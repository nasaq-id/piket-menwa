TUGAS: FASE 5 — Login & daftar + rapikan tema (lihat docs/RENCANA-POLISH-UI.md & docs/OPENCODE-BRIEF.md). Kerjakan HANYA fase ini. Fase 0–4 sudah di-commit.

KEPUTUSAN TIM (sudah final, lihat bagian "Keputusan" di rencana):
- Tema: tactical HUD hijau Menwa DIPERTAHANKAN, dirapikan (sudut tegas, konsisten).
- Kursor berkedip "_": HANYA di judul halaman login (WelcomePage), tidak di judul lain.
- Istilah Menwa dipakai dengan penjelasan singkat saat pertama muncul.

1. Kursor: aturan `.tac h1::after { content:'_'; animation:blink … }` (src/index.css) sekarang berlaku ke semua h1 (header app, Super, dll.) → batasi hanya ke judul di halaman login (WelcomePage di src/Welcome.tsx; beri class khusus bila perlu). Judul wizard daftar & layar lain tanpa kursor. Hormati prefers-reduced-motion (tanpa kedip).
2. Tema tactical rapi & konsisten: di bawah .tac, sisa sudut membulat tema lama dibuat seragam memakai token --radius (2px): mis. .toast (13px), .dragcol (10px), .dragcard (8px), .wmwrap .wm (6px), .picklist button (9px), .ketua/.supdel/.chip/.badge-* dan sejenisnya. Wizard daftar punya lapisan tema sendiri (`.welcome.tac` border-radius 6px + aturan radius:0 untuk input/jabcard/wbtn/dupebox/wlogo) → samakan dengan halaman login & token (satu gaya). Jangan ubah warna tema; hanya radius/konsistensi. Periksa hasil tidak merusak tata letak.
3. Halaman login (WelcomePage):
   - Hint "ketuk logo 1× login manual • 2× login dengan wajah" (.tapHint, 11px opacity .55) → lebih terbaca: ≥12px, kontras cukup (tanpa opacity rendah), tetap kecil & tenang.
   - Umpan balik sentuh logo LANGSUNG saat pointerdown (efek riak/cincin framer-motion), karena pembedaan 1×/2× menunggu 300 ms — logika 1×/2× dan jedanya TIDAK berubah.
   - Catatan privasi (.wsecure, diposisikan absolute `bottom:-50px`, 10.5px opacity .75) → ikut alur normal di bawah (tidak absolute/terpotong), ≥12px terbaca.
4. Wizard daftar (ProfilePage di src/Welcome.tsx):
   - Tombol "TUTUP" (huruf kapital di kode) → "Tutup" (tema tac tetap boleh meng-uppercase lewat CSS).
   - Langkah Persetujuan Data Wajah: paragraf 7 baris → ringkasan 1–2 kalimat + tombol "Selengkapnya" yang membuka teks lengkap (framer-motion height). Isi hukum (UU PDP No. 27/2022, foto tidak disimpan, embedding terenkripsi, dipakai login & absensi) TETAP ada di teks lengkap. Hindari jargon di ringkasan (sebut "data wajah dienkripsi", bukan "AES-256-GCM"; istilah teknis boleh di teks lengkap).
   - Label field NBP: "NBP (Nomor Buku Pokok) Menwa" — istilah dijelaskan saat pertama muncul.
   - Pakai Button untuk tombol Lanjut/Sebelumnya/Tutup/"Lanjut scan wajah" (busy saat cek server, mengganti teks "Memeriksa…" dengan spinner Button).
   - Placeholder nama beranimasi memakai "▌" — biarkan.
5. Semua animasi framer-motion; tap target ≥44px.

Jangan: ubah logika login 1×/2×, alur/validasi pendaftaran, server, atau layar di luar login/daftar selain penyeragaman radius tema (poin 2).
Selesai: npx tsc -b, pnpm lint (tanpa peringatan baru), pnpm build bersih → commit `polish(piket-menwa): fase 5 — login & daftar, rapikan tema tactical, kursor hanya di login` (git add satu-satu; JANGAN opencode.json/docs/*) → ringkasan: file diubah, perubahan per poin, daftar selector radius yang diseragamkan, hal yang sengaja belum dikerjakan.
