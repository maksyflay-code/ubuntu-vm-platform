import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSessao } from "@/hooks/use-sessao";
import { Secao, TituloPagina } from "@/components/radar/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, mensagemErro, pb } from "@/lib/pb";
import { baixarCSV, lerCSV, numeroBR } from "@/lib/csv";
import { brl, decimal, inteiro } from "@/lib/format";

export const Route = createFileRoute("/_app/parametros")({
  head: () => ({ meta: [{ title: "Parâmetros — Radar FUNDEB" }, { name: "description", content: "Município, receitas, projeção, fatores e ações." }, { property: "og:title", content: "Parâmetros — Radar FUNDEB" }, { property: "og:description", content: "Município, receitas, projeção, fatores e ações." }] }),
  component: Parametros,
});

const logParam = (municipioId: string, detalhe: string) => api("/backend/v1/log", { method: "POST", body: { municipioId, acao: "alterar_parametros", detalhe } }).catch(() => {});

function Parametros() {
  const s = useSessao();
  return (
    <div className="space-y-4">
      <TituloPagina titulo="Parâmetros" descricao="Cadastros que alimentam os cálculos. Gestores apenas visualizam." />
      <Tabs defaultValue="municipio">
        <TabsList className="flex-wrap">
          <TabsTrigger value="municipio">Município</TabsTrigger><TabsTrigger value="receitas">Receitas</TabsTrigger><TabsTrigger value="projecao">Projeção</TabsTrigger>
          <TabsTrigger value="fatores">Fatores</TabsTrigger><TabsTrigger value="anterior">Base do ano anterior</TabsTrigger><TabsTrigger value="acoes">Ações do plano</TabsTrigger>
          {s.papel === "admin" && <TabsTrigger value="config">Configurações</TabsTrigger>}
        </TabsList>
        <TabsContent value="municipio"><Municipio /></TabsContent>
        <TabsContent value="receitas"><Receitas /></TabsContent>
        <TabsContent value="projecao"><Projecao /></TabsContent>
        <TabsContent value="fatores"><Fatores /></TabsContent>
        <TabsContent value="anterior"><BaseAnterior /></TabsContent>
        <TabsContent value="acoes"><Acoes /></TabsContent>
        <TabsContent value="config"><Config /></TabsContent>
      </Tabs>
    </div>
  );
}

const CAMPOS_MUN: [string, string, boolean][] = [["nome", "Nome", false], ["uf", "UF", false], ["codigo_ibge", "Código IBGE", false], ["orgao", "Órgão", false], ["cnpj", "CNPJ", false], ["populacao", "População", true], ["domicilios", "Domicílios", true], ["area_km2", "Área territorial (km²)", true], ["alfabetizacao_pct", "Alfabetização (%)", true], ["pop_indigena", "Pop. indígena", true], ["pop_quilombola", "Pop. quilombola", true]];

