import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import InventoryLog from "@/models/InventoryLog";

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const rawPage = request.nextUrl.searchParams.get("page") ?? "1";
  const rawLimit = request.nextUrl.searchParams.get("limit") ?? "50";
  if (!/^[1-9]\d*$/.test(rawPage) || !/^[1-9]\d*$/.test(rawLimit)) {
    return NextResponse.json({ error: "Page and limit must be positive integers." }, { status: 400 });
  }
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || limit > 100) {
    return NextResponse.json({ error: "Invalid ledger page or limit." }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const [entries, total] = await Promise.all([
      InventoryLog.find()
        .sort({ movementDate: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("productId", "name sku stock variants")
        .populate("adminId", "name email")
        .lean(),
      InventoryLog.countDocuments(),
    ]);
    return NextResponse.json({ entries, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Stock ledger lookup failed:", error);
    return NextResponse.json({ error: "Unable to load stock ledger." }, { status: 500 });
  }
}
