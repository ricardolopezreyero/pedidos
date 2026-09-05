#!/bin/zsh
# Despliega a Cloudflare Pages sellando la versión del service worker — RLR
set -e
cd "$(dirname "$0")"
V=$(date +%Y%m%d-%H%M)
sed -i '' -E "s/const VERSION=\"[^\"]*\"/const VERSION=\"$V\"/" app/sw.js
echo "sw.js → versión $V"
npx wrangler pages deploy app --project-name ranita --branch main --commit-dirty=true
