#!/usr/bin/env bash
# Sinkronkan folder aplikasi ini ke repo rilis `nasaq-id/piket-menwa` lewat `git subtree split`.
#
# PENTING: push ke branch `master` repo rilis MEMICU GitHub Actions `deploy` yang langsung
# men-deploy ke VPS produksi (build web + rsync + restart API). Karena itu skrip ini minta
# konfirmasi dulu, dan menolak push kalau riwayatnya bukan fast-forward (tidak pernah force-push).
#
# Pemakaian:
#   deploy/sinkron-mirror.sh --dry-run      # lihat commit yang akan dikirim (tanpa push)
#   deploy/sinkron-mirror.sh                # tampilkan ringkasan, minta konfirmasi, lalu push
#   deploy/sinkron-mirror.sh --yes          # tanpa tanya (untuk otomatisasi)
#   deploy/sinkron-mirror.sh --yes --watch  # tunggu workflow deploy sampai selesai
#
# Opsi lain:
#   --allow-dirty   izinkan ada perubahan belum di-commit di folder aplikasi (perubahan itu
#                   TIDAK ikut tersinkron; hanya commit yang sudah ada yang dikirim)
#
# Env:
#   MIRROR_URL      default https://github.com/nasaq-id/piket-menwa.git
#   MIRROR_BRANCH   default master
#
# Catatan auth: default pakai HTTPS; kredensial dari `gh auth setup-git` (helper gh).
# Kalau push ditolak, jalankan `gh auth login` / `gh auth setup-git` lebih dulu.
set -euo pipefail

