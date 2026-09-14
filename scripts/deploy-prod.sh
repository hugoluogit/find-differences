#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

APP_URL="https://ai-find-differences.vercel.app"
echo "=== Deploying to PRODUCTION: $APP_URL ==="

# Link to production project
npx vercel link --project ai-find-differences --yes

# Deploy (no build-env needed — fallback values in code match production URLs)
npx vercel --prod --yes --archive=tgz

echo "=== Production deployed: $APP_URL ==="
