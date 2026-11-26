import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BarChart3, ClipboardList, FileText, Gauge, LayoutDashboard, LogOut, Map, Radar, Settings, ShieldCheck, TriangleAlert, Upload, Users, Building } from "lucide-react";
import { SessaoProvider, useSessao } from "@/hooks/use-sessao";
import { pb } from "@/lib/pb";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app")({
  component: AppGate,
});

function AppGate() {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return <div className="min-h-screen bg-background" />;
  return (
    <SessaoProvider>
      <Layout />
    </SessaoProvider>
  );
}

const NAV = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/importar", label: "Importar", icon: Upload, editar: true },
  { to: "/escolas", label: "Escolas", icon: Map },
  { to: "/matriculas", label: "Matrículas e Ponderações", icon: BarChart3 },
  { to: "/projecao", label: "Projeção e Potencial", icon: Gauge },
  { to: "/plano", label: "Plano de Ação", icon: ClipboardList },
  { to: "/inconsistencias", label: "Inconsistências", icon: TriangleAlert },
  { to: "/relatorios", label: "Relatórios", icon: FileText },
  { to: "/parametros", label: "Parâmetros", icon: Settings },
  { to: "/municipios", label: "Municípios", icon: Building },
  { to: "/usuarios", label: "Usuários", icon: Users, admin: true },
  { to: "/auditoria", label: "Auditoria", icon: ShieldCheck, admin: true },
] as const;

function Layout() {
  const s = useSessao();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (!s.usuario) navigate({ to: "/login" });
  }, [s.usuario, navigate]);

  const { data: municipios = [] } = useQuery({
    queryKey: ["municipios"],
    queryFn: () => pb().collection("municipios").getFullList({ sort: "nome" }),
    enabled: !!s.usuario,
  });
  useEffect(() => {
    if (municipios.length && !municipios.some((m) => m.id === s.municipioId)) s.setMunicipioId(municipios[0]!.id);
  }, [municipios, s]);

  if (!s.usuario) return null;
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 10 }, (_, i) => anoAtual + 1 - i);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-5 py-5 text-base font-semibold text-sidebar-accent-foreground">
          <Radar className="h-5 w-5 text-sidebar-primary" /> Radar FUNDEB
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.filter((n) => (!("admin" in n) || s.papel === "admin") && (!("editar" in n) || s.podeEditar)).map((n) => {
            const ativo = path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  ativo ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <n.icon className={cn("h-4 w-4", ativo && "text-sidebar-primary")} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-xs">
          <div className="truncate font-medium text-sidebar-accent-foreground">{(s.usuario["name"] as string) || (s.usuario["email"] as string)}</div>
          <div className="capitalize opacity-70">{s.papel}</div>
          <button onClick={s.sair} className="mt-3 flex items-center gap-1.5 opacity-80 hover:opacity-100">
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-background/95 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="eyebrow">Município</span>
            <Select value={s.municipioId} onValueChange={s.setMunicipioId}>
              <SelectTrigger className="h-9 w-64 bg-card">
                <SelectValue placeholder={municipios.length ? "Selecione" : "Nenhum município cadastrado"} />
              </SelectTrigger>
              <SelectContent>
                {municipios.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m["nome"]} - {m["uf"]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="eyebrow">Ano do Censo</span>
            <Select value={String(s.ano)} onValueChange={(v) => s.setAno(+v)}>
              <SelectTrigger className="h-9 w-28 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anos.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <nav className="flex gap-1 overflow-x-auto md:hidden">
            {NAV.slice(0, 7).map((n) => (
              <Link key={n.to} to={n.to} className="rounded px-2 py-1 text-xs hover:bg-muted">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1 px-6 py-6 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
