import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import Order from "@/models/Order";

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  await connectToDatabase();
  const params = request.nextUrl.searchParams;
  const filter: Record<string, unknown> = { deletedAt: null };
  const start = params.get("start");
  const end = params.get("end");
  if (start || end) {
    filter.createdAt = {};
    if (start) (filter.createdAt as Record<string, Date>).$gte = new Date(`${start}T00:00:00+05:00`);
    if (end) (filter.createdAt as Record<string, Date>).$lte = new Date(`${end}T23:59:59.999+05:00`);
  }
  const customer = params.get("customer")?.trim();
  if (customer) filter["customerDetails.name"] = { $regex: customer, $options: "i" };
  const status = params.get("status");
  if (status) filter.status = status;
  const paymentStatus = params.get("paymentStatus");
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  const deliveryCompany = params.get("deliveryCompany");
  if (deliveryCompany) filter.deliveryCompanyId = new Types.ObjectId(deliveryCompany);
  const product = params.get("product")?.trim();
  const sku = params.get("sku")?.trim().toUpperCase();
  const barcode = params.get("barcode")?.trim();
  if (product || sku || barcode) {
    const itemFilter: Record<string, unknown>[] = [];
    if (product) itemFilter.push({ "items.name": { $regex: product, $options: "i" } });
    if (sku) itemFilter.push({ "items.sku": sku });
    if (barcode) itemFilter.push({ "items.barcode": barcode });
    if (itemFilter.length) filter.$and = itemFilter;
  }

  const orders = await Order.find(filter).select("orderNumber createdAt customerDetails name items subtotal deliveryCharge total paymentMethod paymentStatus amountReceived balanceAmount status deliveryCompany deliveryCompanyId").lean();
  const transactions = orders.map((order) => {
    const gross = order.subtotal;
    const received = order.amountReceived ?? (order.status === "Cancelled" ? 0 : order.total);
    const balance = order.balanceAmount ?? Math.max(0, order.total - received);
    const cost = (order.items ?? []).reduce((sum: number, item: { unitCost?: number | null; unitPrice: number; quantity: number }) => sum + (item.unitCost ?? item.unitPrice) * item.quantity, 0);
    return {
      invoiceNo: order.orderNumber,
      date: order.createdAt,
      customer: order.customerDetails.name,
      type: order.status === "Returned" ? "Return" : "Sale",
      paymentMode: order.paymentMethod,
      paymentStatus: order.paymentStatus ?? "Pending",
      total: order.status === "Returned" ? 0 : order.total,
      received,
      balance,
      status: order.status,
      deliveryCompany: order.deliveryCompany ?? "",
      gross,
      cost,
    };
  });

  const grossSales = transactions.filter((row) => row.status !== "Returned" && row.status !== "Cancelled").reduce((sum, row) => sum + row.gross, 0);
  const refunds = transactions.filter((row) => row.status === "Returned").reduce((sum, row) => sum + row.total, 0);
  const productCost = transactions.filter((row) => row.status !== "Returned" && row.status !== "Cancelled").reduce((sum, row) => sum + row.cost, 0);
  const deliveryCharges = transactions.filter((row) => row.status !== "Returned" && row.status !== "Cancelled").reduce((sum, row) => sum + (orders.find((order) => order.orderNumber === row.invoiceNo)?.deliveryCharge ?? 0), 0);
  const received = transactions.filter((row) => row.status !== "Cancelled").reduce((sum, row) => sum + row.received, 0);
  const pending = transactions.filter((row) => row.status !== "Cancelled").reduce((sum, row) => sum + row.balance, 0);
  const summary = {
    totalInvoices: transactions.length,
    grossSales,
    discounts: 0,
    deliveryCharges,
    refunds,
    netSales: grossSales - refunds,
    productCost,
    netProductProfit: grossSales - refunds - productCost,
    amountReceived: received,
    pendingPayments: pending,
  };

  const format = params.get("format");
  if (!format || format === "json") return NextResponse.json({ summary, transactions });
  if (format === "csv") {
    const header = ["Invoice No","Date","Customer","Type","Payment Mode","Total","Received","Balance","Status"];
    const rows = transactions.map((row) => [row.invoiceNo, new Date(row.date).toISOString(), row.customer, row.type, row.paymentMode, row.total, row.received, row.balance, row.status]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g,'""')}"`).join(",")).join("\r\n");
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="sales-report.csv"' } });
  }
  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(transactions.map((row) => ({
      "Invoice No": row.invoiceNo, Date: new Date(row.date).toISOString(), Customer: row.customer, Type: row.type,
      "Payment Mode": row.paymentMode, Total: row.total, Received: row.received, Balance: row.balance, Status: row.status,
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Sales Report");
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="sales-report.xlsx"' } });
  }
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text("IDAI STORES 43 - Sales Report", 14, 14);
    const table = (doc as unknown as { autoTable: (options: Record<string, unknown>) => void }).autoTable;
    table({
      startY: 20,
      head: [["Invoice","Date","Customer","Type","Payment","Total","Received","Balance","Status"]],
      body: transactions.map((row) => [row.invoiceNo, new Date(row.date).toLocaleDateString("en-PK"), row.customer, row.type, row.paymentMode, row.total, row.received, row.balance, row.status]),
    });
    return new NextResponse(Buffer.from(doc.output("arraybuffer")), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="sales-report.pdf"' } });
  }
  return NextResponse.json({ error: "Unsupported export format." }, { status: 400 });
}
