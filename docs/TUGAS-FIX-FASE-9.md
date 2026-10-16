KOREKSI REVIEW FASE 9 (commit 6226a2b2) — BUG KRITIS, perbaiki sekarang.

server/index.ts, fungsi nilaiKomponen (±baris 1280): `const lapsit = db.select().from(lapsit)…` membuat variabel lokal bernama `lapsit` yang MENIMPA tabel `lapsit` yang di-import, lalu dipakai sebelum terdefinisi → runtime `ReferenceError: Cannot access 'lapsit' before initialization`. Terbukti: GET /api/nilai/leaderboard (dengan PIN) → HTTP 500. Semua nilai (peringkat, nilai harian, detail) mati.

Perbaiki: ganti nama variabel lokal (mis. `adaLapsit`), tetap kembalikan properti `lapsit: boolean` di objek hasil (klien memakai nama itu). Rumus tidak berubah.

Wajib jalankan typecheck SERVER (lihat docs/OPENCODE-BRIEF.md, bagian "Kalau mengubah server/"): hasil harus kembali tepat 4 error lama, tanpa error baru. Lalu npx tsc -b, pnpm lint, pnpm build.
Commit terpisah: `fix(piket-menwa): fase 9 — variabel lapsit menimpa tabel di nilaiKomponen` (git add server/index.ts saja) → ringkasan singkat + output typecheck server.
