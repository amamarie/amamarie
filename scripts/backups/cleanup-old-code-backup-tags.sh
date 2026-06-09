#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

tag_prefix="${BACKUP_TAG_PREFIX:-backup/finassuro}"
retention_days="${BACKUP_TAG_RETENTION_DAYS:-90}"

if ! [[ "$retention_days" =~ ^[0-9]+$ ]]; then
  echo "BACKUP_TAG_RETENTION_DAYS must be a positive integer." >&2
  exit 1
fi

cutoff_epoch="$(date -u -d "${retention_days} days ago" +%s)"

git fetch --tags --quiet

deleted=0
while IFS= read -r tag_name; do
  [[ -n "$tag_name" ]] || continue

  tag_date="${tag_name##${tag_prefix}-}"
  if ! [[ "$tag_date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "Skipping backup tag with unexpected date format: ${tag_name}"
    continue
  fi

  tag_epoch="$(date -u -d "$tag_date" +%s)"
  if (( tag_epoch < cutoff_epoch )); then
    git tag -d "$tag_name" >/dev/null
    git push origin ":refs/tags/${tag_name}"
    echo "Deleted old backup tag: ${tag_name}"
    deleted=$((deleted + 1))
  fi
done < <(git tag --list "${tag_prefix}-????-??-??" | sort)

echo "Old backup tag cleanup complete. Deleted ${deleted} tag(s). Retention: ${retention_days} day(s)."
