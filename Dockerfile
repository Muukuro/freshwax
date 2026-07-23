FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN node -e "const lock = require('./package-lock.json'); const prisma = lock.packages['node_modules/prisma']?.version; const client = lock.packages['node_modules/@prisma/client']?.version; if (!prisma || !client || prisma !== client) { throw new Error(\`Prisma CLI (\${prisma ?? 'missing'}) and @prisma/client (\${client ?? 'missing'}) must resolve to the same version\`); }" \
  && npm ci

FROM base AS prisma-tool
COPY package-lock.json ./
RUN PRISMA_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
  && npm install --prefix /opt/prisma-cli --omit=dev --no-audit --no-fund --no-package-lock "prisma@${PRISMA_VERSION}" \
  && npm cache clean --force \
  && rm -rf /root/.npm

FROM deps AS builder
COPY . .
RUN npx prisma generate
ARG BUILD_APP_URL=http://127.0.0.1:3000
ARG BUILD_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/freshwax?schema=public
ARG BUILD_REDIS_URL=redis://localhost:6379
RUN APP_URL="$BUILD_APP_URL" \
  DATABASE_URL="$BUILD_DATABASE_URL" \
  REDIS_URL="$BUILD_REDIS_URL" \
  npm run build
RUN npx esbuild src/worker.ts \
  --bundle \
  --platform=node \
  --format=cjs \
  --target=node24 \
  --external:@prisma/client \
  --outfile=.next/standalone/worker.cjs
RUN mkdir -p .next/standalone/.next \
  && cp -R .next/static .next/standalone/.next/static \
  && cp -R public .next/standalone/public

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
COPY --from=prisma-tool /opt/prisma-cli /opt/prisma-cli
COPY prisma ./prisma
COPY docker ./docker
COPY --from=builder /app/.next/standalone ./.next/standalone
COPY scripts/prepare-prisma-migrations.mjs ./.next/standalone/scripts/prepare-prisma-migrations.mjs
RUN chmod +x ./docker/entrypoint.sh \
  && rm -rf /app/.next/standalone/.next/cache
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["node", "docker/start-production.mjs"]
