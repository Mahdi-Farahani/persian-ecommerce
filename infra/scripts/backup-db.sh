#!/usr/bin/env sh
# Logical backup of the MariaDB service in the Compose stack.
# Usage: infra/scripts/backup-db.sh [backup-dir]   (default ./backups)
# Requires the stack's .env in the current directory (docker compose reads it).
set -eu
BACKUP_DIR="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DB="${MARIADB_DATABASE:-persian_ecommerce}"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/${DB}-${STAMP}.sql.gz"
docker compose exec -T mariadb sh -c 'mariadb-dump --single-transaction --quick --routines --triggers -u root -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' | gzip -9 > "$FILE"
echo "backup written: $FILE ($(du -h "$FILE" | cut -f1))"
# Retention: keep the newest 30 daily files.
ls -1t "$BACKUP_DIR"/${DB}-*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm -f
