#!/usr/bin/env sh
# Restores a backup produced by backup-db.sh into the Compose MariaDB service.
# Usage: infra/scripts/restore-db.sh backups/persian_ecommerce-20260930T120000Z.sql.gz
# Stops the API first so no writes interleave with the restore.
set -eu
FILE="${1:?backup file required}"
[ -f "$FILE" ] || { echo "no such file: $FILE" >&2; exit 1; }
docker compose stop api web
gunzip -c "$FILE" | docker compose exec -T mariadb sh -c 'mariadb -u root -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"'
docker compose start api web
echo "restore complete from $FILE"
