import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — Estoque" }] }),
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    try {
      await login(email, password); // 🔥 AGORA ESPERA A API
      navigate({ to: "/app/" });
    } catch (e) {
      const error = e as Error;
      setErr(error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link to="/">
            <div className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft />
              Voltar
            </div>
          </Link>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Entrar</h1>
          <p className="text-sm text-muted-foreground mt-1">Acesse o painel de gestão.</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="E-mail">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Senha">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </Field>

          {err && <p className="text-xs text-destructive">{err}</p>}

          <button
            type="submit"
            className="w-full mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            Entrar
          </button>
        </form>

        <p className="mt-6 text-xs text-muted-foreground">
          Não tem conta?{" "}
          <Link to="/register" className="text-foreground hover:underline">
            Criar agora
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
