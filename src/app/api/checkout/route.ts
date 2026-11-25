import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { isAllowedNonFoodProduct } from "@/lib/catalog-policy";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
import { connectToDatabase } from "@/lib/db";
import Category from "@/models/Category";
import Order from "@/models/Order";
import InventoryLog from "@/models/InventoryLog";
import Product, { type Product as ProductSchema } from "@/models/Product";
import User from "@/models/User";
import OnlinePayment from "@/models/OnlinePayment";
import { deletePrivateImage, uploadPrivateImage } from "@/lib/cloudinary";

const checkoutSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().regex(/^\+?[0-9][0-9\s()-]{6,19}$/),
    email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
    city: z.string().trim().min(2).max(100),
    area: z.string().trim().max(150).optional(),
    address: z.string().trim().min(5).max(500),
    notes: z.string().trim().max(1000).optional(),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().regex(/^[a-f\d]{24}$/i),
        quantity: z.number().int().min(1).max(100),
        variantName: z.string().trim().min(1).max(100).optional(),
      }),
    )
    .min(1)
    .max(50),
  source: z.enum(["Website", "WhatsApp"]),
  paymentMethod: z.enum(["COD", "Online"]),
  paymentScreenshot: z.string().max(7_000_000).optional(),
  privateMessage: z.string().trim().max(1000).optional(),
}).superRefine((input, context) => {
  if (input.paymentMethod === "Online" && !input.paymentScreenshot) {
    context.addIssue({ code: "custom", path: ["paymentScreenshot"], message: "Upload your payment screenshot to continue." });
  }
});

const DELIVERY_CHARGE = 300;

type CheckoutInput = z.infer<typeof checkoutSchema>;
type OrderLineInput = CheckoutInput["items"][number];

class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

class StockConflictError extends CheckoutError {
  constructor(productName: string) {
    super(`Insufficient stock for "${productName}". Please update your bag.`, 409);
    this.name = "StockConflictError";
  }
}

