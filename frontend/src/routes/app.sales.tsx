import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { salesService, type Sale } from "@/services/sales.service";
import { inventoryService } from "@/services/inventory.service";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/app/sales")({
  component: SalesPage,
});

function SalesPage() {
  const [items, setItems] = useState<Sale[]>(() => salesService.list());
  const [open, setOpen] = useState(false);
  const refresh = () => setItems(salesService.list());

  return (
    <div>
      <PageHeader
        title="Vendas"
        description="Registro de saídas e baixa automática no estoque."
        actions={
          <button onClick={() => setOpen(true)} className="btn btn-primary">
            <Plus className="h-3.5 w-3.5" /> Registrar venda
          </button>
        }
      />
      <div className="p-8">
        {items.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma venda registrada.</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Produto</th>
                  <th className="text-right font-medium px-4 py-2">Qtd</th>
                  <th className="text-right font-medium px-4 py-2">Preço unit.</th>
                  <th className="text-right font-medium px-4 py-2">Total</th>
                  <th className="text-left font-medium px-4 py-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{s.productName}</td>
                    <td className="px-4 py-2.5 text-right">{s.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      R$ {s.unitPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">R$ {s.total.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(s.createdAt).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <NewSaleDialog
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

function NewSaleDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const products = inventoryService.list().filter((p) => p.stock > 0);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [err, setErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      salesService.create(productId, parseInt(quantity));
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
        <h2 className="text-base font-semibold">Registrar venda</h2>
        {products.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Sem produtos disponíveis em estoque.</p>
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
                    {p.name} — {p.stock} em estoque
                  </option>
                ))}
              </select>
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
                Confirmar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
