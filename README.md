# 📋 Piket PWA — Shift Scheduling + Face Attendance + Auto Scoring

Progressive Web App untuk **jadwal piket, absensi wajah, bukti foto ber-stempel, lapsit, tukar jadwal, dan penilaian otomatis**. Dibangun generik: bisa dipakai organisasi apa pun — komunitas kampus, karang taruna, sekre organisasi, tim jaga — bukan cuma satu instansi.

> Frontend PWA (installable, offline-ready) + APK Android (TWA, sideload) + backend Express + SQLite via Drizzle (siap migrasi ke Supabase Postgres).
>
> **Live:** https://piket.example.com · **APK Android terbaru:** https://github.com/nohypelabs/piket-menwa/releases/latest/download/piket-menwa.apk

---

## ✨ Fitur

### 🔐 Auth & Identitas
- **Login 2 jalur (pilih salah satu)** — (a) manual: NBP / No. WhatsApp / alias + PIN atau password, atau (b) **wajah saja**: scan → server mengenali pemiliknya di antara semua anggota (ditolak kalau ada >1 anggota yang sama-sama mirip). Absen tetap wajib scan wajah.
- **Registrasi mandiri** — wizard: Nama → Alias → NBP (angkatan otomatis dari 2 digit pertama) → Jabatan → No. WA → persetujuan data wajah (UU PDP) → PIN/password, lalu scan wajah di akhir. Tolak duplikat wajah, NBP, WA, alias (dicek langsung saat mengetik).
- **Scan wajah challenge-response + anti-spoofing** — tatap depan, lalu server memberi arah menoleh **acak** (kiri/kanan, berlaku 30 detik, sekali pakai), ditambah skor liveness pasif **MiniFASNet**. Foto/layar tidak bisa menoleh sesuai perintah; rekaman video tidak bisa menebak arahnya.
- **Daftar ulang wajah** — kalau template wajah di-reset/ganti model, login manual berikutnya langsung meminta scan wajah sekali (tanpa template tidak bisa absen).
- **Sesi harian** — login berlaku 1 hari; aksi pribadi ditandatangani token wajah (attest) hari itu.
- **Profil** — kontak WA wajib, foto profil (avatar) opsional dari galeri — terpisah dari data wajah biometrik.

### 🧑‍💼 Piket Harian (tab Hari Ini)
- **Stepper Absen → Bukti → Lapsit.**
- **Absensi wajah wajib di mako** — scan wajah BARU saat absen (terpisah dari login), dinilai di server. Syarat dicek server sebelum kamera terbuka:
  - **Jadwal & jam**: absen dibuka 30 menit sebelum jam mulai s/d jam selesai; lewat 15 menit dari jam mulai tercatat **terlambat**.
  - **Geofence**: GPS HP harus di dalam radius mako (diatur superadmin di tab Pengaturan → "Pakai lokasi saya sekarang"). Koordinat mentah tidak ditampilkan publik — cuma status & jarak ke mako. Catatan: GPS bisa dipalsukan aplikasi fake GPS; geofence menyaring kasus umum.
  - Foto bukti, rincian tugas, & lapsit **ditolak server** sebelum absen (bukan cuma dikunci di UI).
- **Bukti foto wajib (4 item)** — 1 tugas = 1 foto, otomatis terkompres **WebP ≤ 40KB** di HP, dibakar stempel **tanggal + jam + koordinat + logo organisasi**, immutable (tidak bisa ubah/hapus). Disajikan lewat URL bertanda tangan (signed URL).
- **Lapsit akhir piket** — catatan + timestamp server + geolocation, terkunci sampai 4 foto lengkap.
- **Rincian 34 tugas** (5 kategori akordeon) — checklist per shift, tersimpan di server, ikut menentukan nilai.
- **Presence online** — heartbeat tiap 30 detik, titik hijau kayak aplikasi chat.

### 🔄 Tukar Jadwal
- Pengajuan dua langkah → yang **diminta** yang menyetujui (bukan admin). Pemohon bisa batalkan. Admin hanya override.
- Notifikasi push (VAPID) + in-app untuk pengajuan/keputusan baru.

