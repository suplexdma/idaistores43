import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const reports = [
  ["Sales Report", "sales", "Invoices, discounts, refunds and net profit"],
  ["PaperBill Reconciliation", "paperbill", "Compare online and physical-store records"],
  ["Purchase Report", "purchases", "Supplier purchases and stock-in"],
  ["Day Book", "day-book", "Chronological daily transactions"],
  ["All Transactions", "transactions", "Unified financial ledger"],
  ["Profit & Loss", "profit-loss", "Revenue, cost and expenses"],
  ["Bill / Order Wise Profit", "bill-profit", "Profit per invoice"],
  ["Product Wise Sales", "product-sales", "Sales grouped by product"],
  ["Category Wise Sales", "category-sales", "Sales grouped by category"],
  ["Customer Statement", "customer-statement", "Customer purchase history"],
  ["Payment Collection", "payments", "Collected and pending payments"],
  ["Cash Flow", "cash-flow", "Money movement over time"],
  ["Inventory Valuation", "inventory-valuation", "Stock quantity and value"],
  ["Return & Refund", "returns", "Return and refund analysis"],
  ["Daily Business Closing", "daily-closing", "End-of-day totals"],
  ["Low Stock", "low-stock", "Products below threshold"],
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-olive">Finance & Operations</p>
        <h1 className="mt-1 text-3xl font-semibold">Reports</h1>
        <p className="mt-2 text-sm text-muted-foreground">Financial, inventory and reconciliation reports for Pakistan Standard Time.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map(([title, slug, description]) => (
          <Link key={slug} href={slug === "sales" ? "/admin/reports/sales" : slug === "paperbill" ? "/admin/reports/paperbill" : `/admin/reports/${slug}`}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:border-brand-olive/30 hover:shadow-md">
              <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{description}</p></CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
