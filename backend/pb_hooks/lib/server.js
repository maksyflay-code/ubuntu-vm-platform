/// <reference path="../../pb_data/types.d.ts" />
// Radar FUNDEB — lógica de servidor usada pelas rotas de main.pb.js.
"use strict";
const E = require(`${__hooks}/lib/engine.js`);

// ---------------------------------------------------------------- acesso
function papel(e) { return e.auth ? e.auth.getString("role") : ""; }
function exigirAcesso(e, municipioId, escrita) {
  if (!e.auth) throw new UnauthorizedError("Faça login.");
  if (e.hasSuperuserAuth && e.hasSuperuserAuth()) return;
  if (e.auth.collection().name !== "users") throw new ForbiddenError("Acesso negado.");
  if (!e.auth.getBool("ativo")) throw new ForbiddenError("Usuário desativado.");
  const r = papel(e);
  if (!municipioId) throw new BadRequestError("Informe o município.");
  if (r !== "admin") {
    const ms = e.auth.getStringSlice("municipios");
    let ok = false;
    for (let i = 0; i < ms.length; i++) if (ms[i] === municipioId) ok = true;
    if (!ok) throw new ForbiddenError("Você não tem acesso a este município.");
    if (escrita && r !== "analista") throw new ForbiddenError("Seu perfil só permite leitura.");
  }
}
function exigirAdmin(e) {
  if (!e.auth) throw new UnauthorizedError("Faça login.");
  if (e.hasSuperuserAuth && e.hasSuperuserAuth()) return;
  if (papel(e) !== "admin") throw new ForbiddenError("Somente administradores.");
}
function registrarLog(app, e, municipioId, acao, detalhe) {
  try {
    const r = new Record(app.findCollectionByNameOrId("logs_acesso"));
    if (e.auth && e.auth.collection().name === "users") { r.set("usuario", e.auth.id); r.set("usuario_email", e.auth.getString("email")); }
    if (municipioId) r.set("municipio", municipioId);
    r.set("acao", acao); r.set("detalhe", String(detalhe || "").slice(0, 2000));
    app.save(r);
  } catch (err) { console.log("log falhou", err); }
}

// ---------------------------------------------------------------- helpers
function json(rec, f) { const s = rec.getString(f); if (!s) return []; try { const v = JSON.parse(s); return v == null ? [] : v; } catch (_) { return []; } }
function todos(app, coll, filtro, params, sort) { return app.findRecordsByFilter(coll, filtro, sort || "", 0, 0, params || {}); }
function agoraBrasilia() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  const p = (n) => (n < 10 ? "0" : "") + n;
  return p(d.getUTCDate()) + "/" + p(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear() + " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds());
}
function num(v) { const n = +v; return isFinite(n) ? n : 0; }

function carregarFatores(app, ano) {
  const recs = todos(app, "fatores_ponderacao", "id != ''", {}, "ano_fundeb");
  const anos = {};
  recs.forEach((r) => { anos[r.getInt("ano_fundeb")] = true; });
  const lista = Object.keys(anos).map((x) => +x).sort((a, b) => a - b);
  let escolhido = null;
  lista.forEach((a) => { if (a <= ano) escolhido = a; });
  if (escolhido == null && lista.length) escolhido = lista[lista.length - 1];
  const F = {};
  recs.forEach((r) => {
    if (r.getInt("ano_fundeb") !== escolhido) return;
    F[r.getString("chave")] = { vaaf: r.getFloat("fator_vaaf"), vaat: r.getFloat("fator_vaat"), aplica_campo: r.getBool("aplica_campo") };
  });
  return { fatores: F, ano: escolhido };
}
function config(app) {
  const l = todos(app, "configuracoes", "id != ''", {});
  if (!l.length) return { emitente_nome: "Radar FUNDEB", url_publica: "", fator_campo: 1.15 };
  const c = l[0];
  return { id: c.id, emitente_nome: c.getString("emitente_nome"), emitente_cnpj: c.getString("emitente_cnpj"), url_publica: c.getString("url_publica"), fator_campo: c.getFloat("fator_campo") || 1.15 };
}

