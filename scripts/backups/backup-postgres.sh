#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

require_command pg_dump

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required for PostgreSQL backup." >&2
  exit 1
fi

dir="$(backup_dir)"
date_part="$(backup_date)"
mkdir -p "$dir"

file="${dir}/finassuro-postgres-${date_part}.dump"

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$file" \
  "$DATABASE_URL"

encrypted_file="$(encrypt_backup_file "$file")"
upload_backup_to_s3 "$encrypted_file"

echo "PostgreSQL backup ready: ${encrypted_file}"