function Municipio() {
  const s = useSessao();
  const qc = useQueryClient();
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState<any>({});
  const [brasao, setBrasao] = useState<File | null>(null);
  const [ibge, setIbge] = useState<any>(null);
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<any[]>([]);
  const { data: mun } = useQuery({ queryKey: ["municipio", s.municipioId], queryFn: () => pb().collection("municipios").getOne(s.municipioId), enabled: !!s.municipioId && !novo });
  useEffect(() => { if (mun && !novo) setF(mun); }, [mun, novo]);
  useEffect(() => { if (!s.municipioId && s.papel === "admin") { setNovo(true); setF({ orgao: "Fundo Municipal de Educação" }); } }, [s.municipioId, s.papel]);

  async function salvar() {
    try {
      const fd = new FormData();
      CAMPOS_MUN.forEach(([k, , n]) => fd.append(k, n ? String(f[k] ?? "") : String(f[k] ?? "")));
      if (brasao) fd.append("brasao", brasao);
      const r = novo ? await pb().collection("municipios").create(fd) : await pb().collection("municipios").update(s.municipioId, fd);
      if (novo) { s.setMunicipioId(r.id); setNovo(false); }
      qc.invalidateQueries();
      logParam(r.id, "Cadastro do município");
      toast.success("Município salvo.");
    } catch (e) { toast.error(mensagemErro(e)); }
  }
  async function buscarIbge() {
    try { setIbge(await api(`/backend/v1/ibge/${String(f.codigo_ibge || "").trim()}`)); } catch (e) { toast.error(mensagemErro(e)); }
  }
  async function buscarNome() {
    try { setAchados(await api<any[]>("/backend/v1/ibge-busca", { query: { nome: busca, uf: f.uf || "" } })); } catch (e) { toast.error(mensagemErro(e)); }
  }
  return (
    <Secao titulo={novo ? "Novo município" : "Cadastro e caracterização"} acoes={s.papel === "admin" && !novo && <Button variant="outline" onClick={() => { setNovo(true); setF({ orgao: "Fundo Municipal de Educação" }); }}>Novo município</Button>}>
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded bg-card p-3">
        <div><Label>Buscar código IBGE pelo nome</Label><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: Inhambupe" className="w-56" /></div>
        <Button variant="outline" onClick={buscarNome} disabled={!s.podeEditar || busca.length < 3}>Buscar</Button>
        {achados.map((a) => <button key={a.codigo_ibge} className="rounded bg-muted px-2 py-1 text-xs hover:bg-accent" onClick={() => { setF({ ...f, codigo_ibge: a.codigo_ibge, nome: f.nome || a.nome, uf: f.uf || a.uf }); setAchados([]); }}>{a.nome}/{a.uf} · {a.codigo_ibge}</button>)}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {CAMPOS_MUN.map(([k, l, n]) => (
          <div key={k}><Label>{l}</Label><Input type={n ? "number" : "text"} step="any" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} disabled={!s.podeEditar} /></div>
        ))}
        <div><Label>Brasão (imagem)</Label><Input type="file" accept="image/*" onChange={(e) => setBrasao(e.target.files?.[0] || null)} disabled={!s.podeEditar} /></div>
      </div>
      <div className="mt-4 flex gap-2">
        {s.podeEditar && <Button onClick={salvar}>Salvar</Button>}
        {s.podeEditar && <Button variant="outline" onClick={buscarIbge} disabled={!f.codigo_ibge}>Buscar no IBGE</Button>}
        {novo && s.municipioId && <Button variant="ghost" onClick={() => setNovo(false)}>Cancelar</Button>}
      </div>
      {ibge && (
        <div className="mt-4 rounded border bg-card p-3 text-sm">
          <div className="mb-2 font-semibold">Prévia do IBGE (Censo 2022) — {ibge.nome}/{ibge.uf}</div>
          <table className="w-full"><thead className="text-left text-xs text-muted-foreground"><tr><th>Campo</th><th className="text-right">Atual</th><th className="text-right">IBGE</th></tr></thead>
            <tbody>{["populacao", "domicilios", "area_km2", "alfabetizacao_pct", "pop_indigena", "pop_quilombola"].map((k) => <tr key={k} className="border-t"><td>{CAMPOS_MUN.find((c) => c[0] === k)![1]}</td><td className="text-right num">{decimal(f[k], k === "area_km2" || k === "alfabetizacao_pct" ? 2 : 0)}</td><td className="text-right num font-semibold">{ibge[k] == null ? "—" : decimal(ibge[k], k === "area_km2" || k === "alfabetizacao_pct" ? 2 : 0)}</td></tr>)}</tbody></table>
          {ibge.erros?.length > 0 && <div className="mt-2 text-xs text-destructive">{ibge.erros.join(" · ")}</div>}
          <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => { const n = { ...f }; ["populacao", "domicilios", "area_km2", "alfabetizacao_pct", "pop_indigena", "pop_quilombola"].forEach((k) => { if (ibge[k] != null) n[k] = ibge[k]; }); setF(n); setIbge(null); toast.info("Valores aplicados. Clique em Salvar para gravar."); }}>Usar valores do IBGE</Button><Button size="sm" variant="ghost" onClick={() => setIbge(null)}>Descartar</Button></div>
        </div>
      )}
    </Secao>
  );
}

