# Codex Local Environment

Use this repo's Codex local environment for managed worktrees.

Setup script:

```bash
.codex/scripts/setup-worktree.sh
```

Useful actions:

```bash
npm run lint
npm run build
npm run dev
npm run dev:worker
npx prisma db push
npm run prisma:seed
```

The setup script creates a host-local `.env` only when one does not already
exist. To copy your existing ignored `.env` into new Codex-managed worktrees,
add `.env` to a root `.worktreeinclude` file.

PostgreSQL and Redis are shared host services. Start them from your main
checkout when needed:

```bash
docker compose up postgres redis
```
