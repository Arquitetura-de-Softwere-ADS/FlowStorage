import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { reportsService } from "@/services/reports.service";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
});

function ReportsPage() {
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

  return (
    <div>
      <PageHeader title="Relatórios" description="Consolidado dos demais serviços." />
      <div className="p-8 space-y-8 max-w-4xl">
        <Section title="Inventário">
          <Row k="Total de produtos" v={data.inv.totalProducts} />
          <Row k="Unidades em estoque" v={data.inv.totalUnits} />
          <Row k="Valor total em estoque" v={`R$ ${data.inv.totalValue.toFixed(2)}`} />
          <Row k="Itens com estoque crítico" v={data.inv.lowStock.length} />
        </Section>

        <Section title="Vendas">
          <Row k="Vendas registradas" v={data.sales.totalSales} />
          <Row k="Receita total" v={`R$ ${data.sales.revenue.toFixed(2)}`} />
        </Section>

        <Section title="Pedidos de reposição">
          <Row k="Total de pedidos" v={data.orders.total} />
          <Row k="Pendentes" v={data.orders.pending} />
          <Row k="Recebidos" v={data.orders.received} />
        </Section>

        {data.sales.topProducts.length > 0 && (
          <Section title="Produtos mais vendidos">
            <div className="border-t border-border">
              {data.sales.topProducts.map((p) => (
                <div
                  key={p.name}
                  className="flex justify-between border-b border-border py-2.5 text-sm"
                >
                  <span>{p.name}</span>
                  <span className="text-muted-foreground">
                    {p.qty} un. ·{" "}
                    <span className="text-foreground font-medium">R$ {p.revenue.toFixed(2)}</span>
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      <div className="border border-border rounded-lg divide-y divide-border bg-card">
        {children}
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
