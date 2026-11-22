import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth-options";
import { connectToDatabase } from "@/lib/db";
import Order, { type Order as OrderSchema } from "@/models/Order";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const orders = await Order.find({ userId: new Types.ObjectId(session.user.id), deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("orderNumber createdAt status total deliveryCharges items")
      .lean();

    return NextResponse.json({
      orders: orders.map((order) => ({
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        status: order.status,
        total: order.total + (order.deliveryCharges ?? 0),
        itemCount: order.items.reduce(
          (count: number, item: OrderSchema["items"][number]) => count + item.quantity,
          0,
        ),
      })),
    });
  } catch (error) {
    console.error("Customer order history lookup failed:", error);
    return NextResponse.json({ error: "Unable to load your order history." }, { status: 500 });
  }
}
