# Radar FUNDEB — instalação na VM (Proxmox + Ubuntu Server)

O sistema é 100% independente: **backend PocketBase** (um único executável com banco SQLite, login, arquivos e e-mail) + **interface web em Node**, atrás do **nginx**. Nenhum serviço externo é obrigatório (o IBGE só é consultado quando você clica em "Buscar no IBGE").

```
navegador ──► nginx :80/:443
               ├── /api, /backend, /_   ──► PocketBase 127.0.0.1:8090  (dados em /opt/radar-fundeb/backend/pb_data)
               └── /                    ──► Node 127.0.0.1:3000        (interface)
```

## 1. VM recomendada
- Ubuntu Server 22.04 ou 24.04, 2 vCPU, 4 GB RAM, 20 GB de disco.
- Acesso à internet só para instalar (e para a busca no IBGE).

## 2. Instalação
```bash
sudo apt install -y git
git clone <URL-do-repositorio> radar-fundeb && cd radar-fundeb
sudo bash deploy/install.sh
```
Ao final, abra `http://IP-DA-VM`. **A primeira conta criada na tela de login vira administradora**; depois disso só o admin cria usuários (tela Usuários).

Para atualizar: `git pull && sudo bash deploy/install.sh` (o banco é preservado).

## 3. HTTPS (recomendado)
Com um domínio apontando para a VM:
```bash
sudo sed -i 's/server_name _;/server_name radar.seudominio.com.br;/' /etc/nginx/sites-available/radar-fundeb
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d radar.seudominio.com.br
```
Depois, em **Parâmetros → Configurações**, preencha a **URL pública** (usada no QR Code dos relatórios).

## 4. E-mail (opcional)
Crie o superusuário do painel técnico:
`sudo -u radar /opt/radar-fundeb/backend/pocketbase superuser upsert voce@email.com SENHA --dir /opt/radar-fundeb/backend/pb_data`
Acesse `http://IP/_/` → Settings → Mail settings e configure o SMTP. Sem isso, "Enviar por e-mail" e "Redefinir senha" mostram um aviso.

## 5. Backup
```bash
sudo cp deploy/backup.sh /opt/radar-fundeb/ && echo "0 2 * * * root /opt/radar-fundeb/backup.sh" | sudo tee /etc/cron.d/radar-backup
```
Também recomendado: backup da VM inteira no Proxmox (vzdump).

## 6. Comandos úteis
```bash
sudo systemctl status radar-pocketbase radar-web
sudo journalctl -u radar-pocketbase -f     # logs do backend
sudo journalctl -u radar-web -f            # logs da interface
```

## 7. Primeiro uso
1. Parâmetros → Município: cadastre (busca do código IBGE pelo nome + "Buscar no IBGE").
2. Parâmetros → Receitas (mínimo 4 anos, ou CSV) e → Projeção (valores por ponderada do ano seguinte).
3. Importar: arraste os pares de planilhas do Educacenso (ou um ZIP). O CPF é mascarado no navegador.
4. Confira Painel, Escolas, Matrículas, Projeção, Plano de Ação e Inconsistências; emita o relatório em Relatórios.

## Desenvolvimento local
`./pocketbase serve --dir backend/pb_data --migrationsDir backend/pb_migrations --hooksDir backend/pb_hooks` e `bun run dev` (o Vite encaminha /api e /backend para a porta 8090).
