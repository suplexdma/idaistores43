import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import User from "@/models/User";
import Order from "@/models/Order";

const segments = ["all", "new", "old", "regular"] as const;
const customerUpdateSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().regex(/^\+?[0-9][0-9\s()-]{6,19}$/),
});
const customerDeleteSchema = z.object({
  ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(100),
});

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const parsed = z.enum(segments).safeParse(request.nextUrl.searchParams.get("segment") ?? "all");
  if (!parsed.success) return NextResponse.json({ error: "Invalid customer filter." }, { status: 400 });

  try {
    await connectToDatabase();
    const now = new Date();
    const recent = new Date(now.getTime() - 30 * 86_400_000);
    const filter: Record<string, unknown> =
      parsed.data === "new"
        ? { createdAt: { $gte: recent } }
        : parsed.data === "old"
          ? {
              createdAt: { $lt: recent },
              $or: [{ lastLoginAt: null }, { lastLoginAt: { $lte: recent } }],
            }
          : parsed.data === "regular"
            ? { createdAt: { $lt: recent }, lastLoginAt: { $gt: recent } }
            : {};

    const customers = await User.aggregate<{
      _id: unknown;
      name: string;
      email: string;
      phone: string;
      createdAt: Date;
      lastLoginAt?: Date;
      orderCount: number;
      totalSpent: number;
    }>([
      { $match: filter },
      {
        $lookup: {
          from: "orders",
          let: { customerId: "$_id" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$userId", "$$customerId"] }, { $eq: [{ $ifNull: ["$deletedAt", null] }, null] }] } } },
            { $group: { _id: null, orderCount: { $sum: 1 }, totalSpent: { $sum: "$total" } } },
          ],
          as: "orderStats",
        },
      },
      {
        $addFields: {
          orderCount: { $ifNull: [{ $first: "$orderStats.orderCount" }, 0] },
          totalSpent: { $ifNull: [{ $first: "$orderStats.totalSpent" }, 0] },
        },
      },
      { $project: { name: 1, email: 1, phone: 1, createdAt: 1, lastLoginAt: 1, orderCount: 1, totalSpent: 1 } },
      { $sort: { createdAt: -1 } },
    ]);

    return NextResponse.json({
      customers: customers.map((customer) => {
        const lastActivity = customer.lastLoginAt ?? customer.createdAt;
        return {
          id: String(customer._id),
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          registeredAt: customer.createdAt,
          lastLoginAt: customer.lastLoginAt ?? null,
          offlineMilliseconds: Math.max(0, now.getTime() - new Date(lastActivity).getTime()),
          orderCount: customer.orderCount,
          totalSpent: customer.totalSpent,
        };
      }),
    });
  } catch (error) {
    console.error("Admin customer listing failed:", error);
    return NextResponse.json({ error: "Unable to load customers." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const parsed = customerUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid name, email and phone." }, { status: 400 });

  try {
    await connectToDatabase();
    const customer = await User.findByIdAndUpdate(
      parsed.data.id,
      { $set: { name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone } },
      { new: true, runValidators: true },
    ).select("name email phone");
    if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    return NextResponse.json({
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "That email or phone number is already used by another account." }, { status: 409 });
    }
    console.error("Admin customer update failed:", error);
    return NextResponse.json({ error: "Unable to update customer." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(["SuperAdmin", "Manager"]))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const parsed = customerDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select one or more valid customers." }, { status: 400 });
  if (new Set(parsed.data.ids).size !== parsed.data.ids.length) {
    return NextResponse.json({ error: "A customer was selected more than once." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const userIds = parsed.data.ids;
    const existingCount = await User.countDocuments({ _id: { $in: userIds } });
    if (existingCount !== userIds.length) {
      return NextResponse.json({ error: "One or more selected customers no longer exist. Refresh and try again." }, { status: 409 });
    }
    const linkedOrders = await Order.countDocuments({ userId: { $in: userIds } });
    if (linkedOrders > 0) {
      return NextResponse.json({ error: "Customers with order history cannot be deleted. Keep those records for order and privacy integrity." }, { status: 409 });
    }
    const result = await User.deleteMany({ _id: { $in: userIds } });
    return NextResponse.json({ deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Admin customer deletion failed:", error);
    return NextResponse.json({ error: "Unable to delete selected customers." }, { status: 500 });
  }
}
