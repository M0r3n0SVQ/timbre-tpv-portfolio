#!/usr/bin/env bash
# Hace un backup cifrado del esquema public de la base de datos.
#
# Uso:
#   SUPABASE_DB_URL=postgresql://...  AGE_RECIPIENT=age1...  scripts/backup/backup.sh <dir_salida>
#
# Deja en <dir_salida>:
#   timbre-<fecha>.dump.age   volcado (pg_dump formato custom) cifrado con age
#   manifest.json             filas por tabla en el momento del backup (no sensible)
#
# Requiere docker (usa la imagen postgres:17 para pg_dump/psql) y age.
set -euo pipefail

: "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL}"
: "${AGE_RECIPIENT:?Falta AGE_RECIPIENT (clave pública de age)}"
out="${1:?Uso: backup.sh <dir_salida>}"
dir_script="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$out"
fecha="$(date -u +%Y%m%dT%H%MZ)"
archivo="$out/timbre-$fecha.dump.age"

pg() { docker run --rm -i --network host postgres:17 "$@"; }

# Tablas, datos, RLS, políticas y permisos del esquema public. Va directo de
# pg_dump a age por una tubería: el volcado nunca se escribe en claro en disco.
# Con pipefail, si pg_dump falla a medias el script falla aunque age termine.
pg pg_dump "$SUPABASE_DB_URL" --schema=public --format=custom --no-owner \
  | age --encrypt --recipient "$AGE_RECIPIENT" > "$archivo"

pg psql "$SUPABASE_DB_URL" -AtX -v ON_ERROR_STOP=1 -f - < "$dir_script/conteo.sql" > "$out/manifest.json"

echo "Backup: $archivo ($(du -h "$archivo" | cut -f1))"
echo "Manifiesto: $(cat "$out/manifest.json")"
