import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { ordersService, type RestockOrder } from "@/services/orders.service";
import { inventoryService } from "@/services/inventory.service";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/app/orders")({
  component: OrdersPage,
});

const statusLabel: Record<RestockOrder["status"], string> = {
  pending: "Pendente",
  received: "Recebido",
  cancelled: "Cancelado",
};

function OrdersPage() {
  const [items, setItems] = useState<RestockOrder[]>(() => ordersService.list());
  const [open, setOpen] = useState(false);
  const refresh = () => setItems(ordersService.list());

  return (
    <div>
      <PageHeader
        title="Pedidos de reposição"
        description="Solicitações de compra a fornecedores."
        actions={
          <button onClick={() => setOpen(true)} className="btn btn-primary">
            <Plus className="h-3.5 w-3.5" /> Novo pedido
          </button>
        }
      />
      <div className="p-8">
        {items.length === 0 ? (
          <Empty />
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Produto</th>
                  <th className="text-left font-medium px-4 py-2">Fornecedor</th>
                  <th className="text-right font-medium px-4 py-2">Quantidade</th>
                  <th className="text-left font-medium px-4 py-2">Data</th>
                  <th className="text-left font-medium px-4 py-2">Status</th>
                  <th className="text-right font-medium px-4 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{o.productName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{o.supplier}</td>
                    <td className="px-4 py-2.5 text-right">{o.quantity}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          o.status === "pending"
                            ? "border-border bg-muted text-foreground"
                            : o.status === "received"
                              ? "border-border bg-accent text-foreground"
                              : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        {statusLabel[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {o.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              ordersService.setStatus(o.id, "received");
                              refresh();
                            }}
                            className="text-xs text-foreground hover:underline"
                          >
                            Receber
                          </button>
                          <span className="text-muted-foreground">·</span>
                          <button
                            onClick={() => {
                              ordersService.setStatus(o.id, "cancelled");
                              refresh();
                            }}
                            className="text-xs text-muted-foreground hover:text-destructive"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && (
        <NewOrderDialog
          onClose={() => setOpen(false)}
          onSaved={() => {
            refresh();
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="border border-dashed border-border rounded-lg p-12 text-center">
      <p className="text-sm text-muted-foreground">Nenhum pedido de reposição.</p>
    </div>
  );
}

function NewOrderDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const products = inventoryService.list();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [supplier, setSupplier] = useState("");
  const [err, setErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      ordersService.create({ productId, quantity: parseInt(quantity), supplier });
      onSaved();
    } catch (e) {
      const error = e as Error;
      setErr(error.message);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-foreground/20 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg border border-border w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">Novo pedido</h2>
        {products.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Cadastre produtos no inventário antes.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-medium">Produto</span>
              <select
                required
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="input mt-1"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium">Fornecedor</span>
              <input
                required
                className="input mt-1"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium">Quantidade</span>
              <input
                type="number"
                min="1"
                required
                className="input mt-1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            {err && <p className="text-xs text-destructive">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn btn-ghost">
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Criar pedido
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
