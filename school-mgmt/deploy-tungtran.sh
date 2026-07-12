#!/usr/bin/env bash
set -euo pipefail

# Local deploy orchestrator:
# 1) Build backend/frontend Docker images
# 2) Push images to Docker Hub
# 3) SSH to remote server and run deployment
#
# Usage:
#   ./deploy-tungtran.sh [version]
#
# Optional environment overrides:
#   IMAGE_NAMESPACE=vutheviet
#   DOMAIN=tungtran.online
#   BACKEND_PORT=8092
#   FRONTEND_PORT=8093
#   TRAEFIK_NETWORK=traefik-network
#   SITE_ROOT=/opt/websites/sites
#   SSH_HOST=vippro-proj-a (or IP/hostname)
#   SSH_PORT=22
#   SSH_USER=admin-001
#   SSH_KEY_PATH=~/.ssh/school-mgmt-deploy
#   SSH_CONFIG_PATH=~/.ssh/config
#   SSH_PASSWORD=<blank to disable password auth>
#   SUDO_PASSWORD=<blank by default; can match SSH_PASSWORD when needed>
#   PYTHON_BIN=python
#   MONGODB_URI=...
#   ATLAS_USER=...
#   ATLAS_DB_PASSWORD=...
#   ATLAS_CLUSTER=...
#   ATLAS_DB=...
#   ATLAS_APP_NAME=...
#   JWT_SECRET=...
#   JWT_EXPIRES=7d
#   TOKEN_ENCRYPTION_KEY=...
#   ADMIN_EMAIL=...
#   ADMIN_PASSWORD=...
#   ADMIN_FULLNAME=...
#   ADMIN_SYNC_EXISTING=false
#   DEMO_PASSWORD=...
#   DEMO_SYNC_EXISTING=true
#   ENABLE_SAMPLE_SEED=false

VERSION="${1:-version8-atlas-hotfix1}"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-vutheviet}"

DOMAIN="${DOMAIN:-tungtran.online}"
BACKEND_PORT="${BACKEND_PORT:-8092}"
FRONTEND_PORT="${FRONTEND_PORT:-8093}"
TRAEFIK_NETWORK="${TRAEFIK_NETWORK:-traefik-network}"
SITE_ROOT="${SITE_ROOT:-/opt/websites/sites}"

SSH_HOST="${SSH_HOST:-vippro-proj-a}"
SSH_PORT="${SSH_PORT:-22}"
SSH_USER="${SSH_USER:-admin-001}"
DEFAULT_SSH_KEY_PATH=""
if [ -f "${HOME}/.ssh/school-mgmt-deploy" ]; then
  DEFAULT_SSH_KEY_PATH="${HOME}/.ssh/school-mgmt-deploy"
fi
SSH_KEY_PATH="${SSH_KEY_PATH:-$DEFAULT_SSH_KEY_PATH}"
SSH_PASSWORD="${SSH_PASSWORD:-}"
SUDO_PASSWORD="${SUDO_PASSWORD:-$SSH_PASSWORD}"
SSH_CONFIG_PATH="${SSH_CONFIG_PATH:-${HOME}/.ssh/config}"
PYTHON_BIN="${PYTHON_BIN:-python}"

ATLAS_USER="${ATLAS_USER:-allinoneuser}"
ATLAS_CLUSTER="${ATLAS_CLUSTER:-allinone.cniws0g.mongodb.net}"
ATLAS_DB="${ATLAS_DB:-tungtran}"
ATLAS_APP_NAME="${ATLAS_APP_NAME:-allinone}"
ATLAS_DB_PASSWORD="${ATLAS_DB_PASSWORD:-mbFpQoAxS0wVdnUf}"
DEFAULT_MONGO_URI="mongodb+srv://${ATLAS_USER}:${ATLAS_DB_PASSWORD}@${ATLAS_CLUSTER}/${ATLAS_DB}?retryWrites=true&w=majority&appName=${ATLAS_APP_NAME}"
MONGODB_URI="${MONGODB_URI:-$DEFAULT_MONGO_URI}"

