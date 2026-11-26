import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TituloPagina, Vazio } from "@/components/radar/ui";
import { Input } from "@/components/ui/input";
import { pb } from "@/lib/pb";
import { useSessao } from "@/hooks/use-sessao";

export const Route = createFileRoute("/_app/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — Radar FUNDEB" }, { name: "description", content: "Trilha de acesso a dados pessoais (LGPD)." }, { property: "og:title", content: "Auditoria — Radar FUNDEB" }, { property: "og:description", content: "Trilha de acesso a dados pessoais (LGPD)." }] }),
  component: Auditoria,
});

const ACOES = ["", "importar", "ver_lista_nominal", "exportar_csv", "emitir_relatorio", "abrir_relatorio", "alterar_parametros"];

function Auditoria() {
  const s = useSessao();
  const [f, setF] = useState({ usuario: "", acao: "", de: "", ate: "", municipio: false });
  const filtro = [
    f.usuario && pb().filter("usuario_email ~ {:u}", { u: f.usuario }),
    f.acao && pb().filter("acao = {:a}", { a: f.acao }),
    f.municipio && s.municipioId && pb().filter("municipio = {:m}", { m: s.municipioId }),
    f.de && pb().filter("created >= {:d}", { d: f.de + " 00:00:00" }),
    f.ate && pb().filter("created <= {:d}", { d: f.ate + " 23:59:59" }),
  ].filter(Boolean).join(" && ");
  const { data } = useQuery({ queryKey: ["logs", filtro], queryFn: () => pb().collection("logs_acesso").getList(1, 200, { filter: filtro, sort: "-created", expand: "municipio" }), enabled: s.papel === "admin" });
  if (s.papel !== "admin") return <Vazio titulo="Somente administradores" />;
  return (
    <div className="space-y-4">
      <TituloPagina titulo="Auditoria de acesso" descricao="Registros de importação, visualização e exportação de listas nominais, emissão/abertura de relatórios e alterações de parâmetros. Ninguém edita nem apaga." />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Input className="w-56" placeholder="E-mail do usuário" value={f.usuario} onChange={(e) => setF({ ...f, usuario: e.target.value })} />
        <select className="h-9 rounded border bg-card px-2" value={f.acao} onChange={(e) => setF({ ...f, acao: e.target.value })}>{ACOES.map((a) => <option key={a} value={a}>{a || "Todas as ações"}</option>)}</select>
        <Input type="date" className="w-40" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} />
        <Input type="date" className="w-40" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} />
        <label className="flex items-center gap-1"><input type="checkbox" checked={f.municipio} onChange={(e) => setF({ ...f, municipio: e.target.checked })} /> Só o município selecionado</label>
      </div>
      <div className="overflow-x-auto rounded border bg-card">
        <table className="tabela-relatorio w-full text-sm">
          <thead className="bg-muted text-left"><tr><th className="p-2">Data</th><th className="p-2">Usuário</th><th className="p-2">Município</th><th className="p-2">Ação</th><th className="p-2">Detalhe</th></tr></thead>
          <tbody>{(data?.items || []).map((l) => (
            <tr key={l.id} className="border-t"><td className="p-2 num text-xs">{new Date(l["created"]).toLocaleString("pt-BR")}</td><td className="p-2">{l["usuario_email"]}</td><td className="p-2">{(l["expand"] as any)?.municipio?.nome}</td><td className="p-2">{l["acao"]}</td><td className="p-2 text-xs">{l["detalhe"]}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
