import { randomInt, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";
import {
  AI_NON_FOOD_CATEGORIES,
  containsFoodRelatedText,
  FOOD_RELATED_REGEX,
  isAllowedNonFoodProduct,
} from "@/lib/catalog-policy";
import AIConversation, { type AIConversation as AIConversationSchema } from "@/models/AIConversation";
import Category from "@/models/Category";
import Order from "@/models/Order";
import InventoryLog from "@/models/InventoryLog";
import Product, { type Product as ProductSchema } from "@/models/Product";
import User from "@/models/User";

export const runtime = "nodejs";
const MAX_CHAT_MESSAGE_LENGTH = 10_000;

const requestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
  sessionId: z.string().uuid().optional(),
  imageDataUrl: z
    .string()
    .max(7_000_000)
    .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
    .optional(),
});

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};
type OpenRouterMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content:
    | string
    | null
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};
type OpenRouterResponse = {
  choices?: Array<{ message?: OpenRouterMessage }>;
  error?: { message?: string };
};
type CartAction = {
  productId: string;
  slug: string;
  name: string;
  image?: string;
  unitPrice: number;
  stock: number;
  quantity: number;
  variantName?: string;
};

const systemPrompt = `You are a professional, warm female shopping assistant for IDAI STORES 43, a general merchandise store in Pakistan. Use PKR, concise Markdown, and a polished, helpful tone. Add a few relevant emojis such as 🛍️, ✅, and 📦 without overusing them.
The store sells only non-food merchandise: ${AI_NON_FOOD_CATEGORIES.join(", ")}.
Never recommend, mention as a recommendation, or claim to sell groceries, food, or perishable products. If asked for them, politely decline and suggest one or two of the supported non-food categories.
Never invent product names, prices, availability, or stock. For every product, item, category, price, or availability question, call searchProducts immediately without asking permission. For every matching product returned by searchProducts, call getStock before responding. Call getProductCount for catalog-count questions. If an exact match is not found, suggest only verified alternatives from the live database rather than ending with an apology. Include exact productUrl values from tool results as clickable Markdown links. Only state factual product details present in tool results.
Understand and reply in English or Roman Urdu, matching the customer's language. For image attachments, describe only visible non-food items; do not identify food as a store product or guess prices or availability.
Cash on Delivery is available. The current delivery estimate is PKR 300; final delivery charges vary based on weight, dimensions, and location.
When a customer asks to add an item to their bag, verify it with searchProducts and getStock, then call addToCart with the exact product, option, and requested quantity. Never imply an item was added unless addToCart succeeds.
When the customer only asks to add something to their bag, use addToCart. If they ask you to place an order, do not stop after adding products to the bag: collect the guest customer's name, phone, city, full address, and requested items, then use the order workflow below.
For orders, offer to place them yourself and say exactly: "Main aapka order khud confirm kar sakta hoon." Call quoteOrder to validate every item, current price and stock, then show that exact summary with line totals, delivery and final total before asking for confirmation. The server will show the verified quote to the customer. Call createOrder only after the customer's latest message explicitly confirms that quoted order, and reuse exactly the quoted items and customer details. Guest checkout is allowed; sign-in is not required. Never claim an order exists unless createOrder returns a successful order number. Orders use only live catalog prices and stock.
For order status, a signed-in customer may use the exact order ID and the account that owns it; a guest must provide both the exact order ID and checkout email. Never reveal an order unless ownership or guest email matches. For editing or cancelling/removing an order, ask for the exact order ID and require the customer to be signed in to the account that owns it; an order ID alone is never authorization. Only pending orders can be edited/cancelled. Before cancellation, ask the owner to confirm. Guests must contact support to change or cancel their order.
Keep replies concise. Ask a brief clarifying question when needed.`;

const aiOrderToolParameters = {
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 30,
      items: {
        type: "object",
        properties: {
          productId: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
          quantity: { type: "integer", minimum: 1, maximum: 100 },
          variantName: { type: "string", minLength: 1, maxLength: 100 },
        },
        required: ["productId", "quantity"],
        additionalProperties: false,
      },
    },
    customer: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 2, maxLength: 100 },
        phone: { type: "string", minLength: 7, maxLength: 20 },
        city: { type: "string", minLength: 2, maxLength: 100 },
        area: { type: "string", maxLength: 150 },
        address: { type: "string", minLength: 5, maxLength: 500 },
        notes: { type: "string", maxLength: 1000 },
      },
      required: ["name", "phone", "city", "address"],
      additionalProperties: false,
    },
  },
  required: ["items", "customer"],
  additionalProperties: false,
} as const;

const tools = [
  {
    type: "function",
    function: {
      name: "searchProducts",
      description: "Search the live catalog for non-food merchandise and return verified prices and stock.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", minLength: 1, maxLength: 100 } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getProductCount",
      description: "Count all active, supported non-food products in the live catalog.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getStock",
      description: "Get the current stock and price for one non-food product.",
      parameters: {
        type: "object",
        properties: { productId: { type: "string", pattern: "^[a-fA-F0-9]{24}$" } },
        required: ["productId"],
        additionalProperties: false,
      },
    },
  },
  {
      type: "function",
      function: {
        name: "addToCart",
        description: "Add a verified live product and quantity to the customer's shopping bag after checking current price and stock.",
        parameters: {
          type: "object",
          properties: {
            productId: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
            quantity: { type: "integer", minimum: 1, maximum: 100 },
            variantName: { type: "string", minLength: 1, maxLength: 100 },
          },
          required: ["productId", "quantity"],
          additionalProperties: false,
        },
      },
    },
  {
    type: "function",
    function: {
      name: "getOrderStatus",
      description: "Look up order status using the signed-in owner's account, or a guest order's exact checkout email.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", pattern: "^IDAI-[0-9]{6}$" },
          userEmail: { type: "string", format: "email", maxLength: 254 },
        },
        required: ["orderId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "quoteOrder",
      description: "Validate a proposed guest or signed-in COD order against current prices and stock and return the exact complete total. Always call this before showing an order summary; it does not reserve stock or place the order.",
      parameters: aiOrderToolParameters,
    },
  },
  {
    type: "function",
    function: {
      name: "createOrder",
      description: "Place a confirmed guest or signed-in cash-on-delivery order. Call only after live items, customer name, phone, city, address, item prices, delivery and total have been summarized and the customer explicitly confirms.",
      parameters: aiOrderToolParameters,
    },
  },
  {
    type: "function",
    function: {
      name: "editOrder",
      description: "Update delivery contact details on the authenticated customer's own pending order. Always ask for the exact order ID first.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", pattern: "^IDAI-[0-9]{6}$" },
          customer: {
            type: "object",
            properties: {
              name: { type: "string", minLength: 2, maxLength: 100 },
              phone: { type: "string", minLength: 7, maxLength: 20 },
              city: { type: "string", minLength: 2, maxLength: 100 },
              area: { type: "string", maxLength: 150 },
              address: { type: "string", minLength: 5, maxLength: 500 },
              notes: { type: "string", maxLength: 1000 },
            },
            minProperties: 1,
            additionalProperties: false,
          },
        },
        required: ["orderId", "customer"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteOrder",
      description: "Cancel the authenticated customer's own pending order after asking for its exact order ID and explicit cancellation confirmation.",
      parameters: {
        type: "object",
        properties: { orderId: { type: "string", pattern: "^IDAI-[0-9]{6}$" } },
        required: ["orderId"],
        additionalProperties: false,
      },
    },
  },
] as const;