function Receitas() {
  const s = useSessao();
  const qc = useQueryClient();
  const { data: recs = [], refetch } = useQuery({ queryKey: ["receitas", s.municipioId], queryFn: () => pb().collection("receitas_fundeb").getFullList({ filter: pb().filter("municipio = {:m}", { m: s.municipioId }), sort: "ano" }), enabled: !!s.municipioId });
  const [linhas, setLinhas] = useState<any[]>([]);
  const [previa, setPrevia] = useState<any[] | null>(null);
  useEffect(() => setLinhas(recs.map((r) => ({ ...r }))), [recs]);
  async function gravar(lista: any[]) {
    try {
      for (const l of lista) {
        const body = { municipio: s.municipioId, ano: +l.ano, contribuicao: +l.contribuicao || 0, vaaf: +l.vaaf || 0, vaat: +l.vaat || 0, vaar: +l.vaar || 0 };
        const ex = recs.find((r) => +r["ano"] === +l.ano);
        if (ex) await pb().collection("receitas_fundeb").update(ex.id, body); else await pb().collection("receitas_fundeb").create(body);
      }
      logParam(s.municipioId, "Receitas do FUNDEB");
      toast.success("Receitas salvas.");
      setPrevia(null); refetch(); qc.invalidateQueries({ queryKey: ["analise"] });
    } catch (e) { toast.error(mensagemErro(e)); }
  }
  async function csv(file: File) {
    const rows = lerCSV(await file.text()).filter((r) => /^\d{4}$/.test(r[0] || ""));
    setPrevia(rows.map((r) => ({ ano: +r[0]!, contribuicao: numeroBR(r[1]!), vaaf: numeroBR(r[2]!), vaat: numeroBR(r[3]!), vaar: numeroBR(r[4]!) })));
  }
  const tot = (l: any) => (+l.contribuicao || 0) + (+l.vaaf || 0) + (+l.vaat || 0) + (+l.vaar || 0);
  return (
    <Secao titulo="Histórico de receitas do FUNDEB" descricao="Mínimo de 4 anos. Total é calculado. CSV: ano;contribuicao;vaaf;vaat;vaar (números no formato brasileiro)."
      acoes={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => baixarCSV("modelo-receitas.csv", ["ano", "contribuicao", "vaaf", "vaat", "vaar"], [["2025", "37.990.000,00", "12.264.000,00", "16.388.000,00", "0,00"]])}>Modelo CSV</Button>
        {s.podeEditar && <label className="cursor-pointer rounded border px-3 py-1.5 text-sm hover:bg-muted">Importar CSV<input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && csv(e.target.files[0])} /></label>}</div>}>
      {previa && <div className="mb-4 rounded bg-warning-soft p-3 text-sm"><b>Prévia do CSV:</b> {previa.map((p) => `${p.ano}: ${brl(tot(p))}`).join(" · ")} <Button size="sm" className="ml-2" onClick={() => gravar(previa)}>Confirmar</Button><Button size="sm" variant="ghost" onClick={() => setPrevia(null)}>Cancelar</Button></div>}
      <table className="w-full rounded bg-card text-sm">
        <thead className="bg-muted text-left"><tr><th className="p-2">Ano</th><th className="p-2">Contribuição</th><th className="p-2">VAAF</th><th className="p-2">VAAT</th><th className="p-2">VAAR</th><th className="p-2 text-right">Total</th></tr></thead>
        <tbody>{linhas.map((l, i) => (
          <tr key={i} className="border-t">{["ano", "contribuicao", "vaaf", "vaat", "vaar"].map((k) => <td key={k} className="p-1"><Input type="number" step="0.01" value={l[k] ?? ""} disabled={!s.podeEditar} onChange={(e) => { const n = [...linhas]; n[i] = { ...l, [k]: e.target.value }; setLinhas(n); }} /></td>)}<td className="p-2 text-right num">{brl(tot(l))}</td></tr>
        ))}</tbody>
      </table>
      {s.podeEditar && <div className="mt-3 flex gap-2"><Button variant="outline" onClick={() => setLinhas([...linhas, { ano: (linhas.length ? Math.max(...linhas.map((l) => +l.ano)) : s.ano - 4) + 1 }])}>Adicionar ano</Button><Button onClick={() => gravar(linhas.filter((l) => l.ano))}>Salvar</Button></div>}
    </Secao>
  );
}

