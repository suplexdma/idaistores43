import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import InventoryLog from "@/models/InventoryLog";
import Order from "@/models/Order";
import Product, { type Product as ProductSchema } from "@/models/Product";

const posOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(7).max(30),
    notes: z.string().trim().max(1000).optional(),
  }),
  items: z.array(z.object({
    productId: z.string().regex(/^[a-f\d]{24}$/i),
    quantity: z.number().int().min(1).max(100),
    variantName: z.string().trim().min(1).max(100).optional(),
  })).min(1).max(30),
});

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin || admin.accessLevel === "View Only") return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const parsed = posOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const grouped = new Map<string, (typeof parsed.data.items)[number]>();
  for (const item of parsed.data.items) {
    const key = `${item.productId}:${item.variantName ?? ""}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      if (existing.quantity > 100) return NextResponse.json({ error: "An item quantity cannot exceed 100." }, { status: 400 });
    } else {
      grouped.set(key, { ...item });
    }
  }

  try {
    const db = await connectToDatabase();
    const session = await db.startSession();
    let orderNumber = "";
    let orderTotal = 0;
    try {
      await session.withTransaction(async () => {
        const orderItems: Array<{
          productId: Types.ObjectId;
          name: string;
          image?: string;
          variantName?: string;
          unitPrice: number;
          unitCost: number | null;
          quantity: number;
        }> = [];
        const inventoryMovements: Array<{
          productId: Types.ObjectId;
          variantName?: string;
          quantityChanged: number;
          remainingStock: number;
        }> = [];
        for (const item of Array.from(grouped.values())) {
          const product = await Product.findOne({ _id: new Types.ObjectId(item.productId), status: "active" })
            .select("+costPrice")
            .session(session)
            .lean();
          if (!product) throw new PosError("An active product could not be found.", 404);
          let variantName: string | undefined;
          let unitPrice = getSellingPrice(product);
          let remainingStock: number;
          let update;
          if (item.variantName) {
            const variant = product.variants.find((entry: ProductSchema["variants"][number]) => entry.name === item.variantName);
            if (!variant) throw new PosError(`The option for "${product.name}" is unavailable.`, 409);
            const regularPrice = variant.price ?? unitPrice;
            unitPrice = variant.salePrice != null && variant.salePrice < regularPrice ? variant.salePrice : regularPrice;
            update = await Product.updateOne(
              { _id: product._id, variants: { $elemMatch: { name: variant.name, stock: { $gte: item.quantity } } } },
              { $inc: { "variants.$[selected].stock": -item.quantity } },
              { arrayFilters: [{ "selected.name": variant.name, "selected.stock": { $gte: item.quantity } }], session },
            );
            remainingStock = variant.stock - item.quantity;
            variantName = variant.name;
          } else {
            if (product.variants.length) throw new PosError(`Choose an option for "${product.name}".`, 400);
            update = await Product.updateOne(
              { _id: product._id, status: "active", stock: { $gte: item.quantity } },
              { $inc: { stock: -item.quantity } },
              { session },
            );
            remainingStock = product.stock - item.quantity;
          }
          if (update.modifiedCount !== 1) throw new PosError(`Not enough stock for "${product.name}".`, 409);
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

        const subtotal = roundMoney(orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
        orderNumber = await createUniqueOrderNumber(session);
        const [order] = await Order.create(
          [{
            orderNumber,
            customerDetails: {
              name: parsed.data.customer.name,
              phone: parsed.data.customer.phone,
              address: "In-store POS sale",
              city: "In-store",
              notes: parsed.data.customer.notes,
            },
            items: orderItems,
            subtotal,
            deliveryCharge: 0,
            total: subtotal,
            paymentMethod: "COD",
            orderSource: "POS",
            status: "Confirmed",
          }],
          { session },
        );
        await InventoryLog.create(
          inventoryMovements.map((movement) => ({
            ...movement,
            reason: `POS order ${order.orderNumber}`,
            source: "POS" as const,
            referenceId: order._id,
            adminId: new Types.ObjectId(admin.sub),
          })),
          { session },
        );
        orderTotal = order.total;
      });
    } finally {
      await session.endSession();
    }
    return NextResponse.json({ orderNumber, total: orderTotal, message: "POS sale recorded and inventory updated." }, { status: 201 });
  } catch (error) {
    if (error instanceof PosError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("POS order failed:", error);
    return NextResponse.json({ error: "Unable to record POS sale." }, { status: 500 });
  }
}

class PosError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function getSellingPrice(product: { price: number; salePrice?: number | null; compareAtPrice?: number | null }) {
  if (product.compareAtPrice != null && product.compareAtPrice > product.price) return product.price;
  return product.salePrice != null && product.salePrice < product.price ? product.salePrice : product.price;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function createUniqueOrderNumber(session: import("mongoose").ClientSession) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `IDAI-${randomInt(100000, 1000000)}`;
    if (!(await Order.exists({ orderNumber: candidate }).session(session))) return candidate;
  }
  throw new Error("Could not allocate a unique order number.");
}