function carregarBase(app, m, ano) {
  const P = { m: m, a: ano };
  const F = "municipio = {:m} && ano_censo = {:a}";
  const escolas = todos(app, "escolas", F, P).map((r) => ({ id: r.id, inep: r.getString("inep"), nome: r.getString("nome"), localizacao: r.getString("localizacao"), dependencia: r.getString("dependencia"), qtd_urbanos: r.getInt("qtd_urbanos"), qtd_rurais: r.getInt("qtd_rurais"), pct_rural: r.getFloat("pct_rural"), tratada_como_campo: r.getBool("tratada_como_campo"), area_predominante: r.getString("area_predominante") }));
  const turmas = todos(app, "turmas", F, P).map((r) => ({ id: r.id, escola: r.getString("escola"), codigo: r.getString("codigo"), nome: r.getString("nome"), tipo_turma: r.getString("tipo_turma"), etapa: r.getString("etapa"), carga_semanal_min: r.getInt("carga_semanal_min"), classe_especial: r.getBool("classe_especial"), horarios: r.getString("horarios"), qtd_alunos: r.getInt("qtd_alunos") }));
  const alunos = todos(app, "alunos", F, P).map((r) => ({ id: r.id, id_inep: r.getString("id_inep"), nome: r.getString("nome"), data_nascimento: r.getString("data_nascimento"), cpf_mascarado: r.getString("cpf_mascarado"), deficiencias: json(r, "deficiencias"), zona_residencia: r.getString("zona_residencia"), localizacao_diferenciada: r.getString("localizacao_diferenciada") }));
  const matriculas = todos(app, "matriculas", F, P).map((r) => ({ id: r.id, aluno: r.getString("aluno"), turma: r.getString("turma"), escola: r.getString("escola"), etapa: r.getString("etapa"), etapa_vinculo_multi: r.getString("etapa_vinculo_multi"), transporte: r.getBool("transporte"), eh_aee: r.getBool("eh_aee"), grupo: r.getString("grupo"), subcategoria: r.getString("subcategoria"), chave: r.getString("chave"), etapa_base: r.getString("etapa_base"), campo: r.getBool("campo"), especial: r.getBool("especial"), fator_vaaf: r.getFloat("fator_vaaf"), fator_vaat: r.getFloat("fator_vaat"), conta_fundeb: r.getBool("conta_fundeb") }));
  return { ano: ano, escolas, turmas, alunos, matriculas };
}

