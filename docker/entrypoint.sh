#!/bin/sh
set -eu

missing_vars=""

for var_name in DATABASE_URL REDIS_URL; do
  eval "var_value=\${$var_name:-}"
  if [ -z "$var_value" ]; then
    missing_vars="${missing_vars} ${var_name}"
  fi
done

if [ -n "$missing_vars" ]; then
  echo "Freshwax is missing required environment variables:${missing_vars}" >&2
  echo "Set DATABASE_URL to a PostgreSQL connection string and REDIS_URL to a Redis connection string." >&2
  echo "APP_URL is optional for local port-mapped containers and defaults to http://127.0.0.1:3000." >&2
  exit 1
fi

exec "$@"
