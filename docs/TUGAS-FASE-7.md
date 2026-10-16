TUGAS: FASE 7 — Teks & aksesibilitas (fase terakhir; lihat docs/RENCANA-POLISH-UI.md & docs/OPENCODE-BRIEF.md). Kerjakan HANYA fase ini. Fase 0–6 sudah di-commit. Keputusan tim: tema tactical dipertahankan; istilah Menwa dipakai DENGAN penjelasan singkat saat pertama muncul.

A. TEKS (Bahasa Indonesia konsisten; jangan ubah makna aturan/validasi)
1. Persetujuan data wajah (src/Welcome.tsx, ringkasan langkah persetujuan): "…yang disimpan hanya data wajah yang dienkripsi" bisa terbaca seolah FOTO disimpan → ganti jadi setara "yang disimpan hanya kode angka wajah (terenkripsi), bukan foto". Teks lengkap "Selengkapnya" tetap.
2. Teks usang src/tabs/MingguanTab.tsx: "Belum ada yang daftar — suruh buka tab Hari Ini → Daftar" → pendaftaran ada di halaman login ("Daftar"); tulis ulang sesuai.
3. Istilah dijelaskan saat pertama muncul (cukup sekali per layar, keterangan kecil/redup): "Lapsit (laporan situasi)" di tab Hari Ini (judul bagian/stepper), "mako (markas komando)" pada hint absen pertama. NBP sudah dijelaskan di Fase 5.
4. Glosarium: "Leaderboard Nilai (rahasia)" → "Peringkat Nilai (rahasia)"; "Rata²" → "Rata-rata"; "Admin override" → "Keputusan admin" (Tukar); "● offline — data lokal" / "• offline" → "Offline — memakai data tersimpan" (+ ikon, bukan ●); status tabel Super "online/offline" → "daring/luring" ATAU biarkan "online/offline" — pilih satu & konsisten di seluruh app (sarankan "online/offline" tetap karena umum dipakai anggota; yang penting konsisten). Kapitalisasi: huruf awal kapital untuk label tombol & judul.
5. Petunjuk berulang: catatan privasi wajah muncul 3× (login .wsecure, persetujuan, FaceCam) → pertahankan di persetujuan & FaceCam; di login cukup satu baris singkat. "scan wajah di mako" diulang 3× di Hari Ini (tombol, hint, pesan kunci) → sisakan di tombol & satu hint, pesan kunci lain cukup "Absen dulu".
6. Emoji/simbol dekoratif sebagai data (● di info besok, ✓ di pesan) boleh tetap bila bukan satu-satunya penanda; pastikan ada teks.

B. AKSESIBILITAS
7. aria-label untuk tombol ikon tanpa teks: gear (mode admin: "Masuk/keluar mode admin"), bell ("Aktifkan notifikasi"), avatar di header ("Buka profil"), dan tombol ikon lain yang tersisa (cek grep `<button` tanpa teks).
8. Elemen klik non-tombol → tombol sungguhan (atau role="button" + tabIndex + Enter/Space): <li> tugas bukti & rincian di HariTab (onClick di li), <img> yang bisa diklik (MingguanTab foto, Super bukti), judul header AppHeader (<div> onTitleTap — pertahankan fungsi 5× ketuk superadmin, hanya jadikan <button> bergaya sama). BottomTabs: aria-current="page" pada tab aktif.
9. Area aman (notch): header (.hd) padding-top + env(safe-area-inset-top); .phone padding-bottom memperhitungkan env(safe-area-inset-bottom); overlay kamera (.camwrap) & pratinjau (.preview) juga.
10. Kontras: teks redup yang dikecilkan lagi dengan opacity (.whint.dim, .dragempty 9px, dll.) → minimal 12px dan tanpa opacity < 0.8 di atas warna --dim; placeholder input jangan terlalu pudar (rgba .35 → setara ≥ .55).
11. Esc: saat ConfirmSheet terbuka DI ATAS sheet lain (mis. Profil → Keluar), Esc hanya boleh menutup ConfirmSheet teratas, bukan dua-duanya (mis. stopImmediatePropagation / cek sheet teratas).
12. Komentar usang src/components/ConfirmSheet.tsx yang menyebut useAppStore.ask → rujuk hooks/useConfirm.ts.

C. KERAPIAN KODE
13. Pindahkan `style={{…}}` statis (±34 tempat, mis. width:'100%', marginTop, flex:1, minHeight:'44px', scrollMarginTop) ke class CSS berbasis token. Biarkan style yang DINAMIS (warna anggota `background: warna(id)`, lebar progress `width: ${…}%`, posisi hitungan).

Jangan: ubah server/endpoint, logika bisnis, alur layar, atau desain yang sudah diselesaikan fase 0–6 selain yang disebut.
Selesai: npx tsc -b, pnpm lint (tanpa peringatan baru), pnpm build bersih → commit `polish(piket-menwa): fase 7 — teks, glosarium, aksesibilitas, rapikan inline style` (git add satu-satu; JANGAN opencode.json/docs/*) → ringkasan: file diubah, perubahan per poin (1–13), hal yang sengaja belum dikerjakan.
