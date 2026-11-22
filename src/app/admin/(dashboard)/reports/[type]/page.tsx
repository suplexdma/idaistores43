import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const titles: Record<string,string> = {
 purchases:"Purchase Report", "day-book":"Day Book", transactions:"All Transactions", "profit-loss":"Profit & Loss",
 "bill-profit":"Bill / Order Wise Profit", "product-sales":"Product Wise Sales", "category-sales":"Category Wise Sales",
 "customer-statement":"Customer Statement & Purchase History", payments:"Payment Collection Report", "cash-flow":"Cash Flow Report",
 "inventory-valuation":"Inventory Valuation Report", returns:"Return & Refund Report", "daily-closing":"Daily Business Closing Report",
 "low-stock":"Low Stock Report",
};

export default function AdvancedReportPage({ params }: { params: { type: string } }) {
  const title=titles[params.type] ?? "Report";
  return <div className="space-y-6"><div><p className="text-sm font-medium text-brand-olive">Reports</p><h1 className="mt-1 text-3xl font-semibold">{title}</h1></div><Card><CardHeader><CardTitle>Report data</CardTitle></CardHeader><CardContent><p className="py-10 text-center text-sm text-muted-foreground">This report is available through the unified financial ledger. Use date, customer, product and payment filters from its operational tables.</p></CardContent></Card></div>;
}
