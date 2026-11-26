/*
 * Radar FUNDEB — motor de cálculo (funções puras).
 * Roda no JSVM do PocketBase (require) e no Node (testes). Mantenha ES2015 simples:
 * sem optional chaining, sem nullish coalescing, sem async.
 */
"use strict";

// ---------------------------------------------------------------- utilidades
function norm(s) {
  var t = String(s == null ? "" : s);
  if (typeof t.normalize === "function") t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}
function r4(n) { return Math.round(n * 10000) / 10000; }
function r2(n) { return Math.round(n * 100) / 100; }
function variacao(atual, anterior) {
  if (!anterior) return 0;
  return atual / anterior - 1;
}
function parseData(s) {
  var m = String(s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return { d: +m[1], m: +m[2], y: +m[3] };
}
/** Idade completa em 31/03 do ano do Censo. */
function idadeEm3103(nasc, ano) {
  var p = parseData(nasc);
  if (!p) return null;
  var idade = ano - p.y;
  if (p.m > 3 || (p.m === 3 && p.d > 31)) idade -= 1;
  return idade;
}
function listaLimpa(v) {
  if (!v) return [];
  var arr = Array.isArray(v) ? v : String(v).split("|");
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var t = String(arr[i] == null ? "" : arr[i]).trim();
    if (t && t !== "--" && t !== "-") out.push(t);
  }
  return out;
}
function ehAEE(tipoTurma) { return norm(tipoTurma).indexOf("atendimento educacional especializado") === 0; }
function ehCurricular(tipoTurma) { return norm(tipoTurma).indexOf("curricular") === 0; }

// ---------------------------------------------------------------- catálogo
var NOMES = {
  creche_integral: "Creche Integral Pública",
  creche_parcial: "Creche Parcial Pública",
  pre_integral: "Pré-Escola Integral Pública",
  pre_parcial: "Pré-Escola Parcial Pública",
  pre_parcial_conv: "Pré-Escola Parcial Conveniada",
  fund_integral: "Ensino Fundamental Integral",
  ai_parcial: "Anos Iniciais Fundamental",
  af_parcial: "Anos Finais Fundamental",
  eja_fund: "EJA Fundamental",
  esp_creche: "Educação Especial - Creche",
  esp_pre: "Educação Especial - Pré-Escola",
  esp_fund: "Educação Especial - Fundamental",
  esp_eja: "Educação Especial - EJA Fundamental",
  aee_infantil: "AEE - Infantil",
  aee_fund: "AEE - Fundamental",
  aee_medio: "AEE - Médio",
};
var GRUPO_DA_CHAVE = {
  creche_integral: "a", creche_parcial: "b", pre_integral: "c", pre_parcial: "d", pre_parcial_conv: "d",
  fund_integral: "e", ai_parcial: "f", af_parcial: "f", eja_fund: "i",
  esp_creche: "j", esp_pre: "j", esp_fund: "j", esp_eja: "j",
  aee_infantil: "m", aee_fund: "m", aee_medio: "m",
};
var GRUPOS = [
  { grupo: "a", nome: "a) Creche em tempo integral pública" },
  { grupo: "b", nome: "b) Creche em tempo parcial pública" },
  { grupo: "c", nome: "c) Pré-escola em tempo integral pública" },
  { grupo: "d", nome: "d) Pré-escola em tempo parcial" },
  { grupo: "e", nome: "e) Ensino fundamental em tempo integral" },
  { grupo: "f", nome: "f) Ensino fundamental em tempo parcial" },
  { grupo: "i", nome: "i) Educação de jovens e adultos" },
  { grupo: "j", nome: "j) Educação especial" },
  { grupo: "m", nome: "m) Atendimento educacional especializado (AEE)" },
];
var CHAVES_PARCIAIS = ["creche_parcial", "pre_parcial", "pre_parcial_conv", "ai_parcial", "af_parcial", "esp_creche", "esp_pre", "esp_fund", "esp_eja"];
var INTEGRAL_POR_ETAPA = { creche: "creche_integral", pre: "pre_integral", ai: "fund_integral", af: "fund_integral" };

/**
 * REGRA DA EDUCAÇÃO ESPECIAL (deduzida do relatório de referência — a validar):
 * aluno com deficiência/TEA/AH em turma curricular recebe o MAIOR fator entre etapa e especial.
 * - turma integral: fica na etapa com sufixo " Especial";
 * - turma parcial, EJA ou classe especial: vai para o grupo j.
 * Troque aqui se a validação mostrar outro comportamento.
 */
var REGRA_ESPECIAL = {
  integralFicaNaEtapa: true,
  parcialVaiParaJ: true,
  ejaVaiParaJ: true,
  classeEspecialVaiParaJ: true,
};

var FATOR_CAMPO_PADRAO = 1.15;

