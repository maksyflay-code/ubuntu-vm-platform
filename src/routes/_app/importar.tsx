import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Secao, TituloPagina, Vazio } from "@/components/radar/ui";
import { agruparPorEscola, lerPlanilha, type EscolaPrevia, type Planilha } from "@/lib/educacenso";
import { api, mensagemErro, pb } from "@/lib/pb";
import { useSessao } from "@/hooks/use-sessao";
import { inteiro } from "@/lib/format";

export const Route = createFileRoute("/_app/importar")({
  head: () => ({ meta: [{ title: "Importar Educacenso — Radar FUNDEB" }, { name: "description", content: "Importação das planilhas do Educacenso." }, { property: "og:title", content: "Importar — Radar FUNDEB" }, { property: "og:description", content: "Importação das planilhas do Educacenso." }] }),
  component: Importar,
});

function Importar() {
  const s = useSessao();
  const qc = useQueryClient();
  const [previa, setPrevia] = useState<EscolaPrevia[]>([]);
  const [errosLeitura, setErrosLeitura] = useState<string[]>([]);
  const [progresso, setProgresso] = useState<{ feito: number; total: number; msg: string } | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const { data: mun } = useQuery({ queryKey: ["municipio", s.municipioId], queryFn: () => pb().collection("municipios").getOne(s.municipioId), enabled: !!s.municipioId });
  const { data: historico = [], refetch } = useQuery({
    queryKey: ["importacoes", s.municipioId, s.ano],
    queryFn: () => pb().collection("importacoes").getFullList({ filter: pb().filter("municipio = {:m} && ano_censo = {:a}", { m: s.municipioId, a: s.ano }), sort: "-created", expand: "usuario" }),
    enabled: !!s.municipioId,
  });

  async function ler(files: FileList | File[]) {
    const planilhas: Planilha[] = [];
    const erros: string[] = [];
    const entradas: { nome: string; buf: () => Promise<ArrayBuffer> }[] = [];
    for (const f of Array.from(files)) {
      if (f.name.toLowerCase().endsWith(".zip")) {
        const zip = await JSZip.loadAsync(f);
        zip.forEach((p, z) => {
          if (!z.dir && /\.xlsx?$/i.test(p) && !p.includes("__MACOSX")) entradas.push({ nome: p.split("/").pop()!, buf: () => z.async("arraybuffer") });
        });
      } else if (/\.xlsx?$/i.test(f.name)) entradas.push({ nome: f.name, buf: () => f.arrayBuffer() });
      else erros.push(`${f.name}: formato não suportado`);
    }
    for (const e of entradas) {
      try {
        planilhas.push(lerPlanilha(await e.buf(), e.nome));
      } catch (err) {
        erros.push(`${e.nome}: ${mensagemErro(err)}`);
      }
    }
    setErrosLeitura(erros);
    setPrevia(agruparPorEscola(planilhas, (mun?.["nome"] as string) || ""));
  }

  async function importar() {
    const validas = previa.filter((p) => !p.erros.length);
    if (!validas.length) { toast.error("Nenhuma escola válida para importar."); return; }
    setProgresso({ feito: 0, total: validas.length, msg: "" });
    let falhas = 0;
    for (let i = 0; i < validas.length; i++) {
      const e = validas[i]!;
      setProgresso({ feito: i, total: validas.length, msg: `Importando ${e.capa.nome}…` });
      try {
        await api("/backend/v1/importacao", {
          method: "POST",
          body: {
            municipioId: s.municipioId,
            ano: s.ano,
            escola: e.capa,
            turmas: e.turmas!.linhas,
            alunos: e.alunos!.linhas,
            arquivos: [
              { tipo: "alunos", nome: e.alunos!.arquivo, emitido_em: e.alunos!.emitidoEm, avisos: e.avisos },
              { tipo: "turmas", nome: e.turmas!.arquivo, emitido_em: e.turmas!.emitidoEm, avisos: [] },
            ],
          },
        });
      } catch (err) {
        falhas++;
        toast.error(`${e.capa.nome}: ${mensagemErro(err)}`);
      }
    }
    setProgresso({ feito: validas.length, total: validas.length, msg: "Processando o município (classificação e inconsistências)…" });
    try {
      const r: any = await api("/backend/v1/processar", { method: "POST", body: { municipioId: s.municipioId, ano: s.ano } });
      toast.success(`Importação concluída: ${r.escolas} escolas, ${inteiro(r.alunos)} alunos, ${inteiro(r.matriculas)} matrículas.${falhas ? ` ${falhas} escola(s) com erro.` : ""}`);
      setPrevia([]);
    } catch (err) {
      toast.error(mensagemErro(err));
    }
    setProgresso(null);
    qc.invalidateQueries();
    refetch();
  }

  async function reprocessar() {
    setProgresso({ feito: 1, total: 1, msg: "Reprocessando…" });
    try {
      await api("/backend/v1/processar", { method: "POST", body: { municipioId: s.municipioId, ano: s.ano } });
      toast.success("Município reprocessado.");
      qc.invalidateQueries();
    } catch (err) {
      toast.error(mensagemErro(err));
    }
    setProgresso(null);
  }

  if (!s.municipioId) return <Vazio titulo="Cadastre um município primeiro">Vá em Parâmetros → Município.</Vazio>;
  return (
    <div className="space-y-6">
      <TituloPagina
        titulo="Importar Educacenso"
        descricao={`Arraste os arquivos "Relação de alunos(as) da escola" e "Relação de turma(s) da escola" (.xlsx ou .zip) de ${mun?.["nome"] || ""} — Censo ${s.ano}. Reimportar uma escola substitui a carga anterior. O CPF é mascarado aqui no navegador e nunca é enviado completo.`}
        acoes={<Button variant="outline" onClick={reprocessar} disabled={!!progresso}>Reprocessar município</Button>}
      />
      <label
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); ler(e.dataTransfer.files); }}
        className={`grid-paper flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${arrastando ? "border-primary bg-secondary" : "bg-card"}`}
      >
        <UploadCloud className="h-10 w-10 text-primary" />
        <span className="mt-3 font-medium">Arraste os arquivos aqui ou clique para escolher</span>
        <span className="text-sm text-muted-foreground">Até ~80 arquivos (um par por escola) ou um ZIP</span>
        <input type="file" multiple accept=".xlsx,.xls,.zip" className="hidden" onChange={(e) => e.target.files && ler(e.target.files)} />
      </label>
      {errosLeitura.length > 0 && <div className="rounded bg-destructive-soft p-3 text-sm text-destructive">{errosLeitura.map((e) => <div key={e}>{e}</div>)}</div>}
      {progresso && (
        <div className="rounded border bg-card p-4">
          <div className="mb-2 text-sm">{progresso.msg} ({progresso.feito}/{progresso.total})</div>
          <Progress value={(progresso.feito / Math.max(1, progresso.total)) * 100} />
        </div>
      )}
      {previa.length > 0 && (
        <Secao titulo={`Prévia — ${previa.length} escola(s)`} acoes={<Button onClick={importar} disabled={!!progresso}>Importar {previa.filter((p) => !p.erros.length).length} escola(s)</Button>}>
          <div className="overflow-x-auto rounded bg-card">
            <table className="tabela-relatorio w-full text-sm">
              <thead className="bg-muted text-left"><tr><th className="p-2">Escola</th><th className="p-2">INEP</th><th className="p-2">Localização</th><th className="p-2 text-right">Turmas</th><th className="p-2 text-right">Linhas</th><th className="p-2 text-right">Alunos</th><th className="p-2">Avisos</th></tr></thead>
              <tbody>
                {previa.map((p) => (
                  <tr key={p.inep} className="border-t align-top">
                    <td className="p-2 font-medium">{p.capa.nome}</td><td className="p-2 num">{p.inep}</td><td className="p-2">{p.capa.localizacao}</td>
                    <td className="p-2 text-right num">{p.nTurmas}</td><td className="p-2 text-right num">{p.nLinhas}</td><td className="p-2 text-right num">{p.nAlunos}</td>
                    <td className="p-2 text-xs">
                      {p.erros.map((e) => <div key={e} className="text-destructive">✕ {e}</div>)}
                      {p.avisos.slice(0, 4).map((e) => <div key={e} className="text-warning">! {e}</div>)}
                      {p.avisos.length > 4 && <div className="text-muted-foreground">+{p.avisos.length - 4} avisos</div>}
                      {!p.erros.length && !p.avisos.length && <span className="text-success">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}
      <Secao titulo="Histórico de importações">
        {historico.length ? (
          <div className="overflow-x-auto rounded bg-card">
            <table className="tabela-relatorio w-full text-sm">
              <thead className="bg-muted text-left"><tr><th className="p-2">Data</th><th className="p-2">Escola</th><th className="p-2">Tipo</th><th className="p-2">Arquivo</th><th className="p-2">Emitido em</th><th className="p-2">Status</th><th className="p-2">Mensagens</th></tr></thead>
              <tbody>
                {historico.map((h) => (
                  <tr key={h.id} className="border-t align-top">
                    <td className="p-2 num text-xs">{new Date(h["created"]).toLocaleString("pt-BR")}</td>
                    <td className="p-2">{h["escola_nome"]} <span className="num text-xs text-muted-foreground">{h["escola_inep"]}</span></td>
                    <td className="p-2">{h["tipo"]}</td><td className="p-2 text-xs">{h["arquivo_nome"]}</td><td className="p-2 text-xs">{h["emitido_em"]}</td>
                    <td className={`p-2 font-medium ${h["status"] === "ok" ? "text-success" : h["status"] === "erro" ? "text-destructive" : "text-warning"}`}>{h["status"]}</td>
                    <td className="p-2 text-xs">{((h["mensagens"] as string[]) || []).slice(0, 3).join(" · ")}{((h["mensagens"] as string[]) || []).length > 3 ? " …" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vazio titulo="Nenhuma importação neste município/ano" />
        )}
      </Secao>
    </div>
  );
}
