#!/usr/bin/env bash
# Backup cifrado del esquema public. Necesita docker y age.
# Uso: SUPABASE_DB_URL=... AGE_RECIPIENT=age1... scripts/backup/backup.sh <dir_salida>
# Deja el volcado cifrado (.dump.age) y manifest.json con las filas por tabla.
set -euo pipefail

: "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL}"
: "${AGE_RECIPIENT:?Falta AGE_RECIPIENT (clave pública de age)}"
out="${1:?Uso: backup.sh <dir_salida>}"
dir_script="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$out"
fecha="$(date -u +%Y%m%dT%H%MZ)"
archivo="$out/timbre-$fecha.dump.age"

pg() { docker run --rm -i --network host postgres:17 "$@"; }

# De pg_dump a age directamente, sin escribir nada en claro en disco
pg pg_dump "$SUPABASE_DB_URL" --schema=public --format=custom --no-owner \
  | age --encrypt --recipient "$AGE_RECIPIENT" > "$archivo"

pg psql "$SUPABASE_DB_URL" -AtX -v ON_ERROR_STOP=1 -f - < "$dir_script/conteo.sql" > "$out/manifest.json"

echo "Backup: $archivo ($(du -h "$archivo" | cut -f1))"
echo "Manifiesto: $(cat "$out/manifest.json")"
