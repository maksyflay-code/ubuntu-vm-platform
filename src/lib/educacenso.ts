import * as XLSX from "xlsx";
import { semAcento } from "./format";

/** Leitura das planilhas "Relação de alunos(as)" e "Relação de turma(s)" do Educacenso, no navegador. */
export type Capa = { inep: string; nome: string; uf: string; municipio: string; localizacao: string; dependencia: string };
export type Planilha = {
  tipo: "alunos" | "turmas";
  arquivo: string;
  capa: Capa;
  emitidoEm: string;
  linhas: any[];
  avisos: string[];
};

const ROTULOS: Record<string, keyof Capa> = {
  "codigo da escola:": "inep",
  "nome da escola:": "nome",
  "uf:": "uf",
  "municipio:": "municipio",
  "localizacao:": "localizacao",
  "dependencia administrativa:": "dependencia",
};

export function texto(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  let s = String(v).trim();
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
  if (s === "--" || s === "-") return "";
  return s;
}
export function lista(v: unknown): string[] {
  const s = texto(v);
  if (!s) return [];
  return s
    .split("|")
    .map((x) => x.trim())
    .filter((x) => x && x !== "--" && x !== "-");
}
export function simNao(v: unknown): boolean {
  return semAcento(texto(v)).startsWith("sim");
}
/** "45:00" -> 2700 minutos; aceita também fração de dia do Excel. */
export function cargaMinutos(v: unknown): number {
  if (typeof v === "number") return v < 10 ? Math.round(v * 24 * 60) : Math.round(v * 60);
  const m = texto(v).match(/(\d+):(\d{2})/);
  if (m) return +m[1]! * 60 + +m[2]!;
  const n = parseFloat(texto(v).replace(",", "."));
  return isFinite(n) ? Math.round(n * 60) : 0;
}
export function data(v: unknown): string {
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${d.y}`;
  }
  const s = texto(v);
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[1]!.padStart(2, "0")}/${m[2]!.padStart(2, "0")}/${m[3]}` : s;
}
/** CPF: 3 primeiros + "******" + 2 últimos. O CPF completo nunca sai do navegador. */
export function mascararCPF(v: unknown): string {
  const d = texto(v).replace(/\D/g, "");
  if (d.length !== 11) return "--";
  return d.slice(0, 3) + "******" + d.slice(-2);
}

function achaColuna(cabecalho: string[], ...nomes: string[]): number {
  for (const n of nomes) {
    const i = cabecalho.indexOf(semAcento(n));
    if (i >= 0) return i;
  }
  for (const n of nomes) {
    const i = cabecalho.findIndex((h) => h.startsWith(semAcento(n)));
    if (i >= 0) return i;
  }
  return -1;
}

const COL_ALUNOS: Record<string, string[]> = {
  ordem: ["Ordem"],
  id_inep: ["Identificação única"],
  nome: ["Nome", "Nome do(a) aluno(a)"],
  data_nascimento: ["Data de nascimento"],
  cpf: ["CPF"],
  cor_raca: ["Cor/Raça", "Cor/raça"],
  sexo: ["Sexo"],
  deficiencias: ["Tipo(s) de deficiência(s)", "Tipo(s) de deficiência"],
  transtornos: ["Tipo(s) de transtorno(s)"],
  zona_residencia: ["Localização/Zona de residência"],
  localizacao_diferenciada: ["Localização diferenciada de residência", "Localização diferenciada"],
  codigo_matricula: ["Código da Matrícula", "Código da matrícula"],
  codigo_turma: ["Código da turma"],
  nome_turma: ["Nome da turma"],
  etapa: ["Etapa de ensino"],
  tipo_aee: ["Tipo de atendimento educacional especializado"],
  transporte: ["Transporte escolar"],
  poder_publico: ["Poder Público responsável", "Poder público"],
  veiculo: ["Tipo de veículo utilizado no transporte escolar", "Tipo de veículo"],
  etapa_vinculo_multi: ["Etapa de vínculo do(a) aluno(a)", "Etapa de vínculo"],
};
const COL_TURMAS: Record<string, string[]> = {
  ordem: ["Ordem"],
  codigo: ["Código da turma"],
  nome: ["Nome da turma"],
  tipo_mediacao: ["Tipo de mediação"],
  tipo_turma: ["Tipo de turma"],
  etapa_agregada: ["Etapa Agregada"],
  etapa: ["Etapa de ensino"],
  carga: ["Carga horária semanal"],
  horarios: ["Dias da semana e horário de funcionamento", "Dias da semana"],
  classe_especial: ["Turma de Educação Especial"],
  bilingue_surdos: ["Turma de Educação Bilíngue de Surdos", "Turma de Educação Bilíngue"],
  alternancia: ["Formação por Alternância"],
  qtd_alunos: ["Quantidade de Alunos(as)", "Quantidade de alunos"],
  qtd_profissionais: ["Quantidade de profissionais", "Quantidade de Profissionais"],
};
const OBRIG_ALUNOS = ["id_inep", "nome", "codigo_matricula", "codigo_turma", "zona_residencia", "transporte", "deficiencias", "etapa"];
const OBRIG_TURMAS = ["codigo", "nome", "tipo_turma", "etapa", "carga", "horarios", "qtd_alunos"];

