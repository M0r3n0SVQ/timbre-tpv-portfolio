#!/usr/bin/env bash
# Descifra un backup y lo restaura en una base de datos.
#
# Uso:
#   AGE_KEY_FILE=ruta/a/la/clave.txt  scripts/backup/restore.sh <backup.dump.age> <url_destino>
#
# El destino debe tener el esquema public vacío (un proyecto de Supabase
# recién creado, o un PostgreSQL de pruebas con los roles de Supabase creados;
# ver prepare-target.sql). Para en el primer error.
#
# Requiere docker (imagen postgres:17) y age.
set -euo pipefail

: "${AGE_KEY_FILE:?Falta AGE_KEY_FILE (clave privada de age)}"
backup="${1:?Uso: restore.sh <backup.dump.age> <url_destino>}"
destino="${2:?Uso: restore.sh <backup.dump.age> <url_destino>}"

age --decrypt --identity "$AGE_KEY_FILE" "$backup" \
  | docker run --rm -i --network host postgres:17 \
      pg_restore --dbname="$destino" --no-owner --exit-on-error