JWT_SECRET="${JWT_SECRET:-tungtran_secret_key_change_me_now}"
JWT_EXPIRES="${JWT_EXPIRES:-7d}"
TOKEN_ENCRYPTION_KEY="${TOKEN_ENCRYPTION_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@tungtran.online}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"
ADMIN_FULLNAME="${ADMIN_FULLNAME:-Director Admin}"
ADMIN_SYNC_EXISTING="${ADMIN_SYNC_EXISTING:-false}"
DEMO_PASSWORD="${DEMO_PASSWORD:-Demo123456!}"
DEMO_SYNC_EXISTING="${DEMO_SYNC_EXISTING:-true}"
ENABLE_SAMPLE_SEED="${ENABLE_SAMPLE_SEED:-false}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_IMAGE="${IMAGE_NAMESPACE}/school-mgmt-backend:${VERSION}"
FRONTEND_IMAGE="${IMAGE_NAMESPACE}/school-mgmt-frontend:${VERSION}"

log() {
  echo "[deploy] $*"
}

normalize_path_for_python() {
  local value="${1:-}"
  if [ -z "$value" ]; then
    return
  fi
  if [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]] && command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$value"
    return
  fi
  printf '%s' "$value"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[deploy] Missing required command: $1" >&2
    exit 1
  fi
}

select_python() {
  if command -v "$PYTHON_BIN" >/dev/null 2>&1; then
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
    return
  fi
  if command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
    return
  fi
  echo "[deploy] Python is required but not found." >&2
  exit 1
}

ensure_paramiko() {
  if "$PYTHON_BIN" -c "import paramiko" >/dev/null 2>&1; then
    return
  fi

  log "Installing Python dependency: paramiko"
  "$PYTHON_BIN" -m pip install --quiet paramiko
}

REMOTE_DEPLOY_SCRIPT="$(cat <<'REMOTE_SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-tungtran.online}"
BACKEND_PORT="${BACKEND_PORT:-8092}"
FRONTEND_PORT="${FRONTEND_PORT:-8093}"
CONTAINER_NAME="$(echo "$DOMAIN" | sed 's/\./-/g')"
VERSION="${1:-version8-atlas-hotfix1}"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-vutheviet}"

BACKEND_IMAGE="${IMAGE_NAMESPACE}/school-mgmt-backend:${VERSION}"
FRONTEND_IMAGE="${IMAGE_NAMESPACE}/school-mgmt-frontend:${VERSION}"

SITE_ROOT="${SITE_ROOT:-/opt/websites/sites}"
SITE_DIR="${SITE_ROOT}/${CONTAINER_NAME}"
TRAEFIK_NETWORK="${TRAEFIK_NETWORK:-traefik-network}"

ATLAS_USER="${ATLAS_USER:-allinoneuser}"
ATLAS_CLUSTER="${ATLAS_CLUSTER:-allinone.cniws0g.mongodb.net}"
ATLAS_DB="${ATLAS_DB:-tungtran}"
ATLAS_APP_NAME="${ATLAS_APP_NAME:-allinone}"
ATLAS_DB_PASSWORD="${ATLAS_DB_PASSWORD:-mbFpQoAxS0wVdnUf}"
DEFAULT_MONGO_URI="mongodb+srv://${ATLAS_USER}:${ATLAS_DB_PASSWORD}@${ATLAS_CLUSTER}/${ATLAS_DB}?retryWrites=true&w=majority&appName=${ATLAS_APP_NAME}"
MONGODB_URI="${MONGODB_URI:-$DEFAULT_MONGO_URI}"

JWT_SECRET="${JWT_SECRET:-tungtran_secret_key_change_me_now}"
JWT_EXPIRES="${JWT_EXPIRES:-7d}"
TOKEN_ENCRYPTION_KEY="${TOKEN_ENCRYPTION_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@tungtran.online}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"
ADMIN_FULLNAME="${ADMIN_FULLNAME:-Director Admin}"
ADMIN_SYNC_EXISTING="${ADMIN_SYNC_EXISTING:-false}"
DEMO_PASSWORD="${DEMO_PASSWORD:-Demo123456!}"
DEMO_SYNC_EXISTING="${DEMO_SYNC_EXISTING:-true}"
ENABLE_SAMPLE_SEED="${ENABLE_SAMPLE_SEED:-false}"
SUDO_PASSWORD="${SUDO_PASSWORD:-}"

log() {
  echo "[remote-deploy] $*"
}