export async function POST(request: NextRequest) {
  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues : "Invalid chat request." },
      { status: 400 },
    );
  }

  if (containsFoodRelatedText(input.message)) {
    return NextResponse.json({
      sessionId: input.sessionId ?? randomUUID(),
      reply:
        "I am sorry, our store does not carry food or grocery items. I would be happy to help you explore stationery, toys, gifts, kitchenware, beauty, home decor, or another non-food category.",
    });
  }

  const apiKey =
    process.env.OPENROUTER_API_KEY ?? process.env.IDAI_OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The shopping assistant is temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }

  const sessionId = input.sessionId ?? randomUUID();
  try {
    await connectToDatabase();
    const authSession = await getServerSession(authOptions);
    const conversationUserId =
      authSession?.user.id && Types.ObjectId.isValid(authSession.user.id)
        ? new Types.ObjectId(authSession.user.id)
        : undefined;
    const conversation = await AIConversation.findOne({ sessionId })
      .select("messages userId toolCalls")
      .lean();
    if (
      conversation?.userId &&
      conversation.userId.toString() !== authSession?.user.id
    ) {
      return NextResponse.json(
        { error: "This conversation belongs to a different customer account." },
        { status: 403 },
      );
    }
    const previousAssistantMessage = [...(conversation?.messages ?? [])]
      .reverse()
      .find((message: AIConversationSchema["messages"][number]) => message.role === "assistant")
      ?.content ?? "";
    const orderConfirmationPromptWasShown =
      /confirm order/i.test(previousAssistantMessage) && /PKR\s*[\d,]+/i.test(previousAssistantMessage);
    const previousOrderQuote = getMostRecentOrderQuote(conversation?.toolCalls ?? []);
    const history: OpenRouterMessage[] = (conversation?.messages ?? [])
      .filter(
        (message: AIConversationSchema["messages"][number]) =>
          message.role === "user" || message.role === "assistant",
      )
      .slice(-10)
      .map((message: AIConversationSchema["messages"][number]) => ({
        role: message.role,
        content: message.content,
      }));
    const messages: OpenRouterMessage[] = [
      { role: "system", content: systemPrompt },
      ...history,
      {
        role: "user",
        content: input.imageDataUrl
          ? [
              { type: "text", text: input.message },
              { type: "image_url", image_url: { url: input.imageDataUrl } },
            ]
          : input.message,
      },
    ];
    const verifiedToolResults: string[] = [];
    const storedToolCalls: Array<{ name: string; arguments: unknown; result: unknown }> = [];
    const cartActions: CartAction[] = [];
    let reply: string | null = null;

    for (let turn = 0; turn < 8; turn += 1) {
      const completion = await fetchOpenRouter(
        apiKey,
        messages,
        turn === 0 && isProductLookupRequest(input.message)
          ? { type: "function", function: { name: "searchProducts" } }
          : "auto",
      );
      const assistantMessage = completion.choices?.[0]?.message;
      if (!assistantMessage) {
        console.error("OpenRouter returned no assistant message.");
        break;
      }

      const toolCalls = assistantMessage.tool_calls ?? [];
      if (toolCalls.length === 0) {
        reply = extractTextContent(assistantMessage.content)?.trim() || null;
        break;
      }

      messages.push(assistantMessage);
      let processedToolCalls = 0;
      for (const call of toolCalls) {
        if (processedToolCalls >= 5) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: "This request exceeded the tool-call limit." }),
          });
          continue;
        }
        processedToolCalls += 1;
        let args: unknown;
        let result: unknown;
        try {
          args = JSON.parse(call.function.arguments) as unknown;
          result = await executeTool(
            call.function.name,
            args,
            input.message,
            authSession,
            orderConfirmationPromptWasShown,
            previousOrderQuote,
          );
        } catch (error) {
          console.error(`AI tool ${call.function.name} failed:`, error);
          result = { error: "The requested live store data could not be loaded." };
        }
        const serializedResult = JSON.stringify(result);
        verifiedToolResults.push(serializedResult);
        const cartResult = z.object({
          success: z.literal(true),
          addToCart: z.object({
            productId: z.string(),
            slug: z.string(),
            name: z.string(),
            image: z.string().optional(),
            unitPrice: z.number(),
            stock: z.number(),
            quantity: z.number(),
            variantName: z.string().optional(),
          }),
        }).safeParse(result);
        if (call.function.name === "addToCart" && cartResult.success) {
          cartActions.push(cartResult.data.addToCart);
        }
        if (call.function.name === "searchProducts" && isProductLookupRequest(input.message)) {
          const products = (result as { products?: Array<{ id?: string }> } | null)?.products ?? [];
          for (const product of products.slice(0, 1)) {
            if (!product.id) continue;
            let stockResult: unknown;
            try {
              stockResult = await executeTool(
                "getStock",
                { productId: product.id },
                input.message,
                authSession,
                orderConfirmationPromptWasShown,
                previousOrderQuote,
              );
            } catch (error) {
              console.error("AI getStock lookup failed:", error);
              stockResult = { error: "The product's current stock could not be verified." };
            }
            const serializedStock = JSON.stringify(stockResult);
            verifiedToolResults.push(serializedStock);
            storedToolCalls.push({
              name: "getStock",
              arguments: { productId: product.id },
              result: stockResult,
            });
          }
          if (isProductCountRequest(input.message)) {
            const countResult = await executeTool(
              "getProductCount",
              {},
              input.message,
              authSession,
              orderConfirmationPromptWasShown,
              previousOrderQuote,
            );
            const serializedCount = JSON.stringify(countResult);
            verifiedToolResults.push(serializedCount);
            storedToolCalls.push({ name: "getProductCount", arguments: {}, result: countResult });
          }
        }
        const persistedArguments =
          call.function.name === "getOrderStatus" && typeof args === "object" && args !== null
            ? {
                ...args,
                ...(Object.hasOwn(args, "userEmail") ? { userEmail: "[redacted]" } : {}),
              }
            : args ?? {};
        storedToolCalls.push({
          name: call.function.name,
          arguments: persistedArguments,
          result,
        });
        messages.push({ role: "tool", tool_call_id: call.id, content: serializedResult });
      }
    }

    const currentOrderQuote = getMostRecentOrderQuote(storedToolCalls);
    const completedAction = getSuccessfulOrderAction(verifiedToolResults);
    const orderActionError = getLatestOrderActionError(storedToolCalls);
    const confirmingQuotedOrder =
      Boolean(previousOrderQuote) &&
      orderConfirmationPromptWasShown &&
      isExplicitOrderConfirmation(input.message);
    const verifiedCatalogReply = buildVerifiedCatalogReply(input.message, verifiedToolResults);
    if (completedAction) {
      reply = completedAction;
    } else if (orderActionError) {
      const failedAction =
        orderActionError.name === "createOrder"
          ? "Your order has not been placed"
          : "No order changes were made";
      reply = `${failedAction}: ${orderActionError.message}`;
    } else if (confirmingQuotedOrder) {
      reply = "I couldn't verify that the order was placed, so it has not been placed. Please try confirming again.";
    } else if (currentOrderQuote) {
      reply = renderOrderQuote(currentOrderQuote);
    } else if (cartActions.length) {
      reply = renderCartActions(cartActions);
    } else {
      if (!reply) {
        const toolError = getLatestToolError(verifiedToolResults);
        reply = toolError
          ? `I couldn't complete that step: ${toolError}`
          : "I couldn't finish that request just now. Your order has not been placed unless I gave you an order number. Please try again.";
      }
      if (containsFoodRelatedText(reply)) {
        reply =
          "Our store focuses on non-food merchandise. I can help you find stationery, toys, gifts, kitchenware, beauty, home decor, or another supported category.";
      }
      if (verifiedCatalogReply) {
        reply = verifiedCatalogReply;
      } else if (!answerUsesVerifiedFacts(reply, verifiedToolResults)) {
        reply = buildVerifiedFallbackReply(input.message, verifiedToolResults);
      }
    }

    await AIConversation.findOneAndUpdate(
      { sessionId },
      {
        $setOnInsert: { sessionId },
        ...(conversationUserId ? { $set: { userId: conversationUserId } } : {}),
        $push: {
          messages: {
            $each: [
              {
                role: "user",
                content: input.imageDataUrl
                  ? `${input.message} [image attachment]`
                  : input.message,
              },
              { role: "assistant", content: reply },
            ],
            $slice: -16,
          },
          toolCalls: { $each: storedToolCalls, $slice: -40 },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return NextResponse.json({ sessionId, reply, ...(cartActions.length ? { cartActions } : {}) });
  } catch (error) {
    if (error instanceof OpenRouterError) {
      console.error("OpenRouter request failed:", error.message);
      return NextResponse.json(
        { error: "The shopping assistant is temporarily unavailable. Please try again later." },
        { status: 502 },
      );
    }
    console.error("AI shopping chat failed:", error);
    return NextResponse.json(
      { error: "Unable to process your message right now." },
      { status: 500 },
    );
  }
}

class OpenRouterError extends Error {}

function extractTextContent(
  content: OpenRouterMessage["content"],
): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  return content
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");
}

