import Link from "next/link";
import { BellRing } from "lucide-react";
import { OrdersGraph } from "@/components/admin/orders-graph";
import {
  DashboardCommerceMetrics,
  DashboardStats,
  type DashboardStat,
} from "@/components/admin/dashboard-stats";
import { getAdminSession } from "@/lib/admin-session";
import { connectToDatabase } from "@/lib/db";
import { calculateOrderFinancials } from "@/lib/order-return";
import AdminUser from "@/models/AdminUser";
import Order from "@/models/Order";
import Product from "@/models/Product";

export const dynamic = "force-dynamic";

const activeProducts = { status: { $ne: "archived" } };
const currency = (amount: number) => `PKR ${amount.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

type StockLevel = { _id: number; count: number };
type InventorySummary = {
  quantity: number;
  stockValue: number;
  netProfit: number;
  productValue: number;
  outOfStockCount: number;
  lowStockCount: number;
};

const effectivePrice = {
  $let: {
    vars: {
      regularPrice: { $ifNull: ["$price", 0] },
      salePrice: { $ifNull: ["$salePrice", null] },
    },
    in: {
      $cond: [
        { $and: [{ $ne: ["$$salePrice", null] }, { $lt: ["$$salePrice", "$$regularPrice"] }] },
        "$$salePrice",
        "$$regularPrice",
      ],
    },
  },
};

const productQuantity = {
  $cond: [
    "$hasVariants",
    { $ifNull: ["$variants.stock", 0] },
    { $ifNull: ["$stock", 0] },
  ],
};

export default async function AdminDashboardPage() {
  await connectToDatabase();
  const session = await getAdminSession();
  const [productCount, inventoryResult, admin, orderMetricsResult] = await Promise.all([
    Product.countDocuments(activeProducts),
    Product.aggregate<{
      totals: InventorySummary[];
      stockLevels: StockLevel[];
    }>([
      { $match: activeProducts },
      {
        $addFields: {
          hasVariants: { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
          baseSellingPrice: effectivePrice,
          unitCost: { $ifNull: ["$costPrice", 0] },
        },
      },
      { $unwind: { path: "$variants", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          availableQuantity: productQuantity,
          effectiveSellingPrice: {
            $let: {
              vars: {
                regularPrice: { $ifNull: ["$variants.price", "$baseSellingPrice"] },
                variantSalePrice: { $ifNull: ["$variants.salePrice", null] },
              },
              in: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$$variantSalePrice", null] },
                      { $lt: ["$$variantSalePrice", "$$regularPrice"] },
                    ],
                  },
                  "$$variantSalePrice",
                  "$$regularPrice",
                ],
              },
            },
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          quantity: { $sum: "$availableQuantity" },
          stockValue: { $sum: { $multiply: ["$unitCost", "$availableQuantity"] } },
          productValue: { $sum: { $multiply: ["$effectiveSellingPrice", "$availableQuantity"] } },
          netProfit: {
            $sum: {
              $multiply: [
                { $subtract: ["$effectiveSellingPrice", "$unitCost"] },
                "$availableQuantity",
              ],
            },
          },
          lowStockThreshold: { $first: { $ifNull: ["$lowStockThreshold", 3] } },
        },
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                quantity: { $sum: "$quantity" },
                stockValue: { $sum: "$stockValue" },
                productValue: { $sum: "$productValue" },
                netProfit: { $sum: "$netProfit" },
                outOfStockCount: {
                  $sum: { $cond: [{ $eq: ["$quantity", 0] }, 1, 0] },
                },
                lowStockCount: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gt: ["$quantity", 0] },
                          { $lte: ["$quantity", "$lowStockThreshold"] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          stockLevels: [
            { $match: { quantity: { $gt: 0 } } },
            { $group: { _id: "$quantity", count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]),
    session?.sub ? AdminUser.findById(session.sub).select("name email").lean() : null,
    Order.aggregate<{
      totalOrders: number;
      confirmedOrders: number;
      cancelledOrders: number;
      returnedOrders: number;
      grossRevenue: number;
      originalProductProfit: number;
      returnedProductProfit: number;
    }>([
      { $match: { deletedAt: null } },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: Product.collection.name,
          localField: "items.productId",
          foreignField: "_id",
          as: "linkedProduct",
        },
      },
      {
        $addFields: {
          itemUnitCost: {
            $switch: {
              branches: [
                {
                  case: { $eq: [{ $type: "$items.unitCost" }, "missing"] },
                  then: {
                    $ifNull: [
                      { $arrayElemAt: ["$linkedProduct.costPrice", 0] },
                      "$items.unitPrice",
                    ],
                  },
                },
                {
                  case: { $eq: [{ $type: "$items.unitCost" }, "null"] },
                  then: "$items.unitPrice",
                },
              ],
              default: "$items.unitCost",
            },
          },
        },
      },
      {
        $addFields: {
          itemProfit: {
            $multiply: [
              { $subtract: ["$items.unitPrice", "$itemUnitCost"] },
              { $ifNull: ["$items.quantity", 0] },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          status: { $first: "$status" },
          subtotal: { $first: "$subtotal" },
          productProfit: { $sum: "$itemProfit" },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          confirmedOrders: {
            $sum: {
              $cond: [{ $in: ["$status", ["Confirmed", "Shipped", "Delivered"]] }, 1, 0],
            },
          },
          cancelledOrders: { $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] } },
          returnedOrders: { $sum: { $cond: [{ $eq: ["$status", "Returned"] }, 1, 0] } },
          grossRevenue: {
            $sum: {
              $cond: [
                { $in: ["$status", ["Confirmed", "Shipped", "Delivered"]] },
                "$subtotal",
                0,
              ],
            },
          },
          originalProductProfit: {
            $sum: {
              $cond: [
                { $in: ["$status", ["Confirmed", "Shipped", "Delivered", "Returned"]] },
                "$productProfit",
                0,
              ],
            },
          },
          returnedProductProfit: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Returned"] },
                "$productProfit",
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const orderMetrics = orderMetricsResult[0] ?? {
    totalOrders: 0,
    confirmedOrders: 0,
    cancelledOrders: 0,
    returnedOrders: 0,
    grossRevenue: 0,
    originalProductProfit: 0,
    returnedProductProfit: 0,
  };
  const commerceMetrics = {
    ...orderMetrics,
    ...calculateOrderFinancials({
      grossRevenue: orderMetrics.grossRevenue,
      originalProductProfit: orderMetrics.originalProductProfit,
      returnedProductProfit: orderMetrics.returnedProductProfit,
      returnedOrders: orderMetrics.returnedOrders,
    }),
  };
  const inventoryResultItem = inventoryResult[0];
  const aggregate = inventoryResultItem?.totals[0] ?? {
    quantity: 0,
    stockValue: 0,
    netProfit: 0,
    productValue: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
  };
  const stockLevels = inventoryResultItem?.stockLevels ?? [];
  const highestStockLevel = stockLevels[stockLevels.length - 1];
  const lowestStockLevel = stockLevels[0];
  const roi = aggregate.stockValue > 0
    ? `${((aggregate.netProfit / aggregate.stockValue) * 100).toLocaleString("en-PK", { maximumFractionDigits: 1 })}%`
    : "N/A";
  const stats: DashboardStat[] = [
    { title: "Total products", value: productCount.toLocaleString("en-PK"), icon: "products" },
    { title: "Total stock value", value: currency(aggregate.stockValue), icon: "stock" },
    { title: "Total net profit", value: currency(aggregate.netProfit), icon: "profit", detail: `ROI: ${roi}` },
    { title: "Total product value", value: currency(aggregate.productValue), icon: "value" },
    {
      title: "Max stock items",
      value: `${(highestStockLevel?.count ?? 0).toLocaleString("en-PK")} · ${(highestStockLevel?._id ?? 0).toLocaleString("en-PK")} units`,
      icon: "highest",
      href: "/admin/products?stock=highest",
    },
    {
      title: "Lowest stock items",
      value: `${(lowestStockLevel?.count ?? 0).toLocaleString("en-PK")} · ${(lowestStockLevel?._id ?? 0).toLocaleString("en-PK")} units`,
      icon: "lowest",
      href: "/admin/products?stock=lowest",
    },
    {
      title: "Out of stock items",
      value: aggregate.outOfStockCount.toLocaleString("en-PK"),
      icon: "empty",
      href: "/admin/products?stock=out",
    },
  ];
  const adminName = admin?.name?.trim() || admin?.email || session?.email || "Unknown";

  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-olive">Overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-charcoal sm:text-[2rem]">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">A quick summary of your store activity.</p>
        </div>
        <Link
          href="/admin/products?stock=low"
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50"
        >
          <BellRing aria-hidden="true" className="size-4" />
          Low-stock alerts
          <span className="rounded-full bg-destructive px-2 py-0.5 text-xs text-white">{aggregate.lowStockCount}</span>
        </Link>
      </div>

      <DashboardCommerceMetrics metrics={commerceMetrics} />
      <OrdersGraph />
      <DashboardStats stats={stats} />
      <p className="rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-sm text-muted-foreground shadow-sm">
        Current Admin: <span className="font-medium text-foreground">{adminName}</span>
      </p>
    </div>
  );
}
