#!/usr/bin/env bash
# Arranca el despertador con el token del .env de la oficina. Sin argumentos usa tu Claude;
# con --fake responde sin IA (para probar sin gastar).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No hay .env: copia .env.example a .env y rellénalo (ver README)." >&2
  exit 1
fi
# Solo el token, sin cargar el resto del .env en el entorno.
RUNNER_TOKEN="$(grep -E '^RUNNER_TOKEN=' .env | head -n1 | cut -d= -f2-)"
if [ -z "$RUNNER_TOKEN" ]; then
  echo "Falta RUNNER_TOKEN en el .env (genera uno con: openssl rand -hex 32)." >&2
  exit 1
fi
if [ "${1:-}" != "--fake" ] && ! command -v "${CLAUDE_BIN:-claude}" >/dev/null; then
  echo "No encuentro el comando claude. Instala Claude Code o usa --fake." >&2
  exit 1
fi

export RUNNER_TOKEN
export MAD_OFFICE_URL="${MAD_OFFICE_URL:-http://localhost:8081}"
exec node despertador/despertador.js "$@"
