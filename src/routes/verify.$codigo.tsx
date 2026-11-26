import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CircleX } from "lucide-react";
import { api } from "@/lib/pb";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/verify/$codigo")({
  head: () => ({ meta: [{ title: "Verificação de autenticidade — Radar FUNDEB" }, { name: "description", content: "Confira a autenticidade de um relatório Análise do FUNDEB." }, { property: "og:title", content: "Verificação de autenticidade — Radar FUNDEB" }, { property: "og:description", content: "Confira a autenticidade de um relatório Análise do FUNDEB." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Verificar,
});

function Verificar() {
  const { codigo } = Route.useParams();
  const { data, isLoading, isError } = useQuery({ queryKey: ["verify", codigo], queryFn: () => api<any>(`/backend/v1/verify/${encodeURIComponent(codigo)}`), retry: false });
  return (
    <div className="grid-paper flex min-h-screen items-center justify-center p-6">
      <div className="card-relatorio w-full max-w-lg p-8">
        <div className="eyebrow">Radar FUNDEB · Verificação de autenticidade</div>
        {isLoading ? <p className="mt-6 text-sm">Verificando…</p> : isError || !data ? (
          <div className="mt-6 flex items-center gap-3 text-destructive"><CircleX className="h-8 w-8" /><div><h1 className="text-xl font-semibold">Documento não encontrado</h1><p className="text-sm text-muted-foreground">O código {codigo} não corresponde a nenhum relatório emitido.</p></div></div>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-3 text-success"><BadgeCheck className="h-8 w-8" /><h1 className="text-xl font-semibold">Documento autêntico</h1></div>
            <dl className="mt-6 grid grid-cols-[140px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Município</dt><dd className="font-medium">{data.municipio} - {data.uf}</dd>
              <dt className="text-muted-foreground">Ano do Censo</dt><dd>{data.ano}</dd>
              <dt className="text-muted-foreground">Emitido em</dt><dd>{data.emitido_em} (Brasília)</dd>
              <dt className="text-muted-foreground">Emitente</dt><dd>{data.emitente}</dd>
              <dt className="text-muted-foreground">Receita total</dt><dd className="num">{brl(data.total_receita)}</dd>
              <dt className="text-muted-foreground">Código</dt><dd className="num text-xs">{data.codigo}</dd>
            </dl>
          </>
        )}
      </div>
    </div>
  );
}
