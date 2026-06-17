import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/app-layout";
import { inventoryService, type Product } from "@/services/inventory.service";
import { notificationService, type Subscription } from "@/services/notification.service";
import { Bell, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/inventory")({
  component: InventoryPage,
});

function InventoryPage() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Product[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [autoReorderSavingIds, setAutoReorderSavingIds] = useState<Set<number>>(new Set());
  const [autoReorderError, setAutoReorderError] = useState("");

  const refresh = async () => {
    try {
      const data = await inventoryService.list();
      setItems(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSubscriptions = async () => {
    try {
      const data = await notificationService.listSubscriptions();
      setSubscriptions(data);
    } catch (err) {
      console.error("Erro ao buscar inscrições:", err);
    }
  };

  useEffect(() => {
    refresh();
    loadSubscriptions();
  }, []);

  const subscriptionByProductId = useMemo(() => {
    return new Map(subscriptions.map((subscription) => [subscription.productId, subscription]));
  }, [subscriptions]);

  const selectedSubscription = selectedProduct
    ? subscriptionByProductId.get(selectedProduct.id)
    : undefined;

  const setAutoReorderSaving = (productId: number, saving: boolean) => {
    setAutoReorderSavingIds((current) => {
      const next = new Set(current);

      if (saving) {
        next.add(productId);
      } else {
        next.delete(productId);
      }

      return next;
    });
  };

  const toggleAutoReorder = async (product: Product, enabled: boolean) => {
    if (autoReorderSavingIds.has(product.id)) return;

    const previousValue = product.autoReorderEnabled;
    setAutoReorderError("");
    setAutoReorderSaving(product.id, true);
    setItems((current) =>
      current.map((item) =>
        item.id === product.id ? { ...item, autoReorderEnabled: enabled } : item,
      ),
    );

    try {
      const updated = await inventoryService.setAutoReorder(product.id, enabled);
      setItems((current) =>
        current.map((item) =>
          item.id === product.id
            ? { ...item, autoReorderEnabled: updated.auto_reorder_enabled }
            : item,
        ),
      );
    } catch (e) {
      const error = e as Error;
      console.error("Erro ao alterar reposição automática:", error);
      setItems((current) =>
        current.map((item) =>
          item.id === product.id
            ? { ...item, autoReorderEnabled: previousValue }
            : item,
        ),
      );
      setAutoReorderError(
        error.message || "Não foi possível alterar a reposição automática.",
      );
    } finally {
      setAutoReorderSaving(product.id, false);
    }
  };

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
        {autoReorderError && (
          <p className="mb-3 text-xs text-destructive">{autoReorderError}</p>
        )}

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
                  <th className="text-left px-4 py-2">Produto</th>
                  <th className="text-left px-4 py-2">SKU</th>
                  <th className="text-left px-4 py-2">Categoria</th>
                  <th className="text-right px-4 py-2">Preço</th>
                  <th className="text-right px-4 py-2">Estoque</th>
                  <th className="text-right px-4 py-2">Mínimo</th>
                  <th className="w-10"></th>
                  <th className="w-12"></th>
                  <th className="w-10"></th>
                </tr>
              </thead>

              <tbody>
                {items.map((p) => {
                  const monitored = subscriptionByProductId.has(p.id);

                  return (
                    <tr key={p.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-medium">{p.name}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">
                        {p.sku}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.category}</td>
                      <td className="px-4 py-2.5 text-right">R$ {p.price.toFixed(2)}</td>
                      <td
                        className={`px-4 py-2.5 text-right font-medium ${
                          p.stock <= p.minStock ? "text-destructive" : ""
                        }`}
                      >
                        {p.stock}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{p.minStock}</td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(p)}
                          className={`p-1 rounded-md transition-colors ${
                            monitored
                              ? "text-warning hover:bg-warning/10"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
                          }`}
                          title={monitored ? "Notificações ativadas" : "Ativar notificações"}
                          aria-label={
                            monitored
                              ? `Notificações ativadas para ${p.name}`
                              : `Ativar notificações para ${p.name}`
                          }
                        >
                          <Bell
                            className="h-3.5 w-3.5"
                            fill={monitored ? "currentColor" : "none"}
                          />
                        </button>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={p.autoReorderEnabled}
                          disabled={autoReorderSavingIds.has(p.id)}
                          onChange={(e) => toggleAutoReorder(p, e.target.checked)}
                          className="h-4 w-4 rounded border-border accent-primary disabled:cursor-not-allowed disabled:opacity-60"
                          title={
                            p.autoReorderEnabled
                              ? "Reposição automática ativada"
                              : "Reposição automática desativada"
                          }
                          aria-label={
                            p.autoReorderEnabled
                              ? `Reposição automática ativada para ${p.name}`
                              : `Reposição automática desativada para ${p.name}`
                          }
                        />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <button
                          onClick={async () => {
                            if (confirm("Remover produto?")) {
                              await inventoryService.remove(p.id);
                              refresh();
                            }
                          }}
                          className="p-1 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
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

      {selectedProduct && (
        <ProductNotificationDialog
          product={selectedProduct}
          subscription={selectedSubscription}
          onClose={() => setSelectedProduct(null)}
          onChanged={loadSubscriptions}
        />
      )}
    </div>
  );
}

function ProductNotificationDialog({
  product,
  subscription,
  onClose,
  onChanged,
}: {
  product: Product;
  subscription?: Subscription;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");
  const monitored = Boolean(subscription);

  const toggleSubscription = async () => {
    setBusy(true);
    setErr("");
    setMessage("");

    try {
      if (subscription) {
        await notificationService.deleteSubscription(subscription.id);
        setMessage("Notificações desativadas para este produto.");
      } else {
        await notificationService.createSubscription(product.id);
        setMessage("Notificações ativadas para este produto.");
      }

      await onChanged();
    } catch (e) {
      const error = e as Error;
      console.error("Erro ao alterar inscrição:", error);
      setErr(error.message || "Não foi possível alterar as notificações.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-foreground/20 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg border w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 h-8 w-8 rounded-md flex items-center justify-center ${
              monitored ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
            }`}
          >
            <Bell className="h-4 w-4" fill={monitored ? "currentColor" : "none"} />
          </div>
          <div>
            <h2 className="text-base font-semibold">Notificações de estoque</h2>
            <p className="text-xs text-muted-foreground mt-1">{product.name}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-4">
          Ative as notificações para receber avisos quando os produtos estiverem em estado crítico.
        </p>

        {message && <p className="text-xs text-success mt-3">{message}</p>}
        {err && <p className="text-xs text-destructive mt-3">{err}</p>}

        <div className="flex justify-end gap-2 pt-5">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Fechar
          </button>
          <button
            type="button"
            onClick={toggleSubscription}
            disabled={busy}
            className={monitored ? "btn btn-outline" : "btn btn-primary"}
          >
            {busy ? "Salvando..." : monitored ? "Desativar notificações" : "Ativar notificações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewProductDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    supplier: "",
    price: "",
    stock: "",
    minStock: "",
  });

  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    try {
      await inventoryService.create({
        name: form.name,
        sku: form.sku,
        category: form.category || "Geral",
        supplier: form.supplier.trim() || null,
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
        className="bg-card rounded-lg border w-full max-w-md p-6"
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

          <Row label="Fornecedor">
            <input
              className="input"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
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
              <select
                required
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Selecione</option>
                <option value="Eletrônicos">Eletrônicos</option>
                <option value="Alimentos">Alimentos</option>
                <option value="Vestuário">Vestuário</option>
                <option value="Outros">Outros</option>
              </select>
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
      <span className="text-xs font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
