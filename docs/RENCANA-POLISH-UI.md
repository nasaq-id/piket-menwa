# Rencana Polish UI/UX — Piket Menwa

28 September 2026

Aplikasi Jurnal Piket Menwa dirapikan dalam 7 fase: tampilan lebih bersih dan sederhana, **tanpa menghapus satu fitur pun**. Yang berubah hanya cara tampil, cara memberi umpan balik, dan konsistensi.

## Tujuan & prinsip

- **Fitur tetap utuh.** Login manual dan login dengan wajah, absen dengan scan wajah di mako, bukti foto, rincian tugas, lapsit, tukar jadwal, mode admin, dan superadmin semuanya tetap ada.
- **Satu sistem desain.** Satu set warna, ukuran huruf, sudut, dan jarak, dipakai di semua layar.
- **Umpan balik yang jelas.** Setiap aksi menunjukkan sedang diproses, berhasil, atau gagal, dengan satu gaya yang sama.
- **Nyaman untuk jari.** Semua tombol minimal 44 px, teks mudah dibaca di HP.
- **Satu bahasa.** Bahasa Indonesia yang konsisten, istilah teknis dihindari.

## Temuan audit UI saat ini

Audit membaca seluruh kode tampilan (`src/`).

| Area | Temuan | Dampak |
|---|---|---|
| Gaya | ~25 gaya tombol, 68 warna hardcode (hanya 6 jadi variabel CSS), 18 ukuran font, 17 ukuran sudut | Tampilan tidak seragam; perubahan kecil harus diulang di banyak tempat |
| Tema | Tema *tactical HUD* hijau dipakai di semua layar, tapi masih tercampur sudut membulat tema lama; wizard daftar punya lapisan tema sendiri | Login dan daftar terlihat beda gaya |
| Judul | Kursor berkedip `_` muncul di semua judul, termasuk header aplikasi dan superadmin | Mengganggu di layar kerja |
| Umpan balik | 23 popup bawaan browser (`alert`/`confirm`) walau sudah ada Toast; error tampil dengan 6 gaya berbeda | Terasa kasar dan tidak konsisten |
| Loading | Tombol kirim lapsit, tukar, PIN admin, PIN superadmin tidak menunjukkan sedang diproses | Pengguna menekan berulang |
| Tab Hari Ini | Status hadir, tombol absen, 4 foto bukti, 34 rincian bertingkat, lapsit, info besok dalam satu scroll | Layar paling padat, padahal paling sering dipakai |
| Tukar jadwal | Daftar datar semua kombinasi orang × hari | Sulit memilih |
| Profil | Sheet dibatasi 46% tinggi layar tanpa scroll; avatar besar tampil sebagai titik 12 px | Isi bisa terpotong |
| Superadmin | Semua bagian dalam satu halaman panjang; tabel 6 kolom terpotong di HP | Sulit dipakai di HP |
| Ukuran tombol | Gear/bell ~27 px, hapus 20–26 px, navigasi minggu 32 px (standar minimal 44 px) | Salah tekan |
| Layar HP | Header & kamera belum memperhitungkan area aman (notch) | Konten bisa tertutup |
| Teks | Campur Indonesia–Inggris (Logout, Approve, Leaderboard); istilah teknis (AES-256-GCM, geofence); teks usang ("buka tab Hari Ini → Daftar") | Membingungkan anggota |
| Aksesibilitas | Hanya 1 `aria-label`; beberapa status hanya dibedakan warna; teks samar di bawah kontras layak | Sulit untuk pembaca layar & mata lelah |
| Kode sisa | ~25 selector CSS untuk komponen yang sudah dihapus | Beban & kebingungan saat merawat kode |

## Bug yang ditemukan sekalian

Bukan soal tampilan, tapi sebaiknya dibereskan di fase awal.

| Prioritas | Bug | Lokasi |
|---|---|---|
| Tinggi | Mode admin bisa dibuka **tanpa PIN** saat offline atau saat server error | `src/hooks/useAppStore.ts` (fungsi tombol gear) |
| Sedang | Tukar jadwal defaultnya menunjuk anggota hardcode `'maxwell'` | `src/hooks/useAppStore.ts` |
| Sedang | Kalau ada 2 permintaan tukar masuk, Terima/Tolak hanya berlaku untuk yang pertama | `src/tabs/TukarTab.tsx` |
| Rendah | Animasi tutup di rincian tugas tidak jalan | `src/tabs/HariTab.tsx` |

## Rencana 7 fase

Ukuran: S = kecil, M = sedang, L = besar.

| Fase | Isi | Ukuran |
|---|---|---|
| **0. Fondasi** | Satu set variabel desain: 6 warna, 5 ukuran font (12/14/16/20/26), 1 ukuran sudut, jarak kelipatan 4. Satu komponen `Button` (primary / secondary / ghost / danger / ikon), semua minimal 44 px. Hapus CSS sisa dan aturan ganda. | M |
| **1. Umpan balik** | Ganti 23 popup browser dengan Toast dan **sheet konfirmasi** (animasi framer-motion). Satu gaya error. Spinner di semua tombol kirim. Pesan "kosong" yang seragam. Perbaiki bug mode admin tanpa PIN. | M |
| **2. Tab Hari Ini** | **Stepper status di atas:** ① Absen → ② Bukti (x/4) → ③ Lapsit, langkah aktif disorot. Bagian yang belum waktunya diciutkan. Rincian 34 tugas tetap ada tapi ringkas; progress bar pindah ke dekat bukti. | L |
| **3. Mingguan & Tukar** | Mode admin punya pembeda visual yang jelas. Tukar dua langkah: pilih hari, lalu pilih orang. Perbaiki default `'maxwell'` dan Terima/Tolak yang ambigu. | M |
| **4. Profil & sheet** | Sheet "Profil" per bagian (Akun · Keamanan · Keluar), bisa di-scroll, avatar ukuran benar. PIN admin jadi sheet sungguhan dengan backdrop. | S |
| **5. Login & daftar** | Hint ketuk logo lebih terbaca; logo langsung bereaksi saat disentuh. Teks persetujuan dipersingkat dengan "selengkapnya". Wizard daftar senada dengan login. | S |
| **6. Superadmin** | Dipecah jadi tab: Ringkasan · Absensi · Anggota · Pengaturan. Tabel bisa di-scroll ke samping; pratinjau foto memakai komponen yang sama dengan aplikasi utama. | M |
| **7. Teks & aksesibilitas** | Glosarium Bahasa Indonesia yang konsisten, `aria-label` di tombol ikon, area aman layar, kontras teks samar. | S |

## Urutan pengerjaan & cara kerja

1. **Fase 0 → 1 dulu.** Fondasi membuat fase lain cepat dan konsisten; bug mode admin ikut tertutup.
2. **Fase 2** berikutnya, karena Tab Hari Ini layar yang paling sering dipakai.
3. Fase 3 sampai 7 berurutan.

Setiap fase dikerjakan dan di-commit terpisah supaya mudah dicek dan dibatalkan. Setelah tiap fase: typecheck, lint, build, lalu dicoba di HP lewat tunnel.

## Keputusan yang perlu diambil tim

- [x] **Arah tema:** *tactical HUD* hijau Menwa dipertahankan, dirapikan. (diputuskan 28 Sep 2026)
- [x] **Istilah khas Menwa** (Lapsit, Mako, NBP): dipakai, dengan penjelasan singkat saat pertama muncul. (diputuskan 28 Sep 2026)
- [x] **Kursor berkedip `_`**: hanya di halaman login. (diputuskan 28 Sep 2026)
