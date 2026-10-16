# Brief untuk opencode — polish UI/UX piket-menwa

Kamu mengerjakan rencana di `docs/RENCANA-POLISH-UI.md`. Sesi Claude Code (reviewer) mengirim tugas lewat sesi ini dan memeriksa setiap commit.

## Aturan kerja

1. Kerjakan **hanya fase yang diminta** di pesan tugas. Jangan lompat ke fase lain.
2. **Jangan hapus fitur apa pun.** Login manual & login dengan wajah (ketuk logo 1×/2×), absen scan wajah di mako (jam + geofence), bukti foto, rincian tugas, lapsit, tukar jadwal, mode admin, superadmin, panel lokasi mako — semua tetap jalan.
3. Semua animasi pakai **framer-motion** (lihat `src/components/Motion.tsx`: `ShakeErr`, `TAP`).
4. Teks untuk pengguna dalam **Bahasa Indonesia**.
5. Sebelum commit, jalankan dari folder ini dan pastikan bersih:
   - `npx tsc -b`
   - `pnpm lint` (peringatan lama `exhaustive-deps` / `only-export-components` boleh tetap ada, jangan tambah yang baru)
   - `pnpm build`
   - **Kalau mengubah `server/`**: juga `npx tsc --ignoreConfig --noEmit --allowImportingTsExtensions --module nodenext --moduleResolution nodenext --target es2022 --strict --skipLibCheck --types node server/index.ts` — boleh ada **tepat 4 error lama** (web-push d.ts, 2× No overload, string|undefined); error baru apa pun = wajib diperbaiki. `pnpm build` hanya memeriksa frontend.
6. **Satu commit per fase**, pesan: `polish(piket-menwa): fase N — <ringkas>`. Stage hanya file di `apps/piket-menwa/` yang kamu ubah untuk fase itu — **jangan** stage `opencode.json`, `docs/OPENCODE-BRIEF.md`, `docs/RENCANA-POLISH-UI.md` (file lokal, bukan untuk commit). Pakai `git add <file>` satu-satu, bukan `git add -A` / `git add .`.
7. Setelah commit, tulis ringkasan singkat: file yang diubah, apa yang berubah, dan hal yang sengaja belum dikerjakan.

## Perintah shell

Permintaan izin di sesi ini **otomatis ditolak** (tidak ada yang menjawab). Pakai hanya perintah yang diizinkan: `ls`, `cat`, `head`, `tail`, `wc`, `grep`, `rg`, `sed -n`, `echo`, `sort`, `uniq`, `cut`, `tr`, `diff`, `npx tsc`, `pnpm lint`, `pnpm build`, `git status/diff/log/show/add/commit`. Untuk membaca/mengubah file pakai tool read/edit, bukan shell.

## Dilarang

- `git push`, `git reset --hard`, `git rebase`, `git clean`, `rm` — push dilakukan reviewer lewat git subtree.
- Menyentuh `.env`, `dev.db*`, `server/.vapid.json`, `infra/`, `server/face/`, `server/models/`.
- Menambah dependency (`pnpm add` / mengubah `package.json`) tanpa izin di pesan tugas.
- Mengubah logika server (`server/index.ts`) kecuali fase yang diminta menyebutnya (mis. bug di Fase 1).

## Konteks teknis

- Frontend React 19 + Vite + TypeScript, backend Express di `server/index.ts`, SQLite via Drizzle.
- Verifikasi wajah dinilai di server (CompreFace + MiniFASNet); frontend hanya memotret (`src/components/FaceCam.tsx`).
- Dev server: Vite `:5173` (proxy `/api` → `:3001`).
