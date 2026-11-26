import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { pb } from "@/lib/pb";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Radar FUNDEB — Análise do FUNDEB municipal" },
      { name: "description", content: "Importe o Educacenso, veja receitas, projeções, potencial e inconsistências do FUNDEB do seu município." },
      { property: "og:title", content: "Radar FUNDEB — Análise do FUNDEB municipal" },
      { property: "og:description", content: "Importe o Educacenso, veja receitas, projeções, potencial e inconsistências do FUNDEB do seu município." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: pb().authStore.isValid ? "/painel" : "/login", replace: true });
  }, [navigate]);
  return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Abrindo o Radar FUNDEB…</div>;
}