/** Deficiências consideradas "graves" na ação garantir_aee. */
var DEFICIENCIAS_GRAVES = ["deficiencia multipla", "surdocegueira", "cegueira", "deficiencia intelectual", "transtorno do espectro autista", "surdez"];

function espDaChave(chave) {
  if (chave.indexOf("creche") === 0) return "esp_creche";
  if (chave.indexOf("pre_") === 0) return "esp_pre";
  if (chave.indexOf("eja") === 0) return "esp_eja";
  return "esp_fund";
}

function nomeSubcategoria(chave, campo, especial, fatores) {
  var f = fatores && fatores[chave];
  var aplica = f ? f.aplica_campo : chave.indexOf("aee_") !== 0;
  var nome = NOMES[chave] || chave;
  if (campo && aplica) nome += " Campo";
  if (especial && chave.indexOf("esp_") !== 0 && chave.indexOf("aee_") !== 0) nome += " Especial";
  return nome;
}

/** fatores: { chave: { vaaf, vaat, aplica_campo } } */
function fatorDe(chave, campo, especial, fatores, multCampo) {
  var f = fatores[chave];
  if (!f) return { vaaf: 0, vaat: 0 };
  var vaaf = f.vaaf, vaat = f.vaat;
  if (especial && chave.indexOf("esp_") !== 0 && chave.indexOf("aee_") !== 0) {
    var e = fatores[espDaChave(chave)];
    if (e) { vaaf = Math.max(vaaf, e.vaaf); vaat = Math.max(vaat, e.vaat); }
  }
  if (campo && f.aplica_campo) { vaaf *= multCampo; vaat *= multCampo; }
  return { vaaf: r4(vaaf), vaat: r4(vaat) };
}

// ---------------------------------------------------------------- etapa
/** Retorna creche | pre | ai | af | eja | medio | null */
function etapaBase(etapa, etapaMulti, idade) {
  var e = norm(etapa);
  if (!e) return null;
  if (e.indexOf("eja") >= 0 || e.indexOf("jovens e adultos") >= 0) return e.indexOf("medio") >= 0 ? "medio" : "eja";
  if (e.indexOf("creche") >= 0) return "creche";
  if (e.indexOf("pre-escola") >= 0 || e.indexOf("pre escola") >= 0 || e.indexOf("preescola") >= 0) return "pre";
  if (e.indexOf("infantil") >= 0 || e.indexOf("unificada") >= 0) {
    if (idade == null) return "pre";
    return idade <= 3 ? "creche" : "pre";
  }
  if (e.indexOf("medio") >= 0) return "medio";
  if (e.indexOf("fundamental") >= 0) {
    var fonte = e;
    if ((e.indexOf("multi") >= 0 || e.indexOf("correcao") >= 0) && etapaMulti) fonte = norm(etapaMulti) + " " + e;
    if (fonte.indexOf("anos finais") >= 0) return "af";
    if (fonte.indexOf("anos iniciais") >= 0) return "ai";
    // "Ensino Fundamental de 9 anos - 3º Ano": ignora o "9 anos" do nome da etapa
    var m = fonte.match(/(\d)\s*[\u00ba\u00b0]\s*ano/) || fonte.replace(/de 9 anos/g, "").replace(/de 8 anos/g, "").match(/(\d)\s*o?\s*ano(?!s)/);
    if (m) return +m[1] >= 6 ? "af" : "ai";
    return "ai";
  }
  return null;
}

// ---------------------------------------------------------------- horários
var DIAS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
function parseHorarios(txt) {
  var out = [];
  var partes = String(txt || "").split("|");
  for (var i = 0; i < partes.length; i++) {
    var p = norm(partes[i]);
    var m = p.match(/^([a-z]+)[^0-9]*?(\d{1,2}):(\d{2})\s*(?:as|a|-|ate)\s*(\d{1,2}):(\d{2})/);
    if (!m) continue;
    var dia = null;
    for (var d = 0; d < DIAS.length; d++) if (m[1].indexOf(DIAS[d]) === 0) dia = DIAS[d];
    if (!dia) continue;
    out.push({ dia: dia, ini: +m[2] * 60 + +m[3], fim: +m[4] * 60 + +m[5] });
  }
  return out;
}
function horariosSobrepoem(a, b) {
  var ha = parseHorarios(a), hb = parseHorarios(b);
  for (var i = 0; i < ha.length; i++)
    for (var j = 0; j < hb.length; j++)
      if (ha[i].dia === hb[j].dia && ha[i].ini < hb[j].fim && hb[j].ini < ha[i].fim) return true;
  return false;
}

// ---------------------------------------------------------------- processamento
/**
 * data = { ano, escolas:[{id,nome,inep,localizacao,dependencia}], turmas:[{id,escola,nome,tipo_turma,etapa,carga_semanal_min,classe_especial,horarios}],
 *          alunos:[{id,id_inep,nome,data_nascimento,deficiencias,zona_residencia,localizacao_diferenciada}],
 *          matriculas:[{id,aluno,turma,escola,etapa,etapa_vinculo_multi,transporte}] }
 * fatores: { chave: {vaaf, vaat, aplica_campo} }
 */
