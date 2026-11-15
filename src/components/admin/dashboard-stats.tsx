"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  Coins,
  CircleDollarSign,
  Package,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RETURN_DELIVERY_LOSS_PKR } from "@/lib/order-return";

type IconName = "products" | "orders" | "stock" | "profit" | "value" | "highest" | "lowest" | "empty";
export type DashboardStat = { title: string; value: string; icon: IconName; href?: string; detail?: string };
export type DashboardCommerceMetrics = {
  grossRevenue: number;
  netProfit: number;
  totalOrders: number;
  confirmedOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  returnLoss: number;
};

const icons = {
  products: Package,
  orders: ShoppingBag,
  stock: Coins,
  profit: TrendingUp,
  value: Boxes,
  highest: Package,
  lowest: AlertTriangle,
  empty: AlertTriangle,
};

const metricCurrency = (amount: number) => {
  const formatted = Math.abs(amount).toLocaleString("en-PK", { maximumFractionDigits: 2 });
  return amount < 0 ? `-PKR ${formatted}` : `PKR ${formatted}`;
};

export function DashboardCommerceMetrics({ metrics }: { metrics: DashboardCommerceMetrics }) {
  const reduceMotion = useReducedMotion();
  const cards = [
    {
      title: "Total Sales / Gross Revenue",
      value: metricCurrency(metrics.grossRevenue),
      detail: "Confirmed, shipped, and delivered orders",
      icon: CircleDollarSign,
      negative: false,
    },
    {
      title: "Total Net Profit",
      value: metricCurrency(metrics.netProfit),
      detail: `Product profit after reversing returned orders and PKR ${RETURN_DELIVERY_LOSS_PKR.toLocaleString("en-PK")} per return`,
      icon: TrendingUp,
      negative: metrics.netProfit < 0,
    },
    {
      title: "Total Orders",
      value: metrics.totalOrders.toLocaleString("en-PK"),
      detail: `${metrics.confirmedOrders.toLocaleString("en-PK")} confirmed/completed · ${metrics.cancelledOrders.toLocaleString("en-PK")} cancelled · ${metrics.returnedOrders.toLocaleString("en-PK")} returned`,
      icon: ShoppingBag,
      negative: false,
    },
    {
      title: "Total Return Loss",
      value: metricCurrency(metrics.returnLoss),
      detail: `${metrics.returnedOrders.toLocaleString("en-PK")} returned × PKR ${RETURN_DELIVERY_LOSS_PKR.toLocaleString("en-PK")} delivery`,
      icon: RotateCcw,
      negative: metrics.returnLoss > 0,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, delay: reduceMotion ? 0 : index * 0.045 }}
          >
            <Card className="h-full rounded-2xl border-black/[0.06] bg-white shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <CardTitle className="max-w-[78%] text-[13px] font-medium leading-5 text-muted-foreground">
                  {card.title}
                </CardTitle>
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                  card.negative ? "bg-rose-50 text-rose-700" : "bg-brand-olive/10 text-brand-olive"
                }`}>
                  <Icon aria-hidden="true" className="size-[18px]" />
                </span>
              </CardHeader>
              <CardContent>
                <p className={`break-words text-[clamp(1.15rem,2vw,1.65rem)] font-semibold tracking-tight ${
                  card.negative ? "text-rose-700" : "text-brand-charcoal"
                }`}>
                  {card.value}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.detail}</p>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

export function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = icons[stat.icon];
        const content = (
          <Card className={`h-full rounded-2xl border-black/[0.06] bg-white shadow-sm transition-all ${
            stat.href ? "hover:-translate-y-1 hover:border-brand-olive/30 hover:shadow-lg hover:shadow-brand-olive/5" : ""
          }`}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
              <CardTitle className="max-w-[75%] text-[13px] font-medium leading-5 text-muted-foreground">{stat.title}</CardTitle>
              <span className={`grid size-10 place-items-center rounded-xl ${
                stat.icon === "empty" ? "bg-red-50 text-red-600" : "bg-brand-olive/10 text-brand-olive"
              }`}>
                <Icon aria-hidden="true" className="size-[18px]" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="break-words text-[clamp(1.15rem,2vw,1.65rem)] font-semibold tracking-tight text-brand-charcoal">{stat.value}</p>
              {stat.detail && <p className="mt-1 text-xs font-medium text-brand-olive">{stat.detail}</p>}
            </CardContent>
          </Card>
        );

        return (
          <motion.div
            key={stat.title}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, delay: reduceMotion ? 0 : index * 0.045 }}
          >
            {stat.href ? (
              <Link href={stat.href} aria-label={`${stat.title}: ${stat.value}. View matching products.`}>{content}</Link>
            ) : content}
          </motion.div>
        );
      })}
    </div>
  );
}
