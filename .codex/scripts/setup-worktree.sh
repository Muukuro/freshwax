#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Install Node.js 20.9 or newer, then rerun this script." >&2
  exit 1
fi

NODE_VERSION="$(node --version)"
NODE_VERSION="${NODE_VERSION#v}"
NODE_MAJOR="${NODE_VERSION%%.*}"
NODE_REST="${NODE_VERSION#*.}"
NODE_MINOR="${NODE_REST%%.*}"

case "$NODE_MAJOR" in
  ''|*[!0-9]*)
    echo "Could not parse Node.js version: $(node --version)" >&2
    exit 1
    ;;
esac

case "$NODE_MINOR" in
  ''|*[!0-9]*)
    echo "Could not parse Node.js version: $(node --version)" >&2
    exit 1
    ;;
esac

if [ "$NODE_MAJOR" -lt 20 ] || { [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -lt 9 ]; }; then
  echo "Node.js 20.9 or newer is required. Current version: $(node --version)" >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  perl -0pi -e 's#DATABASE_URL=postgresql://postgres:postgres\@postgres:5432/freshwax\?schema=public#DATABASE_URL=postgresql://postgres:postgres\@localhost:5432/freshwax?schema=public#' .env
  perl -0pi -e 's#REDIS_URL=redis://redis:6379#REDIS_URL=redis://localhost:6380#' .env
fi

npm ci
npx prisma validate
npx prisma generate

echo "Worktree setup complete."
echo "For runtime checks, start shared services from your main checkout with: docker compose up postgres redis"
