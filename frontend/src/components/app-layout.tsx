import { Link, useNavigate, useRouterState, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  Boxes,
  ClipboardList,
  ShoppingCart,
  BarChart3,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/app", label: "Visão geral", icon: LayoutDashboard, exact: true, color: "var(--primary)" },
  { to: "/app/inventory", label: "Inventário", icon: Boxes, color: "var(--info)" },
  {
    to: "/app/orders",
    label: "Pedidos de reposição",
    icon: ClipboardList,
    color: "var(--warning)",
  },
  { to: "/app/sales", label: "Vendas", icon: ShoppingCart, color: "var(--success)" },
  // Relatórios removido: aba eliminada
];

export function AppLayout() {
  const { user, ready, logout } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (ready && !user) navigate({ to: "/login" });
  }, [ready, user, navigate]);

  if (!ready || !user) return null;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-60 border-r border-border flex flex-col bg-card">
        <div className="px-5 h-14 flex items-center border-b border-border gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
          <span className="text-sm font-semibold tracking-tight">Estoque</span>
          <span className="ml-1 text-xs text-muted-foreground">/ painel</span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {nav.map((n) => {
            const active = n.exact ? path === n.to : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                )}
              >
                <n.icon className="h-4 w-4" style={{ color: n.color }} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="px-2 pb-2">
            <div className="text-xs font-medium truncate">{user.name}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate({ to: "/login" });
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border px-8 h-16 flex items-center justify-between">
      <div>
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
