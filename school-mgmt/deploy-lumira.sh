#!/usr/bin/env bash
set -euo pipefail

# Deploy wrapper for lumiraenglish.com.
#
# This keeps Lumira on its own Atlas database and prevents accidental deploys
# that point the Lumira domain at another tenant's database.
#
# Usage:
#   ./deploy-lumira.sh [version]
#
# Optional overrides still supported:
#   IMAGE_NAMESPACE=vutheviet
#   SSH_HOST=...
#   SSH_USER=...
#   SSH_KEY_PATH=...

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="${1:-${VERSION:-lumiraenglish-$(date +%Y%m%d-%H%M)}}"

export DOMAIN="${DOMAIN:-lumiraenglish.com}"
export BACKEND_PORT="${BACKEND_PORT:-8102}"
export FRONTEND_PORT="${FRONTEND_PORT:-8103}"
export ATLAS_DB="${ATLAS_DB:-lumiraenglish}"
export ADMIN_EMAIL="${ADMIN_EMAIL:-admin@lumiraenglish.com}"
export ADMIN_FULLNAME="${ADMIN_FULLNAME:-Lumira Admin}"
export ENABLE_SAMPLE_SEED="${ENABLE_SAMPLE_SEED:-false}"
export ADMIN_SYNC_EXISTING="${ADMIN_SYNC_EXISTING:-false}"

if [[ "${DOMAIN}" != "lumiraenglish.com" ]]; then
  echo "[deploy-lumira] DOMAIN must remain lumiraenglish.com, got: ${DOMAIN}" >&2
  exit 1
fi

if [[ "${ATLAS_DB}" != "lumiraenglish" ]]; then
  echo "[deploy-lumira] ATLAS_DB must remain lumiraenglish, got: ${ATLAS_DB}" >&2
  exit 1
fi

if [[ -n "${MONGODB_URI:-}" && "${MONGODB_URI}" != *"/lumiraenglish"* ]]; then
  echo "[deploy-lumira] MONGODB_URI does not target the lumiraenglish database." >&2
  exit 1
fi

exec "${SCRIPT_DIR}/deploy-tungtran.sh" "${VERSION}"