// ---------------------------------------------------------------- importação
function importar(app, e, body) {
  const m = body.municipioId, ano = +body.ano, esc = body.escola || {};
  exigirAcesso(e, m, true);
  if (!ano || !esc.inep) throw new BadRequestError("Ano e código da escola são obrigatórios.");
  const turmasIn = body.turmas || [], alunosIn = body.alunos || [];
  const resumo = { escola: esc.nome, inep: esc.inep, turmas: 0, matriculas: 0, alunos: 0, avisos: [] };

  app.runInTransaction((tx) => {
    // escola
    let escola;
    try { escola = tx.findFirstRecordByFilter("escolas", "municipio = {:m} && ano_censo = {:a} && inep = {:i}", { m: m, a: ano, i: String(esc.inep) }); }
    catch (_) { escola = new Record(tx.findCollectionByNameOrId("escolas")); }
    escola.set("municipio", m); escola.set("ano_censo", ano); escola.set("inep", String(esc.inep));
    escola.set("nome", esc.nome || ""); escola.set("localizacao", esc.localizacao || ""); escola.set("dependencia", esc.dependencia || "");
    tx.save(escola);

    tx.db().newQuery("DELETE FROM matriculas WHERE escola = {:e}").bind({ e: escola.id }).execute();
    tx.db().newQuery("DELETE FROM turmas WHERE escola = {:e}").bind({ e: escola.id }).execute();
    // turma com mesmo código em outra escola/município no ano (reimportação trocada)
    const turmasColl = tx.findCollectionByNameOrId("turmas");
    const mapaTurma = {};
    turmasIn.forEach((t) => {
      if (!t.codigo) return;
      tx.db().newQuery("DELETE FROM matriculas WHERE turma IN (SELECT id FROM turmas WHERE ano_censo = {:a} AND codigo = {:c})").bind({ a: ano, c: String(t.codigo) }).execute();
      tx.db().newQuery("DELETE FROM turmas WHERE ano_censo = {:a} AND codigo = {:c}").bind({ a: ano, c: String(t.codigo) }).execute();
      const r = new Record(turmasColl);
      r.set("municipio", m); r.set("escola", escola.id); r.set("ano_censo", ano);
      ["codigo", "nome", "tipo_mediacao", "tipo_turma", "etapa_agregada", "etapa", "horarios"].forEach((f) => r.set(f, t[f] == null ? "" : String(t[f])));
      r.set("carga_semanal_min", num(t.carga_semanal_min)); r.set("qtd_alunos", num(t.qtd_alunos)); r.set("qtd_profissionais", num(t.qtd_profissionais));
      r.set("classe_especial", !!t.classe_especial); r.set("bilingue_surdos", !!t.bilingue_surdos); r.set("alternancia", !!t.alternancia);
      tx.save(r);
      mapaTurma[String(t.codigo)] = r;
      resumo.turmas++;
    });

    const alunosColl = tx.findCollectionByNameOrId("alunos");
    const matColl = tx.findCollectionByNameOrId("matriculas");
    const alunoCache = {};
    alunosIn.forEach((l) => {
      const idInep = String(l.id_inep || "");
      if (!idInep) return;
      let al = alunoCache[idInep];
      if (!al) {
        try { al = tx.findFirstRecordByFilter("alunos", "municipio = {:m} && ano_censo = {:a} && id_inep = {:i}", { m: m, a: ano, i: idInep }); }
        catch (_) { al = new Record(alunosColl); resumo.alunos++; }
        al.set("municipio", m); al.set("ano_censo", ano); al.set("id_inep", idInep);
        ["nome", "data_nascimento", "cor_raca", "sexo", "zona_residencia", "localizacao_diferenciada"].forEach((f) => al.set(f, l[f] == null ? "" : String(l[f])));
        // CPF chega mascarado do navegador; garante a máscara mesmo assim
        let cpf = String(l.cpf_mascarado || "--");
        if (/^\d{11}$/.test(cpf.replace(/\D/g, "")) && cpf.indexOf("*") < 0) cpf = E.mascararCPF(cpf);
        al.set("cpf_mascarado", cpf);
        al.set("deficiencias", E.listaLimpa(l.deficiencias)); al.set("transtornos", E.listaLimpa(l.transtornos));
        tx.save(al);
        alunoCache[idInep] = al;
      }
      const turma = mapaTurma[String(l.codigo_turma || "")];
      if (!turma) { resumo.avisos.push("Matrícula " + l.codigo_matricula + ": turma " + l.codigo_turma + " não encontrada no arquivo de turmas"); return; }
      if (!l.codigo_matricula) return;
      tx.db().newQuery("DELETE FROM matriculas WHERE ano_censo = {:a} AND codigo_matricula = {:c}").bind({ a: ano, c: String(l.codigo_matricula) }).execute();
      const mt = new Record(matColl);
      mt.set("municipio", m); mt.set("ano_censo", ano); mt.set("aluno", al.id); mt.set("turma", turma.id); mt.set("escola", escola.id);
      mt.set("codigo_matricula", String(l.codigo_matricula)); mt.set("etapa", String(l.etapa || ""));
      mt.set("eh_aee", E.ehAEE(turma.getString("tipo_turma")));
      mt.set("tipo_aee", E.listaLimpa(l.tipo_aee)); mt.set("transporte", !!l.transporte);
      mt.set("poder_publico", String(l.poder_publico || "")); mt.set("veiculo", String(l.veiculo || "")); mt.set("etapa_vinculo_multi", String(l.etapa_vinculo_multi || ""));
      tx.save(mt);
      resumo.matriculas++;
    });

    // alunos sem nenhuma matrícula no município/ano
    tx.db().newQuery("DELETE FROM alunos WHERE municipio = {:m} AND ano_censo = {:a} AND id NOT IN (SELECT aluno FROM matriculas WHERE municipio = {:m} AND ano_censo = {:a})").bind({ m: m, a: ano }).execute();

    const impColl = tx.findCollectionByNameOrId("importacoes");
    (body.arquivos || []).forEach((arq) => {
      const r = new Record(impColl);
      r.set("municipio", m); r.set("ano_censo", ano); r.set("escola_inep", String(esc.inep)); r.set("escola_nome", esc.nome || "");
      r.set("tipo", arq.tipo); r.set("arquivo_nome", arq.nome || ""); r.set("emitido_em", arq.emitido_em || "");
      const msgs = (arq.avisos || []).concat(arq.tipo === "alunos" ? resumo.avisos : []);
      r.set("status", msgs.length ? "aviso" : "ok"); r.set("mensagens", msgs);
      if (e.auth && e.auth.collection().name === "users") r.set("usuario", e.auth.id);
      tx.save(r);
    });
  });
  registrarLog(app, e, m, "importar", "Escola " + esc.inep + " - " + (esc.nome || "") + " (" + ano + ")");
  return resumo;
}