SUDO_MODE="none"
if command -v sudo >/dev/null 2>&1; then
  if sudo -n true >/dev/null 2>&1; then
    SUDO_MODE="nopass"
  elif [ -n "${SUDO_PASSWORD}" ] && printf '%s\n' "${SUDO_PASSWORD}" | sudo -S true >/dev/null 2>&1; then
    SUDO_MODE="password"
  fi
fi

sudo_cmd() {
  case "${SUDO_MODE}" in
    nopass)
      sudo -n "$@"
      ;;
    password)
      printf '%s\n' "${SUDO_PASSWORD}" | sudo -S "$@"
      ;;
    *)
      return 1
      ;;
  esac
}

DOCKER_MODE="none"
if docker info >/dev/null 2>&1; then
  DOCKER_MODE="direct"
elif sudo_cmd docker info >/dev/null 2>&1; then
  DOCKER_MODE="sudo"
fi

docker_cmd() {
  case "${DOCKER_MODE}" in
    direct)
      docker "$@"
      ;;
    sudo)
      sudo_cmd docker "$@"
      ;;
    *)
      echo "[remote-deploy] Docker is not accessible for this user." >&2
      exit 1
      ;;
  esac
}

compose() {
  case "${DOCKER_MODE}" in
    direct)
      if docker compose version >/dev/null 2>&1; then
        docker compose "$@"
      else
        docker-compose "$@"
      fi
      ;;
    sudo)
      if sudo_cmd docker compose version >/dev/null 2>&1; then
        sudo_cmd docker compose "$@"
      else
        sudo_cmd docker-compose "$@"
      fi
      ;;
    *)
      echo "[remote-deploy] Docker Compose is not accessible for this user." >&2
      exit 1
      ;;
  esac
}

SITE_ROOT_PARENT="$(dirname "${SITE_ROOT}")"
SITE_ROOT_BASENAME="$(basename "${SITE_ROOT}")"

ensure_site_dir() {
  if mkdir -p "${SITE_DIR}" >/dev/null 2>&1; then
    return
  fi
  docker_cmd run --rm -i \
    -v "${SITE_ROOT_PARENT}:/mnt/site-root-parent" \
    alpine sh -lc "mkdir -p \"/mnt/site-root-parent/${SITE_ROOT_BASENAME}/${CONTAINER_NAME}\""
}

ensure_runtime_dirs() {
  if mkdir -p "${SITE_DIR}/uploads/attendance" "${SITE_DIR}/uploads/invoices" "${SITE_DIR}/uploads/students" >/dev/null 2>&1; then
    return
  fi
  docker_cmd run --rm -i \
    -v "${SITE_ROOT_PARENT}:/mnt/site-root-parent" \
    alpine sh -lc "mkdir -p \
      \"/mnt/site-root-parent/${SITE_ROOT_BASENAME}/${CONTAINER_NAME}/uploads/attendance\" \
      \"/mnt/site-root-parent/${SITE_ROOT_BASENAME}/${CONTAINER_NAME}/uploads/invoices\" \
      \"/mnt/site-root-parent/${SITE_ROOT_BASENAME}/${CONTAINER_NAME}/uploads/students\""
}

write_site_file() {
  local name="$1"
  local tmp_file
  tmp_file="$(mktemp)"
  cat >"${tmp_file}"

  if cp "${tmp_file}" "${SITE_DIR}/${name}" >/dev/null 2>&1; then
    chmod 644 "${SITE_DIR}/${name}" >/dev/null 2>&1 || true
    rm -f "${tmp_file}"
    return
  fi

  docker_cmd run --rm -i \
    -v "${SITE_ROOT_PARENT}:/mnt/site-root-parent" \
    -v "${tmp_file}:/tmp/source-file:ro" \
    alpine sh -lc "set -e && \
      mkdir -p \"/mnt/site-root-parent/${SITE_ROOT_BASENAME}/${CONTAINER_NAME}\" && \
      cp /tmp/source-file \"/mnt/site-root-parent/${SITE_ROOT_BASENAME}/${CONTAINER_NAME}/${name}\" && \
      chmod 644 \"/mnt/site-root-parent/${SITE_ROOT_BASENAME}/${CONTAINER_NAME}/${name}\""

  rm -f "${tmp_file}"
}

