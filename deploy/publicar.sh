#!/usr/bin/env bash
# Publica la versión actual en el VPS: construye las imágenes aquí, las sube y reinicia.
# Antes de cambiar nada, copia de la base (dump) en /opt/mad-office/copias/.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${HOST:-multica}"

(cd backend && npm test >/dev/null) || { echo "Los tests del backend fallan: no publico." >&2; exit 1; }
docker build -q -t mad-office-backend:local backend >/dev/null
docker build -q -t mad-office-frontend:local frontend >/dev/null
echo "Imágenes construidas; subiendo…" >&2

ssh "$HOST" 'mkdir -p /opt/mad-office/copias && cd /opt/mad-office && if docker ps --format "{{.Names}}" | grep -qx mad-office-db; then docker exec mad-office-db pg_dump -U madoffice madoffice | gzip > copias/madoffice-$(date +%F-%H%M).sql.gz; ls -1t copias/*.sql.gz | tail -n +15 | xargs -r rm; fi'
docker save mad-office-backend:local mad-office-frontend:local | gzip | ssh "$HOST" 'gunzip | docker load' >/dev/null
scp -q deploy/docker-compose.yml "$HOST":/opt/mad-office/docker-compose.yml
ssh "$HOST" 'cd /opt/mad-office && docker compose up -d && docker compose up -d --no-deps --force-recreate backend frontend && sleep 5 && docker logs --tail 3 mad-office-backend'