DEFAULT_MIRROR_URL="https://github.com/nasaq-id/piket-menwa.git"
DEFAULT_MIRROR_BRANCH="master"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(git -C "$APP_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
MIRROR_URL="${MIRROR_URL:-$DEFAULT_MIRROR_URL}"
MIRROR_BRANCH="${MIRROR_BRANCH:-$DEFAULT_MIRROR_BRANCH}"

DRY_RUN=0
ASSUME_YES=0
WATCH=0
ALLOW_DIRTY=0

usage() {
  sed -n '2,27p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --yes|-y) ASSUME_YES=1 ;;
    --watch) WATCH=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Opsi tidak dikenal: $1" >&2; echo; usage >&2; exit 2 ;;
  esac
  shift
done

die() { echo "GAGAL: $*" >&2; exit 1; }

[ -n "$ROOT" ] || die "bukan git repository: $APP_DIR"
command -v git >/dev/null 2>&1 || die "git tidak ditemukan"

# Folder aplikasi harus berada di dalam monorepo (bukan di root repo rilis).
PREFIX="$(realpath --relative-to="$ROOT" "$APP_DIR")"
[ "$PREFIX" != "." ] || die "jalankan dari dalam monorepo (folder aplikasi harus di subfolder)"

echo "App     : $APP_DIR"
echo "Repo    : $ROOT"
echo "Prefix  : $PREFIX"
echo "Rilis   : $MIRROR_URL ($MIRROR_BRANCH)"
echo

# --- 1. Pastikan tidak ada perubahan belum di-commit di folder aplikasi ---------------
DIRTY="$(git -C "$ROOT" status --porcelain -- "$PREFIX")"
if [ -n "$DIRTY" ]; then
  if [ "$ALLOW_DIRTY" = 1 ]; then
    echo "PERINGATAN: ada perubahan belum di-commit (TIDAK ikut tersinkron):"
    echo "$DIRTY" | sed 's/^/  /' | head -15
    echo
  else
    echo "Ada perubahan belum di-commit di $PREFIX:" >&2
    echo "$DIRTY" | sed 's/^/  /' | head -15 >&2
    echo >&2
    die "commit dulu (atau pakai --allow-dirty kalau perubahan itu memang tidak mau dikirim)"
  fi
fi

# --- 2. Hitung subtree split ---------------------------------------------------------
TMP_BRANCH="tmp-sinkron-mirror-$$"
cleanup() { git -C "$ROOT" branch -D "$TMP_BRANCH" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> menghitung subtree split (bisa beberapa detik)..."
SPLIT_SHA="$(git -C "$ROOT" subtree split --prefix "$PREFIX" -b "$TMP_BRANCH" 2>/dev/null | tail -1 || true)"
[[ "$SPLIT_SHA" =~ ^[0-9a-f]{40}$ ]] || die "gagal subtree split (prefix: $PREFIX)"
echo "    split commit: $SPLIT_SHA"

# --- 3. Cek fast-forward terhadap repo rilis -----------------------------------------
REMOTE_SHA="$(git ls-remote --heads "$MIRROR_URL" "$MIRROR_BRANCH" 2>/dev/null | awk '{print $1}' | head -1 || true)"
if [ -n "$REMOTE_SHA" ]; then
  echo "    rilis sekarang: $REMOTE_SHA"
  git -C "$ROOT" merge-base --is-ancestor "$REMOTE_SHA" "$SPLIT_SHA" 2>/dev/null \
    || die "riwayat bercabang dari repo rilis — tidak mau force-push. Selesaikan manual dulu."
  RANGE="$REMOTE_SHA..$SPLIT_SHA"
else
  echo "    branch $MIRROR_BRANCH belum ada di repo rilis (push pertama)"
  RANGE="$SPLIT_SHA"
fi

COUNT="$(git -C "$ROOT" rev-list --count "$RANGE")"
if [ "$COUNT" -eq 0 ]; then
  echo "==> sudah sinkron, tidak ada yang perlu dikirim. Selesai."
  exit 0
fi

echo
echo "Commit yang akan dikirim ($COUNT):"
git -C "$ROOT" log --format='  %h %s' -15 "$RANGE"
[ "$COUNT" -gt 15 ] && echo "  ... (+$((COUNT - 15)) commit lagi)"
echo
echo "!! Push ke $MIRROR_BRANCH akan memicu GitHub Actions 'deploy' -> VPS PRODUKSI."
echo "!! (build web + rsync + restart API; data/.env/uploads tidak disentuh)"
echo

if [ "$DRY_RUN" = 1 ]; then
  echo "[dry-run] tidak mengirim apa pun. Perintah yang akan dijalankan:"
  echo "  git push $MIRROR_URL $TMP_BRANCH:$MIRROR_BRANCH"
  exit 0
fi

# --- 4. Konfirmasi -------------------------------------------------------------------
if [ "$ASSUME_YES" != 1 ]; then
  [ -t 0 ] || die "mode non-interaktif: pakai --yes kalau memang mau push + deploy"
  printf "Lanjut sync + deploy sekarang? ketik 'ya': "
  read -r ANSWER || true
  [ "$ANSWER" = "ya" ] || { echo "Dibatalkan (tidak ada yang dikirim)."; exit 1; }
fi

# --- 5. Push -------------------------------------------------------------------------
echo
echo "==> push ke repo rilis..."
GIT_TERMINAL_PROMPT=0 git -C "$ROOT" push "$MIRROR_URL" "$TMP_BRANCH:$MIRROR_BRANCH"
echo "    OK: $MIRROR_BRANCH -> $SPLIT_SHA"

# Rapikan remote-tracking ref kalau remote-nya memang terdaftar dengan URL yang sama.
normalize_url() {
  printf '%s' "$1" \
    | sed -E 's#^git@github\.com:#https://github.com/#; s#^ssh://git@github\.com/#https://github.com/#' \
    | sed -E 's#\.git$##; s#/+$##'
}
REMOTE_URL="$(git -C "$ROOT" remote get-url piket-menwa 2>/dev/null || true)"
if [ -n "$REMOTE_URL" ] && [ "$(normalize_url "$REMOTE_URL")" = "$(normalize_url "$MIRROR_URL")" ]; then
  git -C "$ROOT" update-ref "refs/remotes/piket-menwa/$MIRROR_BRANCH" "$SPLIT_SHA"
fi

# --- 6. Info / pantau workflow deploy --------------------------------------------------
SLUG="$(normalize_url "$MIRROR_URL" | sed -E 's#^https://github\.com/##')"
echo
if command -v gh >/dev/null 2>&1 && [ -n "$SLUG" ]; then
  echo "Menunggu run GitHub Actions terdeteksi..."
  RUN_ID=""
  for _ in $(seq 1 12); do
    RUN_ID="$(gh run list --repo "$SLUG" --branch "$MIRROR_BRANCH" --limit 5 \
      --json databaseId,headSha --jq ".[] | select(.headSha == \"$SPLIT_SHA\") | .databaseId" 2>/dev/null | head -1 || true)"
    [ -n "$RUN_ID" ] && break
    sleep 5
  done
  if [ -n "$RUN_ID" ]; then
    echo "Run deploy: https://github.com/$SLUG/actions/runs/$RUN_ID"
    if [ "$WATCH" = 1 ]; then
      gh run watch "$RUN_ID" --repo "$SLUG" --exit-status --interval 5
      echo "==> deploy SUKSES."
    else
      echo "Pantau: gh run watch $RUN_ID --repo $SLUG"
    fi
  else
    echo "Run belum terdeteksi. Cek: gh run list --repo $SLUG"
  fi
else
  echo "gh tidak tersedia; pantau deploy di: https://github.com/$SLUG/actions"
fi
