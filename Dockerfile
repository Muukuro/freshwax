FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
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
RUN npm cache clean --force \
  && rm -rf /root/.npm /app/node_modules/.cache /app/.next/cache
RUN chmod +x ./docker/entrypoint.sh
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["node", ".next/standalone/server.js"]
