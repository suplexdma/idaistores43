import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { getAdminSession, requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import InventoryLog from "@/models/InventoryLog";
import Product, { type Product as ProductSchema } from "@/models/Product";
import PurchaseInvoice from "@/models/PurchaseInvoice";
import Supplier from "@/models/Supplier";

const invoiceSchema = z.object({
  supplierId: z.string().refine(isValidObjectId),
  purchaseDate: z.string().date(),
  invoiceNumber: z.string().trim().min(1).max(80),
  productId: z.string().refine(isValidObjectId),
  variantName: z.string().trim().min(1).max(100).optional(),
  quantity: z.number().int().min(1).max(100000),
  purchasePrice: z.number().finite().min(0).max(100000000),
});

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  try {
    await connectToDatabase();
    const invoices = await PurchaseInvoice.find()
      .sort({ purchaseDate: -1, createdAt: -1 })
      .limit(250)
      .populate("supplierId", "name")
      .populate("productId", "name")
      .lean();
    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Purchase invoice listing failed:", error);
    return NextResponse.json({ error: "Unable to load purchase invoices." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin || admin.accessLevel === "View Only") return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const parsed = invoiceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  try {
    const db = await connectToDatabase();
    const session = await db.startSession();
    let invoiceId = "";
    try {
      await session.withTransaction(async () => {
        const [supplier, product] = await Promise.all([
          Supplier.findOne({ _id: new Types.ObjectId(parsed.data.supplierId), active: true }).session(session).lean(),
          Product.findOne({ _id: new Types.ObjectId(parsed.data.productId), deletedAt: null })
            .select("+costPrice")
            .session(session)
            .lean(),
        ]);
        if (!supplier) throw new RequestError("Choose an active supplier.", 400);
        if (!product) throw new RequestError("Product not found.", 404);
        const purchaseDate = new Date(`${parsed.data.purchaseDate}T00:00:00.000Z`);

        let remainingStock = product.stock;
        if (parsed.data.variantName) {
          const variant = product.variants.find((entry: ProductSchema["variants"][number]) => entry.name === parsed.data.variantName);
          if (!variant) throw new RequestError("The selected product option was not found.", 400);
          remainingStock = variant.stock + parsed.data.quantity;
          const update = await Product.updateOne(
            { _id: product._id, "variants.name": variant.name },
            {
              $inc: { "variants.$[selected].stock": parsed.data.quantity },
              $set: { costPrice: parsed.data.purchasePrice },
            },
            { arrayFilters: [{ "selected.name": variant.name }], session },
          );
          if (update.modifiedCount !== 1) throw new RequestError("Unable to update product stock.", 409);
        } else {
          if (product.variants.length) throw new RequestError("Select an option for this product.", 400);
          remainingStock = product.stock + parsed.data.quantity;
          const update = await Product.updateOne(
            { _id: product._id },
            { $inc: { stock: parsed.data.quantity }, $set: { costPrice: parsed.data.purchasePrice } },
            { session },
          );
          if (update.modifiedCount !== 1) throw new RequestError("Unable to update product stock.", 409);
        }

        const [invoice] = await PurchaseInvoice.create(
          [{
            supplierId: supplier._id,
            supplierName: supplier.name,
            purchaseDate,
            invoiceNumber: parsed.data.invoiceNumber,
            productId: product._id,
            productName: product.name,
            variantName: parsed.data.variantName,
            quantity: parsed.data.quantity,
            purchasePrice: parsed.data.purchasePrice,
            totalCost: parsed.data.purchasePrice * parsed.data.quantity,
            createdBy: new Types.ObjectId(admin.sub),
          }],
          { session },
        );
        await InventoryLog.create(
          [{
            productId: product._id,
            movementDate: purchaseDate,
            variantName: parsed.data.variantName,
            quantityChanged: parsed.data.quantity,
            remainingStock,
            reason: `Purchase invoice ${parsed.data.invoiceNumber}`,
            source: "Purchase",
            referenceId: invoice._id,
            adminId: new Types.ObjectId(admin.sub),
          }],
          { session },
        );
        invoiceId = invoice._id.toString();
      });
    } finally {
      await session.endSession();
    }
    return NextResponse.json({ invoiceId, message: "Invoice saved and stock updated." }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "This supplier's invoice number has already been recorded." }, { status: 409 });
    }
    console.error("Purchase invoice save failed:", error);
    return NextResponse.json({ error: "Unable to save purchase invoice." }, { status: 500 });
  }
}

class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
