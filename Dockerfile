FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

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
RUN mkdir -p .next/standalone/.next \
  && cp -R .next/static .next/standalone/.next/static \
  && cp -R public .next/standalone/public

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force \
  && rm -rf /root/.npm /app/node_modules/.cache
COPY prisma ./prisma
RUN npx prisma generate \
  && rm -rf /root/.npm /app/node_modules/.cache
COPY tsconfig.json ./
COPY src ./src
COPY docker ./docker
COPY --from=builder /app/.next/standalone ./.next/standalone
RUN chmod +x ./docker/entrypoint.sh \
  && rm -rf /app/.next/standalone/.next/cache
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["node", "docker/start-production.mjs"]
