#!/usr/bin/env bash
# Deploy NexusCart to the self-hosted server at https://nexuscart.surflextechnology.in
#
#   storefront -> /home/surflex/subdomains/nexuscart.surflextechnology.in/        (static, Apache)
#   admin      -> /home/surflex/subdomains/nexuscart.surflextechnology.in/admin/  (static, Apache)
#   backend    -> /opt/nexuscart-backend  (pm2 "nexuscart-backend" on 127.0.0.1:3000,
#                 Apache proxies /api/ and /uploads/ to it; .env lives only on the server)
#
# Usage (Git Bash):  ./deploy-surflex.sh [storefront] [admin] [backend]   (no args = all three)
set -euo pipefail

KEY="${SURFLEX_KEY:-$HOME/.ssh/surflex_deploy}"
SSH=(ssh -i "$KEY" -p 46213 -o IdentitiesOnly=yes -o BatchMode=yes root@103.184.242.89)
DOCROOT=/home/surflex/subdomains/nexuscart.surflextechnology.in
ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGETS=("${@:-storefront admin backend}")
TARGETS=(${TARGETS[*]})

spa_htaccess() { # $1 = base path, e.g. "/" or "/admin/"
  cat <<EOF
Options -MultiViews
RewriteEngine On
RewriteBase $1
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_URI} !^/\.well-known/
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . ${1}index.html [L]

<IfModule mod_headers.c>
  <FilesMatch "^index\.html$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </FilesMatch>
</IfModule>
EOF
}

for t in "${TARGETS[@]}"; do
  case "$t" in
    storefront)
      echo "==> storefront"
      (cd "$ROOT" && npx vite build --mode surflex)
      spa_htaccess / > "$ROOT/dist/.htaccess"
      tar -C "$ROOT/dist" -czf - . | "${SSH[@]}" "D=$DOCROOT; rm -rf \$D/assets && tar --no-same-owner --no-overwrite-dir -xzf - -C \$D && chown -R surflex:surflex \$D/assets \$D/index.html \$D/.htaccess"
      ;;
    admin)
      echo "==> admin"
      (cd "$ROOT/admin" && npx vite build --mode surflex)
      spa_htaccess /admin/ > "$ROOT/admin/dist/.htaccess"
      tar -C "$ROOT/admin/dist" -czf - . | "${SSH[@]}" "A=$DOCROOT/admin; rm -rf \$A && mkdir -p \$A && tar --no-same-owner -xzf - -C \$A && chown -R surflex:surflex \$A"
      ;;
    backend)
      echo "==> backend"
      (cd "$ROOT/backend" && tar -czf - src prisma package.json package-lock.json tsconfig*.json nest-cli.json) \
        | "${SSH[@]}" "cd /opt/nexuscart-backend && rm -rf src prisma && tar -xzf - && npm ci --no-audit --no-fund && npx prisma generate && npm run build && npx prisma migrate deploy && pm2 restart nexuscart-backend --update-env && pm2 save"
      ;;
    *) echo "unknown target: $t (use storefront, admin, backend)"; exit 1 ;;
  esac
done

echo "==> done: https://nexuscart.surflextechnology.in  (admin: /admin/)"
