TUGAS: FASE 8 (kecil) — Placeholder field login NBP/WA/alias (lihat docs/OPENCODE-BRIEF.md). Kerjakan HANYA ini.

Masalah: di halaman login (WelcomePage, src/Welcome.tsx ±baris 240–246) label "NBP / No. WhatsApp / Alias" + placeholder "1494.08.148031, 0812…, atau alias" terlalu ramai (info dobel, 3 contoh sekaligus, terpotong di HP sempit).

Yang diminta:
1. Label jadi lebih pendek: "NBP / No. WA / Alias".
2. Placeholder = animasi MENGETIK satu contoh bergantian, persis gaya placeholder nama di wizard daftar (ProfilePage: state phAnim + tick mengetik/menghapus per huruf + kursor "▌"), TAPI TANPA awalan "contoh:" — yang tampil hanya contohnya, mis. "1494.08.100001▌".
   - Urutan contoh (dummy, BUKAN data nyata): "1494.08.100001" → "081234567890" → "rajawali" → ulang.
   - Ekstrak logika animasi jadi hook bersama, mis. src/hooks/useTypingPlaceholder.ts (words, aktif) → string, dan pakai juga di ProfilePage menggantikan logika yang sekarang (perilaku placeholder nama di wizard TIDAK berubah: tetap memakai nama anggota terdaftar & tetap dengan awalan "contoh:").
   - Animasi berhenti saat field sudah berisi (seperti field nama) dan saat komponen dilepas (bersihkan timer).
   - prefers-reduced-motion: tanpa animasi, tampilkan placeholder statis "NBP, No. WA, atau alias".
3. Jangan ubah: logika login, validasi, field PIN/password, placeholder lain di wizard.

Selesai: npx tsc -b, pnpm lint (tanpa peringatan baru), pnpm build bersih → commit `polish(piket-menwa): placeholder login bergantian NBP/WA/alias` (git add satu-satu; JANGAN opencode.json/docs/*) → ringkasan singkat.
