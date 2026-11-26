import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pb";

type Sessao = {
  usuario: RecordModel | null;
  papel: "admin" | "analista" | "gestor" | "";
  podeEditar: boolean;
  municipioId: string;
  ano: number;
  setMunicipioId: (id: string) => void;
  setAno: (a: number) => void;
  sair: () => void;
};
const Ctx = createContext<Sessao | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<RecordModel | null>(pb().authStore.record);
  const [municipioId, setMun] = useState<string>(() => localStorage.getItem("radar.municipio") || "");
  const [ano, setAnoS] = useState<number>(() => +(localStorage.getItem("radar.ano") || 0) || new Date().getFullYear());

  useEffect(() => pb().authStore.onChange((_t, r) => setUsuario(r)), []);
  useEffect(() => {
    // atualiza dados do usuário (perfil/municípios) ao abrir
    if (pb().authStore.isValid) pb().collection("users").authRefresh().catch(() => pb().authStore.clear());
  }, []);

  const papel = ((usuario?.["role"] as string) || "") as Sessao["papel"];
  const value: Sessao = {
    usuario,
    papel,
    podeEditar: papel === "admin" || papel === "analista",
    municipioId,
    ano,
    setMunicipioId: (id) => {
      localStorage.setItem("radar.municipio", id);
      setMun(id);
    },
    setAno: (a) => {
      localStorage.setItem("radar.ano", String(a));
      setAnoS(a);
    },
    sair: () => pb().authStore.clear(),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSessao() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSessao fora do SessaoProvider");
  return c;
}
