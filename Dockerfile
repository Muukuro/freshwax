FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
RUN mkdir -p .next/standalone/.next \
  && cp -R .next/static .next/standalone/.next/static \
  && cp -R public .next/standalone/public
RUN chmod +x ./docker/entrypoint.sh
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["node", ".next/standalone/server.js"]