async function fetchOpenRouter(
  apiKey: string,
  messages: OpenRouterMessage[],
  toolChoice: "auto" | { type: "function"; function: { name: string } } = "auto",
): Promise<OpenRouterResponse> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      "X-Title": "IDAI STORES 43",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
      messages,
      tools,
      tool_choice: toolChoice,
      temperature: 0,
      max_tokens: 1200,
    }),
    cache: "no-store",
  });
  const payload = (await response.json()) as OpenRouterResponse;
  if (!response.ok) {
    throw new OpenRouterError(payload.error?.message ?? `HTTP ${response.status}`);
  }
  return payload;
}

async function executeTool(
  name: string,
  rawArguments: unknown,
  latestUserMessage: string,
  authSession: { user?: { id?: string; email?: string | null } } | null,
  orderConfirmationPromptWasShown: boolean,
  orderQuote: unknown,
): Promise<unknown> {
  if (typeof rawArguments !== "object" || rawArguments === null) {
    return { error: "Invalid tool arguments." };
  }
  const args = rawArguments as Record<string, unknown>;

  if (name === "searchProducts") {
    if (typeof args.query !== "string" || args.query.trim().length === 0 || args.query.length > 100) {
      return { error: "A valid product query is required." };
    }
    if (containsFoodRelatedText(args.query)) {
      return { products: [], message: "Only non-food store categories are supported." };
    }
    await connectToDatabase();
    const allowedCategories = await Category.find()
      .select("name slug")
      .lean();
    const categoryIds = allowedCategories
      .filter((category) => !containsFoodRelatedText(category.name, category.slug))
      .map((category) => category._id);
    if (categoryIds.length === 0) return { products: [] };

    const query = args.query.trim();
    const exactProducts = await Product.find({
      status: "active",
      $or: [{ barcode: query }, { sku: query.toUpperCase() }],
    }).select("name brand shortDescription description category price salePrice stock variants slug sku barcode").limit(6).lean();
    const products = exactProducts.length ? exactProducts : await Product.find({
      status: "active",
      $and: [
        {
          $or: [
            { category: { $in: categoryIds } },
            { categories: { $in: categoryIds } },
          ],
        },
      ],
      $or: [
        { name: { $regex: query, $options: "i" } },
        { brand: { $regex: query, $options: "i" } },
        { shortDescription: { $regex: query, $options: "i" } },
      ],
      $nor: [
        { name: { $regex: FOOD_RELATED_REGEX } },
        { brand: { $regex: FOOD_RELATED_REGEX } },
        { shortDescription: { $regex: FOOD_RELATED_REGEX } },
        { description: { $regex: FOOD_RELATED_REGEX } },
      ],
    })
      .select("name brand shortDescription description category price salePrice stock variants slug")
      .limit(6)
      .lean();
    const candidates = products.length ? products : await findProductAlternatives(args.query.trim(), categoryIds);
    const categoryById = new Map(
      allowedCategories.map((category) => [category._id.toString(), category]),
    );

    return {
      products: candidates
        .filter((product) => {
          const category = categoryById.get(product.category.toString());
          return category !== undefined && isAllowedNonFoodProduct({ ...product, category });
        })
        .map((product) => ({
          id: product._id.toString(),
          name: product.name,
          brand: product.brand,
          category: categoryById.get(product.category.toString())?.name ?? "",
          slug: product.slug,
          productUrl: `/product/${encodeURIComponent(product.slug)}`,
          price: product.salePrice != null && product.salePrice < product.price
            ? product.salePrice
            : product.price,
          stock: product.variants.length > 0
            ? product.variants.reduce(
                (sum: number, variant: ProductSchema["variants"][number]) => sum + variant.stock,
                0,
              )
            : product.stock,
        })),
    };
  }

  if (name === "getProductCount") {
    await connectToDatabase();
    const allowedCategories = await Category.find()
      .select("name slug")
      .lean();
    const categoryIds = allowedCategories
      .filter((category) => !containsFoodRelatedText(category.name, category.slug))
      .map((category) => category._id);
    if (categoryIds.length === 0) return { count: 0 };
    const count = await Product.countDocuments({
      status: "active",
      $or: [
        { category: { $in: categoryIds } },
        { categories: { $in: categoryIds } },
      ],
      $nor: [
        { name: { $regex: FOOD_RELATED_REGEX } },
        { brand: { $regex: FOOD_RELATED_REGEX } },
        { shortDescription: { $regex: FOOD_RELATED_REGEX } },
        { description: { $regex: FOOD_RELATED_REGEX } },
      ],
    });
    return { count };
  }

  if (name === "getStock") {
    if (typeof args.productId !== "string" || !isValidObjectId(args.productId)) {
      return { error: "A valid product id is required." };
    }
    await connectToDatabase();
    const product = await Product.findOne({ _id: new Types.ObjectId(args.productId), status: "active" })
      .select("name brand slug shortDescription description category price salePrice stock variants")
      .lean();
    if (!product) {
      return { error: "Product not found in the non-food catalog." };
    }
    const category = await Category.findById(product.category).select("name slug").lean();
    if (!category || !isAllowedNonFoodProduct({ ...product, category })) {
      return { error: "Product not found in the non-food catalog." };
    }
    return {
      productId: product._id.toString(),
      name: product.name,
      productUrl: `/product/${encodeURIComponent(product.slug)}`,
      price: product.salePrice != null && product.salePrice < product.price
        ? product.salePrice
        : product.price,
      stock: product.variants.length > 0
        ? product.variants.map((variant: ProductSchema["variants"][number]) => ({
            option: variant.name,
            quantity: variant.stock,
          }))
        : product.stock,
    };
  }

  if (name === "addToCart") {
    if (
      typeof args.productId !== "string" ||
      !isValidObjectId(args.productId) ||
      typeof args.quantity !== "number" ||
      !Number.isInteger(args.quantity) ||
      args.quantity < 1 ||
      args.quantity > 100 ||
      (args.variantName !== undefined && typeof args.variantName !== "string")
    ) {
      return { error: "A valid product, quantity, and option are required." };
    }
    await connectToDatabase();
    const product = await Product.findOne({ _id: new Types.ObjectId(args.productId), status: "active" })
      .select("name slug price salePrice compareAtPrice stock variants images category")
      .lean();
    if (!product) return { error: "Product not found in the active catalog." };
    const category = await Category.findById(product.category).select("name slug").lean();
    if (!category || !isAllowedNonFoodProduct({ ...product, category })) {
      return { error: "Product not found in the supported catalog." };
    }
    const variant = args.variantName
      ? product.variants.find((entry: ProductSchema["variants"][number]) => entry.name === args.variantName)
      : undefined;
    if (args.variantName && !variant) return { error: "The selected product option is unavailable." };
    if (!args.variantName && product.variants.length) return { error: "Choose an option before adding this product to the bag." };
    const availableStock = variant?.stock ?? product.stock;
    if (availableStock < args.quantity) return { error: `Only ${availableStock} unit(s) are currently available.` };
    const basePrice = getProductSellingPrice(product);
    const regularPrice = variant?.price ?? basePrice;
    const unitPrice = variant?.salePrice != null && variant.salePrice < regularPrice
      ? variant.salePrice
      : regularPrice;
    return {
      success: true,
      addToCart: {
        productId: product._id.toString(),
        slug: product.slug,
        name: product.name,
        image: variant?.image?.url ?? product.images[0]?.url,
        unitPrice,
        stock: availableStock,
        quantity: args.quantity,
        ...(variant ? { variantName: variant.name } : {}),
      },
    };
  }

  if (name === "getOrderStatus") {
    if (typeof args.orderId !== "string" || !/^IDAI-\d{6}$/.test(args.orderId)) {
      return { error: "A valid order ID is required." };
    }
    const customerId = authSession?.user?.id;
    const signedInCustomer = customerId && Types.ObjectId.isValid(customerId);
    const userEmail = typeof args.userEmail === "string" ? args.userEmail.trim().toLowerCase() : "";
    if (!signedInCustomer && !z.string().email().safeParse(userEmail).success) {
      return { error: "Sign in to the account that placed the order, or provide the checkout email for a guest order." };
    }
    await connectToDatabase();
    const order = await Order.findOne({
      orderNumber: args.orderId,
      deletedAt: null,
      ...(signedInCustomer
        ? { userId: new Types.ObjectId(customerId) }
        : { "customerDetails.email": userEmail }),
    })
      .select("orderNumber status createdAt")
      .lean();
    if (!order) {
      return { error: "No order matched that ID and email. Please verify both and try again." };
    }
    return {
      orderId: order.orderNumber,
      status: order.status,
      placedAt: order.createdAt,
    };
  }

  if (name === "quoteOrder") {
    return quoteAIOrder(rawArguments);
  }

  if (name === "createOrder") {
    try {
      return await createAIOrder(
        rawArguments,
        latestUserMessage,
        authSession,
        orderConfirmationPromptWasShown,
        orderQuote,
      );
    } catch (error) {
      if (error instanceof AIOrderValidationError) return { error: error.message };
      throw error;
    }
  }

  if (name === "editOrder") {
    return editAIOrder(rawArguments, latestUserMessage, authSession);
  }

  if (name === "deleteOrder") {
    return deleteAIOrder(rawArguments, latestUserMessage, authSession);
  }

  return { error: "Unsupported store action." };
}

const aiOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().regex(/^[a-f\d]{24}$/i),
    quantity: z.number().int().min(1).max(100),
    variantName: z.string().trim().min(1).max(100).optional(),
  })).min(1).max(30),
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().regex(/^\+?[0-9][0-9\s()-]{6,19}$/),
    city: z.string().trim().min(2).max(100),
    area: z.string().trim().max(150).optional(),
    address: z.string().trim().min(5).max(500),
    notes: z.string().trim().max(1000).optional(),
  }),
});

const orderQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().regex(/^[a-f\d]{24}$/i),
    name: z.string(),
    quantity: z.number().int().min(1),
    variantName: z.string().optional(),
    unitPrice: z.number().finite().min(0),
    stock: z.number().int().min(0),
  })).min(1),
  customer: aiOrderSchema.shape.customer,
  subtotal: z.number().finite().min(0),
  deliveryCharge: z.number().finite().min(0),
  total: z.number().finite().min(0),
});

async function quoteAIOrder(rawArguments: unknown) {
  const parsed = aiOrderSchema.safeParse(rawArguments);
  if (!parsed.success) return { error: "The order details are incomplete or invalid. Ask the customer for their name, phone, city, full address, and items." };

  await connectToDatabase();
  const groupedItems = new Map<string, (typeof parsed.data.items)[number]>();
  for (const item of parsed.data.items) {
    const key = `${item.productId.toLowerCase()}:${item.variantName ?? ""}`;
    const existing = groupedItems.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      if (existing.quantity > 100) return { error: "An item quantity cannot exceed 100." };
    } else {
      groupedItems.set(key, { ...item });
    }
  }

  const items = Array.from(groupedItems.values());
  const productIds = Array.from(new Set(items.map((item) => item.productId)))
    .map((id) => new Types.ObjectId(id));
  const products = await Product.find({ _id: { $in: productIds }, status: "active" }).lean();
  const productsById = new Map(products.map((product) => [product._id.toString(), product]));
  const categories = await Category.find({ _id: { $in: products.map((product) => product.category) } })
    .select("name slug")
    .lean();
  const categoriesById = new Map(categories.map((category) => [category._id.toString(), category]));
  const quotedItems: z.infer<typeof orderQuoteSchema>["items"] = [];

  for (const item of items) {
    const product = productsById.get(item.productId);
    if (!product) return { error: "A selected product is no longer available." };
    const category = categoriesById.get(product.category.toString());
    if (!category || !isAllowedNonFoodProduct({ ...product, category })) {
      return { error: "A selected item is not available in the supported catalog." };
    }

    let unitPrice = getProductSellingPrice(product);
    let stock = product.stock;
    let variantName: string | undefined;
    if (item.variantName) {
      const variant = product.variants.find((entry: ProductSchema["variants"][number]) => entry.name === item.variantName);
      if (!variant) return { error: `The selected option for "${product.name}" is unavailable.` };
      const regularVariantPrice = variant.price ?? unitPrice;
      unitPrice = variant.salePrice != null && variant.salePrice < regularVariantPrice
        ? variant.salePrice
        : regularVariantPrice;
      stock = variant.stock;
      variantName = variant.name;
    } else if (product.variants.length > 0) {
      return { error: `Choose an option for "${product.name}" before confirming.` };
    }
    if (stock < item.quantity) return { error: `Only ${stock} unit${stock === 1 ? "" : "s"} of "${product.name}" are currently available.` };
    quotedItems.push({
      productId: product._id.toString(),
      name: product.name,
      quantity: item.quantity,
      variantName,
      unitPrice,
      stock,
    });
  }

  const subtotal = roundCurrency(quotedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const deliveryCharge = 300;
  return {
    quoteId: randomUUID(),
    items: quotedItems,
    customer: parsed.data.customer,
    subtotal,
    deliveryCharge,
    total: subtotal + deliveryCharge,
    paymentStatus: "Pending",
    amountReceived: 0,
    balanceAmount: subtotal + deliveryCharge,
  };
}