// ---------------------------------------------------------------- processamento
function processar(app, e, m, ano) {
  exigirAcesso(e, m, true);
  const base = carregarBase(app, m, ano);
  const cfg = config(app);
  const F = carregarFatores(app, ano);
  const res = E.processar(base, F.fatores, { fatorCampo: cfg.fator_campo });
  const contagem = { AEE_SEM_CURRICULAR: 0, URBANA_EM_ESCOLA_RURAL: 0, DEFICIENCIA_SEM_AEE: 0, MAIS_DE_UM_VINCULO_AEE: 0, hipA: 0, hipB: 0 };
  app.runInTransaction((tx) => {
    const db = tx.db();
    res.escolas.forEach((s) => {
      db.newQuery("UPDATE escolas SET qtd_urbanos={:u}, qtd_rurais={:r}, pct_rural={:p}, tratada_como_campo={:c}, area_predominante={:ar} WHERE id={:id}")
        .bind({ u: s.qtd_urbanos, r: s.qtd_rurais, p: s.pct_rural, c: s.tratada_como_campo, ar: s.area_predominante, id: s.id }).execute();
    });
    res.matriculas.forEach((x) => {
      db.newQuery("UPDATE matriculas SET grupo={:g}, subcategoria={:s}, chave={:k}, etapa_base={:eb}, campo={:c}, especial={:es}, fator_vaaf={:fv}, fator_vaat={:ft}, conta_fundeb={:cf}, aviso={:av}, eh_aee={:aee} WHERE id={:id}")
        .bind({ g: x.grupo, s: x.subcategoria, k: x.chave, eb: x.etapa_base, c: x.campo, es: x.especial, fv: x.fator_vaaf, ft: x.fator_vaat, cf: x.conta_fundeb, av: x.aviso, aee: x.eh_aee, id: x.id }).execute();
    });
    db.newQuery("DELETE FROM inconsistencias WHERE municipio={:m} AND ano_censo={:a} AND status != 'corrigida'").bind({ m: m, a: ano }).execute();
    const corrigidas = {};
    todos(tx, "inconsistencias", "municipio = {:m} && ano_censo = {:a} && status = 'corrigida'", { m: m, a: ano }).forEach((r) => { corrigidas[r.getString("tipo") + "|" + r.getString("aluno")] = true; });
    const coll = tx.findCollectionByNameOrId("inconsistencias");
    res.inconsistencias.forEach((i) => {
      contagem[i.tipo]++;
      if (i.hipA) contagem.hipA++;
      if (i.hipB) contagem.hipB++;
      if (corrigidas[i.tipo + "|" + i.aluno]) return;
      const r = new Record(coll);
      r.set("municipio", m); r.set("ano_censo", ano); r.set("tipo", i.tipo); r.set("aluno", i.aluno); r.set("detalhe", i.detalhe);
      r.set("escolas_txt", i.escolas_txt); r.set("turmas_txt", i.turmas_txt); r.set("status", "aberta");
      tx.save(r);
    });
  });
  return { escolas: res.escolas.length, matriculas: res.matriculas.length, alunos: base.alunos.length, inconsistencias: contagem, fatores_ano: F.ano };
}

