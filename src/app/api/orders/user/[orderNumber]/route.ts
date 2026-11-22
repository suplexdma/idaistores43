import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth-options";
import { connectToDatabase } from "@/lib/db";
import Order, { type Order as OrderSchema } from "@/models/Order";

type RouteContext = { params: { orderNumber: string } };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user.id || !Types.ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!/^IDAI-\d{6}$/.test(params.orderNumber)) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  try {
    await connectToDatabase();
    const order = await Order.findOne({
      orderNumber: params.orderNumber,
      userId: new Types.ObjectId(session.user.id),
      deletedAt: null,
    }).lean();
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    return NextResponse.json({
      order: {
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        status: order.status,
        paymentMethod: order.paymentMethod,
        customerDetails: {
          ...order.customerDetails,
          ...(order.shippingAddress ?? {}),
        },
        items: order.items.map((item: OrderSchema["items"][number]) => ({
          name: item.name,
          image: item.image,
          variantName: item.variantName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
        subtotal: order.subtotal,
        deliveryCharge: order.deliveryCharge,
        deliveryCharges: order.deliveryCharges ?? 0,
        total: order.total,
        deliveryCompany: order.deliveryCompany ?? "",
        trackingNumber: order.trackingNumber ?? "",
        deliveryDate: order.deliveryDate,
        estimatedArrival: order.estimatedArrival,
        paymentStatus: order.paymentStatus ?? "Pending",
      },
    });
  } catch (error) {
    console.error("Customer order detail lookup failed:", error);
    return NextResponse.json({ error: "Unable to load this order." }, { status: 500 });
  }
}
