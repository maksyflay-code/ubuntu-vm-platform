import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useAnalise } from "@/hooks/use-analise";
import { CabecalhoMunicipio, Carregando, Secao, StatCard, TituloPagina, Vazio } from "@/components/radar/ui";
import { ListaMatriculas } from "@/components/radar/ListaNominal";
import { inteiro, pct } from "@/lib/format";
import { mensagemErro } from "@/lib/pb";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/escolas")({
  head: () => ({ meta: [{ title: "Escolas — Radar FUNDEB" }, { name: "description", content: "Residência rural e transporte escolar por escola." }, { property: "og:title", content: "Escolas — Radar FUNDEB" }, { property: "og:description", content: "Residência rural e transporte escolar por escola." }] }),
  component: Escolas,
});

function Escolas() {
  const { data: A, isLoading, error } = useAnalise();
  const [filtro, setFiltro] = useState("todas");
  const [aberta, setAberta] = useState<any>(null);
  if (isLoading) return <Carregando />;
  if (error) return <Vazio titulo="Erro">{mensagemErro(error)}</Vazio>;
  if (!A || !A.escolas.length) return <Vazio titulo="Nenhuma escola importada neste ano">Use a tela Importar.</Vazio>;
  const t = filtro === "todas" ? A.transporte : A.transporte.por_escola[filtro] || { utiliza: 0, nao_utiliza: 0 };
  const tot = t.utiliza + t.nao_utiliza;
  return (
    <div className="space-y-6">
      <CabecalhoMunicipio m={A.municipio} />
      <TituloPagina titulo="Escolas" />
      <Secao titulo="Residência rural" descricao="Escola urbana com 50% ou mais de alunos com residência rural deve ser tratada como Educação do Campo (fator ×1,15), conforme Decreto 7.352/2010 e Decreto 10.656/2021. Para escolas rurais a regra não se aplica. Clique numa escola para ver as matrículas.">
        <div className="overflow-x-auto rounded bg-card">
          <table className="tabela-relatorio w-full text-sm">
            <thead className="bg-muted text-left"><tr><th className="p-2">Escola</th><th className="p-2">INEP</th><th className="p-2 text-right">Alunos Urb.</th><th className="p-2 text-right">Alunos Rur.</th><th className="p-2">Zona</th><th className="p-2">Área</th><th className="p-2">Resid. Rural</th></tr></thead>
            <tbody>{A.escolas.map((e: any) => (
              <tr key={e.id} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => setAberta(e)}>
                <td className="p-2 font-medium">{e.nome}</td><td className="p-2 num">{e.inep}</td><td className="p-2 text-right num">{inteiro(e.qtd_urbanos)}</td><td className="p-2 text-right num">{inteiro(e.qtd_rurais)}</td>
                <td className="p-2">{e.localizacao}</td><td className="p-2 text-xs">{e.area}</td>
                <td className="p-2 font-semibold">{e.residencia_rural === "NA" ? <span className="font-normal text-muted-foreground">Não se aplica</span> : e.residencia_rural === "SIM" ? <span className="text-success">SIM ({pct(e.pct_rural, 0)})</span> : <span className="text-destructive">NÃO ({pct(e.pct_rural, 0)})</span>}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </Secao>
      <Secao titulo="Transporte escolar" descricao="Universo: alunos distintos com matrícula curricular. Utiliza = alguma matrícula curricular com transporte escolar = Sim."
        acoes={<Select value={filtro} onValueChange={setFiltro}><SelectTrigger className="w-72 bg-card"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as escolas</SelectItem>{A.escolas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent></Select>}>
        <div className="grid items-center gap-6 md:grid-cols-[280px_1fr]">
          <div className="h-64">
            <ResponsiveContainer><PieChart><Pie data={[{ n: "Utiliza", v: t.utiliza }, { n: "Não utiliza", v: t.nao_utiliza }]} dataKey="v" nameKey="n" innerRadius={60} outerRadius={100}><Cell fill="var(--color-primary)" /><Cell fill="var(--color-chart-4)" /></Pie><Tooltip /></PieChart></ResponsiveContainer>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard rotulo="Utiliza" valor={inteiro(t.utiliza)} sub={pct(tot ? t.utiliza / tot : 0, 1)} />
            <StatCard rotulo="Não utiliza" valor={inteiro(t.nao_utiliza)} sub={pct(tot ? t.nao_utiliza / tot : 0, 1)} />
          </div>
        </div>
      </Secao>
      {aberta && <ListaMatriculas titulo={aberta.nome} escolaId={aberta.id} onClose={() => setAberta(null)} />}
    </div>
  );
}
