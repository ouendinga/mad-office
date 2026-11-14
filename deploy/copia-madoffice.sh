#!/usr/bin/env bash
# Copia diaria del Postgres de Mad Office, FUERA de Hetzner. Mismo patrón que copia-tucora.sh:
# volcado (formato custom) cifrado a la clave de copias (la privada NO está en este servidor) y
# subido con subir-a-b2, que comprueba que llega. Se instala en /usr/local/bin (cron 03:57).
set -euo pipefail
C=mad-office-db
DEST=/root/copias; mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M)
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
docker exec "$C" pg_dump -U madoffice -d madoffice --format=custom > "$TMP/madoffice.dump"
TABLAS=$(docker exec -i "$C" pg_restore -l < "$TMP/madoffice.dump" | grep -c " TABLE public " || true)
if [ "$TABLAS" -lt 8 ]; then echo "$(date -Is) ERROR: el volcado de Mad Office solo trae $TABLAS tablas. No subo." >&2; exit 1; fi
CIFRADO="$DEST/madoffice-$STAMP.dump.gpg"
gpg --batch --yes --trust-model always --encrypt --recipient copias@alvarosolis.dev --output "$CIFRADO" "$TMP/madoffice.dump"
PAQ=$(gpg --batch --list-packets "$CIFRADO" 2>&1 || true)
if ! printf %s "$PAQ" | grep -q "keyid 58859897CB0C9358"; then echo "$(date -Is) ERROR: la copia de Mad Office no va cifrada a la clave de copias" >&2; rm -f "$CIFRADO"; exit 1; fi
/usr/local/bin/subir-a-b2 "$CIFRADO" "madoffice/madoffice-$STAMP.dump.gpg"   # sube Y comprueba que ha llegado
echo "$(date -Is) subida madoffice-$STAMP.dump.gpg ($(du -h "$CIFRADO" | cut -f1), cifrada, $TABLAS tablas)"
ls -1t "$DEST"/madoffice-*.dump.gpg | tail -n +8 | xargs -r rm -f
