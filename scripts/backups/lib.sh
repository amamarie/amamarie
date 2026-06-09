#!/usr/bin/env bash

set -euo pipefail

backup_dir() {
  printf '%s\n' "${BACKUP_DIR:-.backup}"
}

backup_date() {
  printf '%s\n' "${BACKUP_DATE:-$(date -u +%F)}"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

encrypt_backup_file() {
  local file="$1"

  if [[ -z "${BACKUP_GPG_PUBLIC_KEY:-}" ]]; then
    if [[ "${ALLOW_UNENCRYPTED_BACKUP:-false}" == "true" ]]; then
      echo "WARNING: leaving unencrypted backup on disk: $file" >&2
      return 0
    fi
    echo "BACKUP_GPG_PUBLIC_KEY is required to encrypt sensitive backups." >&2
    echo "Set ALLOW_UNENCRYPTED_BACKUP=true only for local testing." >&2
    exit 1
  fi

  require_command gpg

  local gpg_home
  gpg_home="$(mktemp -d)"
  chmod 700 "$gpg_home"

  printf '%s\n' "$BACKUP_GPG_PUBLIC_KEY" | gpg --batch --homedir "$gpg_home" --import >/dev/null

  local recipient
  recipient="$(gpg --batch --homedir "$gpg_home" --list-keys --with-colons | awk -F: '/^pub:/ { print $5; exit }')"
  if [[ -z "$recipient" ]]; then
    echo "No public GPG recipient found in BACKUP_GPG_PUBLIC_KEY." >&2
    rm -rf "$gpg_home"
    exit 1
  fi

  gpg \
    --batch \
    --yes \
    --homedir "$gpg_home" \
    --trust-model always \
    --recipient "$recipient" \
    --output "${file}.gpg" \
    --encrypt "$file"

  rm -rf "$gpg_home"
  rm -f "$file"
  echo "${file}.gpg"
}

upload_backup_to_s3() {
  local file="$1"

  if [[ -z "${BACKUP_S3_BUCKET:-}" ]]; then
    echo "BACKUP_S3_BUCKET not configured; skipping S3 upload."
    return 0
  fi

  require_command aws

  local prefix="${BACKUP_S3_PREFIX:-finassuro}"
  local date_part
  date_part="$(backup_date)"
  aws s3 cp "$file" "s3://${BACKUP_S3_BUCKET}/${prefix}/${date_part}/$(basename "$file")"
}
