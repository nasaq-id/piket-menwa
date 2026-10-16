TUGAS: FASE 2 — Tab Hari Ini (lihat docs/RENCANA-POLISH-UI.md & docs/OPENCODE-BRIEF.md). Kerjakan HANYA fase ini. Fase 0 & 1 sudah di-commit (32bc1e6d, c3297003): pakai token CSS, Button, Empty, ShakeErr/TAP yang ada.

Tujuan: layar src/tabs/HariTab.tsx (paling sering dipakai) jadi jelas urutannya tanpa menghapus isi apa pun.

1. STEPPER status piket di atas konten (di bawah kartu hero), HANYA bila user petugas hari ini (crew.includes(me)) dan bukan Libur:
   ① Absen → ② Bukti (x/N) → ③ Lapsit
   - Status tiap langkah dari data yang SUDAH ada di store (jangan tambah request): Absen = unlocked/myAtt (tampilkan jam & "terlambat" bila status terlambat); Bukti = ev.length/checks.length; Lapsit = sudah terkirim (lapsit milik me ada) / terbuka (lapsitOpen) / terkunci (tampilkan "mulai {lapsitOpenAt}").
   - Tampilan: 3 langkah sejajar, langkah selesai ✓ (warna accent), langkah aktif disorot, sisanya redup. Animasi framer-motion (mis. indikator aktif pakai layoutId).
   - Tap langkah → scroll halus ke bagiannya (dan buka accordion Bukti bila tertutup).
   - Pakai komponen baru src/components/PiketStepper.tsx.
2. Urutan & fokus bagian (semua bagian tetap ADA):
   - Bagian Absen (tombol "Absen tiba" + hint jam) tetap seperti sekarang; setelah absen tampil baris ringkas "Sudah absen …".
   - Bukti Piket: accordion otomatis terbuka saat langkah aktif = Bukti; progress bar yang sekarang ada di App.tsx (div.progress di luar <main>, sekitar baris 144) PINDAHKAN ke header/atas daftar bukti di HariTab (hapus yang di App.tsx). Semua perilaku foto (preview, pickPhoto, spinner upload, terkunci sebelum absen) tetap.
   - Rincian Tugas (Opsional): tetap setelah Bukti, default tertutup, label jelas "Opsional · ikut nilai". Perbaiki bug: accordion anak dibungkus `open && (<AnimatePresence>…)` sehingga animasi tutup tidak jalan → pindahkan kondisi ke DALAM AnimatePresence.
   - Lapsit: kalau belum waktunya/terkunci, ciutkan jadi satu kartu ringkas berisi alasan (belum absen / foto belum lengkap / buka mulai jam X) — textarea & tombol kirim hanya muncul saat bisa dikirim atau sudah terkirim (tampilkan catatan terkirim seperti sekarang). Logika gating & pesan yang ada TIDAK berubah.
   - Info "Besok: …" tetap di bawah.
3. Tombol "Absen tiba" (motion.button.bigbtn) → pakai Button variant primary dengan busy={absenBusy}, tampilan tetap lebar penuh.
4. Bukan petugas hari ini / Libur: tanpa stepper, tampilan seperti sekarang.
5. Semua animasi framer-motion; tap target ≥44px; tidak ada perubahan logika server/store selain nilai turunan untuk stepper (boleh tambah turunan di store/HariTab, tanpa request baru).

Jangan: ubah server/index.ts, ubah alur absen/foto/lapsit, ubah teks di luar bagian ini (copy umum = Fase 7), sentuh tab lain.
Selesai: npx tsc -b, pnpm lint (tanpa peringatan baru), pnpm build bersih → commit `polish(piket-menwa): fase 2 — tab Hari Ini, stepper Absen→Bukti→Lapsit` (git add satu-satu; JANGAN opencode.json/docs) → ringkasan: file diubah, struktur baru layar, hal yang sengaja belum dikerjakan.
