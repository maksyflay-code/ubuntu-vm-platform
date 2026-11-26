import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useSessao } from "@/hooks/use-sessao";
import { Secao, TituloPagina, Vazio } from "@/components/radar/ui";
import { Button } from "@/components/ui/button";
import { api, arquivoUrl, mensagemErro, pb } from "@/lib/pb";
import { brl, decimal } from "@/lib/format";
import { baixarBlob } from "@/lib/csv";

export const Route = createFileRoute("/_app/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios emitidos — Radar FUNDEB" }, { name: "description", content: "Emissão e histórico de relatórios Análise do FUNDEB." }, { property: "og:title", content: "Relatórios — Radar FUNDEB" }, { property: "og:description", content: "Emissão e histórico de relatórios Análise do FUNDEB." }] }),
  component: Relatorios,
});

function kpis(r: any) {
  const A = r["snapshot"]?.analise || {};
  return { receita: A.receita_atual?.total || 0, projecao: A.projecao?.base.total || 0, potencial: A.potencial?.valor || 0, matriculas: A.cards?.matriculas_fundeb || 0, vaaf: A.cards?.ponderadas_vaaf || 0 };
}

function Relatorios() {
  const s = useSessao();
  const [ocupado, setOcupado] = useState("");
  const [filtroAno, setFiltroAno] = useState("");
  const [comp, setComp] = useState<string[]>([]);
  const { data: rels = [], refetch } = useQuery({
    queryKey: ["relatorios", s.municipioId],
    queryFn: () => pb().collection("relatorios").getFullList({ filter: pb().filter("municipio = {:m}", { m: s.municipioId }), sort: "-created" }),
    enabled: !!s.municipioId,
  });

  async function abrir(id: string) {
    setOcupado(id);
    try {
      const r = await pb().collection("relatorios").getOne(id);
      const snap: any = r["snapshot"];
      const m = snap.analise.municipio;
      const { gerarPdf } = await import("@/components/pdf/RelatorioPdf");
      const blob = await gerarPdf(snap, m.brasao ? arquivoUrl(m.collectionId, m.id, m.brasao) : "");
      api("/backend/v1/log", { method: "POST", body: { municipioId: s.municipioId, acao: "abrir_relatorio", detalhe: r["codigo"] } });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) baixarBlob(`analise-fundeb-${m.nome}-${r["ano"]}.pdf`, blob);
    } catch (e) { toast.error(mensagemErro(e)); }
    setOcupado("");
  }
  async function emitir() {
    setOcupado("novo");
    try {
      const r = await api<{ id: string }>("/backend/v1/relatorios", { method: "POST", body: { municipioId: s.municipioId, ano: s.ano } });
      await refetch();
      await abrir(r.id);
    } catch (e) { toast.error(mensagemErro(e)); }
    setOcupado("");
  }
  async function email(id: string) {
    try {
      const r = await api<any>(`/backend/v1/relatorios/${id}/email`, { method: "POST", body: { baseUrl: window.location.origin } });
      toast.success(`E-mail enviado para ${r.enviados} gestor(es).`);
    } catch (e) { toast.error(mensagemErro(e)); }
  }
  const lista = rels.filter((r) => !filtroAno || String(r["ano"]) === filtroAno);
  const anos = [...new Set(rels.map((r) => String(r["ano"])))];
  const [ra, rb] = comp.map((id) => rels.find((r) => r.id === id));

  if (!s.municipioId) return <Vazio titulo="Selecione um município" />;
  return (
    <div className="space-y-6">
      <TituloPagina titulo="Relatórios emitidos" descricao="Cada relatório congela os números usados (snapshot); reabrir mostra sempre os mesmos valores. O QR Code leva à página pública de verificação, que não exibe dados de alunos."
        acoes={s.podeEditar && <Button onClick={emitir} disabled={!!ocupado}>{ocupado === "novo" ? "Gerando…" : `Emitir relatório ${s.ano}`}</Button>} />
      <div className="flex gap-2 text-sm">Ano: {["", ...anos].map((a) => <button key={a} onClick={() => setFiltroAno(a)} className={`rounded px-2 ${filtroAno === a ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{a || "Todos"}</button>)}</div>
      {lista.length ? (
        <div className="overflow-x-auto rounded border bg-card">
          <table className="tabela-relatorio w-full text-sm">
            <thead className="bg-muted text-left"><tr><th className="p-2">Comparar</th><th className="p-2">Emitido em</th><th className="p-2">Ano</th><th className="p-2">Emitido por</th><th className="p-2">Código</th><th className="p-2 text-right">Receita</th><th /></tr></thead>
            <tbody>{lista.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2"><input type="checkbox" checked={comp.includes(r.id)} onChange={(e) => setComp(e.target.checked ? [...comp, r.id].slice(-2) : comp.filter((x) => x !== r.id))} /></td>
                <td className="p-2 num text-xs">{r["emitido_em"]}</td><td className="p-2">{r["ano"]}</td><td className="p-2">{r["emitido_por_nome"]}</td><td className="p-2 num text-xs">{r["codigo"]}</td><td className="p-2 text-right num">{brl(r["total_receita"])}</td>
                <td className="flex flex-wrap justify-end gap-1 p-2">
                  <Button size="sm" variant="outline" onClick={() => abrir(r.id)} disabled={!!ocupado}>{ocupado === r.id ? "Gerando…" : "Abrir PDF"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/verify/${r["codigo"]}`); toast.success("Link copiado"); }}>Copiar link</Button>
                  {s.podeEditar && <Button size="sm" variant="ghost" onClick={() => email(r.id)}>Enviar por e-mail</Button>}
                </td>
              </tr>))}</tbody>
          </table>
        </div>
      ) : <Vazio titulo="Nenhum relatório emitido" />}
      {ra && rb && (
        <Secao titulo="Comparação entre relatórios">
          <table className="w-full rounded bg-card text-sm">
            <thead className="bg-muted text-left"><tr><th className="p-2">KPI</th><th className="p-2 text-right">{ra["emitido_em"]}</th><th className="p-2 text-right">{rb["emitido_em"]}</th><th className="p-2 text-right">Diferença</th></tr></thead>
            <tbody>{(["receita", "projecao", "potencial", "matriculas", "vaaf"] as const).map((k) => {
              const a = kpis(ra)[k], b = kpis(rb)[k], din = k !== "matriculas" && k !== "vaaf";
              const f = (x: number) => (din ? brl(x) : decimal(x, 0));
              return <tr key={k} className="border-t"><td className="p-2">{{ receita: "Receita do ano", projecao: "Projeção base", potencial: "Potencial", matriculas: "Matrículas FUNDEB", vaaf: "Ponderadas VAAF" }[k]}</td><td className="p-2 text-right num">{f(a)}</td><td className="p-2 text-right num">{f(b)}</td><td className="p-2 text-right num">{f(b - a)}</td></tr>;
            })}</tbody>
          </table>
        </Secao>
      )}
    </div>
  );
}
