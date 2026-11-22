import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAdmin, getAdminSession } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import AuditLog from "@/models/AuditLog";
import ExternalProductMapping from "@/models/ExternalProductMapping";
import Order from "@/models/Order";
import Reconciliation from "@/models/Reconciliation";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  await connectToDatabase();
  const records = await Reconciliation.find().sort({ createdAt: -1 }).limit(100).lean();
  return NextResponse.json({ records });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const form = await request.formData();
  const startDate = String(form.get("startDate") ?? "");
  const endDate = String(form.get("endDate") ?? "");
  const file = form.get("file");
  if (!startDate || !endDate) return NextResponse.json({ error: "Start and end dates are required." }, { status: 400 });
  const start = new Date(`${startDate}T00:00:00+05:00`);
  const end = new Date(`${endDate}T23:59:59.999+05:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return NextResponse.json({ error: "Invalid reconciliation period." }, { status: 400 });

  await connectToDatabase();
  let paperRows: Record<string, unknown>[] = [];
  let fileName = "";
  if (file instanceof File) {
    fileName = file.name;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (/\.xlsx?$/i.test(file.name)) {
      try {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        paperRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      } catch {
        return NextResponse.json({ error: "XLSX support is unavailable. Upload a CSV file." }, { status: 400 });
      }
    } else {
      const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
      paperRows = parseCsv(text);
    }
  }

  const [orders, mappings] = await Promise.all([
    Order.find({ deletedAt: null, createdAt: { $gte: start, $lte: end } }).select("items status").lean(),
    ExternalProductMapping.find().lean(),
  ]);
  const mappingBySku = new Map<string, string>();
  const mappingByBarcode = new Map<string, string>();
  mappings.forEach((mapping) => {
    if (mapping.paperBillSku) mappingBySku.set(String(mapping.paperBillSku).trim().toUpperCase(), mapping.productId.toString());
    if (mapping.paperBillBarcode) mappingByBarcode.set(String(mapping.paperBillBarcode).trim(), mapping.productId.toString());
  });

  const websiteQuantities = new Map<string, number>();
  const saleStatuses = new Set(["Confirmed", "Shipped", "Delivered"]);
  orders.forEach((order) => {
    (order.items ?? []).forEach((item: { productId: Types.ObjectId; quantity: number }) => {
      const itemQuantity = order.status === "Returned" ? -(item.quantity ?? 0) : saleStatuses.has(order.status) ? (item.quantity ?? 0) : 0;
      if (itemQuantity) websiteQuantities.set(item.productId.toString(), (websiteQuantities.get(item.productId.toString()) ?? 0) + itemQuantity);
    });
  });

  const differences: Record<string, unknown>[] = [];
  const matchedPaperIds = new Set<string>();
  paperRows.forEach((row) => {
    const sku = String(row.sku ?? row.SKU ?? row["Product SKU"] ?? "").trim().toUpperCase();
    const barcode = String(row.barcode ?? row.Barcode ?? row.BarcodeNo ?? row["Barcode"] ?? "").trim();
    const paperQty = Number(row.quantity ?? row.Quantity ?? row.qty ?? row.Qty ?? 0);
    const productId = (sku && mappingBySku.get(sku)) || (barcode && mappingByBarcode.get(barcode));
    if (!productId) {
      differences.push({ type: "UNMAPPED_PAPER_PRODUCT", sku, barcode, paperQuantity: paperQty, websiteQuantity: null });
      return;
    }
    matchedPaperIds.add(productId);
    const websiteQty = websiteQuantities.get(productId) ?? 0;
    if (paperQty !== websiteQty) differences.push({ type: "QUANTITY_MISMATCH", productId, sku, barcode, paperQuantity: paperQty, websiteQuantity: websiteQty, variance: websiteQty - paperQty });
  });
  websiteQuantities.forEach((quantity, productId) => {
    if (!matchedPaperIds.has(productId)) differences.push({ type: "UNMATCHED_WEBSITE_PRODUCT", productId, websiteQuantity: quantity, paperQuantity: null });
  });

  const admin = await getAdminSession();
  const record = await Reconciliation.create({
    startDate: start,
    endDate: end,
    sourceFileName: fileName,
    paperBillRows: paperRows,
    differences,
    adjustments: differences.map((difference) => ({ ...difference, approved: false })),
    auditTrail: [{ at: new Date(), action: "Imported and compared", actorId: admin?.sub }],
  });
  await AuditLog.create({ actorId: admin?.sub, actorEmail: admin?.email, action: "import", entityType: "reconciliation", entityId: record._id, changes: { startDate, endDate, differenceCount: differences.length } });
  return NextResponse.json({ record }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id");
  const action = request.nextUrl.searchParams.get("action");
  if (!id || !/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: "Invalid reconciliation id." }, { status: 400 });
  await connectToDatabase();
  const record = await Reconciliation.findById(id);
  if (!record) return NextResponse.json({ error: "Reconciliation not found." }, { status: 404 });
  const admin = await getAdminSession();
  if (action === "approve") {
    record.status = "Approved";
    record.approvedBy = admin?.sub ? new Types.ObjectId(admin.sub) : undefined;
    record.approvedAt = new Date();
  } else if (action === "finalize") {
    if (record.status !== "Approved") return NextResponse.json({ error: "Approve reconciliation adjustments before finalizing." }, { status: 409 });
    record.status = "Finalized";
    record.finalizedBy = admin?.sub ? new Types.ObjectId(admin.sub) : undefined;
    record.finalizedAt = new Date();
  } else {
    return NextResponse.json({ error: "Unsupported reconciliation action." }, { status: 400 });
  }
  record.auditTrail = [...record.auditTrail, { at: new Date(), action, actorId: admin?.sub }];
  await record.save();
  await AuditLog.create({ actorId: admin?.sub, actorEmail: admin?.email, action, entityType: "reconciliation", entityId: record._id, changes: { status: record.status } });
  return NextResponse.json({ record });
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
  });
}
function splitCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value);
  return values;
}
