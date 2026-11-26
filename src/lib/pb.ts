import PocketBase, { ClientResponseError } from "pocketbase";

/**
 * Cliente do backend próprio (PocketBase). Mesmo domínio por padrão (nginx encaminha
 * /api e /backend para o PocketBase); VITE_PB_URL permite apontar para outro endereço.
 */
let client: PocketBase | null = null;

export function pb(): PocketBase {
  if (!client) {
    const url =
      (import.meta.env["VITE_PB_URL"] as string | undefined) ||
      (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8090");
    client = new PocketBase(url);
    client.autoCancellation(false);
  }
  return client;
}

export function api<T = any>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, unknown> } = {}) {
  const o: any = { method: opts.method || "GET" };
  if (opts.body !== undefined) o.body = opts.body;
  if (opts.query) o.query = opts.query;
  return pb().send<T>(path, o);
}

export function mensagemErro(err: unknown): string {
  if (err instanceof ClientResponseError) {
    if (err.status === 0) return "Não foi possível conectar ao servidor do Radar FUNDEB.";
    const data: any = err.response?.["data"] || {};
    const campos = Object.keys(data)
      .map((k) => `${k}: ${data[k]?.message}`)
      .join("; ");
    return (err.response?.["message"] || err.message) + (campos ? ` (${campos})` : "");
  }
  return err instanceof Error ? err.message : String(err);
}

export function arquivoUrl(collectionId: string, recordId: string, nome: string) {
  if (!nome) return "";
  return `${pb().baseURL.replace(/\/$/, "")}/api/files/${collectionId}/${recordId}/${nome}`;
}