function processar(data, fatores, opcoes) {
  opcoes = opcoes || {};
  var mult = opcoes.fatorCampo || FATOR_CAMPO_PADRAO;
  var ano = data.ano;
  var escolaPorId = {}, turmaPorId = {}, alunoPorId = {};
  var i, j;
  for (i = 0; i < data.escolas.length; i++) escolaPorId[data.escolas[i].id] = data.escolas[i];
  for (i = 0; i < data.turmas.length; i++) turmaPorId[data.turmas[i].id] = data.turmas[i];
  for (i = 0; i < data.alunos.length; i++) alunoPorId[data.alunos[i].id] = data.alunos[i];

  // vínculos por aluno e por escola
  var porAluno = {}, alunosPorEscola = {};
  for (i = 0; i < data.matriculas.length; i++) {
    var m = data.matriculas[i];
    var t = turmaPorId[m.turma] || {};
    m._aee = ehAEE(t.tipo_turma);
    m._curr = ehCurricular(t.tipo_turma);
    (porAluno[m.aluno] = porAluno[m.aluno] || []).push(m);
    var ae = (alunosPorEscola[m.escola] = alunosPorEscola[m.escola] || {});
    ae[m.aluno] = true;
  }

  // 1) escolas: residência rural / campo
  var escolasOut = [];
  for (i = 0; i < data.escolas.length; i++) {
    var esc = data.escolas[i];
    var urb = 0, rur = 0, areas = {};
    var ids = Object.keys(alunosPorEscola[esc.id] || {});
    for (j = 0; j < ids.length; j++) {
      var al = alunoPorId[ids[j]];
      if (!al) continue;
      var z = norm(al.zona_residencia);
      if (z === "rural") rur++; else if (z === "urbana") urb++;
      var ar = String(al.localizacao_diferenciada || "").trim() || "--";
      areas[ar] = (areas[ar] || 0) + 1;
    }
    var pct = urb + rur > 0 ? rur / (urb + rur) : 0;
    var rural = norm(esc.localizacao) === "rural";
    var area = "--", maxA = -1;
    var ak = Object.keys(areas);
    for (j = 0; j < ak.length; j++) if (areas[ak[j]] > maxA) { maxA = areas[ak[j]]; area = ak[j]; }
    esc.tratada_como_campo = rural || pct >= 0.5;
    escolasOut.push({ id: esc.id, qtd_urbanos: urb, qtd_rurais: rur, pct_rural: r4(pct), tratada_como_campo: esc.tratada_como_campo, area_predominante: area, total_alunos: ids.length });
  }

  // 2) classificação de cada matrícula
  var matOut = [];
  var curricularEtapaDoAluno = {};
  for (i = 0; i < data.matriculas.length; i++) {
    var mc = data.matriculas[i];
    if (!mc._curr) continue;
    var alc = alunoPorId[mc.aluno] || {};
    var tc = turmaPorId[mc.turma] || {};
    var eb = etapaBase(mc.etapa || tc.etapa, mc.etapa_vinculo_multi, idadeEm3103(alc.data_nascimento, ano));
    if (eb && !curricularEtapaDoAluno[mc.aluno]) curricularEtapaDoAluno[mc.aluno] = eb;
  }

  for (i = 0; i < data.matriculas.length; i++) {
    var mt = data.matriculas[i];
    var tu = turmaPorId[mt.turma] || {};
    var es = escolaPorId[mt.escola] || {};
    var a = alunoPorId[mt.aluno] || {};
    var idade = idadeEm3103(a.data_nascimento, ano);
    var res = { id: mt.id, grupo: "", subcategoria: "", chave: "", etapa_base: "", campo: false, especial: false, fator_vaaf: 0, fator_vaat: 0, conta_fundeb: false, aviso: "", eh_aee: mt._aee };
    var campo = !!es.tratada_como_campo;

    if (mt._aee) {
      var ebA = curricularEtapaDoAluno[mt.aluno];
      var nivel;
      if (ebA === "creche" || ebA === "pre") nivel = "aee_infantil";
      else if (ebA === "medio") nivel = "aee_medio";
      else if (ebA) nivel = "aee_fund";
      else nivel = idade != null && idade <= 5 ? "aee_infantil" : "aee_fund";
      var fa = fatorDe(nivel, false, false, fatores, mult);
      res.chave = nivel; res.grupo = "m"; res.subcategoria = nomeSubcategoria(nivel, false, false, fatores);
      res.etapa_base = ebA || ""; res.fator_vaaf = fa.vaaf; res.fator_vaat = fa.vaat; res.conta_fundeb = true;
      matOut.push(res); continue;
    }
    if (!mt._curr) { res.aviso = "Turma não curricular (não conta no FUNDEB)"; matOut.push(res); continue; }

    var base = etapaBase(mt.etapa || tu.etapa, mt.etapa_vinculo_multi, idade);
    var integral = (+tu.carga_semanal_min || 0) >= 2100;
    var especial = listaLimpa(a.deficiencias).length > 0;
    var conveniada = norm(es.dependencia).indexOf("conveniada") >= 0;
    var chave = null;
    if (!base || base === "medio") {
      res.aviso = base === "medio" ? "Ensino médio: sem categoria municipal configurada" : "Etapa de ensino não reconhecida";
      matOut.push(res); continue;
    }
    var vaiJ = especial && (
      (base === "eja" && REGRA_ESPECIAL.ejaVaiParaJ) ||
      (!integral && REGRA_ESPECIAL.parcialVaiParaJ) ||
      (!REGRA_ESPECIAL.integralFicaNaEtapa)
    );
    if (tu.classe_especial && REGRA_ESPECIAL.classeEspecialVaiParaJ) vaiJ = true;

    if (vaiJ) {
      chave = base === "creche" ? "esp_creche" : base === "pre" ? "esp_pre" : base === "eja" ? "esp_eja" : "esp_fund";
      especial = true;
    } else if (base === "eja") chave = "eja_fund";
    else if (base === "creche") chave = integral ? "creche_integral" : "creche_parcial";
    else if (base === "pre") chave = integral ? "pre_integral" : conveniada ? "pre_parcial_conv" : "pre_parcial";
    else chave = integral ? "fund_integral" : base === "ai" ? "ai_parcial" : "af_parcial";

    var ff = fatorDe(chave, campo, especial, fatores, mult);
    res.chave = chave; res.grupo = GRUPO_DA_CHAVE[chave]; res.etapa_base = base;
    res.campo = campo && !!(fatores[chave] && fatores[chave].aplica_campo); res.especial = especial;
    res.subcategoria = nomeSubcategoria(chave, campo, especial, fatores);
    res.fator_vaaf = ff.vaaf; res.fator_vaat = ff.vaat; res.conta_fundeb = true;
    matOut.push(res);
  }

  // 3) uma curricular por aluno (a de maior fator VAAF)
  var resPorId = {};
  for (i = 0; i < matOut.length; i++) resPorId[matOut[i].id] = matOut[i];
  var alunosIds = Object.keys(porAluno);
  for (i = 0; i < alunosIds.length; i++) {
    var lst = porAluno[alunosIds[i]];
    var currs = [];
    for (j = 0; j < lst.length; j++) { var rr = resPorId[lst[j].id]; if (rr && !rr.eh_aee && rr.conta_fundeb) currs.push(rr); }
    if (currs.length > 1) {
      currs.sort(function (x, y) { return y.fator_vaaf - x.fator_vaaf; });
      for (j = 1; j < currs.length; j++) { currs[j].conta_fundeb = false; currs[j].aviso = "Aluno com mais de uma matrícula curricular; contada a de maior fator"; }
      currs[0].aviso = "Aluno com " + currs.length + " matrículas curriculares; esta é a contada";
    }
  }

  // 4) inconsistências
  var inc = [];
  for (i = 0; i < alunosIds.length; i++) {
    var aid = alunosIds[i];
    var al2 = alunoPorId[aid];
    if (!al2) continue;
    var vs = porAluno[aid];
    var aees = [], curs = [];
    for (j = 0; j < vs.length; j++) { if (vs[j]._aee) aees.push(vs[j]); else if (vs[j]._curr) curs.push(vs[j]); }
    var def = listaLimpa(al2.deficiencias);
    var urbana = norm(al2.zona_residencia) === "urbana";
    var emRural = false;
    for (j = 0; j < vs.length; j++) if (norm((escolaPorId[vs[j].escola] || {}).localizacao) === "rural") emRural = true;

    var txt = function (comLoc) {
      var escs = [], tus = [];
      for (var k = 0; k < vs.length; k++) {
        var e2 = escolaPorId[vs[k].escola] || {};
        var nomeE = (e2.nome || "") + (comLoc ? " (" + (e2.localizacao || "") + ")" : "");
        if (escs.indexOf(nomeE) < 0) escs.push(nomeE);
        var t2 = turmaPorId[vs[k].turma] || {};
        tus.push(t2.nome || "");
      }
      return { escolas: escs.join("; "), turmas: tus.join("; ") };
    };
    if (aees.length >= 1 && curs.length === 0) {
      var t1 = txt(false); inc.push({ tipo: "AEE_SEM_CURRICULAR", aluno: aid, detalhe: aees.length + " matrícula(s) de AEE e nenhuma curricular no município", escolas_txt: t1.escolas, turmas_txt: t1.turmas });
    }
    if (urbana && emRural) {
      var t2b = txt(true); inc.push({ tipo: "URBANA_EM_ESCOLA_RURAL", aluno: aid, detalhe: "Residência urbana com vínculo em escola rural", escolas_txt: t2b.escolas, turmas_txt: t2b.turmas });
    }
    if (def.length > 0 && aees.length === 0) {
      var t3 = txt(false); inc.push({ tipo: "DEFICIENCIA_SEM_AEE", aluno: aid, detalhe: "Deficiência informada: " + def.join(", "), escolas_txt: t3.escolas, turmas_txt: t3.turmas });
    }
    var hip = [];
    if (aees.length >= 2) hip.push("(a) " + aees.length + " matrículas de AEE no município");
    var sobre = false;
    for (j = 0; j < aees.length && !sobre; j++)
      for (var k2 = 0; k2 < curs.length && !sobre; k2++)
        if (horariosSobrepoem((turmaPorId[aees[j].turma] || {}).horarios, (turmaPorId[curs[k2].turma] || {}).horarios)) sobre = true;
    if (sobre) hip.push("(b) AEE no mesmo horário da turma curricular");
    if (hip.length) {
      var t4 = txt(false); inc.push({ tipo: "MAIS_DE_UM_VINCULO_AEE", aluno: aid, detalhe: "Hipótese " + hip.join(" e "), hipA: aees.length >= 2, hipB: sobre, escolas_txt: t4.escolas, turmas_txt: t4.turmas });
    }
  }

  return { escolas: escolasOut, matriculas: matOut, inconsistencias: inc };
}

