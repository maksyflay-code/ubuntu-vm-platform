import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const E = require("../../backend/pb_hooks/lib/engine.js");

const F = {
  fund_integral: { vaaf: 1.5, vaat: 1.5, aplica_campo: true },
  eja_fund: { vaaf: 1.0, vaat: 1.0, aplica_campo: true },
  esp_eja: { vaaf: 1.4, vaat: 1.4, aplica_campo: true },
  esp_fund: { vaaf: 1.4, vaat: 1.4, aplica_campo: true },
  aee_fund: { vaaf: 1.4, vaat: 1.4, aplica_campo: false },
};

describe("fatores de ponderação (Anexo B)", () => {
  it("EF integral campo = 1,725", () => expect(E.fatorDe("fund_integral", true, false, F, 1.15).vaaf).toBe(1.725));
  it("EF integral campo especial mantém 1,725 (maior fator)", () => expect(E.fatorDe("fund_integral", true, true, F, 1.15).vaaf).toBe(1.725));
  it("EJA campo = 1,15", () => expect(E.fatorDe("eja_fund", true, false, F, 1.15).vaaf).toBe(1.15));
  it("Educação especial EJA campo = 1,61", () => expect(E.fatorDe("esp_eja", true, true, F, 1.15).vaaf).toBe(1.61));
  it("AEE não recebe fator campo", () => expect(E.fatorDe("aee_fund", true, false, F, 1.15).vaaf).toBe(1.4));
});

describe("regras", () => {
  it("integral a partir de 35h semanais", () => {
    const base = { ano: 2026, escolas: [{ id: "e", localizacao: "Urbana", dependencia: "Municipal" }], alunos: [{ id: "a", deficiencias: [], zona_residencia: "Urbana" }] };
    const t = (min: number) => [{ id: "t", tipo_turma: "Curricular (etapa de ensino)", etapa: "Ensino Fundamental de 9 anos - 3º Ano", carga_semanal_min: min }];
    const m = [{ id: "m", aluno: "a", turma: "t", escola: "e" }];
    expect(E.processar({ ...base, turmas: t(2100), matriculas: m }, F).matriculas[0].chave).toBe("fund_integral");
    expect(E.processar({ ...base, turmas: t(2099), matriculas: [{ ...m[0] }] }, { ...F, ai_parcial: { vaaf: 1, vaat: 1, aplica_campo: true } }).matriculas[0].chave).toBe("ai_parcial");
  });
  it("escola urbana com 50% de alunos rurais é tratada como campo", () => {
    const r = E.processar({ ano: 2026, escolas: [{ id: "e", localizacao: "Urbana" }], turmas: [], alunos: [{ id: "a", zona_residencia: "Rural" }, { id: "b", zona_residencia: "Urbana" }], matriculas: [{ id: "1", aluno: "a", escola: "e" }, { id: "2", aluno: "b", escola: "e" }] }, F);
    expect(r.escolas[0].tratada_como_campo).toBe(true);
  });
  it("projeção base e % para avançar (gabarito Inhambupe)", () => {
    const p = E.projetar({ vaaf: 10272, vaat: 10865 }, { valor_contrib: 4962.1314, valor_vaaf: 1726.8388, valor_vaat: 3497.9574, vaar_previsto: 0 }, {});
    expect(p.base.contribuicao).toBeCloseTo(50971013.68, -2);
    expect(E.classificarPotencial((136983142.61 - 90642683.39) / 136983142.61, {})).toBe("ALTO");
  });
  it("CPF mascarado: 3 primeiros + ****** + 2 últimos", () => expect(E.mascararCPF("123.456.789-01")).toBe("123******01"));
  it("nascimento mascarado", () => expect(E.mascararNascimento("10/05/2018")).toBe("*****/2018"));
});
