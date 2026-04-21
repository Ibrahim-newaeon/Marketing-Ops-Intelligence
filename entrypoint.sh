#!/bin/sh
set -e

# Railway assigns PORT. Express API takes it (serves /api/* + proxies dashboard).
# Next.js dashboard runs on internal port 3001.
export DASHBOARD_PORT=4000

echo "[entrypoint] starting Next.js dashboard on port $DASHBOARD_PORT"
npx next start dashboards -p $DASHBOARD_PORT &
NEXT_PID=$!

# Wait for Next.js to be ready before starting Express (which proxies to it).
for i in 1 2 3 4 5 6 7 8 9 10; do
  if wget -q -O /dev/null http://127.0.0.1:$DASHBOARD_PORT/ 2>/dev/null; then
    echo "[entrypoint] Next.js ready"
    break
  fi
  echo "[entrypoint] waiting for Next.js... ($i)"
  sleep 2
done

echo "[entrypoint] starting Express API on port $PORT"
node dist/core/server/index.js &
EXPRESS_PID=$!

wait $NEXT_PID $EXPRESS_PID
