import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import Supplier from "@/models/Supplier";

const supplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(30).optional().default(""),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
});

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  try {
    await connectToDatabase();
    const suppliers = await Supplier.find().sort({ name: 1 }).lean();
    return NextResponse.json({ suppliers });
  } catch (error) {
    console.error("Supplier listing failed:", error);
    return NextResponse.json({ error: "Unable to load suppliers." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const parsed = supplierSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  try {
    await connectToDatabase();
    const supplier = await Supplier.create(parsed.data);
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    console.error("Supplier creation failed:", error);
    return NextResponse.json({ error: "Unable to create supplier." }, { status: 500 });
  }
}