async function createAIOrder(
  rawArguments: unknown,
  latestUserMessage: string,
  authSession: { user?: { id?: string; email?: string | null } } | null,
  orderConfirmationPromptWasShown: boolean,
  orderQuote: unknown,
) {
  if (!orderConfirmationPromptWasShown) {
    return { error: "First present a complete order summary in the chat and ask the customer to reply CONFIRM ORDER." };
  }
  if (!isExplicitOrderConfirmation(latestUserMessage)) {
    return { error: "Show the complete live order summary and ask the customer to reply exactly “CONFIRM ORDER” before placing it." };
  }
  const parsed = aiOrderSchema.safeParse(rawArguments);
  if (!parsed.success) return { error: "The order details are incomplete or invalid. Ask the customer to correct them." };
  const quoted = orderQuoteSchema.safeParse(orderQuote);
  if (!quoted.success) return { error: "First verify the items, customer details, prices and stock with quoteOrder, show the full summary, and ask for confirmation." };
  if (!sameQuotedOrder(parsed.data, quoted.data)) {
    return { error: "The confirmed items or delivery details differ from the quote. Prepare and show a fresh quote before asking the customer to confirm again." };
  }
  const customerId = authSession?.user?.id;
  if (customerId && !Types.ObjectId.isValid(customerId)) {
    return { error: "The signed-in customer account could not be verified. Please try again." };
  }

  const db = await connectToDatabase();
  const session = await db.startSession();
  try {
    const createdOrder = await session.withTransaction(async () => {
    const user = customerId
      ? await User.findById(customerId).select("_id email").session(session).lean()
      : null;
    if (customerId && !user) throw new AIOrderValidationError("The signed-in customer account could not be found. Sign in again before placing this order.");

    const groupedItems = new Map<string, (typeof parsed.data.items)[number]>();
    for (const item of parsed.data.items) {
      const productId = item.productId.toLowerCase();
      const key = `${productId}:${item.variantName ?? ""}`;
      const existing = groupedItems.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        if (existing.quantity > 100) throw new AIOrderValidationError("An item quantity cannot exceed 100.");
      } else {
        groupedItems.set(key, { ...item, productId });
      }
    }

    const productIds = Array.from(new Set(Array.from(groupedItems.values()).map((item) => item.productId)))
      .map((id) => new Types.ObjectId(id));
    const products = await Product.find({ _id: { $in: productIds }, status: "active" })
      .select("+costPrice")
      .session(session)
      .lean();
    const productsById = new Map(products.map((product) => [product._id.toString(), product]));
    const categories = await Category.find({ _id: { $in: products.map((product) => product.category) } })
      .select("name slug")
      .session(session)
      .lean();
    const categoriesById = new Map(categories.map((category) => [category._id.toString(), category]));
    const orderItems: {
      productId: Types.ObjectId;
      name: string;
      image?: string;
      variantName?: string;
      unitPrice: number;
      unitCost: number | null;
      quantity: number;
    }[] = [];
    const inventoryMovements: {
      productId: Types.ObjectId;
      variantName?: string;
      quantityChanged: number;
      remainingStock: number;
    }[] = [];

    for (const item of Array.from(groupedItems.values())) {
      const product = productsById.get(item.productId);
      if (!product) throw new AIOrderValidationError("A selected product is no longer available. Prepare a new order quote.");
      const category = categoriesById.get(product.category.toString());
      if (!category || !isAllowedNonFoodProduct({ ...product, category })) {
        throw new AIOrderValidationError("A selected item is no longer available in the supported catalog. Prepare a new order quote.");
      }

      let unitPrice = getProductSellingPrice(product);
      let variantName: string | undefined;
      let remainingStock: number;
      if (item.variantName) {
        const variant = product.variants.find((entry: ProductSchema["variants"][number]) => entry.name === item.variantName);
        if (!variant) throw new AIOrderValidationError(`The selected option for "${product.name}" is unavailable. Prepare a new order quote.`);
        const variantPrice = variant.price ?? unitPrice;
        unitPrice = variant.salePrice != null && variant.salePrice < variantPrice
          ? variant.salePrice
          : variantPrice;
        const updated = await Product.updateOne(
          {
            _id: product._id,
            status: "active",
            variants: { $elemMatch: { name: variant.name, stock: { $gte: item.quantity } } },
          },
          { $inc: { "variants.$[selected].stock": -item.quantity } },
          {
            arrayFilters: [{ "selected.name": variant.name, "selected.stock": { $gte: item.quantity } }],
            session,
          },
        );
        if (updated.modifiedCount !== 1) throw new AIOrderValidationError(`There is not enough stock for "${product.name}". Prepare a new order quote.`);
        remainingStock = variant.stock - item.quantity;
        variantName = variant.name;
      } else {
        if (product.variants.length) throw new AIOrderValidationError(`Choose an option for "${product.name}" before confirming.`);
        const updated = await Product.updateOne(
          { _id: product._id, status: "active", stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session },
        );
        if (updated.modifiedCount !== 1) throw new AIOrderValidationError(`There is not enough stock for "${product.name}". Prepare a new order quote.`);
        remainingStock = product.stock - item.quantity;
      }
      inventoryMovements.push({
        productId: product._id,
        variantName,
        quantityChanged: -item.quantity,
        remainingStock,
      });
      orderItems.push({
        productId: product._id,
        name: product.name,
        image: product.images[0]?.url,
        variantName,
        unitPrice,
        unitCost: product.costPrice ?? null,
        quantity: item.quantity,
      });
    }

    if (!sameQuotedLines(orderItems, quoted.data.items)) {
      throw new AIOrderValidationError("A product price or option changed after the quote. Prepare and show a fresh order summary before asking for confirmation.");
    }
    const subtotal = roundCurrency(orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
    const deliveryCharge = 300;
    if (subtotal !== quoted.data.subtotal || deliveryCharge !== quoted.data.deliveryCharge || subtotal + deliveryCharge !== quoted.data.total) {
      throw new AIOrderValidationError("The order total changed after the quote. Prepare and show a fresh order summary before asking for confirmation.");
    }
    const orderNumber = await createUniqueOrderNumber(session);
    const [order] = await Order.create(
      [{
        orderNumber,
        customerDetails: {
          ...parsed.data.customer,
          ...(authSession?.user?.email ? { email: authSession.user.email.toLowerCase() } : {}),
        },
        shippingAddress: {
          ...parsed.data.customer,
          ...(authSession?.user?.email ? { email: authSession.user.email.toLowerCase() } : {}),
        },
        ...(user ? { userId: user._id } : {}),
        items: orderItems,
        subtotal,
        deliveryCharge,
        deliveryCharges: 0,
        total: subtotal + deliveryCharge,
        paymentStatus: "Pending",
        amountReceived: 0,
        balanceAmount: subtotal + deliveryCharge,
        paymentMethod: "COD",
        orderSource: "AI Generated",
        status: "Pending",
        statusHistory: [{ status: "Pending", timestamp: new Date() }],
      }],
      { session },
    );
    await InventoryLog.create(
      inventoryMovements.map((movement) => ({
        ...movement,
        reason: `AI order ${order.orderNumber}`,
        source: "AI" as const,
        referenceId: order._id,
      })),
      { session, ordered: true },
    );
    return {
      orderNumber: order.orderNumber,
      total: order.total,
      subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge,
    };
    });
    if (!createdOrder) throw new Error("Order transaction completed without creating an order.");
    return {
      success: true,
      orderId: createdOrder.orderNumber,
      ...(customerId ? { orderUrl: `/account/orders/${encodeURIComponent(createdOrder.orderNumber)}` } : {}),
      price: createdOrder.total,
      subtotal: createdOrder.subtotal,
      deliveryCharge: createdOrder.deliveryCharge,
      status: "Pending",
      source: "AI Generated",
    };
  } finally {
    await session.endSession();
  }
}

