import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import OnlinePaymentSettings from "@/models/OnlinePaymentSettings";

const settingsSchema = z.object({
  jazzCashNumber: z.string().trim().max(40),
  easyPaisaNumber: z.string().trim().max(40),
  bankName: z.string().trim().max(120),
  accountTitle: z.string().trim().max(120),
  accountNumber: z.string().trim().max(60),
  iban: z.string().trim().max(60),
});

export async function PUT(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  try {
    await connectToDatabase();
    const settings = await OnlinePaymentSettings.findOneAndUpdate(
      { key: "primary" },
      { $set: parsed.data, $setOnInsert: { key: "primary" } },
      { upsert: true, new: true, runValidators: true },
    ).select("jazzCashNumber easyPaisaNumber bankName accountTitle accountNumber iban").lean();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Online payment settings update failed:", error);
    return NextResponse.json({ error: "Unable to save online payment details." }, { status: 500 });
  }
}