// ---------------------------------------------------------------- análise completa
function analise(app, e, m, ano, pcts) {
  exigirAcesso(e, m, false);
  const mun = app.findRecordById("municipios", m);
  const base = carregarBase(app, m, ano);
  const cfg = config(app);
  const F = carregarFatores(app, ano);
  const A = E.analisar(base);

  // ano anterior: importação, senão totais digitados
  let anterior = [], fonteAnterior = "nenhuma";
  const ant = todos(app, "matriculas", "municipio = {:m} && ano_censo = {:a} && conta_fundeb = true", { m: m, a: ano - 1 });
  if (ant.length) {
    const agg = {};
    ant.forEach((r) => {
      const s = r.getString("subcategoria");
      const x = (agg[s] = agg[s] || { grupo: r.getString("grupo"), subcategoria: s, matriculas: 0, vaaf: 0, vaat: 0 });
      x.matriculas++; x.vaaf += r.getFloat("fator_vaaf"); x.vaat += r.getFloat("fator_vaat");
    });
    anterior = Object.keys(agg).map((k) => agg[k]);
    fonteAnterior = "importacao";
  } else {
    const tot = todos(app, "totais_ano_anterior", "municipio = {:m} && ano_censo = {:a}", { m: m, a: ano - 1 });
    if (tot.length) {
      anterior = tot.map((r) => ({ subcategoria: r.getString("subcategoria"), matriculas: r.getFloat("matriculas"), vaaf: r.getFloat("ponderadas_vaaf"), vaat: r.getFloat("ponderadas_vaat") }));
      fonteAnterior = "digitada";
    }
  }
  const tabela = E.tabelaMatriculas(A.subcategorias, anterior);
  const totAnt = tabela.total.ant;

  // inconsistências
  const incs = todos(app, "inconsistencias", "municipio = {:m} && ano_censo = {:a}", { m: m, a: ano });
  const incResumo = { AEE_SEM_CURRICULAR: 0, URBANA_EM_ESCOLA_RURAL: 0, DEFICIENCIA_SEM_AEE: 0, MAIS_DE_UM_VINCULO_AEE: 0 };
  const incCorr = { AEE_SEM_CURRICULAR: 0, URBANA_EM_ESCOLA_RURAL: 0, DEFICIENCIA_SEM_AEE: 0, MAIS_DE_UM_VINCULO_AEE: 0 };
  let hipA = 0, hipB = 0;
  incs.forEach((r) => {
    const t = r.getString("tipo");
    if (r.getString("status") === "corrigida") incCorr[t]++; else incResumo[t]++;
    if (t === "MAIS_DE_UM_VINCULO_AEE") { const d = r.getString("detalhe"); if (d.indexOf("(a)") >= 0) hipA++; if (d.indexOf("(b)") >= 0) hipB++; }
  });

  // receitas
  const receitas = todos(app, "receitas_fundeb", "municipio = {:m}", { m: m }, "ano").map((r) => {
    const x = { id: r.id, ano: r.getInt("ano"), contribuicao: r.getFloat("contribuicao"), vaaf: r.getFloat("vaaf"), vaat: r.getFloat("vaat"), vaar: r.getFloat("vaar") };
    x.total = E.r2(E.receitaTotal(x));
    return x;
  });
  const recAtual = receitas.filter((r) => r.ano === ano)[0] || null;
  const recAnt = receitas.filter((r) => r.ano === ano - 1)[0] || null;

  let params = null;
  try {
    const p = app.findFirstRecordByFilter("parametros_projecao", "municipio = {:m} && ano_projecao = {:a}", { m: m, a: ano + 1 });
    params = {};
    ["valor_contrib", "valor_vaaf", "valor_vaat", "valor_vaat_marginal", "vaar_previsto", "fator_cons_contrib", "fator_cons_vaaf", "fator_cons_vaat", "fator_otim_contrib", "fator_otim_vaaf", "fator_otim_vaat", "referencial", "limiar_baixo_pct", "limiar_medio_pct"].forEach((f) => { params[f] = p.getFloat(f); });
    params.fonte = p.getString("fonte"); params.id = p.id;
    if (!params.limiar_baixo_pct) params.limiar_baixo_pct = 10;
    if (!params.limiar_medio_pct) params.limiar_medio_pct = 25;
  } catch (_) {}

  const ponderadas = { vaaf: A.cards.ponderadas_vaaf, vaat: A.cards.ponderadas_vaat };
  const projecao = params ? E.projetar(ponderadas, params, recAtual) : null;

  const acoes = todos(app, "acoes_modelo", "ativo = true", {}, "ordem").map((r) => ({ id: r.id, ordem: r.getInt("ordem"), descricao: r.getString("descricao"), tipo: r.getString("tipo"), alvo: (function () { try { return JSON.parse(r.getString("alvo") || "{}") || {}; } catch (_) { return {}; } })(), pct: r.getFloat("pct"), ativo: true }));
  if (pcts) acoes.forEach((a) => { if (pcts[a.id] != null && pcts[a.id] !== "") a.pct = +pcts[a.id]; });
  const receitaAtualTotal = recAtual ? recAtual.total : 0;
  const plano = params ? E.planoDeAcao(A.distribuicao, F.fatores, params, acoes, receitaAtualTotal, A.graves_sem_aee, { fatorCampo: cfg.fator_campo }) : null;

  let potencial = null;
  if (projecao) {
    const valor = E.r2(projecao.base.total + (plano ? plano.integral.impacto : 0));
    const pct = valor ? (valor - receitaAtualTotal) / valor : 0;
    potencial = { valor: valor, pct_avancar: pct, classificacao: E.classificarPotencial(pct, params), referencial: params.referencial || 0, atual: receitaAtualTotal };
  }

  return {
    municipio: { id: mun.id, nome: mun.getString("nome"), uf: mun.getString("uf"), codigo_ibge: mun.getString("codigo_ibge"), orgao: mun.getString("orgao"), cnpj: mun.getString("cnpj"), brasao: mun.getString("brasao"), populacao: mun.getFloat("populacao"), domicilios: mun.getFloat("domicilios"), area_km2: mun.getFloat("area_km2"), alfabetizacao_pct: mun.getFloat("alfabetizacao_pct"), pop_indigena: mun.getFloat("pop_indigena"), pop_quilombola: mun.getFloat("pop_quilombola"), collectionId: mun.collection().id },
    ano: ano,
    fatores_ano: F.ano,
    cards: A.cards,
    matriculas_fundeb_anterior: totAnt.matriculas,
    ponderadas_anterior: { vaaf: totAnt.vaaf, vaat: totAnt.vaat },
    fonte_anterior: fonteAnterior,
    escolas: A.escolas,
    transporte: A.transporte,
    tabela: tabela,
    inconsistencias: { abertas: incResumo, corrigidas: incCorr, hipotese_a: hipA, hipotese_b: hipB },
    receitas: receitas,
    receita_atual: recAtual,
    receita_anterior: recAnt,
    parametros: params,
    projecao: projecao,
    plano: plano,
    potencial: potencial,
    graves_sem_aee: A.graves_sem_aee,
    distribuicao: A.distribuicao,
    fatores: F.fatores,
    fator_campo: cfg.fator_campo,
  };
}

