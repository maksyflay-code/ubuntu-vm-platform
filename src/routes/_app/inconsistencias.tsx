import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useAnalise } from "@/hooks/use-analise";
import { useSessao } from "@/hooks/use-sessao";
import { CabecalhoMunicipio, Carregando, ROTULO_INCONSISTENCIA, Secao, TituloPagina, Vazio } from "@/components/radar/ui";
import { Button } from "@/components/ui/button";
import { api, mensagemErro, pb } from "@/lib/pb";
import { baixarCSV } from "@/lib/csv";
import { inteiro } from "@/lib/format";

export const Route = createFileRoute("/_app/inconsistencias")({
  head: () => ({ meta: [{ title: "Inconsistências — Radar FUNDEB" }, { name: "description", content: "Inconsistências cadastrais a corrigir no Educacenso." }, { property: "og:title", content: "Inconsistências — Radar FUNDEB" }, { property: "og:description", content: "Inconsistências cadastrais a corrigir no Educacenso." }] }),
  component: Inconsistencias,
});

function Inconsistencias() {
  const s = useSessao();
  const qc = useQueryClient();
  const { data: A, isLoading, error } = useAnalise();
  const [tipo, setTipo] = useState<string | null>(null);
  const lista = useQuery({
    queryKey: ["inc-lista", s.municipioId, s.ano, tipo],
    queryFn: () => api<any[]>("/backend/v1/inconsistencias/lista", { query: { municipioId: s.municipioId, ano: s.ano, tipo } }),
    enabled: !!tipo,
  });
  if (isLoading) return <Carregando />;
  if (error) return <Vazio titulo="Erro">{mensagemErro(error)}</Vazio>;
  if (!A) return <Vazio titulo="Selecione um município" />;
  const I = A.inconsistencias;
  const resumo = Object.keys(ROTULO_INCONSISTENCIA).map((t) => ({ t, n: I.abertas[t] || 0, c: I.corrigidas[t] || 0 })).sort((a, b) => b.n - a.n);
  const linhas = lista.data || [];

  function exportar() {
    baixarCSV(`inconsistencias-${tipo}-${s.ano}.csv`, ["Aluno", "ID INEP", "Nascimento", "CPF", "Escola(s)", "Turma(s)", "Detalhe", "Deficiências", "Status"],
      linhas.map((r) => [r.aluno, r.inep, r.nascimento, r.cpf, r.escolas, r.turmas, r.detalhe, r.deficiencias, r.status]));
    api("/backend/v1/log", { method: "POST", body: { municipioId: s.municipioId, acao: "exportar_csv", detalhe: `Inconsistências ${tipo} (${s.ano})` } });
  }
  async function alternar(r: any) {
    try {
      await pb().collection("inconsistencias").update(r.id, { status: r.status === "corrigida" ? "aberta" : "corrigida" });
      lista.refetch();
      qc.invalidateQueries({ queryKey: ["analise"] });
    } catch (e) { toast.error(mensagemErro(e)); }
  }
  return (
    <div className="space-y-6">
      <CabecalhoMunicipio m={A.municipio} />
      <TituloPagina titulo="Inconsistências identificadas" descricao="Alunos consolidados em todas as escolas do município pela Identificação única do INEP. Corrija no Educacenso antes do fechamento do Censo. CPF e nascimento sempre mascarados." />
      <Secao titulo="Resumo">
        <div className="overflow-x-auto rounded bg-card">
          <table className="tabela-relatorio w-full text-sm">
            <thead className="bg-muted text-left"><tr><th className="p-2">Tipo</th><th className="p-2">Descrição</th><th className="p-2 text-right">Abertas</th><th className="p-2 text-right">Corrigidas</th><th /></tr></thead>
            <tbody>{resumo.map((r) => (
              <tr key={r.t} className={`border-t ${tipo === r.t ? "bg-secondary" : ""}`}>
                <td className="p-2 font-medium">{ROTULO_INCONSISTENCIA[r.t]!.titulo}{r.t === "MAIS_DE_UM_VINCULO_AEE" && <span className="ml-2 rounded bg-warning-soft px-1.5 text-[10px] font-semibold uppercase">em validação</span>}</td>
                <td className="p-2 text-xs text-muted-foreground">{ROTULO_INCONSISTENCIA[r.t]!.descricao}{r.t === "MAIS_DE_UM_VINCULO_AEE" && ` Hipótese (a): ${I.hipotese_a} · Hipótese (b): ${I.hipotese_b}.`}</td>
                <td className="p-2 text-right num font-semibold">{inteiro(r.n)}</td><td className="p-2 text-right num text-muted-foreground">{inteiro(r.c)}</td>
                <td className="p-2"><Button size="sm" variant="outline" onClick={() => setTipo(r.t)}>Ver lista</Button></td>
              </tr>))}</tbody>
          </table>
        </div>
      </Secao>
      {tipo && (
        <Secao titulo={ROTULO_INCONSISTENCIA[tipo]!.titulo} descricao={ROTULO_INCONSISTENCIA[tipo]!.descricao} acoes={<Button size="sm" onClick={exportar} disabled={!linhas.length}>Exportar CSV</Button>}>
          {lista.isLoading ? <Carregando /> : (
            <div className="overflow-x-auto rounded bg-card">
              <table className="tabela-relatorio w-full text-xs">
                <thead className="bg-muted text-left"><tr><th className="p-2">Aluno</th><th className="p-2">INEP</th><th className="p-2">Nascimento</th><th className="p-2">CPF</th><th className="p-2">Escola(s)</th><th className="p-2">Turma(s)</th>{tipo === "DEFICIENCIA_SEM_AEE" && <th className="p-2">Deficiências</th>}{tipo === "MAIS_DE_UM_VINCULO_AEE" && <th className="p-2">Hipótese</th>}<th /></tr></thead>
                <tbody>
                  {linhas.map((r) => (
                    <tr key={r.id} className={`border-t align-top ${r.status === "corrigida" ? "text-muted-foreground line-through" : ""}`}>
                      <td className="p-2 font-medium">{r.aluno}</td><td className="p-2 num">{r.inep}</td><td className="p-2 num">{r.nascimento}</td><td className="p-2 num">{r.cpf}</td><td className="p-2">{r.escolas}</td><td className="p-2">{r.turmas}</td>
                      {tipo === "DEFICIENCIA_SEM_AEE" && <td className="p-2">{r.deficiencias}</td>}{tipo === "MAIS_DE_UM_VINCULO_AEE" && <td className="p-2">{r.detalhe}</td>}
                      <td className="p-2 no-underline">{s.podeEditar && <Button size="sm" variant="ghost" onClick={() => alternar(r)}>{r.status === "corrigida" ? "Reabrir" : "Marcar corrigida"}</Button>}</td>
                    </tr>))}
                  <tr className="border-t-2 font-bold"><td className="p-2" colSpan={9}>Total: {inteiro(linhas.length)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </Secao>
      )}
    </div>
  );
}
