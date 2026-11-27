#!/usr/bin/env bash
# Starts the database, builds and starts nodehub (backend + dashboard) on Linux.
# The Linux counterpart of start.cmd, for an office server running Ubuntu or another distribution.
#
#   ./start.sh            database in Docker (docker-compose.yml), like start.cmd
#   ./start.sh --no-docker  PostgreSQL already installed: uses DATABASE_URL from backend/.env as is
set -euo pipefail
cd "$(dirname "$0")"

use_docker=1
case "${1:-}" in
  --no-docker) use_docker=0 ;;
  '') ;;
  *) echo "Usage: ./start.sh [--no-docker]" >&2; exit 1 ;;
esac

fail() { echo "$1" >&2; exit 1; }

[ -f backend/.env ] || fail "backend/.env is missing. Copy backend/.env.example to backend/.env and fill in JWT_SECRET."
command -v node >/dev/null || fail "Node.js is not installed (22 or later is needed)."

# The backend looks for tailscale.exe in Program Files by default; on Linux, use the one on the PATH
if [ -z "${TAILSCALE_BIN:-}" ] && ! grep -q '^TAILSCALE_BIN=' backend/.env; then
  command -v tailscale >/dev/null || fail "Tailscale is not installed (https://tailscale.com/download/linux)."
  export TAILSCALE_BIN="$(command -v tailscale)"
fi

if [ "$use_docker" = 1 ]; then
  command -v docker >/dev/null || fail "Docker is not installed. Install it, or run ./start.sh --no-docker with your own PostgreSQL."
  echo "Starting the database..."
  docker compose up -d --wait || fail "Could not start the database (is the Docker service running?)."
fi

[ -d backend/node_modules ]  || (cd backend && npm install)
[ -d frontend/node_modules ] || (cd frontend && npm install)

cd backend
npx prisma migrate deploy
# Creates the first admin only when there are no users yet (password printed once)
npm run seed
cd ..

(cd frontend && npm run build)
cd backend
npm run build

# exec: the backend replaces this script, so systemd (or Ctrl+C) stops it directly
exec npm start