### 🔔 Pengingat H-1
- Server mengirim push pengingat ke petugas piket besok, **otomatis tiap hari pukul 19.00** (waktu server), sekali per hari. Bisa juga dipicu manual/cron eksternal lewat `POST /api/cron/reminder` (PIN superadmin).

### 🏆 Penilaian Otomatis (real-time, tanpa verifikasi manual)
- **60%** foto bukti • **30%** checklist 34 item • **10%** lapsit → nilai 0–100 + **leaderboard** (khusus superadmin, anggota tidak melihat nilai orang lain).
- Master 34 tugas + bobot (total 100) di-seed dari standar; N/A hanya untuk item Kondisional (dikunci di UI + API + CHECK constraint DB).
- Superadmin bisa melihat **rincian 34 poin per anggota** per rentang tanggal.

### 🛡️ Peran
| Peran | Akses |
|---|---|
| Anggota | Hari Ini (absen, bukti, lapsit, rincian tugas), jadwal Mingguan, Tukar |
| Admin (PIN) | Susun petugas piket + jam, drag-and-drop mingguan, override tukar, putar rotasi |
| Superadmin (PIN + `#super`) | Tab **Ringkasan** · **Absensi** (rekap harian, foto, lapsit, log) · **Nilai** (leaderboard + rincian per anggota) · **Anggota** (daftar anggota, status data wajah, hapus) · **Pengaturan** (lokasi & radius mako) |

### 🔒 Privasi Face Recognition
- HP hanya memotret; frame dikirim ke server aplikasi sendiri (bukan pihak ketiga), diproses di memori lalu dibuang — **foto wajah tidak disimpan**.
- Yang disimpan cuma embedding (+ versi model) **terenkripsi AES-256-GCM**; client tidak pernah menerima vektor wajah siapa pun.
- Setiap verifikasi mencatat **skor** (liveness, arah, similarity, alasan tolak) di tabel `face_checks` — tanpa gambar — untuk kalibrasi dari pemakaian nyata.

---

## 🧰 Tech Stack

