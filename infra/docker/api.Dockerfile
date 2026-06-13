# syntax=docker/dockerfile:1
# Multi-stage build for the NestJS API in a Turborepo monorepo.
# Build context MUST be the repository root: docker build -f infra/docker/api.Dockerfile .

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci

# ---- Build ----
FROM deps AS build
COPY . .
# Prisma client must be generated before compiling consumers.
RUN npx prisma generate --schema packages/database/prisma/schema.prisma
RUN npx turbo run build --filter=api

# ---- Runtime ----
FROM base AS runtime
ENV NODE_ENV=production
# Copy installed node_modules and built artifacts.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages ./packages
WORKDIR /app/apps/api
EXPOSE 3001
# dumb-init-free graceful shutdown is handled by NestJS enableShutdownHooks.
CMD ["node", "dist/main.js"]
