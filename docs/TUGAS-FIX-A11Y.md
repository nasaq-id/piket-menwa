TUGAS: PERBAIKAN KECIL aksesibilitas (sisa review Fase 7; lihat docs/OPENCODE-BRIEF.md). Kerjakan HANYA ini.

1. src/components/AppHeader.tsx: tombol judul `<button className="hdtitle" … aria-label="Judul aplikasi">` — aria-label menutupi teks judul untuk pembaca layar. Hapus aria-label (biarkan teks judul jadi nama tombol). Fungsi ketuk 5× superadmin tetap.
2. src/tabs/HariTab.tsx: baris tugas bukti (`<li role="button" …>` ±baris 188) berisi tombol kamera `<button className="cam">` → tombol di dalam tombol. Rapikan: <li> kembali elemen biasa (hapus role="button"/tabIndex/onKeyDown di li), dan jadikan JUDUL tugas sebuah <button> tersendiri yang menjalankan aksi yang sama seperti klik baris sekarang (taskTap). Tombol kamera tetap terpisah dengan aria-label-nya. Klik di mana pun pada baris tetap boleh memicu taskTap untuk pengguna sentuh (onClick di li tanpa role), selama tombol kamera tetap stopPropagation.
   Untuk baris rincian tugas (±baris 271, role="button" + aria-pressed): tidak berisi tombol lain → biarkan, atau ganti jadi <button> utuh bila mudah; perilaku centang tetap.
Jangan ubah perilaku, teks, atau layar lain.
Selesai: npx tsc -b, pnpm lint (tanpa peringatan baru), pnpm build bersih → commit `polish(piket-menwa): fix a11y judul header & tombol bersarang` (git add satu-satu; JANGAN opencode.json/docs/*) → ringkasan singkat.
