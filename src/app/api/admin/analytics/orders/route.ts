import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import { RETURN_DELIVERY_LOSS_PKR } from "@/lib/order-return";
import Order from "@/models/Order";

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const ranges = ["this-month", "last-month", "yearly", "custom"] as const;
type Range = (typeof ranges)[number];
type BucketUnit = "minute" | "hour" | "day" | "month";

function pktStartOfDay(date: Date) {
  const pktDate = new Date(date.getTime() + PKT_OFFSET_MS);
  return new Date(Date.UTC(pktDate.getUTCFullYear(), pktDate.getUTCMonth(), pktDate.getUTCDate()) - PKT_OFFSET_MS);
}

function getRange(range: Range, now: Date): { start: Date; unit: BucketUnit; count: number } {
  const pktNow = new Date(now.getTime() + PKT_OFFSET_MS);
  if (range === "this-month") {
    const start = new Date(Date.UTC(pktNow.getUTCFullYear(), pktNow.getUTCMonth(), 1) - PKT_OFFSET_MS);
    return { start, unit: "day", count: pktNow.getUTCDate() };
  }
  if (range === "last-month") {
    const start = new Date(Date.UTC(pktNow.getUTCFullYear(), pktNow.getUTCMonth() - 1, 1) - PKT_OFFSET_MS);
    const end = new Date(Date.UTC(pktNow.getUTCFullYear(), pktNow.getUTCMonth(), 0) - PKT_OFFSET_MS);
    const pktEnd = new Date(end.getTime() + PKT_OFFSET_MS);
    return { start, unit: "day", count: pktEnd.getUTCDate() };
  }
  const start = new Date(Date.UTC(pktNow.getUTCFullYear(), 0, 1) - PKT_OFFSET_MS);
  return { start, unit: "month", count: 12 };
}

function bucketStarts(start: Date, unit: BucketUnit, count: number) {
  const buckets: Date[] = [];
  for (let index = 0; index < count; index += 1) {
    const pktStart = new Date(start.getTime() + PKT_OFFSET_MS);
    if (unit === "minute") {
      buckets.push(new Date(start.getTime() + index * 60_000));
    } else if (unit === "hour") {
      buckets.push(new Date(start.getTime() + index * 3_600_000));
    } else if (unit === "day") {
      buckets.push(new Date(start.getTime() + index * 86_400_000));
    } else {
      buckets.push(new Date(Date.UTC(pktStart.getUTCFullYear(), pktStart.getUTCMonth() + index, 1) - PKT_OFFSET_MS));
    }
  }
  return buckets;
}