export async function POST(request: NextRequest) {
  let input: CheckoutInput;
  try {
    input = checkoutSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues : "Invalid checkout request." },
      { status: 400 },
    );
  }

  let groupedItems: OrderLineInput[];
  try {
    groupedItems = groupCartItems(input.items);
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Invalid checkout items." }, { status: 400 });
  }
  if (groupedItems.length > 30) {
    return NextResponse.json({ error: "An order can contain up to 30 unique item options." }, { status: 400 });
  }

  let uploadedScreenshot: Awaited<ReturnType<typeof uploadPrivateImage>> | null = null;
  let orderCommitted = false;
  try {
    if (input.paymentMethod === "Online" && input.paymentScreenshot) {
      const validatedImage = decodePaymentScreenshot(input.paymentScreenshot);
      try {
        uploadedScreenshot = await uploadPrivateImage(validatedImage.buffer);
      } catch (error) {
        console.error("Online payment screenshot upload failed:", error);
        throw new CheckoutError("Unable to securely save the payment screenshot. Please try again or choose Cash on Delivery.", 503);
      }
    }

    const db = await connectToDatabase();
    const authSession = await getServerSession(authOptions);
    const userId =
      authSession?.user.id && Types.ObjectId.isValid(authSession.user.id)
        ? new Types.ObjectId(authSession.user.id)
        : undefined;
    const session = await db.startSession();

    let createdOrder: {
      orderNumber: string;
      subtotal: number;
      deliveryCharge: number;
      total: number;
      items: { name: string; quantity: number; unitPrice: number; variantName?: string }[];
    } | null = null;

    try {
      await session.withTransaction(
        async () => {
          if (userId && !(await User.exists({ _id: userId }).session(session))) {
            throw new CheckoutError("Your customer account could not be found. Sign in again.", 401);
          }

          const productIds = Array.from(
            new Set(groupedItems.map((item) => item.productId)),
          ).map((id) => new Types.ObjectId(id));
          const products = await Product.find({
            _id: { $in: productIds },
            status: "active",
          })
            .select("+costPrice")
            .session(session)
            .lean();
          const productsById = new Map(products.map((product) => [product._id.toString(), product]));
          const productCategories = await Category.find({
            _id: { $in: products.map((product) => product.category) },
          })
            .select("name slug")
            .session(session)
            .lean();
          const categoriesById = new Map(
            productCategories.map((category) => [category._id.toString(), category]),
          );

          const snapshots: {
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

          for (const item of groupedItems) {
            const product = productsById.get(item.productId);
            if (!product) {
              throw new CheckoutError("One or more products are unavailable. Please refresh your bag.", 409);
            }
            const category = categoriesById.get(product.category.toString());
            if (!category || !isAllowedNonFoodProduct({ ...product, category })) {
              throw new CheckoutError(`"${product.name}" is not available in this store catalog.`, 409);
            }

            let unitPrice =
              product.compareAtPrice != null && product.compareAtPrice > product.price
                ? product.price
                : product.salePrice != null && product.salePrice < product.price
                  ? product.salePrice
                  : product.price;
            const hasVariants = product.variants.length > 0;
            let variantName: string | undefined;
            let remainingStock: number;

            if (item.variantName) {
              const variant = product.variants.find(
                (entry: ProductSchema["variants"][number]) =>
                  entry.name === item.variantName,
              );
              if (!variant) {
                throw new CheckoutError(`The selected option for "${product.name}" is no longer available.`, 409);
              }
              const variantPrice = variant.price ?? unitPrice;
              unitPrice =
                variant.salePrice != null && variant.salePrice < variantPrice
                  ? variant.salePrice
                  : variantPrice;
              variantName = variant.name;

              const stockUpdate = await Product.updateOne(
                {
                  _id: product._id,
                  status: "active",
                  variants: {
                    $elemMatch: { name: variant.name, stock: { $gte: item.quantity } },
                  },
                },
                { $inc: { "variants.$[selected].stock": -item.quantity } },
                {
                  arrayFilters: [
                    { "selected.name": variant.name, "selected.stock": { $gte: item.quantity } },
                  ],
                  session,
                },
              );
              if (stockUpdate.modifiedCount !== 1) {
                throw new StockConflictError(product.name);
              }
              remainingStock = variant.stock - item.quantity;
            } else {
              if (hasVariants) {
                throw new CheckoutError(`Choose an option for "${product.name}" before ordering.`, 400);
              }
              const stockUpdate = await Product.updateOne(
                { _id: product._id, status: "active", stock: { $gte: item.quantity } },
                { $inc: { stock: -item.quantity } },
                { session },
              );
              if (stockUpdate.modifiedCount !== 1) {
                throw new StockConflictError(product.name);
              }
              remainingStock = product.stock - item.quantity;
            }

            inventoryMovements.push({
              productId: product._id,
              variantName,
              quantityChanged: -item.quantity,
              remainingStock,
            });
            snapshots.push({
              productId: product._id,
              name: product.name,
              image: product.images[0]?.url,
              variantName,
              unitPrice,
              unitCost: product.costPrice ?? null,
              quantity: item.quantity,
            });
          }

          const subtotal = roundMoney(
            snapshots.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
          );
          const deliveryCharge = DELIVERY_CHARGE;
          const total = roundMoney(subtotal + deliveryCharge);
          const orderNumber = await createUniqueOrderNumber(session);

          const customerEmail =
            input.customer.email?.trim().toLowerCase() || authSession?.user.email || undefined;
          const [order] = await Order.create(
            [
              {
                orderNumber,
                customerDetails: {
                  name: input.customer.name,
                  phone: input.customer.phone,
                  email: customerEmail,
                  address: input.customer.address,
                  area: input.customer.area,
                  city: input.customer.city,
                  notes: input.customer.notes,
                },
                shippingAddress: {
                  name: input.customer.name,
                  phone: input.customer.phone,
                  email: customerEmail,
                  address: input.customer.address,
                  area: input.customer.area,
                  city: input.customer.city,
                },
                userId,
                items: snapshots,
                subtotal,
                deliveryCharge,
                deliveryCharges: 0,
                total,
                paymentStatus: "Pending",
                amountReceived: 0,
                balanceAmount: total,
                paymentMethod: input.paymentMethod,
                orderSource: input.source,
                status: "Pending",
                statusHistory: [{ status: "Pending", timestamp: new Date() }],
              },
            ],
            { session },
          );
          if (input.paymentMethod === "Online" && uploadedScreenshot) {
            await OnlinePayment.create(
              [{
                orderId: order._id,
                orderNumber: order.orderNumber,
                customerName: input.customer.name,
                phone: input.customer.phone,
                privateMessage: input.privateMessage ?? "",
                screenshotPublicId: uploadedScreenshot.publicId,
                screenshotFormat: uploadedScreenshot.format,
              }],
              { session },
            );
          }
          await InventoryLog.create(
            inventoryMovements.map((movement) => ({
              ...movement,
              reason: `Website order ${order.orderNumber}`,
              source: "Website" as const,
              referenceId: order._id,
            })),
            { session, ordered: true },
          );

          if (userId) {
            await User.updateOne(
              {
                _id: userId,
                addresses: {
                  $not: {
                    $elemMatch: {
                      phone: input.customer.phone,
                      address: input.customer.address,
                      area: input.customer.area,
                      city: input.customer.city,
                    },
                  },
                },
              },
              {
                $push: {
                  addresses: {
                    name: input.customer.name,
                    phone: input.customer.phone,
                    address: input.customer.address,
                    area: input.customer.area,
                    city: input.customer.city,
                    isDefault: false,
                  },
                },
              },
              { session },
            );
          }

          createdOrder = {
            orderNumber: order.orderNumber,
            subtotal: order.subtotal,
            deliveryCharge: order.deliveryCharge,
            total: order.total,
            items: snapshots.map(({ name, quantity, unitPrice, variantName: lineVariant }) => ({
              name,
              quantity,
              unitPrice,
              ...(lineVariant ? { variantName: lineVariant } : {}),
            })),
          };
        },
        {
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
          readPreference: "primary",
        },
      );
    } finally {
      await session.endSession();
    }

    const completedOrder = requireCreatedOrder(createdOrder);
    orderCommitted = true;

    const responseBody: {
      orderNumber: string;
      message: string;
      source: "Website" | "WhatsApp";
      whatsappUrl?: string;
    } = {
      orderNumber: completedOrder.orderNumber,
      message: "Your order has been placed successfully.",
      source: input.source,
    };

    if (input.paymentMethod === "Online") {
      const message = [
        `Hello IDAI STORES 43, I have submitted online payment for order ${completedOrder.orderNumber}.`,
        "I will attach my payment screenshot here on WhatsApp for verification.",
        `Order amount: PKR ${completedOrder.total.toLocaleString("en-PK")}`,
      ].join("\n");
      const whatsappNumber = normalizeWhatsAppNumber("03278505273");
      responseBody.whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      responseBody.message = "Your order was saved. Continue to WhatsApp and attach the payment screenshot.";
    } else if (input.source === "WhatsApp") {
      const message = [
        `Hello IDAI STORES 43, I have placed order ${completedOrder.orderNumber}.`,
        "Items:",
        ...completedOrder.items.map(
          (item) =>
            `- ${item.name}${item.variantName ? ` (${item.variantName})` : ""} x${item.quantity} - PKR ${(item.unitPrice * item.quantity).toLocaleString("en-PK")}`,
        ),
        `Subtotal: PKR ${completedOrder.subtotal.toLocaleString("en-PK")}`,
        `Delivery estimate: PKR ${completedOrder.deliveryCharge.toLocaleString("en-PK")} (final charges vary based on weight, dimensions, and location)`,
        `Total: PKR ${completedOrder.total.toLocaleString("en-PK")}`,
      ].join("\n");
      const whatsappNumber = normalizeWhatsAppNumber(
        process.env.WHATSAPP_NUMBER ??
          process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ??
          "03278505273",
      );
      responseBody.whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    if (uploadedScreenshot && !orderCommitted) {
      try {
        await deletePrivateImage(uploadedScreenshot.publicId);
      } catch (cleanupError) {
        console.error("Unable to remove unused online payment screenshot:", cleanupError);
      }
    }
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isTransactionUnavailable(error)) {
      console.error("Checkout requires a MongoDB replica set:", error);
      return NextResponse.json(
        { error: "Order placement requires MongoDB transactions. Configure your database as a replica set and try again." },
        { status: 503 },
      );
    }
    console.error("Order placement failed:", error);
    return NextResponse.json({ error: "Unable to place your order. Please try again." }, { status: 500 });
  }
}

