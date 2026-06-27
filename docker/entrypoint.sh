#!/bin/sh
set -eu

missing_vars=""

for var_name in APP_URL DATABASE_URL REDIS_URL; do
  eval "var_value=\${$var_name:-}"
  if [ -z "$var_value" ]; then
    missing_vars="${missing_vars} ${var_name}"
  fi
done

if [ -n "$missing_vars" ]; then
  echo "Freshwax is missing required environment variables:${missing_vars}" >&2
  exit 1
fi

exec "$@"