const editAIOrderSchema = z.object({
  orderId: z.string().regex(/^IDAI-\d{6}$/),
  customer: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().regex(/^\+?[0-9][0-9\s()-]{6,19}$/).optional(),
    city: z.string().trim().min(2).max(100).optional(),
    area: z.string().trim().max(150).optional(),
    address: z.string().trim().min(5).max(500).optional(),
    notes: z.string().trim().max(1000).optional(),
  }).refine((customer) => Object.keys(customer).length > 0),
});

async function editAIOrder(
  rawArguments: unknown,
  latestUserMessage: string,
  authSession: { user?: { id?: string } } | null,
) {
  const parsed = editAIOrderSchema.safeParse(rawArguments);
  if (!parsed.success) return { error: "Provide an order ID and at least one valid delivery detail to update." };
  const customerId = authSession?.user?.id;
  if (!customerId || !Types.ObjectId.isValid(customerId)) {
    return { error: "For privacy, order changes require signing in to the account that placed the order. Guest customers should contact support." };
  }
  if (!/\b(?:edit|update|change|correct|replace|fix|address|phone|city)\b|badal(?:o|na|(?:\s+kar)?\s+(?:do|dein|den))|theek kar/i.test(latestUserMessage)) {
    return { error: "Ask the customer what they want changed and require the exact order ID in their latest message before editing." };
  }
  if (!latestUserMessage.toUpperCase().includes(parsed.data.orderId)) {
    return { error: "Ask the customer to provide the exact order ID in their latest message before editing." };
  }

  await connectToDatabase();
  const order = await Order.findOneAndUpdate(
    {
      orderNumber: parsed.data.orderId,
      userId: new Types.ObjectId(customerId),
      status: "Pending",
      deletedAt: null,
    },
    {
      $set: Object.fromEntries(
        Object.entries(parsed.data.customer).flatMap(([key, value]) => [
          [`customerDetails.${key}`, value],
          [`shippingAddress.${key}`, value],
        ]),
      ),
    },
    { new: true, runValidators: true },
  ).select("orderNumber status customerDetails.name");
  if (!order) return { error: "No editable pending order was found for this account and order ID." };
  return { success: true, orderId: order.orderNumber, status: order.status, customerName: order.customerDetails.name };
}

async function deleteAIOrder(
  rawArguments: unknown,
  latestUserMessage: string,
  authSession: { user?: { id?: string } } | null,
) {
  const parsed = z.object({ orderId: z.string().regex(/^IDAI-\d{6}$/) }).safeParse(rawArguments);
  if (!parsed.success) return { error: "Ask for the exact order ID before cancelling an order." };
  const customerId = authSession?.user?.id;
  if (!customerId || !Types.ObjectId.isValid(customerId)) {
    return { error: "For privacy, order cancellation requires signing in to the account that placed the order. Guest customers should contact support." };
  }
  const mentionsOrderId = latestUserMessage.toUpperCase().includes(parsed.data.orderId);
  const confirmsCancellation = /\b(?:confirm(?:\s+the)?\s+cancellation|cancel(?:\s+(?:my|this|the))?\s+order|delete(?:\s+(?:my|this|the))?\s+order|remove(?:\s+(?:my|this|the))?\s+order|(?:my|this|the|mera|ye|is)\s+order\s+(?:ko\s+)?(?:cancel|remove|delete)\s+kar\s+(?:do|dein|den)|order\s+(?:ko\s+)?(?:cancel|remove|delete)\s+kar\s+(?:do|dein|den))\b/i.test(latestUserMessage);
  if (!mentionsOrderId || !confirmsCancellation) {
    return { error: "Ask the signed-in customer to confirm cancellation and include the exact order ID in that confirmation." };
  }

  const db = await connectToDatabase();
  const session = await db.startSession();
  try {
    const cancelledOrder = await session.withTransaction(async () => {
      const order = await Order.findOne({
        orderNumber: parsed.data.orderId,
        userId: new Types.ObjectId(customerId),
        status: "Pending",
        deletedAt: null,
      }).session(session);
      if (!order) return null;

      for (const item of order.items) {
        const product = await Product.findById(item.productId)
          .select("stock variants")
          .session(session)
          .lean();
        if (!product) throw new Error(`Could not restore inventory for ${item.name}.`);
        const variant = item.variantName
          ? product.variants.find((entry: ProductSchema["variants"][number]) => entry.name === item.variantName)
          : undefined;
        if (item.variantName && !variant) throw new Error(`Could not restore the selected option for ${item.name}.`);
        const quantityUpdate = item.variantName
          ? { $inc: { "variants.$[selected].stock": item.quantity } }
          : { $inc: { stock: item.quantity } };
        const options = item.variantName
          ? { arrayFilters: [{ "selected.name": item.variantName }], session }
          : { session };
        const restored = await Product.updateOne({ _id: item.productId }, quantityUpdate, options);
        if (restored.matchedCount !== 1 || restored.modifiedCount !== 1) {
          throw new Error(`Could not restore inventory for ${item.name}.`);
        }
        await InventoryLog.create(
          [{
            productId: item.productId,
            variantName: item.variantName,
            quantityChanged: item.quantity,
            remainingStock: (variant?.stock ?? product.stock) + item.quantity,
            reason: `AI order cancellation ${order.orderNumber}`,
            source: "Cancellation",
            referenceId: order._id,
          }],
          { session },
        );
      }

      order.status = "Cancelled";
      order.statusHistory.push({ status: "Cancelled", timestamp: new Date() });
      await order.save({ session });
      return { orderId: order.orderNumber, status: order.status };
    });
    if (!cancelledOrder) return { error: "No pending order was found for this account and order ID." };
    return { success: true, ...cancelledOrder };
  } finally {
    await session.endSession();
  }
}

async function createUniqueOrderNumber(session: import("mongoose").ClientSession) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderNumber = `IDAI-${randomInt(100000, 1000000)}`;
    if (!(await Order.exists({ orderNumber }).session(session))) return orderNumber;
  }
  throw new Error("Could not allocate a unique order number.");
}

