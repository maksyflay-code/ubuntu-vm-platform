/// <reference path="../pb_data/types.d.ts" />
// Radar FUNDEB — estrutura inicial (todas as coleções + dados iniciais).
migrate((app) => {
  const AUTH = '@request.auth.id != ""';
  const ADMIN = '@request.auth.role = "admin"';
  const LER_MUN = `${AUTH} && (${ADMIN} || @request.auth.municipios.id ?= municipio)`;
  const ESCREVER_MUN = `${ADMIN} || (@request.auth.role = "analista" && @request.auth.municipios.id ?= municipio)`;
  const stamps = [
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];
  function mk(def) {
    const c = new Collection(Object.assign({ type: "base" }, def, { fields: def.fields.concat(stamps) }));
    app.save(c);
    return app.findCollectionByNameOrId(def.name);
  }

  // ---- municipios
  const municipios = mk({
    name: "municipios",
    listRule: `${AUTH} && (${ADMIN} || @request.auth.municipios.id ?= id)`,
    viewRule: `${AUTH} && (${ADMIN} || @request.auth.municipios.id ?= id)`,
    createRule: ADMIN,
    updateRule: `${ADMIN} || (@request.auth.role = "analista" && @request.auth.municipios.id ?= id)`,
    deleteRule: ADMIN,
    fields: [
      { name: "nome", type: "text", required: true },
      { name: "uf", type: "text", required: true, max: 2 },
      { name: "codigo_ibge", type: "text" },
      { name: "orgao", type: "text" },
      { name: "cnpj", type: "text" },
      { name: "brasao", type: "file", maxSelect: 1, maxSize: 5242880, mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] },
      { name: "populacao", type: "number" },
      { name: "domicilios", type: "number" },
      { name: "area_km2", type: "number" },
      { name: "alfabetizacao_pct", type: "number" },
      { name: "pop_indigena", type: "number" },
      { name: "pop_quilombola", type: "number" },
    ],
  });

  // ---- users: perfil, municípios, ativo
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new SelectField({ name: "role", values: ["admin", "analista", "gestor"], maxSelect: 1 }));
  users.fields.add(new RelationField({ name: "municipios", collectionId: municipios.id, maxSelect: 999, cascadeDelete: false }));
  users.fields.add(new BoolField({ name: "ativo" }));
  users.listRule = `${ADMIN} || id = @request.auth.id`;
  users.viewRule = `${ADMIN} || id = @request.auth.id`;
  users.createRule = ""; // o hook libera só o primeiro usuário ou o admin
  users.updateRule = `${ADMIN} || (id = @request.auth.id && @request.body.role:isset = false && @request.body.municipios:isset = false && @request.body.ativo:isset = false)`;
  users.deleteRule = ADMIN;
  users.authRule = "ativo = true";
  app.save(users);

  const rel = (name, coll, required) => ({ name, type: "relation", collectionId: coll.id, maxSelect: 1, cascadeDelete: true, required: !!required });
  const somenteLeitura = { listRule: LER_MUN, viewRule: LER_MUN, createRule: null, updateRule: null, deleteRule: null };

  mk(Object.assign({ name: "importacoes", fields: [
    rel("municipio", municipios, true),
    { name: "ano_censo", type: "number", required: true },
    { name: "escola_inep", type: "text" },
    { name: "escola_nome", type: "text" },
    { name: "tipo", type: "select", values: ["alunos", "turmas"], maxSelect: 1 },
    { name: "arquivo_nome", type: "text" },
    { name: "emitido_em", type: "text" },
    { name: "status", type: "select", values: ["ok", "aviso", "erro"], maxSelect: 1 },
    { name: "mensagens", type: "json" },
    { name: "usuario", type: "relation", collectionId: users.id, maxSelect: 1 },
  ] }, somenteLeitura));

  const escolas = mk(Object.assign({ name: "escolas", fields: [
    rel("municipio", municipios, true),
    { name: "ano_censo", type: "number", required: true },
    { name: "inep", type: "text", required: true },
    { name: "nome", type: "text" },
    { name: "localizacao", type: "text" },
    { name: "dependencia", type: "text" },
    { name: "qtd_urbanos", type: "number" },
    { name: "qtd_rurais", type: "number" },
    { name: "pct_rural", type: "number" },
    { name: "tratada_como_campo", type: "bool" },
    { name: "area_predominante", type: "text" },
  ], indexes: ["CREATE UNIQUE INDEX idx_escolas_un ON escolas (municipio, ano_censo, inep)"] }, somenteLeitura));

  const turmas = mk(Object.assign({ name: "turmas", fields: [
    rel("municipio", municipios, true),
    rel("escola", escolas, true),
    { name: "ano_censo", type: "number", required: true },
    { name: "codigo", type: "text", required: true },
    { name: "nome", type: "text" },
    { name: "tipo_mediacao", type: "text" },
    { name: "tipo_turma", type: "text" },
    { name: "etapa_agregada", type: "text" },
    { name: "etapa", type: "text" },
    { name: "carga_semanal_min", type: "number" },
    { name: "horarios", type: "text" },
    { name: "classe_especial", type: "bool" },
    { name: "bilingue_surdos", type: "bool" },
    { name: "alternancia", type: "bool" },
    { name: "qtd_alunos", type: "number" },
    { name: "qtd_profissionais", type: "number" },
  ], indexes: ["CREATE UNIQUE INDEX idx_turmas_un ON turmas (ano_censo, codigo)", "CREATE INDEX idx_turmas_esc ON turmas (escola)"] }, somenteLeitura));

  const alunos = mk(Object.assign({ name: "alunos", fields: [
    rel("municipio", municipios, true),
    { name: "ano_censo", type: "number", required: true },
    { name: "id_inep", type: "text", required: true },
    { name: "nome", type: "text" },
    { name: "data_nascimento", type: "text" },
    { name: "cpf_mascarado", type: "text" },
    { name: "cor_raca", type: "text" },
    { name: "sexo", type: "text" },
    { name: "deficiencias", type: "json" },
    { name: "transtornos", type: "json" },
    { name: "zona_residencia", type: "text" },
    { name: "localizacao_diferenciada", type: "text" },
  ], indexes: ["CREATE UNIQUE INDEX idx_alunos_un ON alunos (municipio, ano_censo, id_inep)"] }, somenteLeitura));

  mk(Object.assign({ name: "matriculas", fields: [
    rel("municipio", municipios, true),
    { name: "ano_censo", type: "number", required: true },
    rel("aluno", alunos, true),
    rel("turma", turmas, true),
    rel("escola", escolas, true),
    { name: "codigo_matricula", type: "text", required: true },
    { name: "etapa", type: "text" },
    { name: "eh_aee", type: "bool" },
    { name: "tipo_aee", type: "json" },
    { name: "transporte", type: "bool" },
    { name: "poder_publico", type: "text" },
    { name: "veiculo", type: "text" },
    { name: "etapa_vinculo_multi", type: "text" },
    { name: "grupo", type: "text" },
    { name: "subcategoria", type: "text" },
    { name: "chave", type: "text" },
    { name: "etapa_base", type: "text" },
    { name: "campo", type: "bool" },
    { name: "especial", type: "bool" },
    { name: "fator_vaaf", type: "number" },
    { name: "fator_vaat", type: "number" },
    { name: "conta_fundeb", type: "bool" },
    { name: "aviso", type: "text" },
  ], indexes: [
    "CREATE UNIQUE INDEX idx_matriculas_un ON matriculas (ano_censo, codigo_matricula)",
    "CREATE INDEX idx_matriculas_mun ON matriculas (municipio, ano_censo)",
    "CREATE INDEX idx_matriculas_esc ON matriculas (escola)",
  ] }, somenteLeitura));

  mk({ name: "inconsistencias", listRule: LER_MUN, viewRule: LER_MUN, createRule: null, updateRule: ESCREVER_MUN, deleteRule: null, fields: [
    rel("municipio", municipios, true),
    { name: "ano_censo", type: "number", required: true },
    { name: "tipo", type: "select", values: ["AEE_SEM_CURRICULAR", "URBANA_EM_ESCOLA_RURAL", "DEFICIENCIA_SEM_AEE", "MAIS_DE_UM_VINCULO_AEE"], maxSelect: 1 },
    { name: "detalhe", type: "text" },
    rel("aluno", alunos, false),
    { name: "escolas_txt", type: "text" },
    { name: "turmas_txt", type: "text" },
    { name: "status", type: "select", values: ["aberta", "corrigida"], maxSelect: 1 },
  ], indexes: ["CREATE INDEX idx_inc_mun ON inconsistencias (municipio, ano_censo)"] });

  // ---- fase 2
  const fatores = mk({ name: "fatores_ponderacao", listRule: AUTH, viewRule: AUTH, createRule: ADMIN, updateRule: ADMIN, deleteRule: ADMIN, fields: [
    { name: "ano_fundeb", type: "number", required: true },
    { name: "grupo", type: "text" },
    { name: "grupo_nome", type: "text" },
    { name: "chave", type: "text", required: true },
    { name: "subcategoria_base", type: "text" },
    { name: "fator_vaaf", type: "number" },
    { name: "fator_vaat", type: "number" },
    { name: "aplica_campo", type: "bool" },
  ], indexes: ["CREATE UNIQUE INDEX idx_fatores_un ON fatores_ponderacao (ano_fundeb, chave)"] });

  mk({ name: "totais_ano_anterior", listRule: LER_MUN, viewRule: LER_MUN, createRule: ESCREVER_MUN, updateRule: ESCREVER_MUN, deleteRule: ESCREVER_MUN, fields: [
    rel("municipio", municipios, true),
    { name: "ano_censo", type: "number", required: true },
    { name: "subcategoria", type: "text", required: true },
    { name: "matriculas", type: "number" },
    { name: "ponderadas_vaaf", type: "number" },
    { name: "ponderadas_vaat", type: "number" },
  ], indexes: ["CREATE UNIQUE INDEX idx_totant_un ON totais_ano_anterior (municipio, ano_censo, subcategoria)"] });

  // ---- fase 3
  mk({ name: "receitas_fundeb", listRule: LER_MUN, viewRule: LER_MUN, createRule: ESCREVER_MUN, updateRule: ESCREVER_MUN, deleteRule: ESCREVER_MUN, fields: [
    rel("municipio", municipios, true),
    { name: "ano", type: "number", required: true },
    { name: "contribuicao", type: "number" },
    { name: "vaaf", type: "number" },
    { name: "vaat", type: "number" },
    { name: "vaar", type: "number" },
  ], indexes: ["CREATE UNIQUE INDEX idx_receitas_un ON receitas_fundeb (municipio, ano)"] });

  mk({ name: "parametros_projecao", listRule: LER_MUN, viewRule: LER_MUN, createRule: ESCREVER_MUN, updateRule: ESCREVER_MUN, deleteRule: ESCREVER_MUN, fields: [
    rel("municipio", municipios, true),
    { name: "ano_projecao", type: "number", required: true },
    { name: "valor_contrib", type: "number" },
    { name: "valor_vaaf", type: "number" },
    { name: "valor_vaat", type: "number" },
    { name: "valor_vaat_marginal", type: "number" },
    { name: "vaar_previsto", type: "number" },
    { name: "fator_cons_contrib", type: "number" },
    { name: "fator_cons_vaaf", type: "number" },
    { name: "fator_cons_vaat", type: "number" },
    { name: "fator_otim_contrib", type: "number" },
    { name: "fator_otim_vaaf", type: "number" },
    { name: "fator_otim_vaat", type: "number" },
    { name: "referencial", type: "number" },
    { name: "limiar_baixo_pct", type: "number" },
    { name: "limiar_medio_pct", type: "number" },
    { name: "fonte", type: "text" },
  ], indexes: ["CREATE UNIQUE INDEX idx_param_un ON parametros_projecao (municipio, ano_projecao)"] });

  // ---- fase 4
  const acoes = mk({ name: "acoes_modelo", listRule: AUTH, viewRule: AUTH, createRule: ADMIN, updateRule: ADMIN, deleteRule: ADMIN, fields: [
    { name: "ordem", type: "number" },
    { name: "descricao", type: "text", required: true },
    { name: "tipo", type: "select", values: ["aumentar_pct", "converter_integral", "garantir_aee"], maxSelect: 1, required: true },
    { name: "alvo", type: "json" },
    { name: "pct", type: "number" },
    { name: "ativo", type: "bool" },
  ] });

  mk({ name: "relatorios", listRule: LER_MUN, viewRule: LER_MUN, createRule: null, updateRule: null, deleteRule: null, fields: [
    rel("municipio", municipios, true),
    { name: "ano", type: "number" },
    { name: "codigo", type: "text", required: true },
    { name: "emitido_em", type: "text" },
    { name: "emitido_por", type: "relation", collectionId: users.id, maxSelect: 1 },
    { name: "emitido_por_nome", type: "text" },
    { name: "emitente", type: "text" },
    { name: "snapshot", type: "json", maxSize: 20000000 },
    { name: "total_receita", type: "number" },
  ], indexes: ["CREATE UNIQUE INDEX idx_relatorios_cod ON relatorios (codigo)"] });

  const config = mk({ name: "configuracoes", listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: ADMIN, deleteRule: null, fields: [
    { name: "emitente_nome", type: "text" },
    { name: "emitente_cnpj", type: "text" },
    { name: "url_publica", type: "text" },
    { name: "fator_campo", type: "number" },
  ] });

  // ---- fase 5
  mk({ name: "logs_acesso", listRule: ADMIN, viewRule: ADMIN, createRule: null, updateRule: null, deleteRule: null, fields: [
    { name: "usuario", type: "relation", collectionId: users.id, maxSelect: 1 },
    { name: "usuario_email", type: "text" },
    { name: "municipio", type: "relation", collectionId: municipios.id, maxSelect: 1 },
    { name: "acao", type: "select", values: ["importar", "ver_lista_nominal", "exportar_csv", "emitir_relatorio", "abrir_relatorio", "alterar_parametros"], maxSelect: 1 },
    { name: "detalhe", type: "text" },
  ] });

  // ---- dados iniciais
  const F = [
    ["a", "a) Creche em tempo integral pública", "creche_integral", "Creche Integral Pública", 1.55, 1.90, true],
    ["b", "b) Creche em tempo parcial pública", "creche_parcial", "Creche Parcial Pública", 1.25, 1.60, true],
    ["c", "c) Pré-escola em tempo integral pública", "pre_integral", "Pré-Escola Integral Pública", 1.50, 1.875, true],
    ["d", "d1) Pré-escola em tempo parcial pública", "pre_parcial", "Pré-Escola Parcial Pública", 1.15, 1.50, true],
    ["d", "d2) Pré-escola em tempo parcial conveniada", "pre_parcial_conv", "Pré-Escola Parcial Conveniada", 1.15, 1.50, true],
    ["e", "e) Ensino fundamental em tempo integral", "fund_integral", "Ensino Fundamental Integral", 1.50, 1.50, true],
    ["f", "f1) Anos iniciais do ensino fundamental em tempo parcial", "ai_parcial", "Anos Iniciais Fundamental", 1.00, 1.00, true],
    ["f", "f2) Anos finais do ensino fundamental em tempo parcial", "af_parcial", "Anos Finais Fundamental", 1.10, 1.10, true],
    ["i", "i) Educação de jovens e adultos (fundamental)", "eja_fund", "EJA Fundamental", 1.00, 1.00, true],
    ["j", "j) Educação especial - Creche", "esp_creche", "Educação Especial - Creche", 1.40, 1.40, true],
    ["j", "j) Educação especial - Pré-Escola", "esp_pre", "Educação Especial - Pré-Escola", 1.40, 1.40, true],
    ["j", "j) Educação especial - Fundamental", "esp_fund", "Educação Especial - Fundamental", 1.40, 1.40, true],
    ["j", "j) Educação especial - EJA Fundamental", "esp_eja", "Educação Especial - EJA Fundamental", 1.40, 1.40, true],
    ["m", "m) AEE - Infantil", "aee_infantil", "AEE - Infantil", 1.40, 1.40, false],
    ["m", "m) AEE - Fundamental", "aee_fund", "AEE - Fundamental", 1.40, 1.40, false],
    ["m", "m) AEE - Médio", "aee_medio", "AEE - Médio", 1.40, 1.40, false],
  ];
  F.forEach((f) => {
    const r = new Record(fatores);
    r.set("ano_fundeb", 2026); r.set("grupo", f[0]); r.set("grupo_nome", f[1]); r.set("chave", f[2]);
    r.set("subcategoria_base", f[3]); r.set("fator_vaaf", f[4]); r.set("fator_vaat", f[5]); r.set("aplica_campo", f[6]);
    app.save(r);
  });

  const A = [
    [1, "Garantir educação em tempo integral para 100% dos estudantes matriculados no Ensino Fundamental I (1º ao 5º ano).", "converter_integral", { etapas: ["ai"] }, 100],
    [2, "Garantir educação em tempo integral para 100% dos estudantes matriculados no Ensino Fundamental II (6º ao 9º ano).", "converter_integral", { etapas: ["af"] }, 100],
    [3, "Aumentar em {pct}% as matrículas da Educação de Jovens e Adultos (EJA) Campo.", "aumentar_pct", { chave: "eja_fund", campo: true }, 20],
    [4, "Garantir educação em tempo integral para 100% das crianças de 4 e 5 anos matriculadas na Pré-Escola.", "converter_integral", { etapas: ["pre"] }, 100],
    [5, "Aumentar em {pct}% as matrículas da Pré-Escola Integral Pública Campo.", "aumentar_pct", { chave: "pre_integral", campo: true }, 10],
    [6, "Aumentar em {pct}% as matrículas da Creche Integral Pública.", "aumentar_pct", { chave: "creche_integral", campo: false }, 15],
    [7, "Aumentar em {pct}% as matrículas da Creche Integral Pública Campo.", "aumentar_pct", { chave: "creche_integral", campo: true }, 10],
    [8, "Aumentar em {pct}% as matrículas da Pré-Escola Integral Pública.", "aumentar_pct", { chave: "pre_integral", campo: false }, 15],
    [9, "Aumentar em {pct}% as matrículas da Educação de Jovens e Adultos (EJA) Urbana.", "aumentar_pct", { chave: "eja_fund", campo: false }, 20],
    [10, "Garantir Atendimento Educacional Especializado (AEE) a 100% dos estudantes com deficiências \"graves\" (deficiência múltipla, surdocegueira, cegueira, deficiência intelectual, transtorno do espectro autista e surdez) na Educação Infantil, Pré-Escola e Ensino Fundamental.", "garantir_aee", {}, 100],
    [11, "Garantir educação em tempo integral para 100% das crianças de 0 a 3 anos matriculadas em creches.", "converter_integral", { etapas: ["creche"] }, 100],
  ];
  A.forEach((a) => {
    const r = new Record(acoes);
    r.set("ordem", a[0]); r.set("descricao", a[1]); r.set("tipo", a[2]); r.set("alvo", a[3]); r.set("pct", a[4]); r.set("ativo", true);
    app.save(r);
  });

  const c = new Record(config);
  c.set("emitente_nome", "Radar FUNDEB"); c.set("url_publica", ""); c.set("fator_campo", 1.15);
  app.save(c);
}, (app) => {
  ["logs_acesso", "configuracoes", "relatorios", "acoes_modelo", "parametros_projecao", "receitas_fundeb", "totais_ano_anterior",
   "fatores_ponderacao", "inconsistencias", "matriculas", "alunos", "turmas", "escolas", "importacoes"].forEach((n) => {
    try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {}
  });
  const users = app.findCollectionByNameOrId("users");
  ["role", "municipios", "ativo"].forEach((f) => users.fields.removeByName(f));
  app.save(users);
  try { app.delete(app.findCollectionByNameOrId("municipios")); } catch (_) {}
});