const CAMPOS_P: [string, string, string][] = [
  ["valor_contrib", "Valor contribuição (R$/ponderada VAAF)", "R$ por matrícula ponderada VAAF da parcela de contribuição (fundo estadual)."],
  ["valor_vaaf", "Valor VAAF (R$/ponderada VAAF)", "Complementação da União VAAF por ponderada."],
  ["valor_vaat", "Valor VAAT (R$/ponderada VAAT)", "Complementação VAAT por ponderada (redes abaixo do VAAT-mínimo)."],
  ["valor_vaat_marginal", "VAAT marginal (R$/ponderada adicional)", "Usado no plano de ação; vazio = usa o valor VAAT."],
  ["vaar_previsto", "VAAR previsto (R$)", "Zero se o município não estiver habilitado."],
  ["fator_cons_contrib", "Conservador × contribuição", "Ex.: 0,980157"], ["fator_cons_vaaf", "Conservador × VAAF", ""], ["fator_cons_vaat", "Conservador × VAAT", ""],
  ["fator_otim_contrib", "Otimista × contribuição", "Ex.: 1,020664"], ["fator_otim_vaaf", "Otimista × VAAF", ""], ["fator_otim_vaat", "Otimista × VAAT", ""],
  ["referencial", "Referencial (R$)", "Patamar exibido na régua de potencial."], ["limiar_baixo_pct", "Limiar BAIXO (%)", "Abaixo disso = BAIXO (padrão 10)"], ["limiar_medio_pct", "Limiar MÉDIO (%)", "Até isso = MÉDIO; acima = ALTO (padrão 25)"],
];
function Projecao() {
  const s = useSessao();
  const qc = useQueryClient();
  const anoP = s.ano + 1;
  const { data: rec, refetch } = useQuery({ queryKey: ["param", s.municipioId, anoP], queryFn: () => pb().collection("parametros_projecao").getFirstListItem(pb().filter("municipio = {:m} && ano_projecao = {:a}", { m: s.municipioId, a: anoP })).catch(() => null), enabled: !!s.municipioId });
  const [f, setF] = useState<any>({});
  useEffect(() => setF(rec || { limiar_baixo_pct: 10, limiar_medio_pct: 25 }), [rec]);
  async function salvar() {
    try {
      const body: any = { municipio: s.municipioId, ano_projecao: anoP, fonte: f.fonte || "" };
      CAMPOS_P.forEach(([k]) => (body[k] = f[k] === "" || f[k] == null ? null : +f[k]));
      if (rec) await pb().collection("parametros_projecao").update(rec.id, body); else await pb().collection("parametros_projecao").create(body);
      logParam(s.municipioId, `Parâmetros de projeção ${anoP}`);
      toast.success("Parâmetros salvos."); refetch(); qc.invalidateQueries({ queryKey: ["analise"] });
    } catch (e) { toast.error(mensagemErro(e)); }
  }
  async function copiar() {
    try { await api("/backend/v1/copiar-parametros", { method: "POST", body: { tipo: "projecao", municipioId: s.municipioId, de: anoP - 1, para: anoP } }); toast.success("Copiado."); refetch(); } catch (e) { toast.error(mensagemErro(e)); }
  }
  return (
    <Secao titulo={`Parâmetros da projeção ${anoP}`} descricao="Valores das portarias FNDE/MEC (ou estimativas). Valores monetários com até 4 casas decimais." acoes={s.podeEditar && <Button variant="outline" size="sm" onClick={copiar}>Copiar parâmetros de {anoP - 1}</Button>}>
      <div className="grid gap-3 md:grid-cols-3">
        {CAMPOS_P.map(([k, l, h]) => <div key={k}><Label>{l}</Label><Input type="number" step="any" value={f[k] ?? ""} disabled={!s.podeEditar} onChange={(e) => setF({ ...f, [k]: e.target.value })} />{h && <p className="mt-0.5 text-[11px] text-muted-foreground">{h}</p>}</div>)}
        <div className="md:col-span-3"><Label>Fonte (portaria / estimativa)</Label><Input value={f.fonte ?? ""} disabled={!s.podeEditar} onChange={(e) => setF({ ...f, fonte: e.target.value })} /></div>
      </div>
      {s.podeEditar && <Button className="mt-4" onClick={salvar}>Salvar</Button>}
    </Secao>
  );
}