function decodePaymentScreenshot(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new CheckoutError("Payment screenshot must be a JPEG, PNG, or WebP image.", 400);
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
    throw new CheckoutError("Payment screenshot must be 5 MB or smaller.", 400);
  }
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (!(isPng && match[1] === "png") && !(isJpeg && match[1] === "jpeg") && !(isWebp && match[1] === "webp")) {
    throw new CheckoutError("The uploaded file does not match its image format.", 400);
  }
  return { buffer, format: match[1] };
}

function groupCartItems(items: OrderLineInput[]) {
  const grouped = new Map<string, OrderLineInput>();
  for (const item of items) {
    const productId = item.productId.toLowerCase();
    const key = `${productId}:${item.variantName ?? ""}`;
    const existing = grouped.get(key);
    if (existing) {
      const quantity = existing.quantity + item.quantity;
      if (quantity > 100) {
        throw new CheckoutError("The quantity for an item cannot exceed 100.", 400);
      }
      existing.quantity = quantity;
    } else {
      grouped.set(key, { ...item, productId });
    }
  }
  return Array.from(grouped.values());
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function requireCreatedOrder(
  order: {
    orderNumber: string;
    subtotal: number;
    deliveryCharge: number;
    total: number;
    items: { name: string; quantity: number; unitPrice: number; variantName?: string }[];
  } | null,
) {
  if (!order) {
    throw new Error("Order transaction completed without creating an order.");
  }
  return order;
}

async function createUniqueOrderNumber(session: mongoose.ClientSession) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderNumber = `IDAI-${randomInt(100000, 1000000)}`;
    if (!(await Order.exists({ orderNumber }).session(session))) {
      return orderNumber;
    }
  }
  throw new Error("Could not allocate a unique order number.");
}

function isTransactionUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const mongoError = error as Error & { code?: number };
  return (
    mongoError.code === 20 ||
    mongoError.code === 251 ||
    /transaction numbers are only allowed|replica set|transactions are not supported/i.test(
      mongoError.message,
    )
  );
}
