"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Product = { _id: string; name: string; sku?: string; barcode?: string };

export default function ExternalProductMappingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/admin/products").then((response) => response.json()).then((data) => setProducts(data.products ?? []));
  }, []);

  async function save() {
    if (!selected) return;
    const response = await fetch("/api/admin/external-product-mappings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: selected, paperBillSku: sku, paperBillBarcode: barcode, paperBillName: name }),
    });
    setMessage(response.ok ? "Mapping saved." : "Unable to save mapping.");
  }

  return (
    <div className="space-y-6">
      <div><p className="text-sm font-medium text-brand-olive">Settings</p><h1 className="mt-1 text-3xl font-semibold">External Product Mapping</h1></div>
      <Card>
        <CardHeader><CardTitle>Map website product to PaperBill</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <select value={selected} onChange={(event) => {
            const product = products.find((item) => item._id === event.target.value);
            setSelected(event.target.value);
            setSku(product?.sku ?? "");
            setBarcode(product?.barcode ?? "");
          }} className="h-10 rounded-md border px-3 text-sm">
            <option value="">Select product</option>
            {products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
          </select>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="PaperBill product name" className="h-10 rounded-md border px-3 text-sm" />
          <input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="PaperBill SKU" className="h-10 rounded-md border px-3 text-sm" />
          <input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="PaperBill barcode" className="h-10 rounded-md border px-3 text-sm" />
          <button onClick={() => void save()} className="h-10 rounded-md bg-brand-olive px-4 text-sm font-semibold text-white md:col-span-2">Save mapping</button>
          {message && <p className="text-sm md:col-span-2">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
