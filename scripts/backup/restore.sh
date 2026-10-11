#!/usr/bin/env bash
# Descifra un backup y lo restaura. Necesita docker y age.
# Uso: AGE_KEY_FILE=clave.txt scripts/backup/restore.sh <backup.dump.age> <url_destino>
# El destino tiene que tener public vacío (proyecto nuevo, o ver prepare-target.sql).
set -euo pipefail

: "${AGE_KEY_FILE:?Falta AGE_KEY_FILE (clave privada de age)}"
backup="${1:?Uso: restore.sh <backup.dump.age> <url_destino>}"
destino="${2:?Uso: restore.sh <backup.dump.age> <url_destino>}"

pg() { docker run --rm -i --network host postgres:17 "$@"; }

# Quito CREATE SCHEMA public porque ya existe en cualquier BD nueva.
# --single-transaction: si falla algo no se queda a medias.
age --decrypt --identity "$AGE_KEY_FILE" "$backup" \
  | pg pg_restore --no-owner --file=- \
  | sed '/^CREATE SCHEMA public;$/d' \
  | pg psql "$destino" --quiet --single-transaction -v ON_ERROR_STOP=1 >/dev/null
