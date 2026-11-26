#!/usr/bin/env bash
# Radar FUNDEB — instalação em Ubuntu Server 22.04/24.04 (VM Proxmox). Rode como root:
#   sudo bash deploy/install.sh
# Reexecutar o script atualiza o sistema (mantém o banco em /opt/radar-fundeb/backend/pb_data).
set -euo pipefail
PB_VERSION="${PB_VERSION:-0.40.6}"
DEST=/opt/radar-fundeb
SRC="$(cd "$(dirname "$0")/.." && pwd)"

echo ">> Pacotes do sistema"
apt-get update -y
apt-get install -y curl unzip nginx ca-certificates
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

id radar >/dev/null 2>&1 || useradd --system --home "$DEST" --shell /usr/sbin/nologin radar
mkdir -p "$DEST/backend" "$DEST/web"

echo ">> Backend (PocketBase $PB_VERSION)"
ARCH=amd64; [ "$(uname -m)" = "aarch64" ] && ARCH=arm64
if [ ! -x "$DEST/backend/pocketbase" ] || ! "$DEST/backend/pocketbase" --version | grep -q "$PB_VERSION"; then
  curl -fsSL -o /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip"
  unzip -o -q /tmp/pb.zip pocketbase -d "$DEST/backend"
fi
rm -rf "$DEST/backend/pb_migrations" "$DEST/backend/pb_hooks"
cp -r "$SRC/backend/pb_migrations" "$SRC/backend/pb_hooks" "$SRC/backend/package.json" "$DEST/backend/"

echo ">> Interface web (build Node)"
rm -rf /tmp/radar-build && mkdir -p /tmp/radar-build
tar --exclude=node_modules --exclude=.git --exclude=backend/pb_data -C "$SRC" -cf - . | tar -xf - -C /tmp/radar-build
cd /tmp/radar-build
# O projeto usa bun.lock; o npm falha com "edgesOut" nesse cenário, então usamos o Bun só para o build.
export BUN_INSTALL=/opt/bun
if [ ! -x /opt/bun/bin/bun ]; then curl -fsSL https://bun.sh/install | bash; fi
/opt/bun/bin/bun install
NITRO_PRESET=node-server /opt/bun/bin/bun run build
rm -rf "$DEST/web/.output" && cp -r .output "$DEST/web/"
cd /

chown -R radar:radar "$DEST"

echo ">> Serviços"
cp "$SRC/deploy/radar-pocketbase.service" "$SRC/deploy/radar-web.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now radar-pocketbase radar-web
systemctl restart radar-pocketbase radar-web

echo ">> Nginx"
cp "$SRC/deploy/nginx-radar.conf" /etc/nginx/sites-available/radar-fundeb
ln -sf /etc/nginx/sites-available/radar-fundeb /etc/nginx/sites-enabled/radar-fundeb
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

IP=$(hostname -I | awk '{print $1}')
echo ""
echo "Pronto! Acesse http://$IP  — a primeira conta criada na tela de login vira administradora."
echo "Painel técnico do banco: http://$IP/_/  (crie o superusuário com:"
echo "  sudo -u radar $DEST/backend/pocketbase superuser upsert seu@email.com SENHA --dir $DEST/backend/pb_data )"
