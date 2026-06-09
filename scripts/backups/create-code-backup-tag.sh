#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

date_part="$(backup_date)"
tag_prefix="${BACKUP_TAG_PREFIX:-backup/finassuro}"
tag_name="${tag_prefix}-${date_part}"

git fetch --tags --quiet

if git rev-parse -q --verify "refs/tags/${tag_name}" >/dev/null; then
  echo "Backup tag already exists: ${tag_name}"
else
  git config user.name "${GIT_BACKUP_USER_NAME:-finassuro-backup-bot}"
  git config user.email "${GIT_BACKUP_USER_EMAIL:-backup@finassuro.com}"
  git tag -a "$tag_name" -m "FinAssuro weekly code backup ${date_part}"
  git push origin "refs/tags/${tag_name}"
  echo "Created backup tag: ${tag_name}"
fi

if [[ "${CREATE_BACKUP_BRANCH:-false}" == "true" ]]; then
  branch_name="${BACKUP_BRANCH_PREFIX:-backup/finassuro}-${date_part}"
  git push origin "HEAD:refs/heads/${branch_name}"
  echo "Created backup branch: ${branch_name}"
fi
