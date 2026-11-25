import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import { deletePrivateImage } from "@/lib/cloudinary";
import OnlinePayment from "@/models/OnlinePayment";

export async function GET() {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  try {
    await connectToDatabase();
    const payments = await OnlinePayment.find({ deletedAt: null })
      .select("orderNumber customerName phone privateMessage screenshotPublicId screenshotFormat createdAt")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    return NextResponse.json({
      payments: payments.map((payment) => ({
        id: payment._id.toString(),
        orderNumber: payment.orderNumber,
        customerName: payment.customerName,
        phone: payment.phone,
        privateMessage: payment.privateMessage,
        screenshotUrl: `/api/admin/online-payments/screenshot?id=${payment._id.toString()}`,
        screenshotFormat: payment.screenshotFormat,
        createdAt: payment.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Online payment log lookup failed:", error);
    return NextResponse.json({ error: "Unable to load online payment records." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[a-f\d]{24}$/i.test(id)) {
    return NextResponse.json({ error: "A valid payment record id is required." }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const payment = await OnlinePayment.findOne({ _id: id, deletedAt: null });
    if (!payment) return NextResponse.json({ error: "Online payment record not found." }, { status: 404 });
    await deletePrivateImage(payment.screenshotPublicId);
    await OnlinePayment.deleteOne({ _id: payment._id });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Online payment record deletion failed:", error);
    return NextResponse.json({ error: "Unable to delete online payment record." }, { status: 500 });
  }
}
