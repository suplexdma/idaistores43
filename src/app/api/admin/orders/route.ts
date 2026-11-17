import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { getAdminSession, requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import Order, { type Order as OrderSchema } from "@/models/Order";
import InventoryLog from "@/models/InventoryLog";
import Product, { type Product as ProductSchema } from "@/models/Product";
import TrashEntry from "@/models/TrashEntry";

const statuses = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled", "Returned"] as const;
const sources = ["Website", "WhatsApp", "AI", "AI Generated", "POS"] as const;
const querySchema = z.object({
  source: z.enum(sources).optional(),
  status: z.enum(statuses).optional(),
});
const updateSchema = z
  .object({
    status: z.enum(statuses).optional(),
    internalNotes: z.string().trim().max(2000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsed = querySchema.safeParse({
    source: request.nextUrl.searchParams.get("source") || undefined,
    status: request.nextUrl.searchParams.get("status") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order filters." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const filter: Record<string, unknown> = { deletedAt: null };
    if (parsed.data.source === "AI Generated") {
      filter.orderSource = { $in: ["AI", "AI Generated"] };
    } else if (parsed.data.source) {
      filter.orderSource = parsed.data.source;
    }
    if (parsed.data.status) filter.status = parsed.data.status;
    const orders = await Order.find(filter)
      .select("orderNumber customerDetails.name customerDetails.phone customerDetails.email customerDetails.notes items subtotal deliveryCharge total paymentMethod status orderSource internalNotes createdAt returnedAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      orders: orders.map((order) => ({
        id: order._id.toString(),
        orderNumber: order.orderNumber,
        customer: order.customerDetails.name,
        phone: order.customerDetails.phone,
        email: order.customerDetails.email ?? "",
        customerNotes: order.customerDetails.notes ?? "",
        items: order.items.map((item: OrderSchema["items"][number]) => ({
          name: item.name,
          quantity: item.quantity,
          variantName: item.variantName ?? "",
        })),
        itemCount: order.items.reduce(
          (sum: number, item: OrderSchema["items"][number]) => sum + item.quantity,
          0,
        ),
        total: order.total,
        status: order.status,
        returnedAt: order.returnedAt?.toISOString() ?? null,
        source: order.orderSource,
        internalNotes: order.internalNotes ?? "",
        createdAt: order.createdAt,
      })),
    });
  } catch (error) {
    console.error("Admin order listing failed:", error);
    return NextResponse.json({ error: "Unable to load orders." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[a-f\d]{24}$/i.test(id)) {
    return NextResponse.json({ error: "A valid order id is required." }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const order = await Order.findOne({ _id: id, deletedAt: null }).select("+internalNotes");
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const session = await getAdminSession();
    await TrashEntry.create({
      entityType: "order",
      originalId: order._id,
      title: order.orderNumber,
      payload: order.toObject(),
      deletedBy: session?.sub,
    });
    order.deletedAt = new Date();
    await order.save();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Admin order delete failed:", error);
    return NextResponse.json({ error: "Unable to move order to Trash." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const orderId = request.nextUrl.searchParams.get("id");
  if (!orderId || !/^[a-f\d]{24}$/i.test(orderId)) {
    return NextResponse.json({ error: "A valid order id is required." }, { status: 400 });
  }

  let input: z.infer<typeof updateSchema>;
  try {
    input = updateSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? error.issues : "Invalid update request." },
      { status: 400 },
    );
  }

  try {
    await connectToDatabase();
    const currentOrder = await Order.findOne({ _id: orderId, deletedAt: null }).select("status returnedAt").lean();
    if (!currentOrder) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (
      input.status === "Returned" &&
      currentOrder.status !== "Returned" &&
      !["Confirmed", "Shipped", "Delivered"].includes(currentOrder.status)
    ) {
      return NextResponse.json(
        { error: "Only confirmed, shipped, or delivered orders can be returned. Cancel pending orders instead." },
        { status: 409 },
      );
    }

    const cancelPendingOrder = async (orderId: string, internalNotes?: string) => {
      const db = await connectToDatabase();
      const session = await db.startSession();
      const admin = await getAdminSession();
      let result: { id: string; orderNumber: string; status: string; internalNotes: string } | null = null;
      try {
        await session.withTransaction(async () => {
          const order = await Order.findOne({ _id: orderId, deletedAt: null, status: "Pending" }).session(session);
          if (!order) return;
          for (const item of order.items) {
            const product = await Product.findById(item.productId).select("stock variants").session(session).lean();
            if (!product) throw new Error(`Could not restore inventory for ${item.name}.`);
            const variant = item.variantName
              ? product.variants.find((entry: ProductSchema["variants"][number]) => entry.name === item.variantName)
              : undefined;
            if (item.variantName && !variant) throw new Error(`Could not restore the selected option for ${item.name}.`);
            const update = item.variantName
              ? await Product.updateOne(
                  { _id: item.productId, variants: { $elemMatch: { name: item.variantName } } },
                  { $inc: { "variants.$[selected].stock": item.quantity } },
                  { arrayFilters: [{ "selected.name": item.variantName }], session },
                )
              : await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } }, { session });
            if (update.modifiedCount !== 1) throw new Error(`Could not restore inventory for ${item.name}.`);
            await InventoryLog.create(
              [{
                productId: item.productId,
                variantName: item.variantName,
                quantityChanged: item.quantity,
                remainingStock: (variant?.stock ?? product.stock) + item.quantity,
                reason: `Admin cancellation ${order.orderNumber}`,
                source: "Cancellation",
                referenceId: order._id,
                ...(admin?.sub ? { adminId: new Types.ObjectId(admin.sub) } : {}),
              }],
              { session },
            );
          }
          order.status = "Cancelled";
          if (internalNotes !== undefined) order.internalNotes = internalNotes;
          await order.save({ session });
          result = {
            id: order._id.toString(),
            orderNumber: order.orderNumber,
            status: order.status,
            internalNotes: order.internalNotes ?? "",
          };
        });
      } finally {
        await session.endSession();
      }
      return result;
    };

    if (input.status === "Cancelled" && currentOrder.status === "Pending") {
      const cancelled = await cancelPendingOrder(orderId, input.internalNotes);
      if (!cancelled) return NextResponse.json({ error: "Order is no longer pending." }, { status: 409 });
      return NextResponse.json({ order: cancelled });
    }
    if (input.status === "Cancelled" && currentOrder.status !== "Cancelled") {
      return NextResponse.json({ error: "Only pending orders can be cancelled." }, { status: 409 });
    }

    const update: Record<string, unknown> = {};
    if (input.status) update.status = input.status;
    if (input.internalNotes !== undefined) update.internalNotes = input.internalNotes;
    if (input.status === "Returned") {
      update.returnedAt = currentOrder.status === "Returned" && currentOrder.returnedAt
        ? currentOrder.returnedAt
        : new Date();
    }

    const order = await Order.findOneAndUpdate(
      { _id: orderId, deletedAt: null },
      {
        $set: update,
        ...(input.status && input.status !== "Returned" && currentOrder.status === "Returned"
          ? { $unset: { returnedAt: "" } }
          : {}),
      },
      { new: true, runValidators: true },
    )
      .select("orderNumber status internalNotes returnedAt")
      .lean();
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    return NextResponse.json({
      order: {
        id: order._id.toString(),
        orderNumber: order.orderNumber,
        status: order.status,
        internalNotes: order.internalNotes ?? "",
        returnedAt: order.returnedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Admin order update failed:", error);
    return NextResponse.json({ error: "Unable to update order." }, { status: 500 });
  }
}
