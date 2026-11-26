#!/usr/bin/env bash
# Backup diário do banco (agende no cron: 0 2 * * * /opt/radar-fundeb/backup.sh)
set -euo pipefail
D=/var/backups/radar-fundeb; mkdir -p "$D"
tar -czf "$D/pb_data-$(date +%F).tar.gz" -C /opt/radar-fundeb/backend pb_data
find "$D" -name 'pb_data-*.tar.gz' -mtime +30 -delete
