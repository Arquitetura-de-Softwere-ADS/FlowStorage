import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
  head: () => ({ meta: [{ title: "Criar conta — Estoque" }] }),
});

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      if (password.length < 4) throw new Error("Senha deve ter ao menos 4 caracteres");
      register(name, email, password);
      navigate({ to: "/app" });
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
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Criar conta</h1>
          <p className="text-sm text-muted-foreground mt-1">Comece a usar o painel.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium">Nome</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium">Senha</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-1"
            />
          </label>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <button
            type="submit"
            className="w-full mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            Criar conta
          </button>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-foreground hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
