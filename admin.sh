#!/usr/bin/env bash
# Family Portal — Admin tool wrapper
# Usage: ./admin.sh

cd "$(dirname "$0")"

if ! command -v node &>/dev/null; then
  echo ""
  echo "❌  Node.js is not installed."
  echo "    Download it from: https://nodejs.org  (choose the LTS version)"
  echo ""
  exit 1
fi

if [ ! -f src/config.json ]; then
  echo ""
  echo "❌  src/config.json not found. Nothing to administer yet."
  echo ""
  exit 1
fi

node admin.js