| Lapis | Teknologi |
|---|---|
| Frontend | React 19 + Vite 8 + TypeScript, framer-motion, lucide-react, zod, @dnd-kit |
| PWA | `vite-plugin-pwa` (injectManifest, SW custom `src/sw.ts`: precache app-shell + cache foto bukti + web push; `/api/*` selalu ke jaringan) |
| Android | TWA (Trusted Web Activity) via Bubblewrap — `android/`, sideload APK |
| Face AI (server) | [CompreFace](https://github.com/exadel-inc/CompreFace) self-hosted (build Mobilenet: RetinaFace + ArcFace/MobileFaceNet, InsightFace) untuk deteksi + embedding + landmark; anti-spoofing pasif **MiniFASNet** (Silent-Face, Apache-2.0) via `onnxruntime-node`. Lihat `server/face/`, `infra/compreface/`. |
| Backend | Express 5 (REST JSON), `web-push` (VAPID), `sharp` |
| Database | SQLite (`better-sqlite3`) via Drizzle ORM — tabel dibuat otomatis saat start; skema Postgres 1:1 di `db/schema.pg.ts` |
| Styling | CSS custom, tema Tactical HUD |

---

## 🚀 Quickstart (dev)

```bash
pnpm install

# 1. Isi .env (lihat tabel di bawah). Buat FACE_ENC_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 2. Jalankan CompreFace (Docker, ~1.1 GB RAM untuk compose lengkap, CPU wajib AVX2)
cd infra/compreface && cp .env.example .env && docker compose up -d && cd ../..
#    Buka http://localhost:8000 → daftar admin → buat Application → service tipe
#    DETECTION → salin API key ke .env app: COMPREFACE_DETECT_KEY=...

# 3. Seed data awal (template bukti + 34 master tugas)
pnpm seed

# 4. Jalan bareng (API :3001 + web :5173)
pnpm dev:all
```

Buka `http://localhost:5173` (kamera butuh HTTPS di HP — pakai tunnel, mis. `cloudflared tunnel --url http://localhost:5173`).
Perintah lain: `pnpm build` (tsc + vite build), `pnpm lint` (oxlint). Service worker **tidak aktif di dev** — uji perilaku cache/offline lewat `pnpm build && pnpm preview` atau di produksi.

### ⚙️ Environment (`.env`)

| Key | Wajib | Keterangan |
|---|---|---|
| `NODE_ENV` | Produksi | `production` → `FACE_ENC_KEY`, `ADMIN_PIN`, `SUPER_PIN` wajib diset (server menolak start), endpoint lab wajah dimatikan |
| `FACE_ENC_KEY` | Produksi | base64 32 byte — enkripsi embedding wajah (jangan masuk git!). Dev punya fallback tidak aman |
| `COMPREFACE_URL` | — | Default `http://127.0.0.1:8000` |
| `COMPREFACE_DETECT_KEY` | Ya | API key service DETECTION di CompreFace |
| `ADMIN_PIN` | Produksi | Mode Admin. Default dev `1234` — **jangan dipakai di produksi** |
| `SUPER_PIN` | Produksi | Dashboard `#super`. Default dev `041294` — **jangan dipakai di produksi** |
| `ABSEN_BUKA_MENIT` / `ABSEN_TELAT_MENIT` | — | Default `30` / `15` — jendela absen & batas terlambat (menit) |
| `MAKO_RADIUS_M` / `GPS_TOLERANSI_M` / `GPS_ACC_MAX_M` | — | Default `100` / `50` / `200` — radius default, toleransi akurasi GPS, akurasi terburuk yang diterima |
| `FACE_MATCH_MIN` / `FACE_LIVE_MIN` / `FACE_MIN_PX` / `FACE_FRONTAL_MAX` / `FACE_TURN_MIN` | — | Default `0.9` / `0.8` / `90` / `0.06` / `0.12` — ambang verifikasi wajah (lihat Lab wajah) |
| `VAPID_PUBLIC` / `VAPID_PRIVATE` | — | Auto-generate ke `server/.vapid.json` bila kosong |
| `PORT` / `HOST` | — | Default `3001` / `0.0.0.0`. Produksi di belakang proxy/tunnel: `HOST=127.0.0.1` |
| `DB_FILE` / `UPLOAD_DIR` | — | Default `./dev.db` / `./uploads` |
| `CORS_ORIGIN` | — | Daftar origin dipisah koma (produksi: domain app) |

### 🔌 API

Autentikasi aksi sensitif: identitas member dari sesi login + token wajah harian (`attest`); admin pakai header `x-admin-pin`, superadmin `x-super-pin`. Endpoint sensitif diberi rate-limit per IP.

| Area | Endpoint |
|---|---|
| Umum | `GET /api/health`, `GET /api/state`, `GET/PUT /api/settings`, `PUT /api/settings/mako` (super) |
| Daftar | `GET /api/register/check`, `POST /api/register` |
| Login | `POST /api/login/credential`, `POST /api/login/identify` (wajah saja), `POST /api/login/enroll-face`, `POST /api/secret/set` |
| Wajah | `POST /api/face/challenge`, `GET /api/faces/summary` (admin), `DELETE /api/faces/:memberId` (reset template; belum ada tombolnya di UI) |
| Anggota | `PUT /api/members/:id/kontak`, `PUT /api/members/:id/foto`, `DELETE /api/members/:id` |
| Absen | `GET/POST /api/attendance` |
| Bukti/Lapsit | `GET/POST /api/evidence`, `GET /uploads-signed/evidence/:file` (signed URL), `GET/POST /api/lapsit` |
| Rincian | `GET/POST /api/breakdown`, `GET /api/checks` |
| Tukar | `POST /api/swaps`, `POST /api/swaps/:id/decide`, `POST /api/swaps/:id/cancel` |
| Petugas piket | `PUT /api/roster`, `GET/PUT/DELETE /api/roster/week` (admin) |
| Nilai | `GET /api/nilai/today`, `GET /api/nilai/leaderboard`, `GET /api/nilai/detail` (super) |
| Push/Presence | `GET /api/push/public-key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `POST /api/presence`, `POST /api/cron/reminder` (super) |
| Super | `POST /api/super/verify`, `POST /api/admin/verify`, `GET /api/super/overview`, `GET /api/super/feed` |
| Dev saja | `POST /api/dev/face-analyze` (tidak didaftarkan di produksi) |

---

## 📁 Struktur Project

```
├── src/                  # React app — App.tsx cuma composition root
│   ├── hooks/            # useAppStore (seluruh state + handler), useConfirm, useTypingPlaceholder
│   ├── tabs/             # HariTab, MingguanTab, TukarTab (presentasional)
│   ├── components/       # FaceCam, WeekDragBoard, PiketStepper, MakoPanel, BottomTabs, AppHeader,
│   │                     # PinSheet, KontakSheet, LogoutSheet, ConfirmSheet, PhotoPreview, Toast…
│   ├── Welcome.tsx       # login 2 jalur + wizard pendaftaran
│   ├── Super.tsx         # dashboard superadmin (Ringkasan/Absensi/Nilai/Anggota/Pengaturan)
│   ├── api.ts            # client API + fallback offline (localStorage)
│   ├── bukti.ts          # kompres WebP ≤40KB + stempel watermark + geo
│   ├── face.ts           # efek suara & getar scan wajah (pengenalan wajah ada di server)
│   └── sw.ts             # service worker: precache, cache foto bukti, push handler
├── server/
│   ├── index.ts          # Express API, rate-limit, scheduler pengingat H-1
│   ├── seed.ts           # template bukti + 34 master tugas
│   ├── face/             # challenge, CompreFace client, liveness MiniFASNet, pipeline, template terenkripsi
│   └── models/           # MiniFASNet ONNX
├── db/                   # skema Drizzle (SQLite + mirror Postgres), crypto AES-GCM, master nilai
├── public/               # aset PWA, brand, .well-known/assetlinks.json (verifikasi TWA)
├── android/              # proyek TWA Bubblewrap (twa-manifest.json)
├── deploy/               # deploy.sh + config produksi (compose CompreFace ramping, systemd, nginx)
├── infra/compreface/     # compose CompreFace lengkap untuk dev (termasuk UI admin)
└── scripts/              # gen-icons.py, face-check.ts
```

### 🎨 Ganti Brand Organisasi Lain
1. Timpa `public/brand/logo-menwa.png` dengan logo sendiri.
2. `python3 scripts/gen-icons.py` → ikon home-screen, splash, favicon ke-regenerate.
3. Sesuaikan nama di `index.html` + `vite.config.ts` (manifest) + petugas piket/bobot di seed.
4. Untuk APK: ganti `packageId`, `host`, dan nama di `android/twa-manifest.json`, buat keystore sendiri, perbarui `public/.well-known/assetlinks.json`.

---

## 📦 Deploy

**Produksi sekarang** (https://piket.example.com): API + CompreFace ramping di server rumah, nginx + file statis di VPS,
dihubungkan tunnel SSH. Update cukup `deploy/deploy.sh` (build → kirim kode → restart → kirim frontend). Skrip ini
**tidak pernah** menimpa `data/` (DB + upload), `.env`, dan `server/.vapid.json` di server. Konfigurasi ada di `deploy/`:
`compreface/` (cuma db + api + core, tanpa admin/UI — hemat ~430 MB RAM), `systemd/` (API + tunnel), `nginx/` (situs, unduhan APK, pembatas percobaan PIN).
Server membaca IP asli dari `X-Forwarded-For` hanya kalau datang dari loopback (`trust proxy`), jadi rate-limit dihitung per pengguna.

**APK Android (TWA, sideload — bukan Play Store):** proyek di `android/` (Bubblewrap, package `com.nohypelabs.piketmenwa`).
- Unduh versi terbaru (link tetap): https://github.com/nohypelabs/piket-menwa/releases/latest/download/piket-menwa.apk — butuh Google Chrome di HP.
- Verifikasi TWA lewat `public/.well-known/assetlinks.json` (fingerprint keystore).
- Keystore + password **tidak di repo**. Hilang = APK baru tidak bisa dipasang menimpa yang lama (anggota harus uninstall dulu) — wajib dicadangkan.
- Rilis versi baru: naikkan `appVersionCode`/`appVersion` di `android/twa-manifest.json` → `bubblewrap update --skipVersionUpgrade` →
  `bubblewrap build --skipPwaValidation` (password lewat env `BUBBLEWRAP_KEYSTORE_PASSWORD`/`BUBBLEWRAP_KEY_PASSWORD`) →
  `gh release create vX.Y.Z piket-menwa.apk --latest` (nama aset **harus** `piket-menwa.apk` supaya link tetap di atas ikut pindah).
- Perubahan tampilan/fitur web **tidak** butuh APK baru — TWA selalu memuat versi web terbaru. APK baru hanya kalau nama/ikon/izin/warna berubah.

Opsi lain:

- **Frontend** → Vercel / static hosting (HTTPS wajib untuk kamera + push).
- **Play Store** → `bubblewrap build` juga menghasilkan `.aab`; pakai **domain sendiri** dulu (origin TWA tidak bisa diganti tanpa rilis ulang & data pengguna di HP ikut hilang).
- **Backend** → VPS / Railway / Fly (butuh filesystem persisten untuk SQLite+upload), atau migrasi ke Supabase lalu jadikan serverless functions.
- **Migrasi Supabase** — skema PG sudah mirror 1:1 (`db/schema.pg.ts`): generate via drizzle-kit → migrate → ganti import schema + Storage untuk file.

---

## 🗺️ Roadmap
- [x] Push reminder H-1 otomatis (scheduler server 19.00 + endpoint cron)
- [x] Liveness anti-foto (challenge menoleh acak + MiniFASNet)
- [x] APK Android (TWA) sideload
- [ ] Domain sendiri (sebelum rilis Play Store)
- [ ] Backup otomatis DB + foto bukti ke lokasi lain
- [ ] Migrasi Supabase (Postgres + Storage + Auth opsional)
- [ ] Export rekap PDF/Excel untuk pembina

---

## 🧪 Lab & kalibrasi wajah (dev)

- `http://localhost:5173/face-lab.html` — tes kamera langsung: skor liveness, arah menoleh, similarity ke acuan. Endpoint-nya (`/api/dev/face-analyze`) **tidak ada di production**; hasil tercatat di `face-lab-log.jsonl`.
- `node --env-file-if-exists=.env scripts/face-check.ts foto1.jpg foto2.jpg` — cek file foto dari terminal.
- Batas bisa di-tune via env tanpa ubah kode: `FACE_MATCH_MIN` (0.9), `FACE_LIVE_MIN` (0.8), `FACE_MIN_PX` (90), `FACE_FRONTAL_MAX` (0.06), `FACE_TURN_MIN` (0.12).
- Similarity pakai kalibrasi resmi CompreFace (`(tanh((c0 − jarak) × c1) + 1) / 2`, >0.5 disarankan untuk keamanan tinggi).

> ⚠️ Lisensi: model InsightFace di CompreFace untuk **non-komersial / riset** (dipakai untuk pembelajaran anggota Menwa). Kalau aplikasi dijual/dipakai komersial, urus lisensi model dulu.

---

## 📜 Lisensi

Copyright © 2026 nohypelabs.

Kode aplikasi ini dirilis di bawah **[GNU Affero General Public License v3.0 atau yang lebih baru](LICENSE)** (AGPL-3.0-or-later).
Singkatnya: boleh dipakai, dipelajari, diubah, dan disebarkan — termasuk untuk organisasi lain — **asal** hasil turunannya
tetap berlisensi AGPL, dan kalau versi yang sudah diubah dijalankan sebagai layanan yang diakses orang lain lewat jaringan,
kode sumbernya wajib ikut dibuka untuk penggunanya. Tanpa jaminan apa pun. Teks lengkap di [`LICENSE`](LICENSE).

Komponen pihak ketiga tetap mengikuti lisensinya masing-masing — termasuk model wajah InsightFace di CompreFace
(**non-komersial**, lihat catatan di atas) dan model MiniFASNet di `server/models/` (Apache-2.0).