function formatLabel(date: Date, unit: BucketUnit) {
  const options: Intl.DateTimeFormatOptions =
    unit === "month"
      ? { month: "short", year: "2-digit", timeZone: "Asia/Karachi" }
      : unit === "day"
        ? { day: "numeric", month: "short", timeZone: "Asia/Karachi" }
        : unit === "hour"
          ? { hour: "numeric", timeZone: "Asia/Karachi" }
          : { hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" };
  return new Intl.DateTimeFormat("en-PK", options).format(date);
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const requestedRange = request.nextUrl.searchParams.get("range") ?? "this-month";
  if (!ranges.includes(requestedRange as Range)) {
    return NextResponse.json({ error: "Invalid graph range." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const now = new Date();
    let range = getRange(requestedRange as Range, now);
    if (requestedRange === "yearly") {
      const requestedYear = Number(request.nextUrl.searchParams.get("year"));
      const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : new Date().getUTCFullYear();
      range = { start: new Date(Date.UTC(year, 0, 1) - PKT_OFFSET_MS), unit: "month", count: 12 };
    }
    if (requestedRange === "custom") {
      const startValue = request.nextUrl.searchParams.get("start");
      const endValue = request.nextUrl.searchParams.get("end");
      if (!startValue || !endValue) return NextResponse.json({ error: "Custom date range requires start and end dates." }, { status: 400 });
      const start = new Date(`${startValue}T00:00:00+05:00`);
      const end = new Date(`${endValue}T23:59:59.999+05:00`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return NextResponse.json({ error: "Invalid custom date range." }, { status: 400 });
      const pktStart = new Date(start.getTime() + PKT_OFFSET_MS);
      const pktEnd = new Date(end.getTime() + PKT_OFFSET_MS);
      const dayCount = Math.max(1, Math.min(366, Math.ceil((Date.UTC(pktEnd.getUTCFullYear(), pktEnd.getUTCMonth(), pktEnd.getUTCDate()) - Date.UTC(pktStart.getUTCFullYear(), pktStart.getUTCMonth(), pktStart.getUTCDate())) / 86_400_000) + 1));
      range = { start: pktStartOfDay(start), unit: "day", count: dayCount };
    }
    const [grouped, returnedGrouped] = await Promise.all([
      Order.aggregate<{
        _id: Date;
        count: number;
        confirmed: number;
        returned: number;
        total: number;
        profit: number;
      }>([
        { $match: { deletedAt: null, createdAt: { $gte: range.start, $lte: now } } },
        {
          $group: {
            _id: { $dateTrunc: { date: "$createdAt", unit: range.unit, timezone: "Asia/Karachi" } },
            count: { $sum: 1 },
            confirmed: {
              $sum: {
                $cond: [{ $in: ["$status", ["Confirmed", "Shipped", "Delivered"]] }, 1, 0],
              },
            },
            returned: { $sum: { $cond: [{ $eq: ["$status", "Returned"] }, 1, 0] } },
            total: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["Confirmed", "Shipped", "Delivered"]] },
                  "$subtotal",
                  0,
                ],
              },
            },
            profit: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["Confirmed", "Shipped", "Delivered"]] },
                  {
                    $reduce: {
                      input: { $ifNull: ["$items", []] },
                      initialValue: 0,
                      in: {
                        $add: [
                          "$$value",
                          {
                            $multiply: [
                              {
                                $subtract: [
                                  "$$this.unitPrice",
                                  { $ifNull: ["$$this.unitCost", "$$this.unitPrice"] },
                                ],
                              },
                              "$$this.quantity",
                            ],
                          },
                        ],
                      },
                    },
                  },
                  {
                    $cond: [
                      { $eq: ["$status", "Returned"] },
                      -RETURN_DELIVERY_LOSS_PKR,
                      0,
                    ],
                  },
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate<{ _id: Date; count: number }>([
        { $match: { deletedAt: null, status: "Returned", returnedAt: { $gte: range.start, $lte: now } } },
        {
          $group: {
            _id: { $dateTrunc: { date: "$returnedAt", unit: range.unit, timezone: "Asia/Karachi" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const byTimestamp = new Map(grouped.map((bucket) => [new Date(bucket._id).getTime(), bucket]));
    const returnedByTimestamp = new Map(returnedGrouped.map((bucket) => [new Date(bucket._id).getTime(), bucket]));
    const dates = bucketStarts(range.start, range.unit, range.count);
    const points = dates.map((date) => {
      const key = bucketTimestamp(date, range.unit);
      const bucket = byTimestamp.get(key);
      return {
        timestamp: date.toISOString(),
        label: formatLabel(date, range.unit),
        orders: bucket?.count ?? 0,
        confirmed: bucket?.confirmed ?? 0,
        returned: bucket?.returned ?? 0,
        sales: bucket?.total ?? 0,
        profit: bucket?.profit ?? 0,
      };
    });
    const returnPoints = dates.map((date) => {
      const key = bucketTimestamp(date, range.unit);
      return {
        timestamp: date.toISOString(),
        label: formatLabel(date, range.unit),
        returned: returnedByTimestamp.get(key)?.count ?? 0,
      };
    });
    return NextResponse.json({ range: requestedRange, timezone: "Asia/Karachi", points, returnPoints });
  } catch (error) {
    console.error("Admin order analytics failed:", error);
    return NextResponse.json({ error: "Unable to load order analytics." }, { status: 500 });
  }
}

function bucketTimestamp(date: Date, unit: BucketUnit) {
  if (unit === "month") {
    const pktDate = new Date(date.getTime() + PKT_OFFSET_MS);
    return Date.UTC(pktDate.getUTCFullYear(), pktDate.getUTCMonth(), 1) - PKT_OFFSET_MS;
  }
  const interval = unit === "minute" ? 60_000 : unit === "hour" ? 3_600_000 : 86_400_000;
  return Math.floor((date.getTime() + PKT_OFFSET_MS) / interval) * interval - PKT_OFFSET_MS;
}
