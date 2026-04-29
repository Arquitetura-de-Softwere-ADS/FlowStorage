import { createFileRoute, redirect } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { authService } from "@/services/auth.service";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && authService.current()) {
      throw redirect({ to: "/app" });
    }
  },
  component: Landing,
  head: () => ({
    meta: [
      { title: "Estoque — Sistema de gestão modular" },
      {
        name: "description",
        content:
          "Sistema de gestão de estoque com arquitetura modular: inventário, pedidos, vendas e relatórios.",
      },
    ],
  }),
});

function Landing() {
  const modules = [
    {
      t: "Inventário",
      d: "Cadastro de produtos com SKU, preço e estoque mínimo.",
      color: "var(--info)",
    },
    {
      t: "Reposição",
      d: "Pedidos a fornecedores com atualização automática do estoque.",
      color: "var(--warning)",
    },
    {
      t: "Vendas",
      d: "Registro de saídas com baixa imediata no inventário.",
      color: "var(--success)",
    },
    {
      t: "Relatórios",
      d: "Visão consolidada de receita, giro e itens críticos.",
      color: "var(--primary)",
    },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border h-14 flex items-center px-6">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
          <span className="text-sm font-semibold tracking-tight">Estoque</span>
        </div>
        <nav className="ml-auto flex items-center gap-3 text-sm">
          <Link to="/login" className="text-muted-foreground hover:text-foreground">
            Entrar
          </Link>
          <Link
            to="/register"
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
          >
            Criar conta
          </Link>
        </nav>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-24">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase px-2.5 py-1 rounded-full bg-accent text-accent-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Gestão de estoque
        </span>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight leading-tight">
          Um painel simples para controlar o que entra e o que sai da sua loja.
        </h1>
        <p className="mt-5 text-base text-muted-foreground max-w-xl leading-relaxed">
          Cinco módulos independentes — autenticação, inventário, pedidos de reposição, registro de
          vendas e relatórios — que conversam entre si.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Link
            to="/register"
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            Começar agora
          </Link>
          <Link
            to="/login"
            className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-accent"
          >
            Já tenho conta
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {modules.map((m) => (
            <div
              key={m.t}
              className="bg-card border border-border rounded-lg p-5 relative overflow-hidden"
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: m.color }}
              />
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                <div className="text-sm font-medium">{m.t}</div>
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{m.d}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
