# syntax=docker/dockerfile:1
# Multi-stage build for the Next.js web app (standalone output).
# Build context MUST be the repository root: docker build -f infra/docker/web.Dockerfile .

FROM node:22-bookworm-slim AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci

# ---- Build ----
FROM deps AS build
COPY . .
# NEXT_PUBLIC_* values are baked at build time; pass them as build args.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN npx prisma generate --schema packages/database/prisma/schema.prisma
RUN npx turbo run build --filter=web

# ---- Runtime (standalone) ----
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
# Next standalone output bundles only what is needed to run.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
