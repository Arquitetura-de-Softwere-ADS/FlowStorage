import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { inventoryService } from "@/services/inventory.service";
import type { Product } from "@/services/inventory.service";
import { salesService } from "@/services/sales.service";
import type { Sale } from "@/services/sales.service";
import { ordersService } from "@/services/orders.service";
import type { RestockOrder } from "@/services/orders.service";
import { notificationService, type StockNotification } from "@/services/notification.service";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, Check } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const [data, setData] = useState<{
    inv: { totalProducts: number; totalUnits: number; totalValue: number; lowStock: Product[] };
    sales: {
      totalSales: number;
      revenue: number;
      topProducts: { name: string; qty: number; revenue: number }[];
    };
    orders: { total: number; pending: number; received: number };
  } | null>(null);
  const [notifications, setNotifications] = useState<StockNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [markingNotificationId, setMarkingNotificationId] = useState<number | null>(null);
  const notificationsOpenRef = useRef(false);
  const notificationsMounted = useRef(true);
  const notificationsRequestInFlight = useRef(false);

  const loadNotifications = useCallback(
    async (options?: { silent?: boolean; keepReadVisible?: boolean }) => {
      if (notificationsRequestInFlight.current) return;

      notificationsRequestInFlight.current = true;
      if (!options?.silent) {
        setNotificationsLoading(true);
      }
      setNotificationError("");

      try {
        const data = await notificationService.listNotifications();
        const unreadNotifications = sortNotificationsByNewest(
          data.filter((notification) => notification.read === false),
        );

        if (notificationsMounted.current) {
          setNotifications((currentNotifications) => {
            const shouldKeepReadVisible = Boolean(
              options?.keepReadVisible && notificationsOpenRef.current,
            );
            const locallyReadIds = new Set(
              currentNotifications
                .filter((notification) => notification.read)
                .map((notification) => notification.id),
            );
            const nextNotifications = new Map<number, StockNotification>();

            if (shouldKeepReadVisible) {
              currentNotifications
                .filter((notification) => notification.read)
                .forEach((notification) => {
                  nextNotifications.set(notification.id, notification);
                });
            }

            unreadNotifications.forEach((notification) => {
              if (shouldKeepReadVisible && locallyReadIds.has(notification.id)) return;
              nextNotifications.set(notification.id, notification);
            });

            return sortNotificationsByNewest([...nextNotifications.values()]);
          });
        }
      } catch (err) {
        console.error("Erro ao buscar notificações:", err);
        if (notificationsMounted.current) {
          setNotificationError("Não foi possível carregar as notificações.");
        }
      } finally {
        if (notificationsMounted.current && !options?.silent) {
          setNotificationsLoading(false);
        }
        notificationsRequestInFlight.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // 🔹 INVENTÁRIO
        const products = await inventoryService.list();

        const inv = {
          totalProducts: products.length,
          totalUnits: products.reduce((s, p) => s + p.stock, 0),
          totalValue: products.reduce((s, p) => s + p.price * p.stock, 0),
          lowStock: products.filter((p) => p.stock <= p.minStock),
        };

        // 🔹 VENDAS
        const sales = await salesService.list();

        const revenue = sales.reduce((s, x) => s + x.total, 0);

        const byProduct = new Map<number, { product_id: number; qty: number; revenue: number }>();

        for (const sale of sales) {
          for (const item of sale.items) {
            const cur = byProduct.get(item.product_id) ?? {
              product_id: item.product_id,
              qty: 0,
              revenue: 0,
            };

            cur.qty += item.quantity;
            cur.revenue += item.price * item.quantity;

            byProduct.set(item.product_id, cur);
          }
        }

        // Agrupa produtos com seus nomes
        const topProductsData = [...byProduct.values()]
          .map((item) => {
            const product = products.find((p) => p.id === item.product_id);
            return {
              name: product?.name || `Produto #${item.product_id}`,
              qty: item.qty,
              revenue: item.revenue,
            };
          })
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        const salesSummary = {
          totalSales: sales.length,
          revenue,
          topProducts: topProductsData,
        };

        // 🔥 PEDIDOS
        const orders = await ordersService.list();

        const ordersSummary = {
          total: orders.length,
          pending: orders.filter((o) => o.status === "Pendente").length,
          received: orders.filter((o) => o.status === "Recebido").length,
        };

        if (!mounted) return;

        setData({
          inv,
          sales: salesSummary,
          orders: ordersSummary,
        });
      } catch (err) {
        console.error("Erro no dashboard:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    notificationsMounted.current = true;
    loadNotifications();

    const intervalId = window.setInterval(() => {
      loadNotifications({
        silent: true,
        keepReadVisible: notificationsOpenRef.current,
      });
    }, 5000);

    return () => {
      notificationsMounted.current = false;
      window.clearInterval(intervalId);
    };
  }, [loadNotifications]);

  const markAsRead = async (notificationId: number) => {
    const notification = notifications.find((item) => item.id === notificationId);
    if (!notification || notification.read) return;

    setMarkingNotificationId(notificationId);
    setNotificationError("");

    try {
      const updatedNotification = await notificationService.markNotificationAsRead(notificationId);
      setNotifications((currentNotifications) =>
        currentNotifications.map((item) =>
          item.id === notificationId ? { ...item, ...updatedNotification, read: true } : item,
        ),
      );
    } catch (err) {
      console.error("Erro ao marcar notificação como lida:", err);
      setNotificationError("Não foi possível marcar a notificação como lida.");
    } finally {
      setMarkingNotificationId(null);
    }
  };

  const closeNotifications = () => {
    notificationsOpenRef.current = false;
    setNotificationsOpen(false);
    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => notification.read === false),
    );
  };

  if (!data) return null;

  const unreadNotifications = notifications.filter((notification) => !notification.read).length;

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
      <PageHeader
        title="Visão geral"
        description="Resumo dos serviços do sistema."
        actions={
          <button
            type="button"
            onClick={() => {
              notificationsOpenRef.current = true;
              setNotificationsOpen(true);
              loadNotifications();
            }}
            className={`relative p-2 rounded-md border border-border transition-colors ${
              unreadNotifications > 0
                ? "text-warning bg-warning/10 hover:bg-warning/15"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            aria-label="Abrir notificações"
            title="Notificações"
          >
            <Bell className="h-4 w-4" fill={unreadNotifications > 0 ? "currentColor" : "none"} />
            {unreadNotifications > 0 && (
              <span className="absolute -right-1.5 -top-1.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-[10px] leading-4 text-destructive-foreground text-center">
                {unreadNotifications}
              </span>
            )}
          </button>
        }
      />

      <div className="p-8 space-y-8">
        {/* CARDS */}
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
              <div className="mt-2 text-2xl font-semibold">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.hint}</div>
            </div>
          ))}
        </div>

        {/* ESTOQUE CRÍTICO */}
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
                    <th className="text-left px-4 py-2">Produto</th>
                    <th className="text-left px-4 py-2">SKU</th>
                    <th className="text-right px-4 py-2">Estoque</th>
                    <th className="text-right px-4 py-2">Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inv.lowStock.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-2.5">{p.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.sku}</td>
                      <td className="px-4 py-2.5 text-right text-destructive font-medium">
                        {p.stock}
                      </td>
                      <td className="px-4 py-2.5 text-right">{p.minStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* TOP PRODUTOS */}
        <section>
          <h2 className="text-sm font-semibold mb-3">Top produtos por receita</h2>

          {data.sales.topProducts.length === 0 ? (
            <EmptyHint text="Ainda não há vendas registradas." />
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Produto</th>
                    <th className="text-right px-4 py-2">Qtd</th>
                    <th className="text-right px-4 py-2">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sales.topProducts.map((p) => (
                    <tr key={p.name} className="border-t">
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

      {notificationsOpen && (
        <NotificationsDialog
          notifications={notifications}
          loading={notificationsLoading}
          error={notificationError}
          markingNotificationId={markingNotificationId}
          onClose={closeNotifications}
          onMarkAsRead={markAsRead}
        />
      )}
    </div>
  );
}

function NotificationsDialog({
  notifications,
  loading,
  error,
  markingNotificationId,
  onClose,
  onMarkAsRead,
}: {
  notifications: StockNotification[];
  loading: boolean;
  error: string;
  markingNotificationId: number | null;
  onClose: () => void;
  onMarkAsRead: (notificationId: number) => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-foreground/20 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg border w-full max-w-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start">
          <div>
            <h2 className="text-base font-semibold">Notificações</h2>
            <p className="text-xs text-muted-foreground mt-1">Avisos recebidos do estoque.</p>
          </div>
        </div>

        {error && <p className="text-xs text-destructive mt-3">{error}</p>}

        <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-3 pr-1">
          {loading && notifications.length === 0 ? (
            <div className="border border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">
              Carregando notificações...
            </div>
          ) : notifications.length === 0 ? (
            <div className="border border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">
              Nenhuma notificação nova.
            </div>
          ) : (
            notifications.map((notification) => {
              const isRead = notification.read;
              const isMarking = markingNotificationId === notification.id;
              const notificationClassName = `block w-full rounded-lg border p-4 text-left transition-colors ${
                isRead
                  ? "border-border bg-muted/40 text-muted-foreground"
                  : "border-success/40 bg-success/5 text-foreground hover:bg-success/10"
              } ${isMarking ? "cursor-wait opacity-80" : ""}`;

              const content = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {notification.title && (
                          <h3
                            className={`text-sm ${
                              isRead ? "font-medium text-muted-foreground" : "font-semibold"
                            }`}
                          >
                            {notification.title}
                          </h3>
                        )}
                        {notification.eventType && (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            {notification.eventType}
                          </span>
                        )}
                      </div>
                      {notification.message && (
                        <p
                          className={`mt-2 text-sm ${
                            isRead ? "text-muted-foreground" : "text-foreground/80"
                          }`}
                        >
                          {notification.message}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] ${
                        isRead ? "bg-muted text-muted-foreground" : "bg-success/15 text-success"
                      }`}
                    >
                      {isRead && <Check className="h-3 w-3" />}
                      {isMarking ? "Marcando..." : isRead ? "Lida" : "Não lida"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Produto #{notification.productId}</span>
                    <span>{formatNotificationDate(notification.createdAt)}</span>
                  </div>
                </>
              );

              return isRead ? (
                <div key={notification.id} className={notificationClassName}>
                  {content}
                </div>
              ) : (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => onMarkAsRead(notification.id)}
                  disabled={isMarking}
                  className={notificationClassName}
                  aria-label={`Marcar notificação ${notification.id} como lida`}
                >
                  {content}
                </button>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-5">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function formatNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function sortNotificationsByNewest(notifications: StockNotification[]) {
  return [...notifications].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();

    return (Number.isNaN(timeB) ? 0 : timeB) - (Number.isNaN(timeA) ? 0 : timeA);
  });
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="border border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
