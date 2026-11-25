import { randomInt } from "node:crypto";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import DeliveryCompany from "@/models/DeliveryCompany";
import DeliveryDispatch from "@/models/DeliveryDispatch";
import Order, { type Order as OrderSchema } from "@/models/Order";
import Product from "@/models/Product";

export async function addShippedOrderToDispatch(orderId: string) {
  const db = await connectToDatabase();
  const session = await db.startSession();
  try {
    let result: { dispatchId: string; dispatchNumber: string } | null = null;
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, status: "Shipped", deletedAt: null }).session(session);
      if (!order?.deliveryCompanyId) return;
      if (order.deliveryDispatchId) {
        const existing = await DeliveryDispatch.findById(order.deliveryDispatchId).session(session).lean();
        if (existing?.companyId.toString() === order.deliveryCompanyId.toString()) {
          result = { dispatchId: existing._id.toString(), dispatchNumber: existing.dispatchNumber };
          return;
        }
        throw new Error("This shipped order is already assigned to another dispatch batch.");
      }

      const company = await DeliveryCompany.findById(order.deliveryCompanyId)
        .select("serviceRates")
        .session(session)
        .lean();
      if (!company) throw new Error("The selected delivery company could not be found.");
      const products = await Product.find({ _id: { $in: order.items.map((item: OrderSchema["items"][number]) => item.productId) } })
        .select("weight")
        .session(session)
        .lean();
      const weights = new Map(products.map((product: { _id: Types.ObjectId; weight?: number }) => [product._id.toString(), product.weight ?? 0]));
      const totalWeight = order.items.reduce(
        (sum: number, item: OrderSchema["items"][number]) => sum + (weights.get(item.productId.toString()) ?? 0) * item.quantity,
        0,
      );
      const matchingRate = [...(company.serviceRates ?? [])]
        .sort((left, right) => left.minWeight - right.minWeight)
        .find((rate) => totalWeight >= rate.minWeight && totalWeight <= rate.maxWeight);
      const courierCharge = matchingRate?.charge ?? 0;
      const now = new Date();
      const dispatchDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const dispatchNumber = `DSP-${dispatchDate.toISOString().slice(0, 10).replace(/-/g, "")}-${randomInt(100000, 1000000)}`;
      const dispatch = await DeliveryDispatch.findOneAndUpdate(
        { companyId: order.deliveryCompanyId, dispatchDate, status: "Dispatched" },
        {
          $setOnInsert: { dispatchNumber, companyId: order.deliveryCompanyId, dispatchDate, status: "Dispatched" },
          $addToSet: { orderIds: order._id },
          $inc: { courierCharges: courierCharge },
        },
        { upsert: true, new: true, runValidators: true, session },
      );
      order.deliveryDispatchId = dispatch._id;
      await order.save({ session });
      result = { dispatchId: dispatch._id.toString(), dispatchNumber: dispatch.dispatchNumber };
    });
    return result;
  } finally {
    await session.endSession();
  }
}
