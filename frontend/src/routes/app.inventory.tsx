import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/app-layout";
import { inventoryService, type Product } from "@/services/inventory.service";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/inventory")({
  component: InventoryPage,
});

function InventoryPage() {
  const [open, setOpen] = useState(false);

  const [items, setItems] = useState<Product[]>([]);

  const refresh = async () => {
    const data = await inventoryService.list();
    setItems(data);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div>
      <PageHeader
        title="Inventário"
        description="Cadastro e controle de produtos."
        actions={
          <button onClick={() => setOpen(true)} className="btn btn-primary">
            <Plus className="h-3.5 w-3.5" /> Novo produto
          </button>
        }
      />
      <div className="p-8">
        {items.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
            <button onClick={() => setOpen(true)} className="btn btn-outline mt-4">
              Adicionar o primeiro
            </button>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Produto</th>
                  <th className="text-left font-medium px-4 py-2">SKU</th>
                  <th className="text-left font-medium px-4 py-2">Categoria</th>
                  <th className="text-right font-medium px-4 py-2">Preço</th>
                  <th className="text-right font-medium px-4 py-2">Estoque</th>
                  <th className="text-right font-medium px-4 py-2">Mínimo</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{p.sku}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.category}</td>
                    <td className="px-4 py-2.5 text-right">R$ {p.price.toFixed(2)}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium ${p.stock <= p.minStock ? "text-destructive" : ""}`}
                    >
                      {p.stock}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{p.minStock}</td>
                    <td className="px-2 py-2.5 text-right">
                      <button
                        onClick={() => {
                          if (confirm("Remover produto?")) {
                            inventoryService.remove(p.id);
                            refresh();
                          }
                        }}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <NewProductDialog
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

function NewProductDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    price: "",
    stock: "",
    minStock: "",
  });
  const [err, setErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      inventoryService.create({
        name: form.name,
        sku: form.sku,
        category: form.category || "Geral",
        price: parseFloat(form.price) || 0,
        stock: parseInt(form.stock) || 0,
        minStock: parseInt(form.minStock) || 0,
      });
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
        <h2 className="text-base font-semibold">Novo produto</h2>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Row label="Nome">
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="SKU">
              <input
                required
                className="input"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </Row>
            <Row label="Categoria">
              <input
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </Row>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Row label="Preço">
              <input
                type="number"
                step="0.01"
                required
                className="input"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Row>
            <Row label="Estoque">
              <input
                type="number"
                required
                className="input"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </Row>
            <Row label="Mínimo">
              <input
                type="number"
                required
                className="input"
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: e.target.value })}
              />
            </Row>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
