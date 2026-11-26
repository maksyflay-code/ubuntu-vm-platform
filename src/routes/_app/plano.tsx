import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSessao } from "@/hooks/use-sessao";
import { useAnalise } from "@/hooks/use-analise";
import { CabecalhoMunicipio, Carregando, Secao, StatCard, TituloPagina, Vazio } from "@/components/radar/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { pctVar, brl, decimal } from "@/lib/format";
import { api, mensagemErro, pb } from "@/lib/pb";

export const Route = createFileRoute("/_app/plano")({
  head: () => ({ meta: [{ title: "Plano de Ação — Radar FUNDEB" }, { name: "description", content: "Ações priorizadas por impacto na receita do FUNDEB." }, { property: "og:title", content: "Plano de Ação — Radar FUNDEB" }, { property: "og:description", content: "Ações priorizadas por impacto na receita do FUNDEB." }] }),
  component: Plano,
});

function Plano() {
  const s = useSessao();
  const { data: A } = useAnalise();
  const [pcts, setPcts] = useState<Record<string, string>>({});
  const [aplicado, setAplicado] = useState<Record<string, string>>({});
  const { data: acoes = [] } = useQuery({ queryKey: ["acoes"], queryFn: () => pb().collection("acoes_modelo").getFullList({ sort: "ordem" }) });
  const { data, isLoading, error } = useQuery({
    queryKey: ["plano", s.municipioId, s.ano, aplicado],
    queryFn: () => api<any>("/backend/v1/plano-acao", { query: { municipioId: s.municipioId, ano: s.ano, pcts: JSON.stringify(aplicado) } }),
    enabled: !!s.municipioId,
  });
  if (isLoading) return <Carregando />;
  if (error) return <Vazio titulo="Erro">{mensagemErro(error)}</Vazio>;
  if (!data?.plano) return <Vazio titulo="Parâmetros de projeção não cadastrados">Cadastre em <Link to="/parametros" className="underline">Parâmetros → Projeção</Link>.</Vazio>;
  const P = data.plano, pot = data.potencial;
  const simulando = Object.keys(aplicado).length > 0;
  return (
    <div className="space-y-6">
      {A && <CabecalhoMunicipio m={A.municipio} />}
      <TituloPagina titulo="Plano de ação" descricao="Ações simuladas sobre a distribuição atual de matrículas, ordenadas por impacto na receita prevista. Impacto = Δ ponderadas VAAF × (valor contribuição + VAAF) + Δ ponderadas VAAT × valor VAAT marginal." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard rotulo="Implementar integralmente" valor={brl(P.integral.impacto)} sub={`+${decimal(P.integral.pp * 100)} p.p.`} destaque />
        <StatCard rotulo="Soma das ações isoladas" valor={brl(P.soma_isoladas)} />
        <StatCard rotulo={`Potencial (${pot?.classificacao || "-"})`} valor={brl(pot?.valor)} sub={pot ? `${pctVar(pot.pct_avancar)} para avançar` : ""} />
      </div>
      {simulando && <div className="rounded bg-warning-soft p-3 text-sm">Simulação ativa (não salva). <button className="underline" onClick={() => { setAplicado({}); setPcts({}); }}>Voltar aos valores padrão</button></div>}
      <Secao titulo="Ações">
        <div className="overflow-x-auto rounded bg-card">
          <table className="tabela-relatorio w-full text-sm">
            <thead className="bg-muted text-left"><tr><th className="p-2">Ação</th><th className="p-2 text-right">Impacto na Receita Prevista</th><th className="p-2 text-right">Impacto no Crescimento</th></tr></thead>
            <tbody>
              <tr className="border-t bg-secondary font-semibold"><td className="p-2">Implementar integralmente as ações previstas neste Plano de Ação.</td><td className="p-2 text-right num text-success">{brl(P.integral.impacto)}</td><td className="p-2 text-right num">{pctVar(P.integral.pp)} p.p.</td></tr>
              {P.acoes.map((a: any) => (
                <tr key={a.id} className="border-t"><td className="p-2">{a.descricao}</td><td className="p-2 text-right num text-success">{brl(a.impacto)}</td><td className="p-2 text-right num">{pctVar(a.pp)} p.p.</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Os impactos de cada ação são calculados isoladamente. Como as ações podem interagir entre si, aplicar mais de uma simultaneamente tende a gerar um impacto total diferente da simples soma dos valores acima.</p>
      </Secao>
      <Secao titulo="Simulador" descricao="Altere o percentual de cada ação (aumento de matrículas ou % convertido para tempo integral) e recalcule. Nada é salvo.">
        <div className="grid gap-2">
          {acoes.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded bg-card p-2 text-sm">
              <Input className="w-24" type="number" value={pcts[a.id] ?? String(a["pct"])} onChange={(e) => setPcts({ ...pcts, [a.id]: e.target.value })} />
              <span className="text-muted-foreground">%</span>
              <span>{String(a["descricao"]).replace("{pct}", pcts[a.id] ?? String(a["pct"]))}</span>
            </div>
          ))}
        </div>
        <Button className="mt-3" onClick={() => setAplicado({ ...pcts })}>Recalcular</Button>
      </Secao>
    </div>
  );
}
