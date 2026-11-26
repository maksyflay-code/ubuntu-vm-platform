import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, mensagemErro } from "@/lib/pb";
import { baixarCSV } from "@/lib/csv";
import { decimal } from "@/lib/format";
import { useSessao } from "@/hooks/use-sessao";

/** Drill-down de matrículas por subcategoria ou escola (dados mascarados, acesso registrado). */
export function ListaMatriculas({ titulo, subcategoria, escolaId, onClose }: { titulo: string; subcategoria?: string; escolaId?: string; onClose: () => void }) {
  const s = useSessao();
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["lista-mat", s.municipioId, s.ano, subcategoria, escolaId],
    queryFn: () => api<any[]>("/backend/v1/matriculas/lista", { query: { municipioId: s.municipioId, ano: s.ano, subcategoria: subcategoria || "", escolaId: escolaId || "" } }),
  });
  function exportar() {
    baixarCSV(`matriculas-${s.ano}.csv`, ["Escola", "Turma", "Aluno", "INEP", "Nascimento", "CPF", "Subcategoria", "Fator VAAF", "Fator VAAT", "Conta FUNDEB", "Aviso"],
      data.map((r) => [r.escola, r.turma, r.aluno, r.inep, r.nascimento, r.cpf, r.subcategoria, decimal(r.fator_vaaf, 4), decimal(r.fator_vaat, 4), r.conta_fundeb ? "Sim" : "Não", r.aviso]));
    api("/backend/v1/log", { method: "POST", body: { municipioId: s.municipioId, acao: "exportar_csv", detalhe: `Matrículas ${titulo}` } });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden">
        <DialogHeader><DialogTitle>{titulo} — {data.length} matrículas</DialogTitle></DialogHeader>
        <div className="flex justify-end"><Button size="sm" variant="outline" onClick={exportar} disabled={!data.length}>Exportar CSV</Button></div>
        <div className="max-h-[60vh] overflow-auto">
          {isLoading ? "Carregando…" : error ? mensagemErro(error) : (
            <table className="tabela-relatorio w-full text-xs">
              <thead className="sticky top-0 bg-muted text-left"><tr><th className="p-1.5">Escola</th><th className="p-1.5">Turma</th><th className="p-1.5">Aluno</th><th className="p-1.5">INEP</th><th className="p-1.5">CPF</th><th className="p-1.5">Subcategoria</th><th className="p-1.5 text-right">VAAF</th><th className="p-1.5 text-right">VAAT</th></tr></thead>
              <tbody>{data.map((r) => (
                <tr key={r.id} className={`border-t ${r.conta_fundeb ? "" : "text-muted-foreground"}`}>
                  <td className="p-1.5">{r.escola}</td><td className="p-1.5">{r.turma}</td><td className="p-1.5">{r.aluno}</td><td className="p-1.5 num">{r.inep}</td><td className="p-1.5 num">{r.cpf}</td>
                  <td className="p-1.5">{r.subcategoria}{r.aviso && <div className="text-warning">{r.aviso}</div>}</td><td className="p-1.5 text-right num">{decimal(r.fator_vaaf, 4)}</td><td className="p-1.5 text-right num">{decimal(r.fator_vaat, 4)}</td>
                </tr>))}</tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