export function lerPlanilha(buf: ArrayBuffer, arquivo: string): Planilha {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
  const normRow = (r: any[]) => (r || []).map((c) => semAcento(texto(c)));

  let h = rows.findIndex((r) => normRow(r).includes("identificacao unica"));
  let tipo: "alunos" | "turmas" = "alunos";
  if (h < 0) {
    h = rows.findIndex((r) => normRow(r).includes("codigo da turma"));
    tipo = "turmas";
  }
  if (h < 0) throw new Error("Layout não reconhecido: não achei a linha com \"Identificação única\" nem com \"Código da turma\".");

  const capa: Capa = { inep: "", nome: "", uf: "", municipio: "", localizacao: "", dependencia: "" };
  for (let i = 0; i < h; i++) {
    const r = rows[i] || [];
    for (let c = 0; c < r.length; c++) {
      const k = ROTULOS[semAcento(texto(r[c]))];
      if (!k) continue;
      for (let d = c + 1; d < r.length; d++) {
        const v = texto(r[d]);
        if (v) {
          capa[k] = v;
          break;
        }
      }
    }
  }
  let emitidoEm = "";
  for (const r of rows)
    for (const c of r || []) {
      const m = texto(c).match(/Emitido em\s*(.+)/i);
      if (m) emitidoEm = m[1]!.trim();
    }

  const cab = normRow(rows[h]!);
  const mapa = tipo === "alunos" ? COL_ALUNOS : COL_TURMAS;
  const idx: Record<string, number> = {};
  for (const k of Object.keys(mapa)) idx[k] = achaColuna(cab, ...mapa[k]!);
  const avisos: string[] = [];
  const faltando = (tipo === "alunos" ? OBRIG_ALUNOS : OBRIG_TURMAS).filter((k) => (idx[k] ?? -1) < 0);
  if (faltando.length) throw new Error("Colunas obrigatórias ausentes: " + faltando.map((k) => mapa[k]![0]).join(", "));

  const linhas: any[] = [];
  const g = (r: any[], k: string) => {
    const i = idx[k] ?? -1;
    return i >= 0 ? r[i] : null;
  };
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    if (r.some((c: unknown) => semAcento(texto(c)).startsWith("fonte: deed/inep/mec"))) break;
    const ordem = g(r, "ordem");
    const ordemOk = typeof ordem === "number" || /^\d+$/.test(texto(ordem));
    if ((idx["ordem"] ?? -1) >= 0 ? !ordemOk : !texto(g(r, tipo === "alunos" ? "id_inep" : "codigo"))) continue;
    if (tipo === "alunos") {
      linhas.push({
        id_inep: texto(g(r, "id_inep")),
        nome: texto(g(r, "nome")),
        data_nascimento: data(g(r, "data_nascimento")),
        cpf_mascarado: mascararCPF(g(r, "cpf")),
        cor_raca: texto(g(r, "cor_raca")),
        sexo: texto(g(r, "sexo")),
        deficiencias: lista(g(r, "deficiencias")),
        transtornos: lista(g(r, "transtornos")),
        zona_residencia: texto(g(r, "zona_residencia")),
        localizacao_diferenciada: texto(g(r, "localizacao_diferenciada")),
        codigo_matricula: texto(g(r, "codigo_matricula")),
        codigo_turma: texto(g(r, "codigo_turma")),
        nome_turma: texto(g(r, "nome_turma")),
        etapa: texto(g(r, "etapa")),
        tipo_aee: lista(g(r, "tipo_aee")),
        transporte: simNao(g(r, "transporte")),
        poder_publico: texto(g(r, "poder_publico")),
        veiculo: texto(g(r, "veiculo")),
        etapa_vinculo_multi: texto(g(r, "etapa_vinculo_multi")),
      });
    } else {
      linhas.push({
        codigo: texto(g(r, "codigo")),
        nome: texto(g(r, "nome")),
        tipo_mediacao: texto(g(r, "tipo_mediacao")),
        tipo_turma: texto(g(r, "tipo_turma")),
        etapa_agregada: texto(g(r, "etapa_agregada")),
        etapa: texto(g(r, "etapa")),
        carga_semanal_min: cargaMinutos(g(r, "carga")),
        horarios: texto(g(r, "horarios")),
        classe_especial: simNao(g(r, "classe_especial")),
        bilingue_surdos: simNao(g(r, "bilingue_surdos")),
        alternancia: simNao(g(r, "alternancia")),
        qtd_alunos: +texto(g(r, "qtd_alunos")) || 0,
        qtd_profissionais: +texto(g(r, "qtd_profissionais")) || 0,
      });
    }
  }
  if (!capa.inep) avisos.push("Código da escola não encontrado na capa do arquivo.");
  if (!linhas.length) avisos.push("Nenhuma linha de dados encontrada.");
  return { tipo, arquivo, capa, emitidoEm, linhas, avisos };
}