update_cloudflared_config() {
  local tmp_script
  tmp_script="$(mktemp)"
  cat >"${tmp_script}" <<'PY'
from pathlib import Path
import re
import sys

config_path = Path('/etc/cloudflared/config.yml')
domain = sys.argv[1].strip()
www_domain = f'www.{domain}'
text = config_path.read_text()

def remove_block(content: str, hostname: str) -> str:
    pattern = (
        rf"  - hostname: {re.escape(hostname)}\n"
        r"    service: http://127\.0\.0\.1:80\n"
        r"    originRequest:\n"
        r"      noTLSVerify: true\n"
        r"      connectTimeout: 30s\n"
        r"      tlsTimeout: 30s\n"
    )
    return re.sub(pattern, '', content)

collapsed_pattern = re.compile(
    rf"- hostname: {re.escape(domain)}\s+service: http://127\.0\.0\.1:80\s+originRequest:\s+noTLSVerify: true\s+connectTimeout: 30s\s+tlsTimeout: 30s\s+"
    rf"- hostname: {re.escape(www_domain)}\s+service: http://127\.0\.0\.1:80\s+originRequest:\s+noTLSVerify: true\s+connectTimeout: 30s\s+tlsTimeout: 30s\n?",
    re.MULTILINE,
)

text = remove_block(text, domain)
text = remove_block(text, www_domain)
text = re.sub(collapsed_pattern, '', text)

marker = '  - service: http_status:404'
if marker not in text:
    raise SystemExit('http_status:404 marker not found in /etc/cloudflared/config.yml')

block = (
    f"  - hostname: {domain}\n"
    "    service: http://127.0.0.1:80\n"
    "    originRequest:\n"
    "      noTLSVerify: true\n"
    "      connectTimeout: 30s\n"
    "      tlsTimeout: 30s\n"
    f"  - hostname: {www_domain}\n"
    "    service: http://127.0.0.1:80\n"
    "    originRequest:\n"
    "      noTLSVerify: true\n"
    "      connectTimeout: 30s\n"
    "      tlsTimeout: 30s\n"
)

config_path.write_text(text.replace(marker, block + marker, 1))
PY

  if sudo_cmd python3 "${tmp_script}" "${DOMAIN}"; then
    rm -f "${tmp_script}"
    return 0
  fi

  rm -f "${tmp_script}"
  return 1
}

log "Deploying ${DOMAIN}"
log "Version: ${VERSION}"
log "Backend image: ${BACKEND_IMAGE}"
log "Frontend image: ${FRONTEND_IMAGE}"

ensure_site_dir
cd "${SITE_DIR}"

log "Preparing runtime folders..."
ensure_runtime_dirs

log "Writing .env ..."
write_site_file .env <<EOF
NODE_ENV=production
PORT=3000
MONGODB_URI=${MONGODB_URI}
CORS_ORIGIN=https://${DOMAIN},https://www.${DOMAIN},http://${DOMAIN},http://www.${DOMAIN},http://localhost:${FRONTEND_PORT}
FRONTEND_URL=https://${DOMAIN}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES=${JWT_EXPIRES}
TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_FULLNAME=${ADMIN_FULLNAME}
ADMIN_SYNC_EXISTING=${ADMIN_SYNC_EXISTING}
DEMO_PASSWORD=${DEMO_PASSWORD}
DEMO_SYNC_EXISTING=${DEMO_SYNC_EXISTING}
ENABLE_SAMPLE_SEED=${ENABLE_SAMPLE_SEED}
EOF