function Fatores() {
  const s = useSessao();
  const qc = useQueryClient();
  const [ano, setAno] = useState(s.ano);
  const { data: fat = [], refetch } = useQuery({ queryKey: ["fatores", ano], queryFn: () => pb().collection("fatores_ponderacao").getFullList({ filter: pb().filter("ano_fundeb = {:a}", { a: ano }), sort: "grupo,chave" }) });
  const [ed, setEd] = useState<Record<string, any>>({});
  async function salvar() {
    try {
      for (const id of Object.keys(ed)) await pb().collection("fatores_ponderacao").update(id, ed[id]);
      setEd({}); refetch(); logParam("", `Fatores de ponderação ${ano}`);
      toast.success("Fatores salvos. Reprocesse o município (tela Importar) para aplicar.");
      qc.invalidateQueries({ queryKey: ["analise"] });
    } catch (e) { toast.error(mensagemErro(e)); }
  }
  async function copiar() {
    try { const r: any = await api("/backend/v1/copiar-parametros", { method: "POST", body: { tipo: "fatores", de: ano - 1, para: ano } }); toast.success(`${r.copiados} fatores copiados.`); refetch(); } catch (e) { toast.error(mensagemErro(e)); }
  }
  const admin = s.papel === "admin";
  return (
    <Secao titulo="Fatores de ponderação" descricao={<>Resolução CIF nº 5/2024. Fator campo ×1,15 (exceto AEE). Os fatores VAAT da educação infantil são aproximados — <b>conferir na Resolução CIF vigente</b>. Sem fatores para o ano, o sistema usa o ano anterior mais próximo.</>}
      acoes={<div className="flex items-center gap-2"><Input type="number" className="w-24" value={ano} onChange={(e) => setAno(+e.target.value)} />{admin && <Button size="sm" variant="outline" onClick={copiar}>Copiar de {ano - 1}</Button>}</div>}>
      <table className="w-full rounded bg-card text-sm">
        <thead className="bg-muted text-left"><tr><th className="p-2">Grupo</th><th className="p-2">Subcategoria</th><th className="p-2">VAAF</th><th className="p-2">VAAT</th><th className="p-2">Aplica campo</th></tr></thead>
        <tbody>{fat.map((r) => { const v = { ...r, ...(ed[r.id] || {}) }; const set = (k: string, val: any) => setEd({ ...ed, [r.id]: { ...(ed[r.id] || {}), [k]: val } }); return (
          <tr key={r.id} className="border-t"><td className="p-2 text-xs">{r["grupo_nome"]}</td><td className="p-2">{r["subcategoria_base"]}</td>
            <td className="p-1"><Input type="number" step="0.0001" className="w-28" value={v["fator_vaaf"]} disabled={!admin} onChange={(e) => set("fator_vaaf", +e.target.value)} /></td>
            <td className="p-1"><Input type="number" step="0.0001" className="w-28" value={v["fator_vaat"]} disabled={!admin} onChange={(e) => set("fator_vaat", +e.target.value)} /></td>
            <td className="p-2"><input type="checkbox" checked={!!v["aplica_campo"]} disabled={!admin} onChange={(e) => set("aplica_campo", e.target.checked)} /></td></tr>); })}</tbody>
      </table>
      {!fat.length && <p className="mt-2 text-sm text-muted-foreground">Nenhum fator para {ano}. {admin ? "Use “Copiar”." : ""}</p>}
      {admin && Object.keys(ed).length > 0 && <Button className="mt-3" onClick={salvar}>Salvar alterações</Button>}
    </Secao>
  );
}