export type EscolaPrevia = {
  inep: string;
  capa: Capa;
  alunos?: Planilha;
  turmas?: Planilha;
  nTurmas: number;
  nLinhas: number;
  nAlunos: number;
  avisos: string[];
  erros: string[];
};

export function agruparPorEscola(planilhas: Planilha[], municipioNome: string): EscolaPrevia[] {
  const porInep = new Map<string, EscolaPrevia>();
  for (const p of planilhas) {
    const k = p.capa.inep || p.arquivo;
    const e = porInep.get(k) || { inep: k, capa: p.capa, nTurmas: 0, nLinhas: 0, nAlunos: 0, avisos: [], erros: [] };
    if (p.tipo === "alunos") e.alunos = p;
    else e.turmas = p;
    if (!e.capa.nome && p.capa.nome) e.capa = p.capa;
    porInep.set(k, e);
  }
  for (const e of porInep.values()) {
    e.nTurmas = e.turmas?.linhas.length || 0;
    e.nLinhas = e.alunos?.linhas.length || 0;
    e.nAlunos = new Set((e.alunos?.linhas || []).map((l) => l.id_inep)).size;
    if (!e.turmas) e.erros.push("Arquivo de turmas faltando");
    if (!e.alunos) e.erros.push("Arquivo de alunos faltando");
    if (municipioNome && e.capa.municipio && semAcento(e.capa.municipio) !== semAcento(municipioNome))
      e.erros.push(`Município do arquivo (${e.capa.municipio}) diferente do selecionado (${municipioNome})`);
    e.avisos.push(...(e.alunos?.avisos || []), ...(e.turmas?.avisos || []));
    if (e.turmas && e.alunos) {
      const cont = new Map<string, number>();
      for (const l of e.alunos.linhas) cont.set(l.codigo_turma, (cont.get(l.codigo_turma) || 0) + 1);
      for (const t of e.turmas.linhas) {
        const n = cont.get(t.codigo) || 0;
        if (t.qtd_alunos && n !== t.qtd_alunos) e.avisos.push(`Turma ${t.nome} (${t.codigo}): ${t.qtd_alunos} alunos na turma, ${n} vínculos lidos`);
      }
    }
  }
  return [...porInep.values()].sort((a, b) => a.inep.localeCompare(b.inep));
}
