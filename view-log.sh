#!/usr/bin/env bash
# Family Portal — Access Log viewer wrapper
# Usage: ./view-log.sh

cd "$(dirname "$0")"

if ! command -v node &>/dev/null; then
  echo ""
  echo "❌  Node.js is not installed."
  echo "    Download it from: https://nodejs.org  (choose the LTS version)"
  echo ""
  exit 1
fi

node view-log.js