// ---------------------------------------------------------------- análise (telas)
/**
 * data: mesmo formato de processar, mas matriculas já classificadas (campos chave, campo, especial, etapa_base,
 * subcategoria, grupo, fator_vaaf, fator_vaat, conta_fundeb, eh_aee, transporte) e escolas com campos do processamento.
 */
function analisar(data) {
  var i, j;
  var turmaPorId = {}, alunoPorId = {};
  for (i = 0; i < data.turmas.length; i++) turmaPorId[data.turmas[i].id] = data.turmas[i];
  for (i = 0; i < data.alunos.length; i++) alunoPorId[data.alunos[i].id] = data.alunos[i];

  var alunosTodos = {}, alunosCurr = {}, transpSim = {}, escolasComVinc = {};
  var porEscolaCurr = {}, porEscolaTransp = {};
  var aeeCount = 0, contaFundeb = 0, pVaaf = 0, pVaat = 0;
  var alunoTemAEE = {}, alunoEtapa = {};
  var sub = {}, dist = {};
  for (i = 0; i < data.matriculas.length; i++) {
    var m = data.matriculas[i];
    alunosTodos[m.aluno] = true;
    escolasComVinc[m.escola] = true;
    if (m.eh_aee) { aeeCount++; alunoTemAEE[m.aluno] = true; }
    var t = turmaPorId[m.turma] || {};
    if (!m.eh_aee && ehCurricular(t.tipo_turma)) {
      alunosCurr[m.aluno] = true;
      (porEscolaCurr[m.escola] = porEscolaCurr[m.escola] || {})[m.aluno] = true;
      if (m.transporte) { transpSim[m.aluno] = true; (porEscolaTransp[m.escola] = porEscolaTransp[m.escola] || {})[m.aluno] = true; }
      if (m.etapa_base && !alunoEtapa[m.aluno]) alunoEtapa[m.aluno] = m.etapa_base;
    }
    if (m.conta_fundeb && m.chave) {
      contaFundeb++; pVaaf += m.fator_vaaf; pVaat += m.fator_vaat;
      var s = (sub[m.subcategoria] = sub[m.subcategoria] || { grupo: m.grupo, subcategoria: m.subcategoria, matriculas: 0, vaaf: 0, vaat: 0 });
      s.matriculas++; s.vaaf += m.fator_vaaf; s.vaat += m.fator_vaat;
      var dk = m.chave + "|" + (m.campo ? 1 : 0) + "|" + (m.especial ? 1 : 0) + "|" + (m.etapa_base || "");
      dist[dk] = (dist[dk] || 0) + 1;
    }
  }
  var subcats = [];
  var sk = Object.keys(sub);
  for (i = 0; i < sk.length; i++) { var x = sub[sk[i]]; x.vaaf = r4(x.vaaf); x.vaat = r4(x.vaat); subcats.push(x); }

  // alunos com deficiência grave sem AEE (para a ação garantir_aee)
  var gravesSemAEE = { aee_infantil: 0, aee_fund: 0 };
  for (i = 0; i < data.alunos.length; i++) {
    var al = data.alunos[i];
    if (alunoTemAEE[al.id] || !alunosCurr[al.id]) continue;
    var defs = listaLimpa(al.deficiencias);
    var grave = false;
    for (j = 0; j < defs.length; j++) for (var g = 0; g < DEFICIENCIAS_GRAVES.length; g++) if (norm(defs[j]).indexOf(DEFICIENCIAS_GRAVES[g]) >= 0) grave = true;
    if (!grave) continue;
    var eb = alunoEtapa[al.id];
    if (eb === "creche" || eb === "pre") gravesSemAEE.aee_infantil++;
    else if (eb === "ai" || eb === "af") gravesSemAEE.aee_fund++;
  }

  var escolasTab = [];
  var transpPorEscola = {};
  for (i = 0; i < data.escolas.length; i++) {
    var e = data.escolas[i];
    if (!escolasComVinc[e.id]) continue;
    var rural = norm(e.localizacao) === "rural";
    escolasTab.push({ id: e.id, inep: e.inep, nome: e.nome, localizacao: e.localizacao, dependencia: e.dependencia, qtd_urbanos: e.qtd_urbanos || 0, qtd_rurais: e.qtd_rurais || 0, pct_rural: e.pct_rural || 0, tratada_como_campo: !!e.tratada_como_campo, area: e.area_predominante || "--", residencia_rural: rural ? "NA" : (e.pct_rural || 0) >= 0.5 ? "SIM" : "NAO" });
    var u = Object.keys(porEscolaCurr[e.id] || {}).length, tsim = Object.keys(porEscolaTransp[e.id] || {}).length;
    transpPorEscola[e.id] = { utiliza: tsim, nao_utiliza: u - tsim };
  }
  escolasTab.sort(function (a, b) { return String(a.inep) < String(b.inep) ? -1 : 1; });
  var universo = Object.keys(alunosCurr).length, utiliza = Object.keys(transpSim).length;

  return {
    cards: {
      total_escolas: Object.keys(escolasComVinc).length,
      total_alunos: Object.keys(alunosTodos).length,
      alunos_curricular: universo,
      matriculas_aee: aeeCount,
      matriculas_fundeb: contaFundeb,
      ponderadas_vaaf: r4(pVaaf),
      ponderadas_vaat: r4(pVaat),
    },
    escolas: escolasTab,
    transporte: { utiliza: utiliza, nao_utiliza: universo - utiliza, por_escola: transpPorEscola },
    subcategorias: subcats,
    distribuicao: dist,
    graves_sem_aee: gravesSemAEE,
  };
}

