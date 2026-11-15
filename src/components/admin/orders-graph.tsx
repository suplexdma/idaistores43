"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ranges = [
  { value: "year", label: "1 Year" },
  { value: "6months", label: "6 Months" },
  { value: "3months", label: "3 Months" },
  { value: "month", label: "1 Month" },
  { value: "7days", label: "7 Days" },
  { value: "day", label: "1 Day" },
  { value: "hours", label: "Hours" },
  { value: "minutes", label: "Minutes" },
] as const;

type Range = (typeof ranges)[number]["value"];
type Point = {
  timestamp: string;
  label: string;
  orders: number;
  confirmed: number;
  returned: number;
  sales: number;
};
type ReturnPoint = { timestamp: string; label: string; returned: number };
type ChartSeries = { key: string; label: string; color: string };

function TimeSeriesChart({
  points,
  series,
  ariaLabel,
}: {
  points: Array<{ timestamp: string; label: string; [key: string]: string | number }>;
  series: ChartSeries[];
  ariaLabel: string;
}) {
  const width = 900;
  const height = 230;
  const padX = 58;
  const padTop = 16;
  const padBottom = 34;
  const maximum = Math.max(1, ...points.flatMap((point) =>
    series.map((item) => Number(point[item.key]) || 0),
  ));
  const yAxisMax = Math.max(4, Math.ceil(maximum / 4) * 4);
  const denominator = Math.max(points.length - 1, 1);
  const coordinates = points.map((point, index) => ({
    x: padX + ((width - padX * 2) * index) / denominator,
    point,
  }));
  const yFor = (value: number) => height - padBottom - ((height - padTop - padBottom) * value) / yAxisMax;
  const formatValue = (value: number) => value.toLocaleString("en-PK");

  return (
    <svg role="img" aria-label={ariaLabel} viewBox="0 0 900 270" preserveAspectRatio="none" className="h-64 w-full overflow-visible">
      {[0, 1, 2, 3, 4].map((tick) => {
        const value = (yAxisMax * tick) / 4;
        const y = yFor(value);
        return (
          <g key={tick}>
            <line x1="58" x2="890" y1={y} y2={y} stroke="currentColor" strokeDasharray="4 6" className="text-border" />
            <text x="46" y={y + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">{formatValue(value)}</text>
          </g>
        );
      })}
      <line x1="58" x2="58" y1="16" y2="196" stroke="currentColor" className="text-border" />
      <line x1="58" x2="890" y1="196" y2="196" stroke="currentColor" className="text-border" />
      {series.map((item) => {
        const path = coordinates.map(({ x, point }, index) => {
          const y = yFor(Number(point[item.key]) || 0);
          return `${index === 0 ? "M" : "L"} ${x},${y}`;
        }).join(" ");
        return (
          <g key={item.key}>
            {coordinates.length > 1 && (
              <motion.path
                d={path}
                fill="none"
                stroke={item.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            )}
            {coordinates.map(({ x, point }) => {
              const value = Number(point[item.key]) || 0;
              const date = new Intl.DateTimeFormat("en-PK", {
                dateStyle: "medium",
                timeZone: "Asia/Karachi",
              }).format(new Date(point.timestamp));
              return (
                <circle key={`${item.key}-${point.timestamp}`} cx={x} cy={yFor(value)} r="4" fill="white" stroke={item.color} strokeWidth="3">
                  <title>Date: {date}, {item.label}: {value}</title>
                </circle>
              );
            })}
          </g>
        );
      })}
      {points.filter((_, index) =>
        index === 0 ||
        index === points.length - 1 ||
        index % Math.ceil(points.length / 6) === 0,
      ).map((point) => {
        const pointIndex = points.findIndex((entry) => entry.timestamp === point.timestamp);
        const coordinate = coordinates[pointIndex];
        return coordinate ? (
          <text key={`x-${point.timestamp}`} x={coordinate.x} y="222" textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {point.label}
          </text>
        ) : null;
      })}
    </svg>
  );
}

export function OrdersGraph() {
  const [range, setRange] = useState<Range>("7days");
  const [points, setPoints] = useState<Point[]>([]);
  const [returnPoints, setReturnPoints] = useState<ReturnPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadGraph() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/analytics/orders?range=${range}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          points?: Point[];
          returnPoints?: ReturnPoint[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Unable to load order graph.");
        setPoints(data.points ?? []);
        setReturnPoints(data.returnPoints ?? []);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load order graph.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadGraph();
    return () => controller.abort();
  }, [range]);

  const formatRangeValue = (value: number) => value.toLocaleString("en-PK");
  const totalOrders = points.reduce((sum, point) => sum + point.orders, 0);
  const totalConfirmed = points.reduce((sum, point) => sum + point.confirmed, 0);
  const totalReturned = points.reduce((sum, point) => sum + point.returned, 0);

  return (
    <div className="space-y-6">
    <Card className="overflow-hidden rounded-2xl border-black/[0.06] bg-white shadow-sm">
      <CardHeader className="gap-5 border-b border-black/[0.05] bg-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Orders graph</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Order volume · Pakistan Standard Time (UTC+5)</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted/70 p-1" role="group" aria-label="Graph time range">
          {ranges.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setRange(item.value)}
              aria-pressed={range === item.value}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                range === item.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-5 sm:p-7">
        {error ? (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        ) : loading ? (
          <div role="status" aria-label="Loading orders graph" className="h-56 animate-pulse rounded-lg bg-muted/50" />
        ) : (
          <>
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{formatRangeValue(totalOrders)}</span>
              <span className="text-sm text-muted-foreground">orders in selected period</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
              {[
                { label: `Total orders (${totalOrders})`, color: "#719347" },
                { label: `Confirmed / completed (${totalConfirmed})`, color: "#16a34a" },
                { label: `Returned (${totalReturned})`, color: "#9333ea" },
              ].map((item) => (
                <span key={item.label} className="inline-flex items-center gap-2 text-muted-foreground">
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
            <TimeSeriesChart
              ariaLabel={`Total, confirmed, and returned order counts over ${ranges.find((item) => item.value === range)?.label}`}
              points={points}
              series={[
                { key: "orders", label: "Total orders", color: "#719347" },
                { key: "confirmed", label: "Confirmed / completed", color: "#16a34a" },
                { key: "returned", label: "Returned orders", color: "#9333ea" },
              ]}
            />
            <div className="sr-only">
              {points.map((point) => (
                <p key={point.timestamp}>
                  {point.label}: {point.orders} total orders, {point.confirmed} confirmed or completed, {point.returned} returned
                </p>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
    <Card className="overflow-hidden rounded-2xl border-black/[0.06] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Returned Orders</CardTitle>
        <p className="text-sm text-muted-foreground">Returns by returned date · Pakistan Standard Time (UTC+5)</p>
      </CardHeader>
      <CardContent className="p-5 pt-0 sm:p-7 sm:pt-0">
        {error ? (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        ) : loading ? (
          <div role="status" aria-label="Loading returned orders chart" className="h-56 animate-pulse rounded-lg bg-muted/50" />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {formatRangeValue(returnPoints.reduce((sum, point) => sum + point.returned, 0))} returned orders in selected period
            </p>
            <TimeSeriesChart
              ariaLabel={`Returned order counts by return date over ${ranges.find((item) => item.value === range)?.label}`}
              points={returnPoints}
              series={[{ key: "returned", label: "Returned orders", color: "#9333ea" }]}
            />
            <div className="sr-only">
              {returnPoints.map((point) => (
                <p key={point.timestamp}>{point.label}: {point.returned} returned orders</p>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
