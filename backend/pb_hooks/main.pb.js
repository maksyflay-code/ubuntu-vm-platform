/// <reference path="../pb_data/types.d.ts" />
// Radar FUNDEB — rotas do backend (/backend/v1/...). Cada handler roda isolado, por isso o require fica dentro dele.

// Primeiro usuário vira admin; depois disso só admin cria usuários.
onRecordCreateRequest((e) => {
  const total = $app.countRecords("users");
  const body = e.requestInfo().body || {};
  if (total === 0) {
    e.record.set("role", "admin");
    e.record.set("ativo", true);
  } else {
    const superuser = e.hasSuperuserAuth();
    if (!superuser && (!e.auth || e.auth.getString("role") !== "admin")) throw new ForbiddenError("Somente o administrador cria usuários.");
    if (body.ativo === undefined) e.record.set("ativo", true);
    if (!e.record.getString("role")) e.record.set("role", "gestor");
  }
  e.next();
}, "users");

routerAdd("GET", "/backend/v1/setup-status", (e) => {
  return e.json(200, { hasUsers: $app.countRecords("users") > 0 });
});

routerAdd("POST", "/backend/v1/importacao", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  return e.json(200, S.importar($app, e, e.requestInfo().body || {}));
}, $apis.requireAuth(), $apis.bodyLimit(50 << 20));

routerAdd("POST", "/backend/v1/processar", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  const b = e.requestInfo().body || {};
  return e.json(200, S.processar($app, e, b.municipioId, +b.ano));
}, $apis.requireAuth());

routerAdd("GET", "/backend/v1/analise", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  const q = e.requestInfo().query;
  return e.json(200, S.analise($app, e, q.municipioId, +q.ano));
}, $apis.requireAuth());

routerAdd("GET", "/backend/v1/projecao", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  const q = e.requestInfo().query;
  const A = S.analise($app, e, q.municipioId, +q.ano);
  return e.json(200, { receita_atual: A.receita_atual, receita_anterior: A.receita_anterior, parametros: A.parametros, projecao: A.projecao, potencial: A.potencial });
}, $apis.requireAuth());

routerAdd("GET", "/backend/v1/plano-acao", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  const q = e.requestInfo().query;
  const A = S.analise($app, e, q.municipioId, +q.ano);
  return e.json(200, { plano: A.plano, potencial: A.potencial });
}, $apis.requireAuth());

routerAdd("GET", "/backend/v1/inconsistencias/lista", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  const q = e.requestInfo().query;
  S.exigirAcesso(e, q.municipioId, false);
  const lista = S.listaInconsistencias($app, q.municipioId, +q.ano, q.tipo || "");
  S.registrarLog($app, e, q.municipioId, "ver_lista_nominal", "Inconsistências " + (q.tipo || "todas") + " (" + q.ano + ") - " + lista.length + " alunos");
  return e.json(200, lista);
}, $apis.requireAuth());

routerAdd("GET", "/backend/v1/matriculas/lista", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  const q = e.requestInfo().query;
  S.exigirAcesso(e, q.municipioId, false);
  const lista = S.listaMatriculas($app, q.municipioId, +q.ano, q.subcategoria || "", q.escolaId || "");
  S.registrarLog($app, e, q.municipioId, "ver_lista_nominal", "Matrículas " + (q.subcategoria || q.escolaId || "") + " (" + q.ano + ")");
  return e.json(200, lista);
}, $apis.requireAuth());

routerAdd("POST", "/backend/v1/log", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  const b = e.requestInfo().body || {};
  const permitidas = ["exportar_csv", "abrir_relatorio", "alterar_parametros", "ver_lista_nominal"];
  if (permitidas.indexOf(b.acao) < 0) throw new BadRequestError("Ação inválida.");
  if (b.municipioId) S.exigirAcesso(e, b.municipioId, false);
  S.registrarLog($app, e, b.municipioId || "", b.acao, b.detalhe || "");
  return e.json(200, { ok: true });
}, $apis.requireAuth());

routerAdd("POST", "/backend/v1/relatorios", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  const b = e.requestInfo().body || {};
  return e.json(200, S.emitirRelatorio($app, e, b.municipioId, +b.ano));
}, $apis.requireAuth());

routerAdd("POST", "/backend/v1/relatorios/{id}/email", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  const b = e.requestInfo().body || {};
  return e.json(200, S.enviarEmail($app, e, e.request.pathValue("id"), b.baseUrl || ""));
}, $apis.requireAuth());

// PÚBLICA: só metadados, nunca dados de alunos.
routerAdd("GET", "/backend/v1/verify/{codigo}", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  const v = S.verificar($app, e.request.pathValue("codigo"));
  if (!v) return e.json(404, { message: "Documento não encontrado" });
  return e.json(200, v);
});

