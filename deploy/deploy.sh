#!/usr/bin/env bash
# Deploy piket-menwa dari laptop ke VPS Helipod (frontend + API + DB, semua di /opt/piket-menwa):
#   API   : systemd piket-menwa (user piket, 127.0.0.1:3110, TZ Asia/Jakarta)
#   Web   : nginx VPS 127.0.0.1:8080 (dist/ + proxy /api /uploads) — deploy/nginx/piket-local.conf
#   Publik: nginx VPS tunnel (SSL + rate limit) -> tunnel SSH piket-tunnel -> 127.0.0.1:8080
# Alamat & domain dibaca dari deploy/deploy.env (lokal, di-gitignore) — salin dari deploy.env.example.
# VPS cuma ±1 GB RAM tanpa swap: JANGAN pnpm install di sana (pernah membuatnya beku). node_modules dirakit
# di laptop pakai Node yang sama dengan server (ABI better-sqlite3), dikirim hanya kalau pnpm-lock.yaml berubah.
# Yang TIDAK PERNAH ditimpa/dihapus di server: data/ (DB + uploads), .env, server/.vapid.json
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f deploy/deploy.env ] || { echo "deploy/deploy.env belum ada — salin dari deploy/deploy.env.example lalu isi."; exit 1; }
. deploy/deploy.env   # APP_URL, SERVER_SSH, SERVER_PORT
NODE_VER=v24.14.1     # samakan dengan /usr/local/bin/node di server
DIR=/opt/piket-menwa
RSH="ssh -p $SERVER_PORT -o BatchMode=yes"
remote() { $RSH "$SERVER_SSH" "$@" </dev/null; }

echo "==> build frontend"
pnpm build

echo "==> kirim kode + frontend"
rsync -a --delete -e "$RSH" \
  --exclude node_modules/ --exclude data/ --exclude uploads/ \
  --exclude .env --exclude 'server/.vapid.json' --exclude 'deploy/deploy.env' \
  --exclude 'deploy/compreface/.env' --exclude 'infra/compreface/.env' --exclude '*.db' --exclude '*.db-*' \
  --exclude 'face-lab*' --exclude opencode.json --exclude .git/ --exclude docs/ --exclude '*.apk' --exclude '*.zip' \
  ./ "$SERVER_SSH:$DIR/"

LOCAL_LOCK=$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)
if [ "$(remote "cat $DIR/node_modules/.lock-sha 2>/dev/null || true")" != "$LOCAL_LOCK" ]; then
  echo "==> pnpm-lock berubah: rakit node_modules produksi (Node $NODE_VER) di laptop"
  N="$HOME/.cache/piket-node/node-$NODE_VER-linux-x64"
  if [ ! -x "$N/bin/node" ]; then
    mkdir -p "$(dirname "$N")"
    curl -fsSL "https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-linux-x64.tar.xz" | tar -xJ -C "$(dirname "$N")"
  fi
  STAGE=$(mktemp -d); trap 'rm -rf "$STAGE"' EXIT
  cp package.json pnpm-lock.yaml pnpm-workspace.yaml "$STAGE/"
  (cd "$STAGE" && PATH="$N/bin:$PATH" npx -y pnpm@11.24.0 install --prod --frozen-lockfile >/dev/null)
  (cd "$STAGE" && PATH="$N/bin:$PATH" node -e "new (require('better-sqlite3'))(':memory:')")
  echo "$LOCAL_LOCK" > "$STAGE/node_modules/.lock-sha"
  rsync -a --delete -e "$RSH" "$STAGE/node_modules/" "$SERVER_SSH:$DIR/node_modules/"
fi

echo "==> restart API"
remote "chown -R piket:piket $DIR && chmod -R o+rX $DIR/dist && systemctl restart piket-menwa \
  && for i in \$(seq 1 30); do curl -sf http://127.0.0.1:8080/api/health && echo && exit 0; sleep 1; done; echo 'API gagal hidup'; exit 1"

echo "==> cek publik"
curl -sf "$APP_URL/api/health" && echo && curl -s -o /dev/null -w "web: %{http_code}\n" "$APP_URL/"
echo "Selesai: $APP_URL"
