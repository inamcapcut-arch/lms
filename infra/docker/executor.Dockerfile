# syntax=docker/dockerfile:1
# Multi-stage build for the code-execution worker.
# Build context MUST be the repository root: docker build -f infra/docker/executor.Dockerfile .
#
# IMPORTANT: the executor launches sandboxed language containers via the Docker
# Engine. It therefore needs access to the host Docker socket (mounted in
# compose) and the sandbox runner images (alex-python-runner, etc.) must be
# built/available on the host. This image does NOT run code itself; it only
# orchestrates short-lived sandbox containers.

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/executor/package.json apps/executor/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci

# ---- Build / runtime ----
# The executor runs via ts-node (see its package.json start script), so we keep
# the source and node_modules and generate the Prisma client.
FROM deps AS build
COPY . .
RUN npx prisma generate --schema packages/database/prisma/schema.prisma

FROM build AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/executor
CMD ["npx", "ts-node", "src/index.ts"]