class AIOrderValidationError extends Error {}

function isExplicitOrderConfirmation(message: string) {
  const normalizedMessage = message.trim();
  return (
    /^(?:(?:yes|yeah|yep|sure|please|okay|ok|haan|han|ji|bilkul|theek hai)[,\s]+)*(?:confirm(?:\s+(?:my|the|this))?\s+order|place(?:\s+(?:my|the|this))?\s+order|order\s+(?:confirm|place)\s+kar(?:do|dein|den)|(?:confirm|place)\s+kar(?:do|dein|den)(?:\s+order)?)[\s.!]*$/i.test(normalizedMessage) ||
    /^(?:yes(?:\s+please)?|yeah|yep|sure|okay|ok|haan|han|ji|bilkul|theek hai)[.!]*$/i.test(normalizedMessage)
  );
}

function getProductSellingPrice(product: {
  price: number;
  salePrice?: number | null;
  compareAtPrice?: number | null;
}) {
  if (product.compareAtPrice != null && product.compareAtPrice > product.price) return product.price;
  if (product.salePrice != null && product.salePrice < product.price) return product.salePrice;
  return product.price;
}

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function sameQuotedOrder(
  input: z.infer<typeof aiOrderSchema>,
  quote: z.infer<typeof orderQuoteSchema>,
) {
  const normalizeItems = (items: z.infer<typeof aiOrderSchema>["items"]) =>
    Array.from(items.reduce((grouped, item) => {
      const productId = item.productId.toLowerCase();
      const variantName = item.variantName ?? "";
      const key = `${productId}:${variantName}`;
      const existing = grouped.get(key);
      if (existing) existing.quantity += item.quantity;
      else grouped.set(key, { productId, variantName, quantity: item.quantity });
      return grouped;
    }, new Map<string, { productId: string; variantName: string; quantity: number }>())
      .values())
      .sort((left, right) =>
        `${left.productId}:${left.variantName}`.localeCompare(`${right.productId}:${right.variantName}`),
      );
  const normalizeCustomer = (customer: z.infer<typeof aiOrderSchema>["customer"]) => ({
    name: customer.name.trim(),
    phone: customer.phone.trim(),
    city: customer.city.trim(),
    area: customer.area?.trim() ?? "",
    address: customer.address.trim(),
    notes: customer.notes?.trim() ?? "",
  });
  const normalizedQuoteItems = normalizeItems(quote.items);
  return (
    JSON.stringify(normalizeItems(input.items)) === JSON.stringify(normalizedQuoteItems) &&
    JSON.stringify(normalizeCustomer(input.customer)) === JSON.stringify(normalizeCustomer(quote.customer))
  );
}

function sameQuotedLines(
  orderItems: Array<{
    productId: Types.ObjectId;
    variantName?: string;
    unitPrice: number;
    quantity: number;
  }>,
  quotedItems: z.infer<typeof orderQuoteSchema>["items"],
) {
  const normalize = (items: Array<{
    productId: Types.ObjectId | string;
    variantName?: string;
    unitPrice: number;
    quantity: number;
  }>) =>
    items
      .map((item) => ({
        productId: item.productId.toString().toLowerCase(),
        variantName: item.variantName ?? "",
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      }))
      .sort((left, right) =>
        `${left.productId}:${left.variantName}`.localeCompare(`${right.productId}:${right.variantName}`),
      );
  return JSON.stringify(normalize(orderItems)) === JSON.stringify(normalize(quotedItems));
}

function getMostRecentOrderQuote(calls: Array<{ name: string; result?: unknown }>) {
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    if (calls[index].name !== "quoteOrder") continue;
    const parsed = orderQuoteSchema.safeParse(calls[index].result);
    return parsed.success ? parsed.data : null;
  }
  return null;
}

function renderOrderQuote(rawQuote: unknown) {
  const parsed = orderQuoteSchema.safeParse(rawQuote);
  if (!parsed.success) return null;
  const quote = parsed.data;
  const itemLines = quote.items.map((item) => {
    const itemName = item.variantName ? `${item.name} (${item.variantName})` : item.name;
    const lineTotal = roundCurrency(item.unitPrice * item.quantity);
    return `- **${itemName}** × ${item.quantity} — PKR ${item.unitPrice.toLocaleString("en-PK")} each = **PKR ${lineTotal.toLocaleString("en-PK")}**`;
  });
  return [
    `🛍️ **Order summary for ${quote.customer.name}**`,
    ...itemLines,
    "",
    `Subtotal: PKR ${quote.subtotal.toLocaleString("en-PK")}`,
    `Delivery estimate: PKR ${quote.deliveryCharge.toLocaleString("en-PK")} (final charges vary based on weight, dimensions, and location)`,
    `**Total: PKR ${quote.total.toLocaleString("en-PK")}**`,
    "Payment: Cash on Delivery",
    "",
    "To place this order, reply **CONFIRM ORDER**. Main aapka order khud confirm kar sakta hoon. ✅",
  ].join("\n");
}

function renderCartActions(cartActions: CartAction[]) {
  return cartActions.map((item) =>
    `🛍️ Added **${item.name}${item.variantName ? ` (${item.variantName})` : ""}** × ${item.quantity} to your bag. [View product](/product/${encodeURIComponent(item.slug)}) ✅`,
  ).join("\n");
}

function parseToolResults(results: string[]) {
  return results.flatMap((result) => {
    try {
      return [JSON.parse(result) as Record<string, unknown>];
    } catch {
      return [];
    }
  });
}

function getSuccessfulOrderAction(results: string[]) {
  const action = parseToolResults(results).reverse().find(
    (result) => result.success === true && typeof result.orderId === "string",
  );
  if (!action) return null;
  const orderId = String(action.orderId);
  if (action.status === "Cancelled") return `✅ Order **${orderId}** has been cancelled.`;
  if (typeof action.customerName === "string") return `✅ Delivery details for order **${orderId}** have been updated.`;
  return `✅ Your order is confirmed: **${orderId}**. The order number is saved for your records.`;
}

function getLatestOrderActionError(
  calls: Array<{ name: string; result?: unknown }>,
) {
  const action = [...calls].reverse().find((call) =>
    ["createOrder", "editOrder", "deleteOrder"].includes(call.name),
  );
  if (!action || typeof action.result !== "object" || action.result === null) return null;
  const result = action.result as Record<string, unknown>;
  if (result.success === true) return null;
  return {
    name: action.name,
    message: typeof result.error === "string" ? result.error : "Please check the order details and try again.",
  };
}

function getLatestToolError(results: string[]) {
  const error = parseToolResults(results).reverse().find(
    (result) => typeof result.error === "string",
  )?.error;
  return typeof error === "string" ? error.slice(0, 600) : null;
}