/** Monta a tabela comparativa (grupos + subcategorias) entre ano anterior e atual. */
function tabelaMatriculas(atual, anterior) {
  var porNome = {}, i;
  function add(lista, lado) {
    for (var k = 0; k < (lista || []).length; k++) {
      var s = lista[k];
      var row = (porNome[s.subcategoria] = porNome[s.subcategoria] || { grupo: s.grupo || grupoPorNome(s.subcategoria), subcategoria: s.subcategoria, ant: { matriculas: 0, vaaf: 0, vaat: 0 }, atual: { matriculas: 0, vaaf: 0, vaat: 0 } });
      if (!row.grupo && s.grupo) row.grupo = s.grupo;
      row[lado] = { matriculas: +s.matriculas || 0, vaaf: +s.vaaf || 0, vaat: +s.vaat || 0 };
    }
  }
  add(anterior, "ant"); add(atual, "atual");
  var grupos = [], total = { ant: { matriculas: 0, vaaf: 0, vaat: 0 }, atual: { matriculas: 0, vaaf: 0, vaat: 0 } };
  for (i = 0; i < GRUPOS.length; i++) {
    var G = GRUPOS[i];
    var linhas = [];
    var nomes = Object.keys(porNome);
    for (var j = 0; j < nomes.length; j++) {
      var r = porNome[nomes[j]];
      if (r.grupo !== G.grupo) continue;
      if (!r.ant.matriculas && !r.atual.matriculas) continue;
      r.peso = r.atual.matriculas ? r4(r.atual.vaaf / r.atual.matriculas) : r.ant.matriculas ? r4(r.ant.vaaf / r.ant.matriculas) : 0;
      linhas.push(r);
    }
    linhas.sort(function (a, b) { return a.subcategoria < b.subcategoria ? -1 : 1; });
    if (!linhas.length) continue;
    var tg = { ant: { matriculas: 0, vaaf: 0, vaat: 0 }, atual: { matriculas: 0, vaaf: 0, vaat: 0 } };
    for (var l = 0; l < linhas.length; l++) {
      ["ant", "atual"].forEach(function (lado) {
        ["matriculas", "vaaf", "vaat"].forEach(function (c) { tg[lado][c] += linhas[l][lado][c]; total[lado][c] += linhas[l][lado][c]; });
      });
    }
    grupos.push({ grupo: G.grupo, nome: G.nome, totais: tg, linhas: linhas });
  }
  return { grupos: grupos, total: total };
}
function grupoPorNome(nome) {
  var n = norm(nome);
  if (n.indexOf("aee") === 0) return "m";
  if (n.indexOf("educacao especial") === 0) return "j";
  if (n.indexOf("eja") === 0) return "i";
  if (n.indexOf("creche integral") === 0) return "a";
  if (n.indexOf("creche parcial") === 0) return "b";
  if (n.indexOf("pre-escola integral") === 0) return "c";
  if (n.indexOf("pre-escola parcial") === 0) return "d";
  if (n.indexOf("ensino fundamental integral") === 0) return "e";
  if (n.indexOf("anos") === 0) return "f";
  return "";
}