routerAdd("GET", "/backend/v1/ibge/{codigo}", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  const r = S.papel(e);
  if (!e.hasSuperuserAuth() && r !== "admin" && r !== "analista") throw new ForbiddenError("Sem permissão.");
  return e.json(200, S.ibgeMunicipio(e.request.pathValue("codigo")));
}, $apis.requireAuth());

routerAdd("GET", "/backend/v1/ibge-busca", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  const q = e.requestInfo().query;
  return e.json(200, S.ibgeBusca(q.nome || "", (q.uf || "").toUpperCase()));
}, $apis.requireAuth());

routerAdd("POST", "/backend/v1/copiar-parametros", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  const b = e.requestInfo().body || {};
  const de = +b.de, para = +b.para;
  let n = 0;
  if (b.tipo === "fatores") {
    S.exigirAdmin(e);
    $app.runInTransaction((tx) => {
      const coll = tx.findCollectionByNameOrId("fatores_ponderacao");
      S.todos(tx, "fatores_ponderacao", "ano_fundeb = {:a}", { a: de }).forEach((f) => {
        let r;
        try { r = tx.findFirstRecordByFilter("fatores_ponderacao", "ano_fundeb = {:a} && chave = {:c}", { a: para, c: f.getString("chave") }); } catch (_) { r = new Record(coll); }
        ["grupo", "grupo_nome", "chave", "subcategoria_base", "fator_vaaf", "fator_vaat", "aplica_campo"].forEach((k) => r.set(k, f.get(k)));
        r.set("ano_fundeb", para); tx.save(r); n++;
      });
    });
  } else {
    S.exigirAcesso(e, b.municipioId, true);
    const f = $app.findFirstRecordByFilter("parametros_projecao", "municipio = {:m} && ano_projecao = {:a}", { m: b.municipioId, a: de });
    let r;
    try { r = $app.findFirstRecordByFilter("parametros_projecao", "municipio = {:m} && ano_projecao = {:a}", { m: b.municipioId, a: para }); } catch (_) { r = new Record($app.findCollectionByNameOrId("parametros_projecao")); }
    ["valor_contrib", "valor_vaaf", "valor_vaat", "valor_vaat_marginal", "vaar_previsto", "fator_cons_contrib", "fator_cons_vaaf", "fator_cons_vaat", "fator_otim_contrib", "fator_otim_vaaf", "fator_otim_vaat", "referencial", "limiar_baixo_pct", "limiar_medio_pct", "fonte"].forEach((k) => r.set(k, f.get(k)));
    r.set("municipio", b.municipioId); r.set("ano_projecao", para); $app.save(r); n = 1;
  }
  S.registrarLog($app, e, b.municipioId || "", "alterar_parametros", "Cópia de " + b.tipo + " de " + de + " para " + para);
  return e.json(200, { copiados: n });
}, $apis.requireAuth());

routerAdd("GET", "/backend/v1/municipios-resumo", (e) => {
  const S = require(`${__hooks}/lib/server.js`);
  const ano = +e.requestInfo().query.ano;
  const admin = e.hasSuperuserAuth() || S.papel(e) === "admin";
  let ids = null;
  if (!admin) { ids = {}; const ms = e.auth.getStringSlice("municipios"); for (let i = 0; i < ms.length; i++) ids[ms[i]] = true; }
  const out = [];
  S.todos($app, "municipios", "id != ''", {}, "nome").forEach((m) => {
    if (ids && !ids[m.id]) return;
    const P = { m: m.id, a: ano };
    const escolas = S.todos($app, "escolas", "municipio = {:m} && ano_censo = {:a}", P).length;
    const imps = $app.findRecordsByFilter("importacoes", "municipio = {:m}", "-created", 1, 0, P);
    const incs = S.todos($app, "inconsistencias", "municipio = {:m} && ano_censo = {:a} && status = 'aberta'", P).length;
    let receita = 0;
    try { const r = $app.findFirstRecordByFilter("receitas_fundeb", "municipio = {:m} && ano = {:a}", P); receita = r.getFloat("contribuicao") + r.getFloat("vaaf") + r.getFloat("vaat") + r.getFloat("vaar"); } catch (_) {}
    const rels = $app.findRecordsByFilter("relatorios", "municipio = {:m}", "-created", 1, 0, P);
    let potencial = null, ultimoRel = "";
    if (rels.length) {
      ultimoRel = rels[0].getString("emitido_em");
      try { const s = JSON.parse(rels[0].getString("snapshot")); potencial = s.analise.potencial; } catch (_) {}
    }
    out.push({ id: m.id, nome: m.getString("nome"), uf: m.getString("uf"), escolas, ultima_importacao: imps.length ? imps[0].getString("created") : "", inconsistencias_abertas: incs, receita, potencial, ultimo_relatorio: ultimoRel });
  });
  return e.json(200, out);
}, $apis.requireAuth());
