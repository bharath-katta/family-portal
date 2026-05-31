#!/usr/bin/env bash
# Family Portal — Build wrapper
# Usage: ./build.sh

cd "$(dirname "$0")"

# Check Node.js is available
if ! command -v node &>/dev/null; then
  echo ""
  echo "❌  Node.js is not installed."
  echo "    Download it from: https://nodejs.org  (choose the LTS version)"
  echo ""
  exit 1
fi

node build.js