log "Writing docker-compose.yml ..."
write_site_file docker-compose.yml <<EOF
services:
  backend:
    image: ${BACKEND_IMAGE}
    container_name: ${CONTAINER_NAME}-backend
    restart: unless-stopped
    networks:
      - ${TRAEFIK_NETWORK}
    env_file:
      - .env
    volumes:
      - ./uploads:/app/uploads
    ports:
      - "${BACKEND_PORT}:3000"
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=${TRAEFIK_NETWORK}"
      - "traefik.http.routers.${CONTAINER_NAME}-api.rule=(Host(\`${DOMAIN}\`) || Host(\`www.${DOMAIN}\`)) && PathPrefix(\`/api\`)"
      - "traefik.http.routers.${CONTAINER_NAME}-api.entrypoints=websecure"
      - "traefik.http.routers.${CONTAINER_NAME}-api.tls=true"
      - "traefik.http.routers.${CONTAINER_NAME}-api.priority=200"
      - "traefik.http.routers.${CONTAINER_NAME}-api.service=${CONTAINER_NAME}-api"
      - "traefik.http.routers.${CONTAINER_NAME}-api.middlewares=${CONTAINER_NAME}-api-strip"
      - "traefik.http.routers.${CONTAINER_NAME}-api-http.rule=(Host(\`${DOMAIN}\`) || Host(\`www.${DOMAIN}\`)) && PathPrefix(\`/api\`)"
      - "traefik.http.routers.${CONTAINER_NAME}-api-http.entrypoints=web"
      - "traefik.http.routers.${CONTAINER_NAME}-api-http.priority=200"
      - "traefik.http.routers.${CONTAINER_NAME}-api-http.service=${CONTAINER_NAME}-api"
      - "traefik.http.routers.${CONTAINER_NAME}-api-http.middlewares=${CONTAINER_NAME}-api-strip"
      - "traefik.http.services.${CONTAINER_NAME}-api.loadbalancer.server.port=3000"
      - "traefik.http.middlewares.${CONTAINER_NAME}-api-strip.stripprefix.prefixes=/api"

  frontend:
    image: ${FRONTEND_IMAGE}
    container_name: ${CONTAINER_NAME}-frontend
    restart: unless-stopped
    networks:
      - ${TRAEFIK_NETWORK}
    depends_on:
      - backend
    ports:
      - "${FRONTEND_PORT}:80"
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=${TRAEFIK_NETWORK}"
      - "traefik.http.routers.${CONTAINER_NAME}.rule=Host(\`${DOMAIN}\`) || Host(\`www.${DOMAIN}\`)"
      - "traefik.http.routers.${CONTAINER_NAME}.entrypoints=websecure"
      - "traefik.http.routers.${CONTAINER_NAME}.tls=true"
      - "traefik.http.services.${CONTAINER_NAME}.loadbalancer.server.port=80"
      - "traefik.http.routers.${CONTAINER_NAME}-http.rule=Host(\`${DOMAIN}\`) || Host(\`www.${DOMAIN}\`)"
      - "traefik.http.routers.${CONTAINER_NAME}-http.entrypoints=web"

networks:
  ${TRAEFIK_NETWORK}:
    external: true
EOF

log "Pulling images..."
docker_cmd pull "${BACKEND_IMAGE}"
docker_cmd pull "${FRONTEND_IMAGE}"

log "Starting containers..."
compose up -d --remove-orphans

log "Waiting backend readiness..."
READY=0
for i in $(seq 1 50); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${BACKEND_PORT}/users/me" || true)"
  if [ "$CODE" = "401" ] || [ "$CODE" = "200" ]; then
    READY=1
    break
  fi
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  log "Backend not ready in time. Showing last backend logs:"
  compose logs backend --tail=120 || true
  exit 1
fi

log "Ensuring commercial admin with /app/scripts/ensure-commercial-admin.js ..."
if ! docker_cmd exec "${CONTAINER_NAME}-backend" node /app/scripts/ensure-commercial-admin.js; then
  log "ensure-commercial-admin.js failed. Check ADMIN_* env vars and backend logs."
  exit 1
fi

if [ "${ENABLE_SAMPLE_SEED,,}" = "true" ]; then
  log "Seeding sample data with /app/scripts/seed-all.js ..."
  if ! docker_cmd exec "${CONTAINER_NAME}-backend" node /app/scripts/seed-all.js; then
    log "seed-all.js failed. Check MONGODB_URI and backend logs."
  fi

  log "Normalizing demo passwords with /app/scripts/update-demo-passwords.js ..."
  if ! docker_cmd exec "${CONTAINER_NAME}-backend" node /app/scripts/update-demo-passwords.js; then
    log "update-demo-passwords.js failed. Continue deployment."
  fi
else
  log "Sample seed disabled (ENABLE_SAMPLE_SEED=${ENABLE_SAMPLE_SEED})."
fi

  log "Checking Cloudflared config..."
