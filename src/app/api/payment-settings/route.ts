import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import OnlinePaymentSettings from "@/models/OnlinePaymentSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    const settings = await OnlinePaymentSettings.findOne({ key: "primary" })
      .select("jazzCashNumber easyPaisaNumber bankName accountTitle accountNumber iban")
      .lean();
    return NextResponse.json({
      settings: settings ?? {
        jazzCashNumber: "",
        easyPaisaNumber: "",
        bankName: "",
        accountTitle: "",
        accountNumber: "",
        iban: "",
      },
    });
  } catch (error) {
    console.error("Online payment details lookup failed:", error);
    return NextResponse.json({ error: "Unable to load payment details." }, { status: 500 });
  }
}
