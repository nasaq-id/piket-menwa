TUGAS: FASE 3 — Mingguan & Tukar (lihat docs/RENCANA-POLISH-UI.md & docs/OPENCODE-BRIEF.md). Kerjakan HANYA fase ini. Fase 0–2 sudah di-commit: pakai token CSS, Button, Empty, ConfirmSheet (store.ask), ShakeErr/TAP.

A. Perbaikan dari review Fase 2 (src/tabs/HariTab.tsx):
   `lapsitSent = lapsit.length > 0` salah di mode admin (daftar lapsit berisi semua anggota) → pakai `lapsit.some((l) => l.memberId === me)`. Tampilan bagian lapsit juga: form/kartu kunci ditentukan oleh lapsit MILIK me; daftar lapsit semua anggota tetap boleh tampil untuk admin.

B. Tab Tukar (src/tabs/TukarTab.tsx + state di src/hooks/useAppStore.ts):
   1. BUG default: `useState('maxwell')` (target) & default fromDay 'Senin' / toDay 'Selasa' hardcode → default kosong ('' / null) dan tombol kirim nonaktif sampai pilihan lengkap. Validasi & pesan error submitSwap yang ada tetap.
   2. Pemilihan dua langkah menggantikan daftar datar "Tukar dengan" (semua orang × hari):
      Langkah 1 "Giliran kamu" (hari milikmu, seperti sekarang) → Langkah 2 "Tukar ke hari" (chip hari Senin–Jumat selain hari asal, yang ada petugasnya) → Langkah 3 "Dengan siapa" (petugas di hari tujuan itu). Langkah berikut muncul setelah langkah sebelumnya dipilih (framer-motion, height/opacity). Ringkasan pilihan di atas tombol kirim, mis. "Rabu 30/9 ⇄ Jumat 2/10 dengan Budi".
   3. BUG ambigu: tombol Terima/Tolak sekarang di luar loop dan selalu memakai incoming[0] → pindahkan tombol ke DALAM kartu tiap permintaan masuk (Button primary "Terima" + secondary "Tolak"), masing-masing untuk permintaan itu. Tolak minta konfirmasi via store.ask (danger).
   4. Tombol kecil `.ketua` ("batalkan", "aksi Admin") → Button (secondary/danger, ≥44px). Label: "Batalkan", "Aksi admin". Admin override: "Setujui" (bukan "Approve") + "Tolak".
   5. Teks usang: "Masuk dengan wajah dulu (tab Hari Ini)." tidak bisa terjadi (tab hanya tampil setelah login) → hapus cabangnya atau ganti Empty yang wajar.
   6. Riwayat: status tampil sebagai badge berwarna (disetujui / ditolak / dibatalkan), bukan kata mentah 'approved'/'rejected'.

C. Tab Mingguan (src/tabs/MingguanTab.tsx, src/components/WeekDragBoard.tsx):
   1. Mode admin dibedakan jelas: banner di atas tab "Mode admin — perubahan jadwal langsung tersimpan" (warna warning, framer-motion) + kontrol edit (hapus petugas, tambah, jam, drag) terlihat berbeda dari tampilan baca.
   2. Tap target ≥44px: tombol navigasi minggu ‹ › (sekarang ~32px, beri aria-label "Minggu sebelumnya"/"Minggu berikutnya"), tombol hapus petugas `.dedit .x` (~20px, aria-label "Hapus {nama} dari {hari}"). Pakai Button variant icon bila cocok.
   3. Hapus petugas dari hari → konfirmasi store.ask (danger) bila sekarang langsung terhapus tanpa konfirmasi.
   Semua fitur admin tetap: tambah personel, jam mulai/selesai, drag-drop minggu lain, putar rotasi, hapus susunan khusus minggu.

Jangan: ubah server/index.ts, ubah logika tukar di server, ubah teks di luar yang disebut (copy umum = Fase 7), sentuh tab/layar lain.
Selesai: npx tsc -b, pnpm lint (tanpa peringatan baru), pnpm build bersih → commit `polish(piket-menwa): fase 3 — tukar dua langkah, fix terima/tolak & default, mode admin mingguan` (git add satu-satu; JANGAN opencode.json/docs/*) → ringkasan: file diubah, perubahan per bagian A/B/C, hal yang sengaja belum dikerjakan.
