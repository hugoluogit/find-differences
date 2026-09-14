#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

APP_URL="https://test-ai-find-differences.vercel.app"
echo "=== Deploying to STAGING: $APP_URL ==="

# Link to staging project (create if not exists)
npx vercel link --project test-ai-find-differences --yes 2>/dev/null || (
  echo "Creating project test-ai-find-differences..."
  npx vercel project add test-ai-find-differences --yes
)

# Deploy with staging env vars
npx vercel --prod --yes --archive=tgz \
  --build-env APP_URL="$APP_URL" \
  --build-env EXPO_PUBLIC_API_URL="$APP_URL"

echo "=== Staging deployed: $APP_URL ==="
