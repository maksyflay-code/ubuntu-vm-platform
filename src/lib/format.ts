const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export const brl = (v: number | null | undefined) => brlFmt.format(+(v || 0)).replace(/\u00a0/g, " ");
export const inteiro = (v: number | null | undefined) => intFmt.format(Math.round(+(v || 0)));
export const decimal = (v: number | null | undefined, casas = 2) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(+(v || 0));
/** 0.0283 -> "+2,83%" */
export const pctVar = (v: number | null | undefined) => {
  const n = +(v || 0) * 100;
  return (n > 0 ? "+" : "") + decimal(n, 2) + "%";
};
export const pct = (v: number | null | undefined, casas = 2) => decimal(+(v || 0) * 100, casas) + "%";
export const mi = (v: number | null | undefined) => "R$ " + decimal(+(v || 0) / 1e6, 1) + " mi";
export const variacao = (atual: number, anterior: number) => (anterior ? atual / anterior - 1 : 0);
export const sinal = (v: number | null | undefined): "pos" | "neg" | "zero" => {
  const n = Math.round(+(v || 0) * 10000);
  return n > 0 ? "pos" : n < 0 ? "neg" : "zero";
};
export const semAcento = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
