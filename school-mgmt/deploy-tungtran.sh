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
#   SSH_HOST=192.168.100.237
#   SSH_PORT=22
#   SSH_USER=admin-001
#   SSH_KEY_PATH=~/.ssh/school-mgmt-deploy
#   SSH_PASSWORD=123456789
#   SUDO_PASSWORD=123456789
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
#   DEMO_PASSWORD=...
#   DEMO_SYNC_EXISTING=true

VERSION="${1:-version8-atlas-hotfix1}"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-vutheviet}"

DOMAIN="${DOMAIN:-tungtran.online}"
BACKEND_PORT="${BACKEND_PORT:-8092}"
FRONTEND_PORT="${FRONTEND_PORT:-8093}"
TRAEFIK_NETWORK="${TRAEFIK_NETWORK:-traefik-network}"
SITE_ROOT="${SITE_ROOT:-/opt/websites/sites}"

SSH_HOST="${SSH_HOST:-192.168.100.237}"
SSH_PORT="${SSH_PORT:-22}"
SSH_USER="${SSH_USER:-admin-001}"
DEFAULT_SSH_KEY_PATH=""
if [ -f "${HOME}/.ssh/school-mgmt-deploy" ]; then
  DEFAULT_SSH_KEY_PATH="${HOME}/.ssh/school-mgmt-deploy"
fi
SSH_KEY_PATH="${SSH_KEY_PATH:-$DEFAULT_SSH_KEY_PATH}"
SSH_PASSWORD="${SSH_PASSWORD:-123456789}"
SUDO_PASSWORD="${SUDO_PASSWORD:-$SSH_PASSWORD}"
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
DEMO_PASSWORD="${DEMO_PASSWORD:-Demo123456!}"
DEMO_SYNC_EXISTING="${DEMO_SYNC_EXISTING:-true}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_IMAGE="${IMAGE_NAMESPACE}/school-mgmt-backend:${VERSION}"
FRONTEND_IMAGE="${IMAGE_NAMESPACE}/school-mgmt-frontend:${VERSION}"

log() {
  echo "[deploy] $*"
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
DEMO_PASSWORD="${DEMO_PASSWORD:-Demo123456!}"
DEMO_SYNC_EXISTING="${DEMO_SYNC_EXISTING:-true}"

compose() {
  if sudo docker compose version >/dev/null 2>&1; then
    sudo docker compose "$@"
  else
    sudo docker-compose "$@"
  fi
}

log() {
  echo "[remote-deploy] $*"
}

log "Deploying ${DOMAIN}"
log "Version: ${VERSION}"
log "Backend image: ${BACKEND_IMAGE}"
log "Frontend image: ${FRONTEND_IMAGE}"

sudo mkdir -p "${SITE_DIR}"
cd "${SITE_DIR}"

if [ -f docker-compose.yml ] || [ -f docker-compose.yaml ]; then
  log "Stopping previous stack (if any)..."
  compose down --remove-orphans || true
fi

log "Preparing runtime folders..."
sudo mkdir -p uploads/attendance uploads/invoices uploads/students

log "Writing .env ..."
sudo tee .env >/dev/null <<EOF
NODE_ENV=development
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
DEMO_PASSWORD=${DEMO_PASSWORD}
DEMO_SYNC_EXISTING=${DEMO_SYNC_EXISTING}
EOF

log "Writing docker-compose.yml ..."
sudo tee docker-compose.yml >/dev/null <<EOF
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
      - "traefik.enable=false"

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
sudo docker pull "${BACKEND_IMAGE}"
sudo docker pull "${FRONTEND_IMAGE}"

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

log "Seeding sample data with /app/scripts/seed-all.js ..."
if ! sudo docker exec "${CONTAINER_NAME}-backend" node /app/scripts/seed-all.js; then
  log "seed-all.js failed. Check MONGODB_URI and backend logs."
fi

log "Normalizing demo passwords with /app/scripts/update-demo-passwords.js ..."
if ! sudo docker exec "${CONTAINER_NAME}-backend" node /app/scripts/update-demo-passwords.js; then
  log "update-demo-passwords.js failed. Continue deployment."
fi

log "Checking Cloudflared config..."
if [ -f /etc/cloudflared/config.yml ]; then
  if grep -q "hostname: ${DOMAIN}" /etc/cloudflared/config.yml; then
    log "Cloudflared already contains ${DOMAIN}."
  else
    log "Adding ${DOMAIN} + www.${DOMAIN} into /etc/cloudflared/config.yml ..."
    sudo sed -i "/- service: http_status:404/i\\
      - hostname: ${DOMAIN}\\
        service: http://127.0.0.1:80\\
        originRequest:\\
          noTLSVerify: true\\
          connectTimeout: 30s\\
          tlsTimeout: 30s\\
      - hostname: www.${DOMAIN}\\
        service: http://127.0.0.1:80\\
        originRequest:\\
          noTLSVerify: true\\
          connectTimeout: 30s\\
          tlsTimeout: 30s" /etc/cloudflared/config.yml
  fi

  log "Restarting cloudflared..."
  sudo systemctl restart cloudflared || true
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

export SSH_HOST SSH_PORT SSH_USER SSH_KEY_PATH SSH_PASSWORD SUDO_PASSWORD
export VERSION IMAGE_NAMESPACE DOMAIN BACKEND_PORT FRONTEND_PORT TRAEFIK_NETWORK SITE_ROOT
export MONGODB_URI ATLAS_USER ATLAS_DB_PASSWORD ATLAS_CLUSTER ATLAS_DB ATLAS_APP_NAME
export JWT_SECRET JWT_EXPIRES TOKEN_ENCRYPTION_KEY ADMIN_EMAIL ADMIN_PASSWORD ADMIN_FULLNAME
export DEMO_PASSWORD DEMO_SYNC_EXISTING

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

ssh_host = os.environ["SSH_HOST"]
ssh_port = int(os.environ["SSH_PORT"])
ssh_user = os.environ["SSH_USER"]
ssh_key_path = os.environ.get("SSH_KEY_PATH", "").strip()
ssh_password = os.environ.get("SSH_PASSWORD", "")
sudo_password = os.environ.get("SUDO_PASSWORD", "")
version = os.environ["VERSION"]

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
    "DEMO_PASSWORD",
    "DEMO_SYNC_EXISTING",
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
        if ssh_password:
            connect_kwargs["password"] = ssh_password
            connect_kwargs["passphrase"] = ssh_password
    else:
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
    stdin, stdout, stderr = client.exec_command("sudo -n true", get_pty=True)
    stdout.read()
    stderr.read()
    sudo_no_password = stdout.channel.recv_exit_status() == 0

    if sudo_no_password:
        command = (
            f"sudo -n env {env_export} "
            f"bash {shlex.quote(remote_path)} {shlex.quote(version)}"
        )
    elif sudo_password:
        command = (
            f"printf '%s\\n' {shlex.quote(sudo_password)} | sudo -S env {env_export} "
            f"bash {shlex.quote(remote_path)} {shlex.quote(version)}"
        )
    else:
        raise RuntimeError(
            "sudo requires a password, but SUDO_PASSWORD is empty. "
            "Provide SUDO_PASSWORD or configure passwordless sudo."
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