// ---------------------------------------------------------------- receitas e projeção
function receitaTotal(r) { return r ? (+r.contribuicao || 0) + (+r.vaaf || 0) + (+r.vaat || 0) + (+r.vaar || 0) : 0; }

function projetar(ponderadas, params, receitaAtual) {
  var p = params || {};
  var base = {
    contribuicao: r2(ponderadas.vaaf * (+p.valor_contrib || 0)),
    vaaf: r2(ponderadas.vaaf * (+p.valor_vaaf || 0)),
    vaat: r2(ponderadas.vaat * (+p.valor_vaat || 0)),
    vaar: r2(+p.vaar_previsto || 0),
  };
  base.total = r2(base.contribuicao + base.vaaf + base.vaat + base.vaar);
  function cen(fc, fv, ft) {
    var c = { contribuicao: r2(base.contribuicao * (+fc || 1)), vaaf: r2(base.vaaf * (+fv || 1)), vaat: r2(base.vaat * (+ft || 1)), vaar: base.vaar };
    c.total = r2(c.contribuicao + c.vaaf + c.vaat + c.vaar);
    return c;
  }
  var cons = cen(p.fator_cons_contrib, p.fator_cons_vaaf, p.fator_cons_vaat);
  var otim = cen(p.fator_otim_contrib, p.fator_otim_vaaf, p.fator_otim_vaat);
  var ra = receitaAtual || {};
  ra = { contribuicao: +ra.contribuicao || 0, vaaf: +ra.vaaf || 0, vaat: +ra.vaat || 0, vaar: +ra.vaar || 0 };
  ra.total = receitaTotal(ra);
  function vars(c) { return { contribuicao: variacao(c.contribuicao, ra.contribuicao), vaaf: variacao(c.vaaf, ra.vaaf), vaat: variacao(c.vaat, ra.vaat), vaar: variacao(c.vaar, ra.vaar), total: variacao(c.total, ra.total) }; }
  return { conservador: cons, base: base, otimista: otim, variacoes: { conservador: vars(cons), base: vars(base), otimista: vars(otim) } };
}

