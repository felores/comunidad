FROM node:22.22.1-alpine3.22@sha256:764fa18a0649c8682db1a580ce075d8662b6fb0eb2f05221af2d13f2ff43c383 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

FROM dependencies AS build
COPY . .
RUN GOMAXPROCS=1 npm run build
RUN npm prune --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:22.22.1-alpine3.22@sha256:764fa18a0649c8682db1a580ce075d8662b6fb0eb2f05221af2d13f2ff43c383 AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S astro && adduser -S astro -G astro
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-ops ./ops
COPY package.json ./package.json
RUN chmod 0555 /app/ops/sp-load-coolify-secret /app/ops/start-coolify-secret-loader
USER astro
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4321/api/health >/dev/null || exit 1
CMD ["node", "./dist/server/entry.mjs"]
