import type { ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { pctVar, sinal } from "@/lib/format";
import { arquivoUrl } from "@/lib/pb";
import { Building2 } from "lucide-react";

const selo = cva("inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold num leading-none", {
  variants: {
    tom: {
      pos: "bg-success-soft text-success",
      neg: "bg-destructive-soft text-destructive",
      zero: "bg-neutral-soft text-muted-foreground",
    },
  },
});

export function VarBadge({ valor, className }: { valor: number | null | undefined; className?: string }) {
  return <span className={cn(selo({ tom: sinal(valor) }), className)}>{pctVar(valor)}</span>;
}

export function StatCard({ rotulo, valor, sub, variacao, destaque }: { rotulo: string; valor: ReactNode; sub?: ReactNode; variacao?: number | null; destaque?: boolean }) {
  return (
    <div className={cn("card-relatorio p-4", destaque && "bg-secondary")}>
      <div className="eyebrow">{rotulo}</div>
      <div className="mt-1.5 text-2xl font-semibold num text-foreground">{valor}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {variacao !== undefined && variacao !== null && <VarBadge valor={variacao} />}
        {sub}
      </div>
    </div>
  );
}

export function Secao({ titulo, descricao, acoes, children, className }: { titulo: string; descricao?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg bg-section p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
          {descricao && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{descricao}</p>}
        </div>
        {acoes}
      </div>
      {children}
    </section>
  );
}

export function TituloPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-foreground">{titulo}</h1>
        {descricao && <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="grid-paper rounded-lg border border-dashed p-10 text-center">
      <p className="font-medium text-foreground">{titulo}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Carregando() {
  return <div className="animate-pulse rounded-lg bg-muted p-10 text-center text-sm text-muted-foreground">Carregando…</div>;
}

export function CabecalhoMunicipio({ m }: { m: any }) {
  if (!m) return null;
  const url = m.brasao ? arquivoUrl(m.collectionId, m.id, m.brasao) : "";
  return (
    <div className="mb-6 flex items-center gap-4 rounded-lg border bg-card p-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
        {url ? <img src={url} alt={`Brasão de ${m.nome}`} className="h-full w-full object-contain" /> : <Building2 className="h-7 w-7 text-muted-foreground" />}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold uppercase tracking-wide text-foreground">
          Prefeitura Municipal de {m.nome} - {m.uf}
        </div>
        <div className="text-xs text-muted-foreground">
          {m.orgao || "Fundo Municipal de Educação"}
          {m.cnpj ? ` · CNPJ: ${m.cnpj}` : ""}
        </div>
      </div>
      <div className="eyebrow hidden text-primary sm:block">Análise do FUNDEB</div>
    </div>
  );
}

export const ROTULO_INCONSISTENCIA: Record<string, { titulo: string; descricao: string }> = {
  MAIS_DE_UM_VINCULO_AEE: {
    titulo: "Mais de um vínculo de AEE",
    descricao: "Critério em validação: 2+ matrículas de AEE no município (hipótese a) ou AEE no mesmo horário da turma curricular (hipótese b).",
  },
  AEE_SEM_CURRICULAR: { titulo: "AEE sem matrícula curricular", descricao: "Aluno com vínculo de AEE e nenhum vínculo curricular em qualquer escola do município." },
  URBANA_EM_ESCOLA_RURAL: { titulo: "Residência urbana em escola rural", descricao: "Aluno com zona de residência Urbana e vínculo em escola de localização Rural." },
  DEFICIENCIA_SEM_AEE: { titulo: "Deficiência sem vínculo de AEE", descricao: "Aluno com deficiência/TEA informada e nenhum vínculo de AEE no município." },
};
