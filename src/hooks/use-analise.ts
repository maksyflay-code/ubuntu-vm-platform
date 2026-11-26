import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/pb";
import { useSessao } from "./use-sessao";

export function useAnalise() {
  const { municipioId, ano } = useSessao();
  return useQuery({
    queryKey: ["analise", municipioId, ano],
    queryFn: () => api<any>("/backend/v1/analise", { query: { municipioId, ano } }),
    enabled: !!municipioId,
    staleTime: 30_000,
  });
}
