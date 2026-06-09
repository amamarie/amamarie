#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

require_command npx

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "VERCEL_TOKEN is required to export Vercel environment variables." >&2
  exit 1
fi

dir="$(backup_dir)"
date_part="$(backup_date)"
environment="${VERCEL_ENVIRONMENT:-production}"
mkdir -p "$dir"

if [[ -n "${VERCEL_ORG_ID:-}" && -n "${VERCEL_PROJECT_ID:-}" ]]; then
  mkdir -p .vercel
  printf '{"orgId":"%s","projectId":"%s"}\n' "$VERCEL_ORG_ID" "$VERCEL_PROJECT_ID" > .vercel/project.json
fi

file="${dir}/finassuro-vercel-${environment}-env-${date_part}.env"

npx --yes vercel@latest env pull "$file" \
  --environment="$environment" \
  --token="$VERCEL_TOKEN"

encrypted_file="$(encrypt_backup_file "$file")"
upload_backup_to_s3 "$encrypted_file"

echo "Vercel environment backup ready: ${encrypted_file}"