if [ -f /etc/cloudflared/config.yml ]; then
  if grep -q "hostname: ${DOMAIN}" /etc/cloudflared/config.yml; then
    log "Cloudflared already contains ${DOMAIN}."
  else
    if update_cloudflared_config; then
      log "Added ${DOMAIN} + www.${DOMAIN} into /etc/cloudflared/config.yml."
    else
      log "Skipping Cloudflared config update because sudo is unavailable."
    fi
  fi

  log "Restarting cloudflared..."
  sudo_cmd systemctl restart cloudflared || true
else
  log "/etc/cloudflared/config.yml not found, skip Cloudflared step."
fi

log "Basic checks..."
echo "Frontend:"
curl -I "http://127.0.0.1:${FRONTEND_PORT}" || true
echo
echo "Backend /users/me (expect 401 without JWT):"
curl -i "http://127.0.0.1:${BACKEND_PORT}/users/me" || true

echo
echo "Deploy completed for ${DOMAIN}"
echo "Containers:"
echo "  - ${CONTAINER_NAME}-backend (port ${BACKEND_PORT})"
echo "  - ${CONTAINER_NAME}-frontend (port ${FRONTEND_PORT})"
echo "Domain: https://${DOMAIN}"
REMOTE_SCRIPT
)"

select_python
require_cmd docker
require_cmd base64
ensure_paramiko

log "Starting local build and push"
log "Version: ${VERSION}"
log "Backend image: ${BACKEND_IMAGE}"
log "Frontend image: ${FRONTEND_IMAGE}"
log "Target server: ${SSH_USER}@${SSH_HOST}:${SSH_PORT}"
if [ -n "${SSH_KEY_PATH}" ]; then
  SSH_KEY_PATH="$(normalize_path_for_python "${SSH_KEY_PATH}")"
  log "SSH auth mode: key (${SSH_KEY_PATH})"
else
  log "SSH auth mode: password"
fi

docker info >/dev/null

docker build -t "${BACKEND_IMAGE}" -f "${SCRIPT_DIR}/backend/Dockerfile" "${SCRIPT_DIR}/backend"
docker build -t "${FRONTEND_IMAGE}" -f "${SCRIPT_DIR}/frontend/Dockerfile" "${SCRIPT_DIR}/frontend"

docker push "${BACKEND_IMAGE}"
docker push "${FRONTEND_IMAGE}"

REMOTE_SCRIPT_B64="$(printf '%s' "${REMOTE_DEPLOY_SCRIPT}" | base64 | tr -d '\n')"
export REMOTE_SCRIPT_B64

export SSH_HOST SSH_PORT SSH_USER SSH_KEY_PATH SSH_CONFIG_PATH SSH_PASSWORD SUDO_PASSWORD
export VERSION IMAGE_NAMESPACE DOMAIN BACKEND_PORT FRONTEND_PORT TRAEFIK_NETWORK SITE_ROOT
export MONGODB_URI ATLAS_USER ATLAS_DB_PASSWORD ATLAS_CLUSTER ATLAS_DB ATLAS_APP_NAME
export JWT_SECRET JWT_EXPIRES TOKEN_ENCRYPTION_KEY ADMIN_EMAIL ADMIN_PASSWORD ADMIN_FULLNAME
export ADMIN_SYNC_EXISTING DEMO_PASSWORD DEMO_SYNC_EXISTING ENABLE_SAMPLE_SEED

log "Uploading and executing remote deploy script over SSH"
if [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]]; then
  if [ -n "${MSYS2_ENV_CONV_EXCL:-}" ]; then
    export MSYS2_ENV_CONV_EXCL="${MSYS2_ENV_CONV_EXCL};SITE_ROOT"
  else
    export MSYS2_ENV_CONV_EXCL="SITE_ROOT"
  fi
fi
MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' "${PYTHON_BIN}" - <<'PYCODE'
import base64
import os
import shlex
import sys
import time

import paramiko

for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SSH_HOST_ALIAS = os.environ["SSH_HOST"]
ssh_port = int(os.environ["SSH_PORT"])
ssh_user = os.environ.get("SSH_USER", "").strip()
ssh_key_path = os.environ.get("SSH_KEY_PATH", "").strip()
ssh_password = os.environ.get("SSH_PASSWORD", "")
sudo_password = os.environ.get("SUDO_PASSWORD", "")
version = os.environ["VERSION"]
ssh_config_path = os.environ.get("SSH_CONFIG_PATH", "").strip()


