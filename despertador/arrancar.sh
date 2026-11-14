#!/usr/bin/env bash
# Arranca el despertador con el token del .env de la oficina. Sin argumentos usa tu Claude;
# con --fake responde sin IA (para probar sin gastar); con --prod va a la oficina publicada.
set -euo pipefail
cd "$(dirname "$0")/.."

# --prod: la oficina publicada (token en ~/.config/mad-office/produccion.env, fuera del repo).
if [ "${1:-}" = "--prod" ]; then
  shift
  PROD="$HOME/.config/mad-office/produccion.env"
  [ -f "$PROD" ] || { echo "Falta $PROD (lo crea el despliegue)." >&2; exit 1; }
  RUNNER_TOKEN="$(grep -E '^RUNNER_TOKEN=' "$PROD" | cut -d= -f2-)"
  MAD_OFFICE_URL="$(grep -E '^MAD_OFFICE_URL=' "$PROD" | cut -d= -f2-)"
else
  if [ ! -f .env ]; then
    echo "No hay .env: copia .env.example a .env y rellénalo (ver README)." >&2
    exit 1
  fi
  # Solo el token, sin cargar el resto del .env en el entorno.
  RUNNER_TOKEN="$(grep -E '^RUNNER_TOKEN=' .env | head -n1 | cut -d= -f2-)"
fi
if [ -z "$RUNNER_TOKEN" ]; then
  echo "Falta RUNNER_TOKEN (genera uno con: openssl rand -hex 32)." >&2
  exit 1
fi
if [ "${1:-}" != "--fake" ] && ! command -v "${CLAUDE_BIN:-claude}" >/dev/null; then
  echo "No encuentro el comando claude. Instala Claude Code o usa --fake." >&2
  exit 1
fi

export RUNNER_TOKEN
export MAD_OFFICE_URL="${MAD_OFFICE_URL:-http://localhost:8081}"
exec node despertador/despertador.js "$@"
