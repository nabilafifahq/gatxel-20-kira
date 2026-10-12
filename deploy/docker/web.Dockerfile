# syntax=docker/dockerfile:1.7
# Image web Kira: Next.js standalone, konten soal, migrasi SQL, dan alat admin.
# Dibangun dari root repo: docker compose build web

ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1 CI=1
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/content/package.json packages/content/
COPY packages/db/package.json packages/db/
COPY packages/figures/package.json packages/figures/
COPY e2e/package.json e2e/
RUN --mount=type=cache,id=kira-pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Alamat publik (Tailscale) masuk ke konfigurasi Server Actions saat build; lihat next.config.ts.
ARG KIRA_ORIGIN=
ENV KIRA_ORIGIN=${KIRA_ORIGIN}
RUN pnpm --filter @kira/web build
RUN mkdir -p /repo/tools-dist \
 && for t in migrate admin; do \
      pnpm --filter @kira/worker exec esbuild "../../packages/db/scripts/$t.ts" --bundle --platform=node --format=esm --target=node22 \
        --outfile="/repo/tools-dist/$t.mjs" --log-level=warning \
        "--banner:js=import { createRequire as __r } from 'node:module'; const require = __r(import.meta.url);" ; \
    done

FROM ${NODE_IMAGE} AS run
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    KIRA_CONTENT_DIR=/app/content KIRA_MIGRATIONS_DIR=/app/migrations KIRA_DATA_DIR=/data
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
COPY --from=build --chown=node:node /repo/content ./content
COPY --from=build --chown=node:node /repo/packages/db/migrations ./migrations
COPY --from=build --chown=node:node /repo/tools-dist ./tools
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
