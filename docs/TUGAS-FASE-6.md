TUGAS: FASE 6 — Superadmin (lihat docs/RENCANA-POLISH-UI.md & docs/OPENCODE-BRIEF.md). Kerjakan HANYA fase ini. Fase 0–5 sudah di-commit: pakai token CSS (tema tactical, --radius 2px), Button, Empty, ConfirmSheet, Toast, ShakeErr/TAP.

Layar: src/Super.tsx (dibuka via #super, PIN superadmin). Sekarang satu halaman sangat panjang: 6 kartu statistik, Pengaturan absen (MakoPanel), Leaderboard, Pengguna, Rekap harian (absensi, bukti foto, lapsit, tukar), Log aktivitas + pratinjau foto sendiri.

1. Pecah jadi TAB di atas konten (segmented/tabbar sticky, framer-motion indikator aktif via layoutId, tab ≥44px, aria-selected / role="tablist"):
   • Ringkasan — 6 kartu statistik + Log aktivitas
   • Absensi — pilih tanggal + Rekap harian (absensi dgn status tepat/terlambat & jarak, bukti foto, lapsit, tukar)
   • Anggota — tabel Pengguna (+ hapus anggota) + Leaderboard nilai (rahasia, dgn rentang tanggal)
   • Pengaturan — MakoPanel (lokasi mako)
   Semua isi & fitur yang ada sekarang TETAP ada, hanya dipindah ke tab. Ingat tab terakhir di sessionStorage (dibungkus try/catch). Transisi konten antartab halus (framer-motion).
2. Tabel (Pengguna, Leaderboard): bungkus dengan wadah overflow-x:auto supaya bisa di-scroll ke samping di HP (sekarang terpotong karena .phone overflow:hidden). Tombol "hapus" (.supdel ±24px) → Button danger kecil ≥44px dengan aria-label "Hapus {nama}". Status online: ganti emoji 🟢/⚫ dengan titik warna + teks ("online"/"offline") supaya tidak bergantung warna saja.
3. Pratinjau foto: Super punya salinan modal sendiri (±baris 257–277) → pakai komponen src/components/PhotoPreview.tsx yang sama dengan app (sesuaikan props bila perlu, mis. judul & pengunggah dari data bukti). Perilaku tutup tetap.
4. Logika konfirmasi `ask` ditulis dua kali (store & Super.tsx) → ekstrak jadi hook src/hooks/useConfirm.ts ({ req, ask, resolve }) dan pakai di KEDUANYA (useAppStore & Super). Perilaku ConfirmSheet tidak berubah.
5. Kepala halaman (.suphead): tombol "Tutup" (button polos) → Button secondary; perilaku tetap (hapus super-pin dari sessionStorage lalu keluar). Samakan dengan tombol Tutup di gerbang PIN (sekarang gerbang PIN TIDAK menghapus super-pin — biarkan perilakunya, cukup tampilannya seragam).

Jangan: ubah server/endpoint, ubah data yang ditampilkan, ubah layar lain selain yang disebut (useAppStore hanya untuk poin 4).
Selesai: npx tsc -b, pnpm lint (tanpa peringatan baru), pnpm build bersih → commit `polish(piket-menwa): fase 6 — superadmin per tab, tabel scroll, preview & useConfirm bersama` (git add satu-satu; JANGAN opencode.json/docs/*) → ringkasan: file diubah, isi tiap tab, hal yang sengaja belum dikerjakan.
