import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import DeliveryCompany from "@/models/DeliveryCompany";
import DeliveryDispatch from "@/models/DeliveryDispatch";
import Order from "@/models/Order";

type DispatchOrder = {
  _id: Types.ObjectId;
  orderNumber: string;
  total: number;
  deliveryCharges?: number;
  amountReceived?: number;
};

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const companyId = request.nextUrl.searchParams.get("companyId") || "";
  const search = (request.nextUrl.searchParams.get("search") || "").trim();
  if (companyId && !/^[a-f\d]{24}$/i.test(companyId)) {
    return NextResponse.json({ error: "Invalid delivery company filter." }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const filter = companyId ? { companyId: new Types.ObjectId(companyId) } : {};
    const [dispatches, companies] = await Promise.all([
      DeliveryDispatch.find(filter).sort({ dispatchDate: -1, createdAt: -1 }).limit(200).lean(),
      DeliveryCompany.find().select("name").sort({ name: 1 }).lean(),
    ]);
    const orderIds = Array.from(new Set<string>(dispatches.flatMap((dispatch) =>
      dispatch.orderIds.map((id: Types.ObjectId) => id.toString()),
    )));
    const orders: DispatchOrder[] = await Order.find({ _id: { $in: orderIds }, deletedAt: null })
      .select("orderNumber total deliveryCharges amountReceived")
      .lean();
    const ordersById = new Map<string, DispatchOrder>(orders.map((order: DispatchOrder) => [order._id.toString(), order]));
    const companiesById = new Map(companies.map((company) => [company._id.toString(), company.name]));
    const rows = dispatches.map((dispatch) => {
      const batchOrders: DispatchOrder[] = dispatch.orderIds.flatMap((id: Types.ObjectId): DispatchOrder[] => {
        const order = ordersById.get(id.toString());
        return order ? [order] : [];
      });
      const codAmount = roundMoney(batchOrders.reduce(
        (sum: number, order: DispatchOrder) => sum + Math.max(0, order.total + (order.deliveryCharges ?? 0) - (order.amountReceived ?? 0)),
        0,
      ));
      const netReceivable = roundMoney(codAmount - dispatch.courierCharges);
      return {
        id: dispatch._id.toString(),
        dispatchNumber: dispatch.dispatchNumber,
        companyId: dispatch.companyId.toString(),
        companyName: companiesById.get(dispatch.companyId.toString()) ?? "Deleted company",
        date: dispatch.dispatchDate.toISOString(),
        createdAt: dispatch.createdAt.toISOString(),
        orderCount: batchOrders.length,
        orderNumbers: batchOrders.map((order: DispatchOrder) => order.orderNumber),
        codAmount,
        courierCharges: dispatch.courierCharges,
        netReceivable,
        receivedAmount: dispatch.receivedAmount,
        balance: roundMoney(netReceivable - dispatch.receivedAmount),
        status: dispatch.status,
      };
    }).filter((row) =>
      !search ||
      [row.dispatchNumber, row.companyName, ...row.orderNumbers].some((value) =>
        value.toLowerCase().includes(search.toLowerCase()),
      ),
    );
    return NextResponse.json({ dispatches: rows, companies });
  } catch (error) {
    console.error("Courier dispatch report failed:", error);
    return NextResponse.json({ error: "Unable to load courier dispatches." }, { status: 500 });
  }
}

const updateSchema = z.object({
  receivedAmount: z.number().finite().min(0).optional(),
  courierCharges: z.number().finite().min(0).optional(),
}).refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[a-f\d]{24}$/i.test(id)) {
    return NextResponse.json({ error: "A valid dispatch id is required." }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  try {
    await connectToDatabase();
    const dispatch = await DeliveryDispatch.findById(id);
    if (!dispatch) return NextResponse.json({ error: "Dispatch not found." }, { status: 404 });
    if (parsed.data.courierCharges !== undefined) dispatch.courierCharges = parsed.data.courierCharges;
    if (parsed.data.receivedAmount !== undefined) dispatch.receivedAmount = parsed.data.receivedAmount;

    const orders: DispatchOrder[] = await Order.find({ _id: { $in: dispatch.orderIds }, deletedAt: null })
      .select("total deliveryCharges amountReceived")
      .lean();
    const codAmount = roundMoney(orders.reduce(
      (sum: number, order: DispatchOrder) => sum + Math.max(0, order.total + (order.deliveryCharges ?? 0) - (order.amountReceived ?? 0)),
      0,
    ));
    const netReceivable = roundMoney(codAmount - dispatch.courierCharges);
    dispatch.status = dispatch.receivedAmount >= netReceivable ? "Received" : dispatch.receivedAmount > 0 ? "Partial" : "Dispatched";
    await dispatch.save();
    return NextResponse.json({ updated: true, status: dispatch.status });
  } catch (error) {
    console.error("Courier dispatch update failed:", error);
    return NextResponse.json({ error: "Unable to update courier receipt." }, { status: 500 });
  }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
