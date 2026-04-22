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
# All runtime modules compute the project root as path.resolve(__dirname,
# "..", "..") — at runtime __dirname lives inside dist/, so anything
# referenced that way must sit under dist/ too. Mirror every non-TS asset
# the pipeline reads into dist/:
#   - core/db/migrations → dist/core/db/migrations  (migrate.js)
#   - .claude/agents     → dist/.claude/agents      (agent_loader.ts)
#   - config/            → dist/config              (anthropic_client.ts, clients fs-fallback)
#   - memory/            → dist/memory              (state.ts, routes.ts, timer.ts)
#   - CLAUDE.md          → dist/CLAUDE.md           (anthropic_client system prompt)
COPY --from=build --chown=app:app /app/core/db/migrations ./dist/core/db/migrations
COPY --from=build --chown=app:app /app/.claude/agents ./dist/.claude/agents
COPY --from=build --chown=app:app /app/config ./dist/config
COPY --from=build --chown=app:app /app/memory ./dist/memory
COPY --from=build --chown=app:app /app/CLAUDE.md ./dist/CLAUDE.md
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/dashboards/.next ./dashboards/.next
COPY --from=build --chown=app:app /app/dashboards/next.config.mjs ./dashboards/next.config.mjs
COPY --from=build --chown=app:app /app/entrypoint.sh ./entrypoint.sh
USER app
EXPOSE ${PORT:-3000}
HEALTHCHECK NONE
CMD ["sh", "entrypoint.sh"]