// ---------------------------------------------------------------- listas nominais
function listaInconsistencias(app, m, ano, tipo) {
  const filtro = "municipio = {:m} && ano_censo = {:a}" + (tipo ? " && tipo = {:t}" : "");
  const incs = todos(app, "inconsistencias", filtro, { m: m, a: ano, t: tipo || "" }, "tipo");
  const ids = {};
  incs.forEach((r) => { ids[r.getString("aluno")] = true; });
  const alunos = {};
  todos(app, "alunos", "municipio = {:m} && ano_censo = {:a}", { m: m, a: ano }).forEach((r) => { if (ids[r.id]) alunos[r.id] = r; });
  const out = incs.map((r) => {
    const a = alunos[r.getString("aluno")];
    return { id: r.id, tipo: r.getString("tipo"), detalhe: r.getString("detalhe"), status: r.getString("status"), escolas: r.getString("escolas_txt"), turmas: r.getString("turmas_txt"),
      aluno: a ? a.getString("nome") : "", inep: a ? a.getString("id_inep") : "", nascimento: a ? E.mascararNascimento(a.getString("data_nascimento")) : "--", cpf: a ? a.getString("cpf_mascarado") : "--", deficiencias: a ? json(a, "deficiencias").join(", ") : "" };
  });
  out.sort((x, y) => (x.aluno < y.aluno ? -1 : 1));
  return out;
}

function listaMatriculas(app, m, ano, subcategoria, escolaId) {
  let filtro = "municipio = {:m} && ano_censo = {:a}";
  if (subcategoria) filtro += " && subcategoria = {:s} && conta_fundeb = true";
  if (escolaId) filtro += " && escola = {:e}";
  const recs = todos(app, "matriculas", filtro, { m: m, a: ano, s: subcategoria || "", e: escolaId || "" });
  app.expandRecords(recs, ["aluno", "turma", "escola"], null);
  return recs.map((r) => {
    const a = r.expandedOne("aluno"), t = r.expandedOne("turma"), s = r.expandedOne("escola");
    return { id: r.id, escola: s ? s.getString("nome") : "", inep_escola: s ? s.getString("inep") : "", turma: t ? t.getString("nome") : "", aluno: a ? a.getString("nome") : "", inep: a ? a.getString("id_inep") : "", cpf: a ? a.getString("cpf_mascarado") : "--", nascimento: a ? E.mascararNascimento(a.getString("data_nascimento")) : "--", subcategoria: r.getString("subcategoria"), fator_vaaf: r.getFloat("fator_vaaf"), fator_vaat: r.getFloat("fator_vaat"), conta_fundeb: r.getBool("conta_fundeb"), aviso: r.getString("aviso") };
  }).sort((x, y) => (x.escola + x.turma + x.aluno < y.escola + y.turma + y.aluno ? -1 : 1));
}

