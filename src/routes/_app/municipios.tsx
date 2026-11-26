import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSessao } from "@/hooks/use-sessao";
import { TituloPagina, Vazio } from "@/components/radar/ui";
import { api } from "@/lib/pb";
import { brl, decimal, inteiro } from "@/lib/format";

export const Route = createFileRoute("/_app/municipios")({
  head: () => ({ meta: [{ title: "Municípios — Radar FUNDEB" }, { name: "description", content: "Visão geral dos municípios acompanhados." }, { property: "og:title", content: "Municípios — Radar FUNDEB" }, { property: "og:description", content: "Visão geral dos municípios acompanhados." }] }),
  component: Municipios,
});

function Municipios() {
  const s = useSessao();
  const navigate = useNavigate();
  const { data = [] } = useQuery({ queryKey: ["mun-resumo", s.ano], queryFn: () => api<any[]>("/backend/v1/municipios-resumo", { query: { ano: s.ano } }) });
  return (
    <div className="space-y-4">
      <TituloPagina titulo="Municípios" descricao={`Situação de cada município no Censo ${s.ano}. Clique para abrir o painel. Novos municípios são cadastrados em Parâmetros → Município.`} />
      {data.length ? (
        <div className="overflow-x-auto rounded border bg-card">
          <table className="tabela-relatorio w-full text-sm">
            <thead className="bg-muted text-left"><tr><th className="p-2">Município</th><th className="p-2 text-right">Escolas</th><th className="p-2">Última importação</th><th className="p-2 text-right">Inconsist. abertas</th><th className="p-2 text-right">Receita {s.ano}</th><th className="p-2 text-right">Potencial</th><th className="p-2">Último relatório</th></tr></thead>
            <tbody>{data.map((m) => (
              <tr key={m.id} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => { s.setMunicipioId(m.id); navigate({ to: "/painel" }); }}>
                <td className="p-2 font-medium">{m.nome} - {m.uf}</td><td className="p-2 text-right num">{inteiro(m.escolas)}</td>
                <td className="p-2 text-xs">{m.ultima_importacao ? new Date(m.ultima_importacao).toLocaleString("pt-BR") : "—"}</td>
                <td className="p-2 text-right num">{inteiro(m.inconsistencias_abertas)}</td><td className="p-2 text-right num">{brl(m.receita)}</td>
                <td className="p-2 text-right num">{m.potencial ? `${brl(m.potencial.valor)} (${m.potencial.classificacao}, ${decimal(m.potencial.pct_avancar * 100)}%)` : "—"}</td>
                <td className="p-2 text-xs">{m.ultimo_relatorio || "—"}</td>
              </tr>))}</tbody>
          </table>
        </div>
      ) : <Vazio titulo="Nenhum município disponível" />}
    </div>
  );
}
