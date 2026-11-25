import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import Order from "@/models/Order";

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const orderNumber = request.nextUrl.searchParams.get("orderNumber")?.trim();
  if (!orderNumber || orderNumber.length > 100) {
    return NextResponse.json({ error: "A valid invoice number is required." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const invoice = await Order.findOne({ orderNumber, deletedAt: null })
      .select("orderNumber createdAt customerDetails items subtotal deliveryCharge deliveryCharges total paymentMethod paymentStatus amountReceived balanceAmount status")
      .lean();
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("Sales invoice lookup failed:", error);
    return NextResponse.json({ error: "Unable to load invoice." }, { status: 500 });
  }
}
