TUGAS: FASE 9 — Nilai (peringkat & rincian 34 poin) (lihat docs/OPENCODE-BRIEF.md). Kerjakan HANYA ini. Fase ini BOLEH mengubah server/index.ts, khusus bagian nilai yang disebut.

Latar: nilai otomatis per hari = foto bukti 60% + rincian 34 tugas 30% + lapsit 10% (server/index.ts `nilaiOtomatis`, BREAKDOWN_TOTAL = 34). Superadmin (#super, src/Super.tsx) hanya menampilkan rata-rata di tab Anggota → pengguna mengira peringkat hilang, dan rincian 34 poin tidak pernah terlihat.

A. Server (server/index.ts)
1. KEAMANAN: `GET /api/nilai/leaderboard` sekarang publik tanpa PIN → pasang `requireSuper` (klien Super sudah pakai superGet yang mengirim x-super-pin).
2. KEAMANAN: `GET /api/nilai/today` menampilkan nilai anggota mana pun → hanya boleh bila (a) header x-super-pin benar, atau (b) query `attest` valid untuk memberId+tanggal itu (checkAttest). Sesuaikan klien src/api.ts `loadNilaiToday` agar mengirim attest milik sendiri (getAttest(memberId, date)). Nilai di tab Hari Ini tetap tampil untuk diri sendiri.
3. Refactor: `nilaiKomponen(tanggal, memberId)` → { foto, fotoMax, rincian, rincianMax, rincianKeys: string[], lapsit: boolean, nilai } dengan rumus SAMA PERSIS; `nilaiOtomatis` memakai ini (hasil angka tidak berubah).
4. Endpoint baru `GET /api/nilai/detail?memberId&from&to` (requireSuper): per tanggal kerja di rentang di mana member itu petugas (pakai effectiveRosterDay seperti leaderboard) → daftar { tanggal, ...nilaiKomponen }, urut terbaru dulu. Validasi tanggal seperti leaderboard.

B. Superadmin (src/Super.tsx)
5. Tab baru "Nilai": urutan tab Ringkasan · Absensi · Nilai · Anggota · Pengaturan. Pindahkan "Peringkat Nilai (rahasia)" + rentang tanggal dari tab Anggota ke tab Nilai. Tab Anggota tetap berisi tabel Pengguna.
6. Di atas tabel: keterangan rumus "Foto 60% · Rincian 30% · Lapsit 10%".
7. Ketuk baris peringkat → baris membentang (framer-motion height) menampilkan rincian per tanggal dari /api/nilai/detail (muat saat dibuka, spinner/Empty): tanggal · foto x/4 · rincian x/34 · lapsit ✓/— · nilai. Ketuk satu tanggal → tampilkan daftar tugas rincian yang DICENTANG (nama item dari src/breakdown.ts BREAKDOWN, key "gi:ii") dikelompokkan per kategori, sisanya ringkas "x belum". Baris peringkat jadi tombol ≥44px dengan aria-expanded.
8. Tab Ringkasan: kartu kecil "3 teratas" (nama + rata-rata) + tombol "Lihat semua" yang pindah ke tab Nilai.

D. Catatan review sebelumnya
9. src/tabs/HariTab.tsx: tombol judul tugas bukti (`<button className="ttitle" style={{ background:'none', border:0, padding:0, … }}>`) punya inline style statis → pindahkan ke class CSS (mis. `.ttitle` di index.css atau `.ttitlebtn`). Tampilan harus sama.

C. Batasan
- Rumus & data nilai TIDAK berubah; fitur lain tidak disentuh.
- Semua animasi framer-motion, pakai token/Button/Empty yang ada.

Uji endpoint (curl) dilakukan reviewer — kamu tidak punya izin curl/node; cukup pastikan tipe & build.

Selesai: npx tsc -b, pnpm lint (tanpa peringatan baru), pnpm build bersih → commit `feat(piket-menwa): fase 9 — tab Nilai, rincian 34 poin per anggota, amankan endpoint nilai` (git add satu-satu; JANGAN opencode.json/docs/*) → ringkasan: file diubah, perubahan per poin, hal yang sengaja belum dikerjakan.