// ---------------------------------------------------------------- relatórios
function emitirRelatorio(app, e, m, ano) {
  exigirAcesso(e, m, true);
  const A = analise(app, e, m, ano);
  const cfg = config(app);
  const anexos = listaInconsistencias(app, m, ano, "").filter((x) => x.status !== "corrigida");
  const codigo = $security.randomStringWithAlphabet(24, "0123456789abcdef");
  const emitido = agoraBrasilia();
  const snapshot = { analise: A, anexos: anexos, emitente: cfg.emitente_nome, emitente_cnpj: cfg.emitente_cnpj, url_publica: cfg.url_publica, emitido_em: emitido, codigo: codigo, emitido_por: e.auth ? e.auth.getString("name") || e.auth.getString("email") : "" };
  const r = new Record(app.findCollectionByNameOrId("relatorios"));
  r.set("municipio", m); r.set("ano", ano); r.set("codigo", codigo); r.set("emitido_em", emitido);
  if (e.auth && e.auth.collection().name === "users") { r.set("emitido_por", e.auth.id); r.set("emitido_por_nome", snapshot.emitido_por); }
  r.set("emitente", cfg.emitente_nome); r.set("snapshot", snapshot); r.set("total_receita", A.receita_atual ? A.receita_atual.total : 0);
  app.save(r);
  registrarLog(app, e, m, "emitir_relatorio", "Relatório " + codigo + " (" + ano + ")");
  return { id: r.id, codigo: codigo };
}

function verificar(app, codigo) {
  let r;
  try { r = app.findFirstRecordByFilter("relatorios", "codigo = {:c}", { c: String(codigo || "") }); } catch (_) { return null; }
  const mun = app.findRecordById("municipios", r.getString("municipio"));
  return { municipio: mun.getString("nome"), uf: mun.getString("uf"), ano: r.getInt("ano"), emitido_em: r.getString("emitido_em"), emitente: r.getString("emitente"), total_receita: r.getFloat("total_receita"), codigo: r.getString("codigo") };
}

// ---------------------------------------------------------------- IBGE
function ibgeGet(url) {
  const res = $http.send({ url: url, method: "GET", timeout: 30 });
  if (res.statusCode !== 200) throw new BadRequestError("IBGE respondeu " + res.statusCode + " para " + url);
  return res.json;
}
function ibgeMunicipio(codigo) {
  const cod = String(codigo || "").replace(/\D/g, "");
  if (cod.length !== 7) throw new BadRequestError("Código IBGE deve ter 7 dígitos.");
  const out = { codigo_ibge: cod, erros: [] };
  try {
    const loc = ibgeGet("https://servicodados.ibge.gov.br/api/v1/localidades/municipios/" + cod);
    out.nome = loc.nome;
    try { out.uf = loc.microrregiao.mesorregiao.UF.sigla; } catch (_) { try { out.uf = loc["regiao-imediata"]["regiao-intermediaria"].UF.sigla; } catch (__) {} }
  } catch (err) { out.erros.push("Localidades: " + err); }
  const sidra = (tabela, vars) => {
    const d = ibgeGet("https://apisidra.ibge.gov.br/values/t/" + tabela + "/n6/" + cod + "/v/" + vars + "/p/2022");
    const m = {};
    for (let i = 1; i < d.length; i++) m[E.norm(d[i].D2N)] = parseFloat(String(d[i].V).replace(",", "."));
    return m;
  };
  const tenta = (nome, fn) => { try { fn(); } catch (err) { out.erros.push(nome + ": " + err); } };
  tenta("População e área (tabela 4714)", () => { const m = sidra(4714, "93,6318"); out.populacao = m["populacao residente"]; out.area_km2 = m["area da unidade territorial"]; });
  tenta("Domicílios (tabela 4712)", () => { const m = sidra(4712, "381"); out.domicilios = m["domicilios particulares permanentes ocupados"]; });
  tenta("Alfabetização (tabela 9543)", () => { const m = sidra(9543, "2513"); const k = Object.keys(m)[0]; out.alfabetizacao_pct = m[k]; });
  tenta("População indígena (tabela 9718)", () => { const m = sidra(9718, "allxp"); out.pop_indigena = m["pessoas indigenas"]; });
  tenta("População quilombola (tabela 9578)", () => { const m = sidra(9578, "allxp"); out.pop_quilombola = m["pessoas quilombolas"]; });
  return out;
}
function ibgeBusca(nome, uf) {
  const url = uf ? "https://servicodados.ibge.gov.br/api/v1/localidades/estados/" + uf + "/municipios" : "https://servicodados.ibge.gov.br/api/v1/localidades/municipios";
  const lista = ibgeGet(url);
  const n = E.norm(nome);
  const out = [];
  for (let i = 0; i < lista.length && out.length < 30; i++) {
    const x = lista[i];
    if (E.norm(x.nome).indexOf(n) < 0) continue;
    let sigla = uf || "";
    try { sigla = x.microrregiao.mesorregiao.UF.sigla; } catch (_) {}
    out.push({ codigo_ibge: String(x.id), nome: x.nome, uf: sigla });
  }
  return out;
}

