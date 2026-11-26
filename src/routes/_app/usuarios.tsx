import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useSessao } from "@/hooks/use-sessao";
import { Secao, TituloPagina, Vazio } from "@/components/radar/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mensagemErro, pb } from "@/lib/pb";

export const Route = createFileRoute("/_app/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — Radar FUNDEB" }, { name: "description", content: "Gestão de usuários e perfis." }, { property: "og:title", content: "Usuários — Radar FUNDEB" }, { property: "og:description", content: "Gestão de usuários e perfis." }] }),
  component: Usuarios,
});

type Form = { id?: string; name: string; email: string; password: string; role: string; municipios: string[]; ativo: boolean };
const VAZIO: Form = { name: "", email: "", password: "", role: "gestor", municipios: [], ativo: true };

function Usuarios() {
  const s = useSessao();
  const [f, setF] = useState<Form | null>(null);
  const { data: users = [], refetch } = useQuery({ queryKey: ["users"], queryFn: () => pb().collection("users").getFullList({ sort: "name" }), enabled: s.papel === "admin" });
  const { data: muns = [] } = useQuery({ queryKey: ["municipios"], queryFn: () => pb().collection("municipios").getFullList({ sort: "nome" }) });
  if (s.papel !== "admin") return <Vazio titulo="Somente administradores" />;

  async function salvar() {
    if (!f) return;
    try {
      const body: any = { name: f.name, email: f.email, role: f.role, municipios: f.municipios, ativo: f.ativo, emailVisibility: true };
      if (f.password) { body.password = f.password; body.passwordConfirm = f.password; }
      if (f.id) await pb().collection("users").update(f.id, body);
      else await pb().collection("users").create(body);
      toast.success("Usuário salvo.");
      setF(null);
      refetch();
    } catch (e) { toast.error(mensagemErro(e)); }
  }
  async function resetar(email: string) {
    try { await pb().collection("users").requestPasswordReset(email); toast.success("E-mail de redefinição enviado (requer SMTP configurado)."); } catch (e) { toast.error(mensagemErro(e)); }
  }
  return (
    <div className="space-y-6">
      <TituloPagina titulo="Usuários" descricao="Admin: acesso total. Analista: edita os municípios vinculados. Gestor: só leitura dos municípios vinculados. Usuários desativados não conseguem entrar." acoes={<Button onClick={() => setF({ ...VAZIO })}>Novo usuário</Button>} />
      {f && (
        <Secao titulo={f.id ? "Editar usuário" : "Novo usuário"}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Nome" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <Input placeholder="E-mail" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <Input placeholder={f.id ? "Nova senha (deixe vazio para manter)" : "Senha (mín. 8)"} type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <select className="h-9 rounded border bg-card px-2 text-sm" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="admin">Admin</option><option value="analista">Analista</option><option value="gestor">Gestor</option></select>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">{muns.map((m) => (
            <label key={m.id} className="flex items-center gap-1"><input type="checkbox" checked={f.municipios.includes(m.id)} onChange={(e) => setF({ ...f, municipios: e.target.checked ? [...f.municipios, m.id] : f.municipios.filter((x) => x !== m.id) })} />{m["nome"]}/{m["uf"]}</label>
          ))}</div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Ativo</label>
          <div className="mt-4 flex gap-2"><Button onClick={salvar}>Salvar</Button><Button variant="ghost" onClick={() => setF(null)}>Cancelar</Button></div>
        </Secao>
      )}
      <div className="overflow-x-auto rounded border bg-card">
        <table className="tabela-relatorio w-full text-sm">
          <thead className="bg-muted text-left"><tr><th className="p-2">Nome</th><th className="p-2">E-mail</th><th className="p-2">Perfil</th><th className="p-2">Municípios</th><th className="p-2">Status</th><th /></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-2">{u["name"]}</td><td className="p-2">{u["email"]}</td><td className="p-2 capitalize">{u["role"]}</td>
              <td className="p-2 text-xs">{((u["municipios"] as string[]) || []).map((id) => muns.find((m) => m.id === id)?.["nome"]).filter(Boolean).join(", ") || (u["role"] === "admin" ? "todos" : "—")}</td>
              <td className={`p-2 ${u["ativo"] ? "text-success" : "text-muted-foreground"}`}>{u["ativo"] ? "Ativo" : "Desativado"}</td>
              <td className="flex justify-end gap-1 p-2">
                <Button size="sm" variant="outline" onClick={() => setF({ id: u.id, name: u["name"], email: u["email"], password: "", role: u["role"], municipios: u["municipios"] || [], ativo: !!u["ativo"] })}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => resetar(u["email"])}>Redefinir senha</Button>
              </td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