function BaseAnterior() {
  const s = useSessao();
  const qc = useQueryClient();
  const anoA = s.ano - 1;
  const { data: tot = [], refetch } = useQuery({ queryKey: ["totant", s.municipioId, anoA], queryFn: () => pb().collection("totais_ano_anterior").getFullList({ filter: pb().filter("municipio = {:m} && ano_censo = {:a}", { m: s.municipioId, a: anoA }), sort: "subcategoria" }), enabled: !!s.municipioId });
  const [txt, setTxt] = useState("");
  async function gravar() {
    try {
      const rows = lerCSV(txt).filter((r) => r[0] && !/^subcategoria$/i.test(r[0]));
      for (const r of rows) {
        const body = { municipio: s.municipioId, ano_censo: anoA, subcategoria: r[0]!, matriculas: numeroBR(r[1]!), ponderadas_vaaf: numeroBR(r[2]!), ponderadas_vaat: numeroBR(r[3]!) };
        const ex = tot.find((t) => t["subcategoria"] === r[0]);
        if (ex) await pb().collection("totais_ano_anterior").update(ex.id, body); else await pb().collection("totais_ano_anterior").create(body);
      }
      setTxt(""); refetch(); qc.invalidateQueries({ queryKey: ["analise"] }); logParam(s.municipioId, `Base ${anoA}`);
      toast.success(`${rows.length} linhas gravadas.`);
    } catch (e) { toast.error(mensagemErro(e)); }
  }
  async function apagar(id: string) { await pb().collection("totais_ano_anterior").delete(id); refetch(); qc.invalidateQueries({ queryKey: ["analise"] }); }
  return (
    <Secao titulo={`Totais do Censo ${anoA}`} descricao="Usados como “Matríc. Ant.” quando não há importação do ano anterior. Cole linhas no formato subcategoria;matriculas;vaaf;vaat usando os mesmos nomes de subcategoria do sistema (ex.: Ensino Fundamental Integral Campo).">
      {s.podeEditar && <><textarea className="h-32 w-full rounded border bg-card p-2 font-mono text-xs" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Ensino Fundamental Integral Campo;1650;2846,25;2846,25" /><Button className="mt-2" onClick={gravar} disabled={!txt.trim()}>Gravar</Button></>}
      <table className="mt-4 w-full rounded bg-card text-sm">
        <thead className="bg-muted text-left"><tr><th className="p-2">Subcategoria</th><th className="p-2 text-right">Matrículas</th><th className="p-2 text-right">VAAF</th><th className="p-2 text-right">VAAT</th><th /></tr></thead>
        <tbody>{tot.map((t) => <tr key={t.id} className="border-t"><td className="p-2">{t["subcategoria"]}</td><td className="p-2 text-right num">{inteiro(t["matriculas"])}</td><td className="p-2 text-right num">{decimal(t["ponderadas_vaaf"])}</td><td className="p-2 text-right num">{decimal(t["ponderadas_vaat"])}</td><td className="p-2">{s.podeEditar && <Button size="sm" variant="ghost" onClick={() => apagar(t.id)}>Remover</Button>}</td></tr>)}
          <tr className="border-t font-bold"><td className="p-2">Total</td><td className="p-2 text-right num">{inteiro(tot.reduce((a, t) => a + (t["matriculas"] || 0), 0))}</td><td colSpan={3} /></tr></tbody>
      </table>
    </Secao>
  );
}

function Acoes() {
  const s = useSessao();
  const qc = useQueryClient();
  const { data: acoes = [], refetch } = useQuery({ queryKey: ["acoes"], queryFn: () => pb().collection("acoes_modelo").getFullList({ sort: "ordem" }) });
  const admin = s.papel === "admin";
  async function upd(id: string, body: any) { try { await pb().collection("acoes_modelo").update(id, body); refetch(); qc.invalidateQueries(); } catch (e) { toast.error(mensagemErro(e)); } }
  return (
    <Secao titulo="Ações-modelo do plano" descricao="Tipos: aumentar_pct (soma % às matrículas da subcategoria), converter_integral (move matrículas parciais para integral), garantir_aee (cria AEE para alunos com deficiência grave sem AEE).">
      <table className="w-full rounded bg-card text-sm">
        <thead className="bg-muted text-left"><tr><th className="p-2">#</th><th className="p-2">Descrição</th><th className="p-2">Tipo</th><th className="p-2">%</th><th className="p-2">Ativa</th></tr></thead>
        <tbody>{acoes.map((a) => (
          <tr key={a.id} className="border-t"><td className="p-2">{a["ordem"]}</td><td className="p-2">{a["descricao"]}</td><td className="p-2 text-xs">{a["tipo"]}</td>
            <td className="p-1"><Input type="number" className="w-20" defaultValue={a["pct"]} disabled={!admin} onBlur={(e) => +e.target.value !== a["pct"] && upd(a.id, { pct: +e.target.value })} /></td>
            <td className="p-2"><input type="checkbox" checked={!!a["ativo"]} disabled={!admin} onChange={(e) => upd(a.id, { ativo: e.target.checked })} /></td></tr>))}</tbody>
      </table>
    </Secao>
  );
}

function Config() {
  const { data: c, refetch } = useQuery({ queryKey: ["config"], queryFn: () => pb().collection("configuracoes").getFirstListItem("") });
  const [f, setF] = useState<any>({});
  useEffect(() => { if (c) setF(c); }, [c]);
  async function salvar() {
    try { await pb().collection("configuracoes").update(c!.id, { emitente_nome: f.emitente_nome, emitente_cnpj: f.emitente_cnpj, url_publica: f.url_publica, fator_campo: +f.fator_campo || 1.15 }); toast.success("Configurações salvas."); refetch(); } catch (e) { toast.error(mensagemErro(e)); }
  }
  return (
    <Secao titulo="Configurações gerais" descricao="URL pública: endereço do sistema usado no QR Code e no link de verificação (ex.: https://radar.suaempresa.com.br). Vazio = endereço atual do navegador.">
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Empresa emissora</Label><Input value={f.emitente_nome ?? ""} onChange={(e) => setF({ ...f, emitente_nome: e.target.value })} /></div>
        <div><Label>CNPJ da emissora</Label><Input value={f.emitente_cnpj ?? ""} onChange={(e) => setF({ ...f, emitente_cnpj: e.target.value })} /></div>
        <div><Label>URL pública</Label><Input value={f.url_publica ?? ""} onChange={(e) => setF({ ...f, url_publica: e.target.value })} /></div>
        <div><Label>Multiplicador campo</Label><Input type="number" step="0.01" value={f.fator_campo ?? 1.15} onChange={(e) => setF({ ...f, fator_campo: e.target.value })} /></div>
      </div>
      <Button className="mt-4" onClick={salvar}>Salvar</Button>
    </Secao>
  );
}
