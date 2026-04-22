#!/bin/sh
set -e

# Railway assigns PORT. Express API takes it (serves /api/* + proxies dashboard).
# Next.js dashboard runs on internal port 4000.
# INTERNAL_API_PORT is a snapshot of Express's port that the dashboard SSR
# code reads — Next.js overwrites process.env.PORT with its -p value, so we
# can't rely on PORT inside the Next.js process.
export DASHBOARD_PORT=4000
export INTERNAL_API_PORT=${PORT:-3000}

# Run DB migrations before anything else if DATABASE_URL is set. Idempotent
# — migrate.js tracks applied filenames in schema_migrations.
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] running db migrations"
  node dist/core/db/migrate.js || {
    echo "[entrypoint] db migrations failed — aborting"
    exit 1
  }
else
  echo "[entrypoint] DATABASE_URL not set — skipping migrations (clients adapter will fall back to filesystem)"
fi

# Start Express FIRST. /api/health must respond to Railway's healthcheck
# ASAP — before Next.js finishes its (~2–10s) cold start. Non-API routes
# will 502 briefly until Next.js is up; that's fine, they're not on the
# healthcheck path. This matters on Railway because the deploy
# healthcheck timeout is short and the container is killed if /api/health
# doesn't answer in time.
echo "[entrypoint] starting Express API on port $PORT (INTERNAL_API_PORT=$INTERNAL_API_PORT)"
node dist/core/server/index.js &
EXPRESS_PID=$!

echo "[entrypoint] starting Next.js dashboard on port $DASHBOARD_PORT"
npx next start dashboards -p $DASHBOARD_PORT &
NEXT_PID=$!

# Block on Express specifically — it's what Railway's healthcheck hits.
# If Express dies, kill Next.js and exit so Railway restarts the
# container. If Next.js dies first we keep Express alive so /api/health
# still answers; Express's proxy will return 502 on dashboard requests
# (visible, recoverable) rather than the whole container cycling.
# `wait -n` is not portable to BusyBox ash, so we explicitly wait on
# the Express pid.
wait $EXPRESS_PID
EXIT_CODE=$?
echo "[entrypoint] Express exited with code $EXIT_CODE — tearing down Next.js"
kill $NEXT_PID 2>/dev/null || true
wait 2>/dev/null || true
exit $EXIT_CODE
