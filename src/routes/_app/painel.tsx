import { createFileRoute, Link } from "@tanstack/react-router";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAnalise } from "@/hooks/use-analise";
import { CabecalhoMunicipio, Carregando, Secao, StatCard, TituloPagina, Vazio } from "@/components/radar/ui";
import { pctVar, brl, decimal, inteiro, mi, pct, variacao } from "@/lib/format";
import { mensagemErro } from "@/lib/pb";

export const Route = createFileRoute("/_app/painel")({
  head: () => ({ meta: [{ title: "Painel — Radar FUNDEB" }, { name: "description", content: "Resumo do FUNDEB do município." }, { property: "og:title", content: "Painel — Radar FUNDEB" }, { property: "og:description", content: "Resumo do FUNDEB do município." }] }),
  component: Painel,
});

const CORES: Record<string, string> = { total: "var(--color-ink)", contribuicao: "var(--color-chart-1)", vaaf: "var(--color-chart-2)", vaat: "var(--color-chart-3)", vaar: "var(--color-chart-4)" };

function Painel() {
  const { data: A, isLoading, error } = useAnalise();
  if (isLoading) return <Carregando />;
  if (error) return <Vazio titulo="Não foi possível carregar a análise">{mensagemErro(error)}</Vazio>;
  if (!A) return <Vazio titulo="Selecione ou cadastre um município">Cadastre em <Link to="/parametros" className="underline">Parâmetros</Link>.</Vazio>;
  const c = A.cards, ra = A.receita_atual, rp = A.receita_anterior, m = A.municipio;
  return (
    <div className="space-y-6">
      <CabecalhoMunicipio m={m} />
      <TituloPagina titulo="Resumo do relatório" descricao={`Censo Escolar ${A.ano} · fatores de ponderação ${A.fatores_ano ?? "-"}`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard rotulo={`Receita FUNDEB ${A.ano}`} valor={brl(ra?.total)} variacao={rp ? variacao(ra?.total || 0, rp.total) : null} sub={rp ? `vs ${A.ano - 1}` : "sem receita do ano anterior"} />
        <StatCard rotulo={`Matrículas FUNDEB ${A.ano}`} valor={inteiro(c.matriculas_fundeb)} variacao={A.matriculas_fundeb_anterior ? variacao(c.matriculas_fundeb, A.matriculas_fundeb_anterior) : null} sub={`${inteiro(c.alunos_curricular)} curriculares + ${inteiro(c.matriculas_aee)} AEE`} />
        <StatCard rotulo="Potencial" valor={A.potencial ? A.potencial.classificacao : "—"} sub={A.potencial ? `${pctVar(A.potencial.pct_avancar)} para avançar.` : "cadastre os parâmetros de projeção"} destaque />
        <StatCard rotulo={`Projeção FUNDEB ${A.ano + 1}`} valor={brl(A.projecao?.base.total)} variacao={A.projecao ? A.projecao.variacoes.base.total : null} sub="cenário base" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard rotulo="Ponderadas VAAF" valor={inteiro(c.ponderadas_vaaf)} variacao={A.ponderadas_anterior?.vaaf ? variacao(c.ponderadas_vaaf, A.ponderadas_anterior.vaaf) : null} />
        <StatCard rotulo="Ponderadas VAAT" valor={inteiro(c.ponderadas_vaat)} variacao={A.ponderadas_anterior?.vaat ? variacao(c.ponderadas_vaat, A.ponderadas_anterior.vaat) : null} />
        <StatCard rotulo="Alunos com matrícula curricular" valor={inteiro(c.alunos_curricular)} />
        <StatCard rotulo="Matrículas de AEE" valor={inteiro(c.matriculas_aee)} />
      </div>
      <Secao titulo="Caracterização do município" descricao="Dados do IBGE (Censo 2022) e do Censo Escolar importado.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard rotulo="Total de escolas" valor={inteiro(c.total_escolas)} />
          <StatCard rotulo="Total de alunos" valor={inteiro(c.total_alunos)} />
          <StatCard rotulo="População" valor={inteiro(m.populacao)} />
          <StatCard rotulo="Domicílios" valor={inteiro(m.domicilios)} />
          <StatCard rotulo="Área territorial (km²)" valor={decimal(m.area_km2)} />
          <StatCard rotulo="Alfabetização" valor={`${decimal(m.alfabetizacao_pct)}%`} />
          <StatCard rotulo="Pop. indígena" valor={inteiro(m.pop_indigena)} />
          <StatCard rotulo="Pop. quilombola" valor={inteiro(m.pop_quilombola)} />
        </div>
      </Secao>
      <Secao titulo="Histórico de receitas do FUNDEB" descricao="Receitas de Contribuição (fundo estadual), Complementações da União VAAF, VAAT e VAAR. Total = soma dos componentes.">
        {A.receitas.length ? (
          <div className="h-80 rounded bg-card p-3">
            <ResponsiveContainer>
              <LineChart data={A.receitas}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="ano" />
                <YAxis tickFormatter={(v) => mi(v)} width={90} />
                <Tooltip formatter={(v: any) => brl(v)} />
                <Legend />
                <Line dataKey="total" name="Total" stroke={CORES["total"]} strokeWidth={3} />
                {(["contribuicao", "vaaf", "vaat", "vaar"] as const).map((k) => (
                  <Line key={k} dataKey={k} name={{ contribuicao: "Contribuição", vaaf: "VAAF", vaat: "VAAT", vaar: "VAAR" }[k]} stroke={CORES[k]} strokeDasharray="5 4" strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Vazio titulo="Nenhuma receita cadastrada">Cadastre em Parâmetros → Receitas.</Vazio>
        )}
      </Secao>
      <Secao titulo={`Receitas do FUNDEB para o ano de ${A.ano}`}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {(["total", "contribuicao", "vaaf", "vaat", "vaar"] as const).map((k) => (
            <StatCard key={k} rotulo={{ total: "Total", contribuicao: "Receitas de Contribuição", vaaf: "Complementação VAAF", vaat: "Complementação VAAT", vaar: "VAAR" }[k]} valor={brl(ra?.[k])} variacao={rp ? variacao(ra?.[k] || 0, rp[k]) : null} />
          ))}
        </div>
      </Secao>
      <p className="text-xs text-muted-foreground">Inconsistências abertas: {inteiro(Object.values(A.inconsistencias.abertas as Record<string, number>).reduce((a, b) => a + b, 0))} · Transporte: {pct(A.transporte.utiliza / Math.max(1, A.transporte.utiliza + A.transporte.nao_utiliza), 1)} utilizam</p>
    </div>
  );
}
