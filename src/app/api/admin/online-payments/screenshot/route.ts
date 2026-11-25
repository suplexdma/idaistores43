import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import { getPrivateImageUrl } from "@/lib/cloudinary";
import OnlinePayment from "@/models/OnlinePayment";

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[a-f\d]{24}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid payment record id." }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const payment = await OnlinePayment.findOne({ _id: id, deletedAt: null })
      .select("screenshotPublicId")
      .lean();
    if (!payment) return NextResponse.json({ error: "Payment screenshot not found." }, { status: 404 });
    return NextResponse.redirect(getPrivateImageUrl(payment.screenshotPublicId));
  } catch (error) {
    console.error("Online payment screenshot lookup failed:", error);
    return NextResponse.json({ error: "Unable to open payment screenshot." }, { status: 500 });
  }
}