def resolve_ssh_target():
    host_alias = SSH_HOST_ALIAS.strip()
    host = host_alias
    user = ssh_user
    port = ssh_port
    key_path = ssh_key_path

    config = None
    if ssh_config_path and os.path.exists(ssh_config_path):
        try:
            from paramiko.config import SSHConfig

            with open(ssh_config_path, "r", encoding="utf-8") as f:
                config = SSHConfig()
                config.parse(f)
        except Exception:
            config = None

    if config is not None:
        conf = config.lookup(host_alias)
        if conf.get("hostname"):
            host = conf["hostname"].strip()
        if conf.get("user"):
            user = conf["user"].strip() or user
        if conf.get("port"):
            try:
                port = int(conf["port"])
            except Exception:
                pass
        if (not key_path) and conf.get("identityfile"):
            identity_files = conf["identityfile"]
            if isinstance(identity_files, list) and identity_files:
                key_path = os.path.expanduser(identity_files[0])
            elif isinstance(identity_files, str):
                key_path = os.path.expanduser(identity_files)

    return host, port, user, key_path


ssh_host, ssh_port, ssh_user, ssh_key_path = resolve_ssh_target()

env_keys = [
    "IMAGE_NAMESPACE",
    "DOMAIN",
    "BACKEND_PORT",
    "FRONTEND_PORT",
    "TRAEFIK_NETWORK",
    "SITE_ROOT",
    "MONGODB_URI",
    "ATLAS_USER",
    "ATLAS_DB_PASSWORD",
    "ATLAS_CLUSTER",
    "ATLAS_DB",
    "ATLAS_APP_NAME",
    "JWT_SECRET",
    "JWT_EXPIRES",
    "TOKEN_ENCRYPTION_KEY",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
    "ADMIN_FULLNAME",
    "ADMIN_SYNC_EXISTING",
    "DEMO_PASSWORD",
    "DEMO_SYNC_EXISTING",
    "ENABLE_SAMPLE_SEED",
    "SUDO_PASSWORD",
]

remote_script = base64.b64decode(os.environ["REMOTE_SCRIPT_B64"]).decode("utf-8")
remote_path = f"/tmp/deploy-tungtran-{int(time.time())}.sh"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    connect_kwargs = dict(
        hostname=ssh_host,
        port=ssh_port,
        username=ssh_user,
        timeout=30,
        auth_timeout=30,
        look_for_keys=False,
        allow_agent=False,
    )
    if ssh_key_path:
        connect_kwargs["key_filename"] = ssh_key_path
    elif ssh_user:
        connect_kwargs["look_for_keys"] = True
    if ssh_password:
        connect_kwargs["password"] = ssh_password

    client.connect(**connect_kwargs)
except Exception as exc:
    print(f"[deploy] SSH connection failed: {exc}", file=sys.stderr)
    raise

def safe_print(text: str, is_err: bool = False):
    target = sys.stderr if is_err else sys.stdout
    try:
        target.write(text)
        target.flush()
    except UnicodeEncodeError:
        encoding = target.encoding or "utf-8"
        sanitized = text.encode(encoding, errors="replace").decode(encoding, errors="replace")
        target.write(sanitized)
        target.flush()


def run(command: str, check: bool = True):
    stdin, stdout, stderr = client.exec_command(command, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out:
        safe_print(out)
    if err:
        safe_print(err, is_err=True)
    if check and code != 0:
        raise RuntimeError(f"Command failed with code {code}: {command}")
    return code

try:
    sftp = client.open_sftp()
    with sftp.open(remote_path, "w") as f:
        f.write(remote_script)
    sftp.chmod(remote_path, 0o755)
    sftp.close()

    env_export = " ".join(
        f"{k}={shlex.quote(os.environ.get(k, ''))}" for k in env_keys
    )
    command = (
        f"env {env_export} "
        f"bash {shlex.quote(remote_path)} {shlex.quote(version)}"
    )
    run(command, check=True)
finally:
    try:
        run(f"rm -f {shlex.quote(remote_path)}", check=False)
    except Exception:
        pass
    client.close()
PYCODE

log "Completed: images pushed and remote deployment executed"
