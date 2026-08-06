FROM node:22.23.1-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run unit \
    && npm run build \
    && npm prune --omit=dev

FROM node:22.23.1-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --gid 10001 daymark \
    && useradd --uid 10001 --gid daymark --create-home --shell /usr/sbin/nologin daymark \
    && mkdir -p /var/lib/daymark/data /var/lib/daymark/backups /var/lib/daymark/logs \
    && chown -R daymark:daymark /var/lib/daymark

COPY --from=build --chown=root:root /app/package.json /app/package-lock.json ./
COPY --from=build --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/dist ./dist
COPY --from=build --chown=root:root /app/drizzle ./drizzle
COPY --from=build --chown=root:root /app/runtime ./runtime
COPY --from=build --chown=root:root /app/lib/runtime-health.ts ./lib/runtime-health.ts

USER daymark
EXPOSE 3210
VOLUME ["/var/lib/daymark"]

HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3210/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "--import", "tsx", "runtime/local/cli.ts", "start", "--app-dir", "/app", "--host", "0.0.0.0", "--port", "3210", "--data-dir", "/var/lib/daymark/data", "--backup-dir", "/var/lib/daymark/backups", "--log-dir", "/var/lib/daymark/logs"]
