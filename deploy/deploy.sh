#!/usr/bin/env bash
# Deploy piket-menwa dari laptop:
#   API  -> mini PC  ~/apps/piket-menwa  (systemd user: piket-menwa, piket-tunnel; CompreFace: deploy/compreface)
#   Web  -> VPS VPS_HOST /var/www/piket-menwa (nginx), dikirim lewat mini PC
# Publik: https://piket.example.com
# Yang TIDAK PERNAH ditimpa/dihapus di mini PC: data/ (DB + uploads), .env, server/.vapid.json, deploy/compreface/.env
set -euo pipefail
cd "$(dirname "$0")/.."
URL=https://piket.example.com

echo "==> build frontend"
pnpm build

echo "==> kirim kode ke mini PC"
rsync -a --delete \
  --exclude node_modules/ --exclude dist/ --exclude data/ --exclude uploads/ \
  --exclude .env --exclude 'server/.vapid.json' --exclude 'deploy/compreface/.env' \
  --exclude 'infra/compreface/.env' --exclude '*.db' --exclude '*.db-*' \
  --exclude 'face-lab*' --exclude opencode.json \
  ./ minipc:apps/piket-menwa/

echo "==> install dependency & restart API"
ssh minipc 'cd ~/apps/piket-menwa && npx -y pnpm@11.24.0 install --prod --frozen-lockfile >/dev/null \
  && systemctl --user restart piket-menwa \
  && for i in $(seq 1 30); do curl -sf http://127.0.0.1:3110/api/health && echo && exit 0; sleep 2; done; echo "API gagal hidup"; exit 1' </dev/null

echo "==> kirim frontend ke VPS"
rsync -a --delete dist/ minipc:apps/piket-menwa/dist/
ssh minipc 'rsync -a --delete ~/apps/piket-menwa/dist/ root@VPS_HOST:/var/www/piket-menwa/' </dev/null

echo "==> cek publik"
curl -sf "$URL/api/health" && echo && curl -s -o /dev/null -w "web: %{http_code}\n" "$URL/"
echo "Selesai: $URL"
