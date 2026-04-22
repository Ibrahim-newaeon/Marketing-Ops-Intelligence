# syntax=docker/dockerfile:1.7

# ─── Stage 1: deps ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# ─── Stage 2: build ───────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# ─── Stage 3: runtime ─────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/dist ./dist
# Migrations are raw SQL — tsc doesn't emit them. Place them next to the
# compiled migrate.js so __dirname/migrations resolves correctly.
COPY --from=build --chown=app:app /app/core/db/migrations ./dist/core/db/migrations
# Agent definitions are markdown + frontmatter, not TS. agent_loader.ts
# resolves them as `<__dirname>/../../.claude/agents/*.md`, which maps to
# `dist/.claude/agents/` at runtime — mirror the layout into dist.
COPY --from=build --chown=app:app /app/.claude/agents ./dist/.claude/agents
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/dashboards/.next ./dashboards/.next
COPY --from=build --chown=app:app /app/dashboards/next.config.mjs ./dashboards/next.config.mjs
COPY --from=build --chown=app:app /app/config ./config
COPY --from=build --chown=app:app /app/memory ./memory
COPY --from=build --chown=app:app /app/entrypoint.sh ./entrypoint.sh
USER app
EXPOSE ${PORT:-3000}
HEALTHCHECK NONE
CMD ["sh", "entrypoint.sh"]
