import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
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
  active: z.boolean().optional(),
});

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!isValidObjectId(params.id)) return NextResponse.json({ error: "Invalid supplier id." }, { status: 400 });
  const parsed = supplierSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  try {
    await connectToDatabase();
    const supplier = await Supplier.findByIdAndUpdate(params.id, { $set: parsed.data }, { new: true, runValidators: true }).lean();
    if (!supplier) return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
    return NextResponse.json({ supplier });
  } catch (error) {
    console.error("Supplier update failed:", error);
    return NextResponse.json({ error: "Unable to update supplier." }, { status: 500 });
  }
}
