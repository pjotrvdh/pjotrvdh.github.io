#!/usr/bin/env bash
# Runs the Vite dev server inside the DDEV web container (see web_extra_daemons in config.yaml).
# node_modules is shared with the host, and Vite's native bundler is per platform: when the
# installed packages were made for another platform (or are missing), reinstall them first.
set -e
cd /var/www/html
if ! node --input-type=module -e "await import('rolldown')" >/dev/null 2>&1; then
    npm ci --no-audit --no-fund
fi
exec npm run dev
