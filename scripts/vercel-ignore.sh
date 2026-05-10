#!/usr/bin/env bash
# ============================================================================
# Vercel ignore-build hook
# ============================================================================
# Skip the build entirely on gh-pages (which only contains the dist output
# pushed by the npm gh-pages package — no source files, no node_modules).
#
# Vercel convention :
#   - exit 0 → skip build (good for us on gh-pages)
#   - exit 1 → proceed with build (everything else)
# ============================================================================

set -e

BRANCH="${VERCEL_GIT_COMMIT_REF:-unknown}"

if [[ "$BRANCH" == "gh-pages" ]]; then
  echo "🛑 Branch '$BRANCH' is a build-output branch — skipping Vercel build."
  exit 0
fi

# Otherwise build
echo "✅ Branch '$BRANCH' will be built."
exit 1
