<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Radar FUNDEB — arquitetura
- Self-hosted, sem Lovable Cloud: backend PocketBase (`backend/pb_migrations`, `backend/pb_hooks`) + interface TanStack Start buildada com `NITRO_PRESET=node-server`, atrás de nginx (ver `DEPLOY.md`). Motivo: roda numa VM Proxmox/Ubuntu do cliente.
- Toda regra de cálculo FUNDEB fica em `backend/pb_hooks/lib/engine.js` (CommonJS ES2015, sem `?.`/`??`), usado pelo JSVM do PocketBase e pelos testes em `src/test/engine.test.ts`. Motivo: uma única fonte de verdade.
- Rotas de servidor ficam sob `/backend/v1/*` em `main.pb.js`; cada handler faz `require` de `lib/server.js` (handlers do JSVM são isolados) e checa acesso ao município com `exigirAcesso`.
- Mudança de esquema = nova migration numerada em `backend/pb_migrations`; nunca editar uma migration já aplicada.
- O navegador fala com o backend pelo mesmo domínio (`src/lib/pb.ts`); no dev o Vite faz proxy de `/api` e `/backend` para 127.0.0.1:8090.
- CPF é mascarado no navegador antes do envio; o banco nunca guarda CPF completo.
