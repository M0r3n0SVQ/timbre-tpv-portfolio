#!/usr/bin/env bash
# Descifra un backup y lo restaura en una base de datos.
#
# Uso:
#   AGE_KEY_FILE=ruta/a/la/clave.txt  scripts/backup/restore.sh <backup.dump.age> <url_destino>
#
# El destino debe tener el esquema public vacío (un proyecto de Supabase
# recién creado, o un PostgreSQL de pruebas con los roles de Supabase creados;
# ver prepare-target.sql).
#
# Requiere docker (imagen postgres:17) y age.
set -euo pipefail

: "${AGE_KEY_FILE:?Falta AGE_KEY_FILE (clave privada de age)}"
backup="${1:?Uso: restore.sh <backup.dump.age> <url_destino>}"
destino="${2:?Uso: restore.sh <backup.dump.age> <url_destino>}"

pg() { docker run --rm -i --network host postgres:17 "$@"; }

# 1. age descifra y pg_restore lo convierte a SQL, todo en tubería: el
#    volcado nunca se escribe en claro en disco.
# 2. El volcado incluye "CREATE SCHEMA public;", pero public ya existe en
#    cualquier base de datos nueva (también en Supabase): se quita esa línea.
# 3. psql lo aplica en una sola transacción: o se restaura todo o no se
#    toca nada, y para en el primer error.
age --decrypt --identity "$AGE_KEY_FILE" "$backup" \
  | pg pg_restore --no-owner --file=- \
  | sed '/^CREATE SCHEMA public;$/d' \
  | pg psql "$destino" --quiet --single-transaction -v ON_ERROR_STOP=1 >/dev/null
