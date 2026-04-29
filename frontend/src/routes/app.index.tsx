import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { reportsService } from "@/services/reports.service";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const [data, setData] = useState<{
    inv: ReturnType<typeof reportsService.inventorySummary>;
    sales: ReturnType<typeof reportsService.salesSummary>;
    orders: ReturnType<typeof reportsService.ordersSummary>;
  } | null>(null);

  useEffect(() => {
    setData({
      inv: reportsService.inventorySummary(),
      sales: reportsService.salesSummary(),
      orders: reportsService.ordersSummary(),
    });
  }, []);

  if (!data) return null;

  const stats = [
    {
      label: "Produtos",
      value: data.inv.totalProducts,
      hint: `${data.inv.totalUnits} unidades`,
      color: "var(--info)",
    },
    {
      label: "Valor em estoque",
      value: `R$ ${data.inv.totalValue.toFixed(2)}`,
      hint: "preço × quantidade",
      color: "var(--primary)",
    },
    {
      label: "Receita total",
      value: `R$ ${data.sales.revenue.toFixed(2)}`,
      hint: `${data.sales.totalSales} vendas`,
      color: "var(--success)",
    },
    {
      label: "Pedidos pendentes",
      value: data.orders.pending,
      hint: `${data.orders.total} no total`,
      color: "var(--warning)",
    },
  ];

  return (
    <div>
      <PageHeader title="Visão geral" description="Resumo dos serviços do sistema." />
      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-card border border-border rounded-lg p-5 relative overflow-hidden"
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: s.color }}
              />
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.hint}</div>
            </div>
          ))}
        </div>

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold">Estoque crítico</h2>
            <Link
              to="/app/inventory"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <div className="flex items-center gap-1">
                <ArrowLeft />
                Ver inventário
              </div>
            </Link>
          </div>
          {data.inv.lowStock.length === 0 ? (
            <EmptyHint text="Nenhum produto abaixo do estoque mínimo." />
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Produto</th>
                    <th className="text-left font-medium px-4 py-2">SKU</th>
                    <th className="text-right font-medium px-4 py-2">Estoque</th>
                    <th className="text-right font-medium px-4 py-2">Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inv.lowStock.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-2.5">{p.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.sku}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-destructive">
                        {p.stock}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{p.minStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-3">Top produtos por receita</h2>
          {data.sales.topProducts.length === 0 ? (
            <EmptyHint text="Ainda não há vendas registradas." />
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Produto</th>
                    <th className="text-right font-medium px-4 py-2">Qtd</th>
                    <th className="text-right font-medium px-4 py-2">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sales.topProducts.map((p) => (
                    <tr key={p.name} className="border-t border-border">
                      <td className="px-4 py-2.5">{p.name}</td>
                      <td className="px-4 py-2.5 text-right">{p.qty}</td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        R$ {p.revenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="border border-dashed border-border rounded-lg p-6 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
