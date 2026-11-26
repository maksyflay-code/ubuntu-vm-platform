import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { useAnalise } from "@/hooks/use-analise";
import { CabecalhoMunicipio, Carregando, Secao, TituloPagina, VarBadge, Vazio } from "@/components/radar/ui";
import { ListaMatriculas } from "@/components/radar/ListaNominal";
import { decimal, inteiro, variacao } from "@/lib/format";
import { mensagemErro } from "@/lib/pb";

export const Route = createFileRoute("/_app/matriculas")({
  head: () => ({ meta: [{ title: "Matrículas e Ponderações — Radar FUNDEB" }, { name: "description", content: "Evolução de matrículas e ponderações VAAF/VAAT." }, { property: "og:title", content: "Matrículas e Ponderações — Radar FUNDEB" }, { property: "og:description", content: "Evolução de matrículas e ponderações VAAF/VAAT." }] }),
  component: Matriculas,
});

function Cel({ atual, ant, destaque }: { atual: number; ant?: number; destaque?: boolean }) {
  return (
    <td className={`p-2 text-right num ${destaque ? "bg-secondary/60" : ""}`}>
      {inteiro(atual)}
      {ant !== undefined && (ant || atual) ? <div><VarBadge valor={ant ? variacao(atual, ant) : 0} /></div> : null}
    </td>
  );
}

function Matriculas() {
  const { data: A, isLoading, error } = useAnalise();
  const [sub, setSub] = useState<string | null>(null);
  if (isLoading) return <Carregando />;
  if (error) return <Vazio titulo="Erro">{mensagemErro(error)}</Vazio>;
  if (!A || !A.tabela.grupos.length) return <Vazio titulo="Sem matrículas classificadas">Importe o Educacenso deste ano.</Vazio>;
  const T = A.tabela, ano = A.ano;
  return (
    <div className="space-y-6">
      <CabecalhoMunicipio m={A.municipio} />
      <TituloPagina titulo="Evolução de matrículas e ponderações" descricao={<>Fatores de ponderação conforme a Resolução CIF nº 5, de 26 de julho de 2024 (editáveis em Parâmetros → Fatores). Ano anterior: {A.fonte_anterior === "importacao" ? "importação do Censo " + (ano - 1) : A.fonte_anterior === "digitada" ? "totais digitados" : "não informado"}. Clique numa subcategoria para ver os alunos.</>} />
      <Secao titulo={`Censo ${ano - 1} × ${ano}`}>
        <div className="overflow-x-auto rounded bg-card">
          <table className="tabela-relatorio w-full text-sm">
            <thead className="bg-muted"><tr>
              <th className="p-2 text-left">Categoria</th><th className="p-2 text-right">Peso</th>
              <th className="p-2 text-right">Matríc. Ant.</th><th className="bg-primary p-2 text-right text-primary-foreground">Matríc. {ano}</th>
              <th className="p-2 text-right">VAAF Ant.</th><th className="bg-primary p-2 text-right text-primary-foreground">VAAF {ano}</th>
              <th className="p-2 text-right">VAAT Ant.</th><th className="bg-primary p-2 text-right text-primary-foreground">VAAT {ano}</th>
            </tr></thead>
            <tbody>
              {T.grupos.map((g: any) => (
                <Fragment key={g.grupo}>
                  <tr className="border-t bg-section font-semibold"><td className="p-2" colSpan={2}>{g.nome}</td>
                    <td className="p-2 text-right num">{inteiro(g.totais.ant.matriculas)}</td><Cel atual={g.totais.atual.matriculas} ant={g.totais.ant.matriculas} destaque />
                    <td className="p-2 text-right num">{inteiro(g.totais.ant.vaaf)}</td><Cel atual={g.totais.atual.vaaf} ant={g.totais.ant.vaaf} destaque />
                    <td className="p-2 text-right num">{inteiro(g.totais.ant.vaat)}</td><Cel atual={g.totais.atual.vaat} ant={g.totais.ant.vaat} destaque /></tr>
                  {g.linhas.map((l: any) => (
                    <tr key={l.subcategoria} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => setSub(l.subcategoria)}>
                      <td className="p-2 pl-6 text-primary underline-offset-2 hover:underline">{l.subcategoria}</td><td className="p-2 text-right num">{decimal(l.peso, 4)}</td>
                      <td className="p-2 text-right num">{inteiro(l.ant.matriculas)}</td><Cel atual={l.atual.matriculas} ant={l.ant.matriculas} destaque />
                      <td className="p-2 text-right num">{inteiro(l.ant.vaaf)}</td><Cel atual={l.atual.vaaf} ant={l.ant.vaaf} destaque />
                      <td className="p-2 text-right num">{inteiro(l.ant.vaat)}</td><Cel atual={l.atual.vaat} ant={l.ant.vaat} destaque />
                    </tr>))}
                </Fragment>
              ))}
              <tr className="border-t-2 border-foreground font-bold"><td className="p-2" colSpan={2}>Total geral</td>
                <td className="p-2 text-right num">{inteiro(T.total.ant.matriculas)}</td><Cel atual={T.total.atual.matriculas} ant={T.total.ant.matriculas} destaque />
                <td className="p-2 text-right num">{inteiro(T.total.ant.vaaf)}</td><Cel atual={T.total.atual.vaaf} ant={T.total.ant.vaaf} destaque />
                <td className="p-2 text-right num">{inteiro(T.total.ant.vaat)}</td><Cel atual={T.total.atual.vaat} ant={T.total.ant.vaat} destaque /></tr>
            </tbody>
          </table>
        </div>
      </Secao>
      {sub && <ListaMatriculas titulo={sub} subcategoria={sub} onClose={() => setSub(null)} />}
    </div>
  );
}