function classificarPotencial(pctAvancar, params) {
  var b = params && params.limiar_baixo_pct != null && params.limiar_baixo_pct !== "" ? +params.limiar_baixo_pct : 10;
  var md = params && params.limiar_medio_pct != null && params.limiar_medio_pct !== "" ? +params.limiar_medio_pct : 25;
  var p = pctAvancar * 100;
  if (p < b) return "BAIXO";
  if (p <= md) return "MÉDIO";
  return "ALTO";
}

// ---------------------------------------------------------------- plano de ação
function distParaLista(dist) {
  var out = [];
  var ks = Object.keys(dist || {});
  for (var i = 0; i < ks.length; i++) {
    var p = ks[i].split("|");
    out.push({ chave: p[0], campo: p[1] === "1", especial: p[2] === "1", etapa_base: p[3] || "", n: dist[ks[i]] });
  }
  return out;
}
function ponderadasDe(lista, fatores, mult) {
  var v = 0, t = 0;
  for (var i = 0; i < lista.length; i++) {
    var f = fatorDe(lista[i].chave, lista[i].campo, lista[i].especial, fatores, mult);
    v += f.vaaf * lista[i].n; t += f.vaat * lista[i].n;
  }
  return { vaaf: v, vaat: t };
}
function clonar(lista) { return lista.map(function (e) { return { chave: e.chave, campo: e.campo, especial: e.especial, etapa_base: e.etapa_base, n: e.n }; }); }

function aplicarAcao(lista, acao, gravesSemAEE) {
  var alvo = acao.alvo || {};
  var pct = (+acao.pct || 0) / 100;
  var out = clonar(lista), i;
  if (acao.tipo === "converter_integral") {
    var etapas = alvo.etapas || [];
    var novos = [];
    for (i = 0; i < out.length; i++) {
      var e = out[i];
      if (CHAVES_PARCIAIS.indexOf(e.chave) < 0 || etapas.indexOf(e.etapa_base) < 0) continue;
      var para = INTEGRAL_POR_ETAPA[e.etapa_base];
      if (!para) continue;
      var mover = e.n * (pct || 1);
      e.n -= mover;
      novos.push({ chave: para, campo: e.campo, especial: e.especial, etapa_base: e.etapa_base, n: mover });
    }
    return out.concat(novos);
  }
  if (acao.tipo === "aumentar_pct") {
    for (i = 0; i < out.length; i++) {
      var x = out[i];
      if (x.chave === alvo.chave && !!x.campo === !!alvo.campo && !x.especial) x.n = x.n * (1 + pct);
    }
    return out;
  }
  if (acao.tipo === "garantir_aee") {
    var g = gravesSemAEE || {};
    var f = pct || 1;
    if (g.aee_infantil) out.push({ chave: "aee_infantil", campo: false, especial: false, etapa_base: "", n: g.aee_infantil * f });
    if (g.aee_fund) out.push({ chave: "aee_fund", campo: false, especial: false, etapa_base: "", n: g.aee_fund * f });
    return out;
  }
  return out;
}