// ---------------------------------------------------------------- e-mail
function enviarEmail(app, e, relatorioId, base) {
  const r = app.findRecordById("relatorios", relatorioId);
  const m = r.getString("municipio");
  exigirAcesso(e, m, true);
  const s = app.settings();
  if (!s.smtp.enabled) throw new BadRequestError("O envio de e-mail não está configurado. Configure o SMTP no painel do PocketBase (Settings → Mail settings).");
  const gestores = todos(app, "users", "role = 'gestor' && ativo = true && municipios.id ?= {:m}", { m: m });
  if (!gestores.length) throw new BadRequestError("Nenhum gestor ativo vinculado a este município.");
  const snap = JSON.parse(r.getString("snapshot") || "{}");
  const A = snap.analise || {};
  const brl = (v) => "R$ " + (+v || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const inc = A.inconsistencias ? A.inconsistencias.abertas : {};
  const nInc = Object.keys(inc || {}).reduce((a, k) => a + (inc[k] || 0), 0);
  const link = (base || snap.url_publica || "").replace(/\/$/, "") + "/relatorios";
  const html = "<h2>Análise do FUNDEB — " + (A.municipio ? A.municipio.nome + "/" + A.municipio.uf : "") + " (" + r.getInt("ano") + ")</h2>" +
    "<p><b>Receita FUNDEB do ano:</b> " + brl(A.receita_atual ? A.receita_atual.total : 0) + "<br/>" +
    "<b>Projeção (cenário base):</b> " + brl(A.projecao ? A.projecao.base.total : 0) + "<br/>" +
    "<b>Potencial:</b> " + brl(A.potencial ? A.potencial.valor : 0) + (A.potencial ? " (" + A.potencial.classificacao + ")" : "") + "<br/>" +
    "<b>Inconsistências abertas:</b> " + nInc + "</p>" +
    "<p>Acesse o relatório completo no sistema: <a href=\"" + link + "\">" + link + "</a></p>" +
    "<p style=\"color:#666;font-size:12px\">Código de verificação: " + r.getString("codigo") + ". Este e-mail não contém dados pessoais de alunos.</p>";
  const msg = new MailerMessage({
    from: { address: s.meta.senderAddress, name: s.meta.senderName },
    to: gestores.map((g) => ({ address: g.getString("email") })),
    subject: "Radar FUNDEB — Relatório " + (A.municipio ? A.municipio.nome : "") + " " + r.getInt("ano"),
    html: html,
  });
  app.newMailClient().send(msg);
  return { enviados: gestores.length };
}

module.exports = { exigirAcesso, exigirAdmin, registrarLog, importar, processar, analise, listaInconsistencias, listaMatriculas, emitirRelatorio, verificar, ibgeMunicipio, ibgeBusca, enviarEmail, todos, config, agoraBrasilia, papel };
