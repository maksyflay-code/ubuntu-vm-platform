import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, mensagemErro, pb } from "@/lib/pb";
import { Radar } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Radar FUNDEB" },
      { name: "description", content: "Acesso restrito ao Radar FUNDEB." },
      { property: "og:title", content: "Entrar — Radar FUNDEB" },
      { property: "og:description", content: "Acesso restrito ao Radar FUNDEB." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [primeiro, setPrimeiro] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api<{ hasUsers: boolean }>("/backend/v1/setup-status")
      .then((r) => setPrimeiro(!r.hasUsers))
      .catch((e) => {
        setPrimeiro(false);
        setErro(mensagemErro(e));
      });
  }, []);

  async function entrar(ev: FormEvent) {
    ev.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      if (primeiro) {
        await pb().collection("users").create({ email, password: senha, passwordConfirm: senha, name: nome });
      }
      await pb().collection("users").authWithPassword(email, senha);
      navigate({ to: "/painel" });
    } catch (e) {
      setErro(mensagemErro(e).replace("Failed to authenticate.", "E-mail ou senha incorretos (ou usuário desativado)."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between bg-ink p-12 text-ink-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Radar className="h-6 w-6" /> Radar FUNDEB
        </div>
        <div>
          <p className="font-[family-name:var(--font-display)] text-4xl leading-tight">
            Quanto o seu município recebe, quanto pode receber e o que corrigir no Censo antes do fechamento.
          </p>
          <p className="mt-4 max-w-md text-sm opacity-70">
            Importação do Educacenso, matrículas ponderadas (Resolução CIF nº 5/2024), projeção em três cenários, plano de ação e relatório com verificação pública.
          </p>
        </div>
        <p className="text-xs opacity-50">Dados pessoais tratados conforme a LGPD (Lei 13.709/2018).</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={entrar} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{primeiro ? "Criar o administrador" : "Entrar"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {primeiro ? "Nenhum usuário existe ainda. A primeira conta criada vira administradora." : "Use o e-mail e a senha fornecidos pelo administrador."}
            </p>
          </div>
          {primeiro && (
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} autoComplete="current-password" />
          </div>
          {erro && <p className="rounded bg-destructive-soft p-2 text-sm text-destructive">{erro}</p>}
          <Button type="submit" className="w-full" disabled={enviando || primeiro === null}>
            {enviando ? "Aguarde…" : primeiro ? "Criar e entrar" : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