function answerUsesVerifiedFacts(answer: string, toolResults: string[]) {
  const verifiedProductCounts = toolResults.flatMap((result) => {
    try {
      return collectNumbersByKey(JSON.parse(result) as unknown, "count");
    } catch {
      return [];
    }
  });
  const productCountClaims = Array.from(
    answer.matchAll(/\b([\d,]+)\s+(?:active\s+)?(?:products?|items?)\b/gi),
    (match) => Number(match[1].replace(/,/g, "")),
  );
  if (productCountClaims.some((count) => !verifiedProductCounts.includes(count))) return false;

  const currencyClaims = answer.match(/(?:PKR|Rs\.?)\s*[\d,]+(?:\.\d{1,2})?/gi) ?? [];
  const isDeliveryClaim = /\b(?:delivery|shipping|deliver)\b/i.test(answer);
  for (const claim of currencyClaims) {
    const amount = Number(claim.replace(/[^\d.]/g, ""));
    const verifiedPrices = toolResults.flatMap((result) => {
      try {
        return collectNumbersByKey(JSON.parse(result) as unknown, "price");
      } catch {
        return [];
      }
    });
    const isVerified =
      (isDeliveryClaim && amount === 300) ||
      verifiedPrices.some((price) => price === amount);
    if (!isVerified) return false;
  }

  const stockValues = toolResults.flatMap((result) => {
    try {
      return collectStockValues(JSON.parse(result) as unknown);
    } catch {
      return [];
    }
  });
  const quantifiedClaims = [
    ...Array.from(
      answer.matchAll(/\b(\d+)\s+(?:units?\s+)?(?:in stock|available)\b/gi),
      (match) => Number(match[1]),
    ),
    ...Array.from(answer.matchAll(/\bstock\s*(?:is|:)\s*(\d+)\b/gi), (match) =>
      Number(match[1]),
    ),
    ...Array.from(answer.matchAll(/\b(?:only\s+)?(\d+)\s+(?:left|remaining)\b/gi), (match) =>
      Number(match[1]),
    ),
  ];
  if (quantifiedClaims.some((quantity) => !stockValues.includes(quantity))) return false;

  if (/\bout of stock\b/i.test(answer)) return stockValues.includes(0);
  if (/\b(?:in stock|currently available|availability)\b/i.test(answer)) {
    return stockValues.some((quantity) => quantity > 0);
  }
  return true;
}

function collectStockValues(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStockValues(entry));
  }
  if (typeof value !== "object" || value === null) return [];

  const record = value as Record<string, unknown>;
  const values: number[] = [];
  for (const [key, nestedValue] of Object.entries(record)) {
    if ((key === "stock" || key === "quantity") && typeof nestedValue === "number") {
      values.push(nestedValue);
    } else {
      values.push(...collectStockValues(nestedValue));
    }
  }
  return values;
}

function collectNumbersByKey(value: unknown, targetKey: string): number[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectNumbersByKey(entry, targetKey));
  }
  if (typeof value !== "object" || value === null) return [];

  const record = value as Record<string, unknown>;
  const values: number[] = [];
  for (const [key, nestedValue] of Object.entries(record)) {
    if (key === targetKey && typeof nestedValue === "number") {
      values.push(nestedValue);
    } else {
      values.push(...collectNumbersByKey(nestedValue, targetKey));
    }
  }
  return values;
}

function buildVerifiedFallbackReply(message: string, results: string[]) {
  const parsedResults = parseToolResults(results);
  const countResult = parsedResults.find((result) => typeof result.count === "number");
  if (countResult && /\b(?:how many|number of|count)\b|kitne|kitni/i.test(message)) {
    return `✅ We currently have **${Number(countResult.count).toLocaleString("en-PK")} active products** in our catalog. 🛍️`;
  }
  const completedAction = getSuccessfulOrderAction(results);
  if (completedAction) return completedAction;
  const stockResult = parsedResults.find((result) => typeof result.productId === "string" && Object.hasOwn(result, "stock"));
  if (stockResult) {
    const stockText = Array.isArray(stockResult.stock)
      ? stockResult.stock.map((entry) => {
          const option = entry as { option?: string; quantity?: number };
          return `- ${String(option.option ?? "Option")}: ${Number(option.quantity ?? 0)} available`;
        }).join("\n")
      : `${Number(stockResult.stock)} available`;
    return `📦 **${String(stockResult.name)}**\n${stockText}\n[View product](${String(stockResult.productUrl)})`;
  }
  const productResult = parsedResults.find((result) => Array.isArray(result.products));
  if (productResult) {
    const products = productResult.products as Array<Record<string, unknown>>;
    if (products.length === 0) return "I couldn't find an exact match in our live catalog. 🛍️ Tell me a category or product name and I'll search again.";
    return `Here are verified options from our catalog:\n${products.slice(0, 4).map((product) => {
      const stock = typeof product.stock === "number"
        ? ` · ${product.stock} in stock`
        : "";
      return `- [${String(product.name)}](${String(product.productUrl)}) · PKR ${Number(product.price).toLocaleString("en-PK")}${stock}`;
    }).join("\n")}${products.length ? "\n\nThese are the closest available options I found. ✅" : ""}`;
  }
  return "I couldn't verify the live store information just now. Please try again in a moment, and I'll check it for you. 🛍️";
}

function isProductLookupRequest(message: string) {
  if (/^(?:hi|hello|hey|thanks|thank you|good morning|good evening)\b/i.test(message.trim())) return false;
  if (/\b(?:order status|track (?:my )?order|delivery charge|shipping|return policy|refund|cancel (?:my )?order|remove (?:my )?order)\b/i.test(message)) return false;
  const mentionsCatalog = /\b(?:product|products|item|items|price|stock|available|availability|buy|shop|find|search|looking for|need|want|show|see|recommend|category|brand|catalog|in stock|have)\b|dikha|dhoond|milay|qeemat|daam|maujood|stock mein/i.test(message);
  return mentionsCatalog || AI_NON_FOOD_CATEGORIES.some((category) =>
    category.split(/\s+/).some((term) => term.length > 3 && new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(message)),
  );
}

function isProductCountRequest(message: string) {
  return /\b(?:how many|number of|count|total number)\b|kitne|kitni/i.test(message);
}

async function findProductAlternatives(query: string, categoryIds: Types.ObjectId[]) {
  const terms = query
    .replace(/\b(?:show|find|search|recommend|available|availability|price|stock|have|product|products|item|items|please|the|for|in|a|an|do|you|have|what|is|are)\b/gi, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 3)
    .slice(0, 4);
  const conditions = terms.flatMap((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = { $regex: escaped, $options: "i" };
    return [{ name: regex }, { brand: regex }, { shortDescription: regex }];
  });
  const matches = conditions.length
    ? await Product.find({
        status: "active",
        category: { $in: categoryIds },
        $or: conditions,
      })
        .select("name brand shortDescription category price salePrice stock variants slug")
        .limit(6)
        .lean()
    : [];
  if (matches.length) return matches;
  return Product.find({ status: "active", category: { $in: categoryIds } })
    .select("name brand shortDescription category price salePrice stock variants slug")
    .sort({ createdAt: -1 })
    .limit(4)
    .lean();
}

function buildVerifiedCatalogReply(message: string, results: string[]) {
  const asksCount = /\b(?:how many|number of|count)\b|kitne|kitni/i.test(message);
  const asksForItems = isProductLookupRequest(message);
  if (!asksCount && !asksForItems) return null;
  const parsedResults = results.flatMap((result) => {
    try {
      return [JSON.parse(result) as Record<string, unknown>];
    } catch {
      return [];
    }
  });
  const hasRelevantResult = parsedResults.some((result) =>
    typeof result.count === "number" ||
    Array.isArray(result.products) ||
    (typeof result.productId === "string" && Object.hasOwn(result, "stock")),
  );
  return hasRelevantResult ? buildVerifiedFallbackReply(message, results) : null;
}
