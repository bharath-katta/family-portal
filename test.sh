#!/usr/bin/env bash
# Family Portal — Safari smoke test wrapper
# Usage: ./test.sh
# One-time setup (needs your Mac password, run once ever): sudo safaridriver --enable

cd "$(dirname "$0")"

if ! command -v node &>/dev/null; then
  echo ""
  echo "❌  Node.js is not installed."
  echo "    Download it from: https://nodejs.org  (choose the LTS version)"
  echo ""
  exit 1
fi

if ! command -v safaridriver &>/dev/null; then
  echo ""
  echo "❌  safaridriver not found — this test requires macOS + Safari."
  echo ""
  exit 1
fi

node test/smoke-test.js