function impactoDe(delta, params) {
  var p = params || {};
  var marg = p.valor_vaat_marginal != null && p.valor_vaat_marginal !== "" && +p.valor_vaat_marginal > 0 ? +p.valor_vaat_marginal : +p.valor_vaat || 0;
  return delta.vaaf * ((+p.valor_contrib || 0) + (+p.valor_vaaf || 0)) + delta.vaat * marg;
}

/** acoes: [{id, ordem, descricao, tipo, alvo, pct, ativo}] */
function planoDeAcao(dist, fatores, params, acoes, receitaAtualTotal, gravesSemAEE, opcoes) {
  var mult = (opcoes && opcoes.fatorCampo) || FATOR_CAMPO_PADRAO;
  var lista = distParaLista(dist);
  var P0 = ponderadasDe(lista, fatores, mult);
  var ativas = (acoes || []).filter(function (a) { return a.ativo !== false; });
  var linhas = [];
  for (var i = 0; i < ativas.length; i++) {
    var a = ativas[i];
    var sim = aplicarAcao(lista, a, gravesSemAEE);
    var P1 = ponderadasDe(sim, fatores, mult);
    var delta = { vaaf: P1.vaaf - P0.vaaf, vaat: P1.vaat - P0.vaat };
    var imp = r2(impactoDe(delta, params));
    linhas.push({ id: a.id, ordem: a.ordem, descricao: String(a.descricao || "").replace("{pct}", String(a.pct)), tipo: a.tipo, pct: a.pct, delta_vaaf: r4(delta.vaaf), delta_vaat: r4(delta.vaat), impacto: imp, pp: receitaAtualTotal ? imp / receitaAtualTotal : 0 });
  }
  // implementar integralmente: conversões → aumentos → AEE
  var ordemTipo = { converter_integral: 0, aumentar_pct: 1, garantir_aee: 2 };
  var seq = ativas.slice().sort(function (x, y) { return (ordemTipo[x.tipo] - ordemTipo[y.tipo]) || ((+x.ordem || 0) - (+y.ordem || 0)); });
  var acc = lista;
  for (var k = 0; k < seq.length; k++) acc = aplicarAcao(acc, seq[k], gravesSemAEE);
  var PI = ponderadasDe(acc, fatores, mult);
  var impI = r2(impactoDe({ vaaf: PI.vaaf - P0.vaaf, vaat: PI.vaat - P0.vaat }, params));
  var visiveis = linhas.filter(function (l) { return Math.abs(l.impacto) >= 0.005; });
  visiveis.sort(function (x, y) { return y.impacto - x.impacto; });
  var soma = 0; for (var s = 0; s < visiveis.length; s++) soma += visiveis[s].impacto;
  return { integral: { impacto: impI, pp: receitaAtualTotal ? impI / receitaAtualTotal : 0 }, acoes: visiveis, soma_isoladas: r2(soma), ponderadas_atuais: { vaaf: r4(P0.vaaf), vaat: r4(P0.vaat) } };
}

// ---------------------------------------------------------------- máscaras (LGPD)
function mascararNascimento(d) { var p = parseData(d); return p ? "*****/" + p.y : "--"; }
function mascararCPF(cpf) {
  var dg = String(cpf || "").replace(/\D/g, "");
  if (dg.length !== 11) return "--";
  return dg.slice(0, 3) + "******" + dg.slice(-2);
}

module.exports = {
  norm: norm, r2: r2, r4: r4, variacao: variacao, idadeEm3103: idadeEm3103, listaLimpa: listaLimpa,
  ehAEE: ehAEE, ehCurricular: ehCurricular, etapaBase: etapaBase, parseHorarios: parseHorarios, horariosSobrepoem: horariosSobrepoem,
  NOMES: NOMES, GRUPOS: GRUPOS, GRUPO_DA_CHAVE: GRUPO_DA_CHAVE, REGRA_ESPECIAL: REGRA_ESPECIAL, FATOR_CAMPO_PADRAO: FATOR_CAMPO_PADRAO,
  fatorDe: fatorDe, nomeSubcategoria: nomeSubcategoria, processar: processar, analisar: analisar, tabelaMatriculas: tabelaMatriculas,
  receitaTotal: receitaTotal, projetar: projetar, classificarPotencial: classificarPotencial, planoDeAcao: planoDeAcao, aplicarAcao: aplicarAcao,
  impactoDe: impactoDe, mascararNascimento: mascararNascimento, mascararCPF: mascararCPF,
};
