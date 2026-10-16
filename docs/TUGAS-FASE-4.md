TUGAS: FASE 4 — Profil & sheet (lihat docs/RENCANA-POLISH-UI.md & docs/OPENCODE-BRIEF.md). Kerjakan HANYA fase ini. Fase 0–3 sudah di-commit: pakai token CSS, Button, Empty, ConfirmSheet (store.ask), ShakeErr/TAP.

1. Sheet dasar (.sheet di src/index.css): sekarang `max-height:46svh` TANPA scroll → isi terpotong. Ubah: max-height ±88svh, isi bisa di-scroll (overflow-y:auto, overscroll-behavior:contain), padding bawah tetap memperhitungkan safe-area. Berlaku untuk semua sheet (.sheet) — cek LogoutSheet, KontakSheet, ConfirmSheet tetap rapi.
   Drag-untuk-tutup (drag="y" di motion.div sheet) jangan sampai bentrok dengan scroll: batasi drag hanya dari "grabber"/kepala sheet (framer-motion useDragControls + dragListener={false}, onPointerDown di grabber). Perilaku tutup saat ditarik ke bawah tetap.
2. Sheet Profil (src/components/LogoutSheet.tsx, dibuka dari avatar di header):
   - Judul sheet "Profil". Susun per bagian dengan judul kecil:
     • Akun: avatar (foto atau lingkaran warna 64px) + nama + jabatan·angkatan, tombol "Ganti/Tambah foto profil" & "Hapus foto" (pakai Button secondary kecil, busy saat memproses — ganti teks "memproses…" dengan spinner Button), tombol "Ubah NBP / WA / alias".
     • Keamanan: pilihan PIN/Password + input + tombol Simpan (SecretField yang ada) + pesan ok/err yang sudah ada.
     • Keluar: tombol "Keluar" (Button danger; ganti teks "Logout") dengan konfirmasi store.ask ("Keluar dari akun?", danger) — butuh akses ask: teruskan lewat props dari App.tsx.
   - Tombol "Batal" di bawah → ganti jadi "Tutup" (secondary) atau tombol X kecil di kepala sheet (Button variant icon, aria-label "Tutup"). Pilih salah satu, konsisten.
   - Semua perilaku yang ada tetap (ganti/hapus avatar, simpan PIN/password, ubah kontak, logout).
3. PIN Admin (src/components/PinSheet.tsx): sekarang kartu inline di bawah header tanpa backdrop → jadikan sheet sungguhan seperti sheet lain (.sheetwrap + .sheet, slide dari bawah framer-motion, tap backdrop = batal, grabber). Isi tetap: judul "Masuk mode Admin", keterangan, input PIN (autoFocus, Enter = kirim), Button Masuk (busy) + Batal. Bersihkan CSS .pinsheet yang tak terpakai lagi.
4. Aksesibilitas sheet: role="dialog", aria-modal="true", aria-label (judul) di LogoutSheet, KontakSheet, PinSheet (ConfirmSheet sudah). Tombol Esc menutup sheet (kecuali KontakSheet mode forced) — tambahkan juga ke ConfirmSheet (Esc = batal).

Jangan: ubah server, ubah alur login/absen/tukar, ubah teks di luar sheet-sheet ini, sentuh layar lain.
Selesai: npx tsc -b, pnpm lint (tanpa peringatan baru), pnpm build bersih → commit `polish(piket-menwa): fase 4 — sheet profil per bagian, sheet bisa scroll, PIN admin jadi sheet` (git add satu-satu; JANGAN opencode.json/docs/*) → ringkasan: file diubah, perubahan per poin, hal yang sengaja belum dikerjakan.
