# syntax=docker/dockerfile:1.7
# Image worker Kira: antrean job AI (Claude Code CLI atau OpenAI-compatible), impor PDF (poppler),
# kotak keluar email, laporan mingguan, retensi data. Dibangun dari root repo: docker compose build worker

ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1
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
RUN --mount=type=cache,id=kira-pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @kira/worker...

FROM deps AS build
COPY . .
RUN pnpm --filter @kira/worker build

FROM ${NODE_IMAGE} AS run
# poppler-utils: pdftotext dan pdftoppm untuk impor paket PDF. Claude Code CLI versi yang sudah diuji worker.
ARG CLAUDE_CODE_VERSION=2.1.295
RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
 && npm cache clean --force
ENV NODE_ENV=production KIRA_DATA_DIR=/data KIRA_CONTENT_DIR=/app/content CLAUDE_BIN=claude DISABLE_AUTOUPDATER=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/worker/dist ./dist
# Konten repo (skill, soal, bacaan, registri sumber): job tts.batch membaca teks bahasa Inggris dari sini untuk membuat suaranya,
# dan pembaruan mingguan sumber soal membaca registri sumber.
COPY --from=build --chown=node:node /repo/content ./content
RUN mkdir -p /data && chown node:node /data
USER node
HEALTHCHECK --interval=60s --timeout=5s --start-period=60s --retries=3 \
  CMD test $(( $(date +%s) - $(stat -c %Y /tmp/kira-worker-alive) )) -lt 90
CMD ["node", "dist/index.mjs"]
