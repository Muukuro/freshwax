#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

rm -rf \
  .next \
  node_modules \
  node_modules/.prisma \
  .prisma

echo "Removed worktree-local dependency and build caches."
echo "Run .codex/scripts/setup-worktree.sh before building or running the app again."
