/** CSV com separador ";" e UTF-8 com BOM (abre direto no Excel). */
export function baixarCSV(nome: string, cabecalho: string[], linhas: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const txt = "\ufeff" + [cabecalho, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
  baixarBlob(nome, new Blob([txt], { type: "text/csv;charset=utf-8" }));
}
export function baixarBlob(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
/** "1.234.567,89" -> 1234567.89 */
export function numeroBR(s: string): number {
  const t = String(s || "").trim().replace(/[R$\s]/g, "");
  if (!t) return 0;
  const n = t.includes(",") ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : parseFloat(t);
  return isFinite(n) ? n : 0;
}
export function lerCSV(txt: string): string[][] {
  return txt
    .replace(/^\ufeff/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/[;\t]/).map((c) => c.trim().replace(/^"|"$/g, "")));
}
