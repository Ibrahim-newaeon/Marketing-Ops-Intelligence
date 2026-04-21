#!/bin/sh
set -e

# Railway assigns PORT. Express API takes it (serves /api/* + healthcheck).
# Next.js dashboard runs on internal port 3001.
export DASHBOARD_PORT=3001

node dist/core/server/index.js &
npx next start dashboards -p $DASHBOARD_PORT &

wait
