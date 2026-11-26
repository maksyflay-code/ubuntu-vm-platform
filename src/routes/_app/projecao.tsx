import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAnalise } from "@/hooks/use-analise";
import { CabecalhoMunicipio, Carregando, Secao, StatCard, TituloPagina, Vazio } from "@/components/radar/ui";
import { pctVar, brl, decimal, mi } from "@/lib/format";
import { mensagemErro } from "@/lib/pb";

export const Route = createFileRoute("/_app/projecao")({
  head: () => ({ meta: [{ title: "Projeção e Potencial — Radar FUNDEB" }, { name: "description", content: "Projeção do FUNDEB em três cenários e régua de potencial." }, { property: "og:title", content: "Projeção — Radar FUNDEB" }, { property: "og:description", content: "Projeção do FUNDEB em três cenários e régua de potencial." }] }),
  component: Projecao,
});

const COMP = [["total", "Total"], ["contribuicao", "Receitas de Contribuição"], ["vaaf", "VAAF"], ["vaat", "VAAT"], ["vaar", "VAAR"]] as const;

export function ReguaPotencial({ A }: { A: any }) {
  const p = A.potencial;
  const max = Math.max(p.valor, p.atual, p.referencial) * 1.08 || 1;
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  return (
    <div>
      <div className="relative mx-2 mb-10 mt-8 h-4 rounded-full regua-potencial">
        <div className="absolute -top-3 h-10 border-l-2 border-dashed border-foreground" style={{ left: pos(p.referencial) }}><span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-xs">Referencial</span></div>
        <div className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-ink" style={{ left: pos(p.atual) }}><span className="absolute top-6 -translate-x-1/4 whitespace-nowrap text-xs font-semibold">{A.municipio.nome}</span></div>
        <div className="absolute -top-3 h-10 border-l-2 border-dotted border-success" style={{ left: pos(p.valor) }}><span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-success">Potencial</span></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard rotulo="Referencial" valor={brl(p.referencial)} />
        <StatCard rotulo={`${A.municipio.nome} - ${A.municipio.uf}`} valor={brl(p.atual)} />
        <StatCard rotulo={`Potencial (${p.classificacao})`} valor={brl(p.valor)} sub={`${pctVar(p.pct_avancar)} para avançar`} destaque />
      </div>
    </div>
  );
}

function Projecao() {
  const { data: A, isLoading, error } = useAnalise();
  if (isLoading) return <Carregando />;
  if (error) return <Vazio titulo="Erro">{mensagemErro(error)}</Vazio>;
  if (!A?.projecao) return <Vazio titulo="Parâmetros de projeção não cadastrados">Cadastre em <Link to="/parametros" className="underline">Parâmetros → Projeção</Link> para o ano {A ? A.ano + 1 : ""}.</Vazio>;
  const P = A.projecao;
  const dados = COMP.map(([k, n]) => ({ n, Conservador: P.conservador[k], Base: P.base[k], Otimista: P.otimista[k] }));
  return (
    <div className="space-y-6">
      <CabecalhoMunicipio m={A.municipio} />
      <TituloPagina titulo={`Projeção do FUNDEB para ${A.ano + 1}`} descricao="A projeção usa parâmetros oficiais do governo federal (VAAF, VAAT e VAAR), receitas apuradas pela STN/SIAFI, matrículas do Censo Escolar e fatores de ponderação; valores podem mudar conforme atualizações do FNDE/MEC." />
      <Secao titulo="Cenários por componente">
        <div className="h-96 rounded bg-card p-3">
          <ResponsiveContainer>
            <BarChart data={dados}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="n" /><YAxis tickFormatter={(v) => mi(v)} width={90} /><Tooltip formatter={(v: any) => brl(v)} /><Legend />
              <Bar dataKey="Conservador" fill="var(--color-destructive)"><LabelList dataKey="Conservador" position="top" formatter={(v: any) => mi(v)} fontSize={10} /></Bar>
              <Bar dataKey="Base" fill="var(--color-primary)"><LabelList dataKey="Base" position="top" formatter={(v: any) => mi(v)} fontSize={10} /></Bar>
              <Bar dataKey="Otimista" fill="var(--color-success)"><LabelList dataKey="Otimista" position="top" formatter={(v: any) => mi(v)} fontSize={10} /></Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Secao>
      {(["conservador", "base", "otimista"] as const).map((c) => (
        <Secao key={c} titulo={`Cenário ${c === "base" ? "base" : c}`.toUpperCase()}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {COMP.map(([k, n]) => <StatCard key={k} rotulo={n} valor={brl(P[c][k])} variacao={P.variacoes[c][k]} sub={`vs ${A.ano}`} />)}
          </div>
        </Secao>
      ))}
      <Secao titulo="Potencial de crescimento das receitas do FUNDEB" descricao="Potencial = projeção base + impacto do plano de ação implementado integralmente. O referencial é o patamar cadastrado nos parâmetros. Classificação pelos limiares de “% para avançar”.">
        <ReguaPotencial A={A} />
      </Secao>
    </div>
  );
}
