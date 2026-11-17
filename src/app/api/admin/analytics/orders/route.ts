import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import { RETURN_DELIVERY_LOSS_PKR } from "@/lib/order-return";
import Order from "@/models/Order";

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const ranges = ["year", "6months", "3months", "month", "7days", "day", "hours", "minutes"] as const;
type Range = (typeof ranges)[number];
type BucketUnit = "minute" | "hour" | "day" | "month";

function pktStartOfDay(date: Date) {
  const pktDate = new Date(date.getTime() + PKT_OFFSET_MS);
  return new Date(Date.UTC(pktDate.getUTCFullYear(), pktDate.getUTCMonth(), pktDate.getUTCDate()) - PKT_OFFSET_MS);
}

function getRange(range: Range, now: Date): { start: Date; unit: BucketUnit; count: number } {
  if (range === "minutes") {
    const start = new Date(Math.floor(now.getTime() / 60_000) * 60_000 - 59 * 60_000);
    return { start, unit: "minute", count: 60 };
  }
  if (range === "hours") {
    const start = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000 - 23 * 3_600_000);
    return { start, unit: "hour", count: 24 };
  }
  if (range === "day") {
    return { start: pktStartOfDay(now), unit: "hour", count: new Date(now.getTime() + PKT_OFFSET_MS).getUTCHours() + 1 };
  }
  if (range === "7days") {
    return { start: new Date(pktStartOfDay(now).getTime() - 6 * 86_400_000), unit: "day", count: 7 };
  }

  const monthCount = range === "year" ? 12 : range === "6months" ? 6 : range === "3months" ? 3 : 1;
  const pktNow = new Date(now.getTime() + PKT_OFFSET_MS);
  const start = new Date(Date.UTC(pktNow.getUTCFullYear(), pktNow.getUTCMonth() - monthCount + 1, 1) - PKT_OFFSET_MS);
  return { start, unit: "month", count: monthCount };
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

  const requestedRange = request.nextUrl.searchParams.get("range") ?? "7days";
  if (!ranges.includes(requestedRange as Range)) {
    return NextResponse.json({ error: "Invalid graph range." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const now = new Date();
    const range = getRange(requestedRange as Range, now);
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
