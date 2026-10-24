# Absen: mode wajah vs QR — dan cara ganti kalau salah satu bermasalah

Dokumen ini bahasa manusia biasa, tanpa istilah teknis. Untuk dipakai saat panik.

## Intinya: ada 2 cara absen, tapi cuma SATU yang nyala

Server memilih sendiri berdasarkan satu baris setelan di `.env` VPS:

| Setelan | Yang dipakai untuk absen | QR-nya |
|---|---|---|
| `FACE_ENABLED=true` ← **SEKARANG** | **Scan wajah** di mako | Tidur. Walau ada yang scan QR, tidak dihitung |
| `FACE_ENABLED=false` | **Scan QR** yang ditempel di mako + geofence | Aktif |

Bukan dua-duanya sekaligus. Jadi tidak perlu "mematikan QR" — QR memang sudah otomatis tidak dipakai
selama mode wajah menyala. Ini bukan setelan terpisah, tapi satu saklar yang sama.

## Kalau absen wajah rusak — balik ke QR dalam 10 detik

**Gejalanya:** anggota dapat pesan *"Layanan verifikasi wajah sedang tidak tersedia — coba lagi sebentar."*
Biasanya karena CompreFace di sandbox Instabox mati, atau tunnel-nya putus.

```bash
sed -i 's/^FACE_ENABLED=.*/FACE_ENABLED=false/' /opt/piket-menwa/.env
systemctl restart piket-menwa
```

Selesai. Absen QR langsung hidup — token QR-nya sudah ada di server, tidak perlu bikin baru.
Pastikan saja kertas QR-nya masih ditempel di mako.

Tidak perlu deploy, tidak perlu build, tidak perlu menyentuh sandbox.

## Cek dulu: CompreFace masih hidup atau tidak?

Jalankan di VPS app:

```bash
# 1. tunnel-nya nyambung?
ss -ltn | grep 8100

# 2. CompreFace menjawab? (400 = hidup, cuma tidak ada gambar yang dikirim)
K=$(sed -n 's/^COMPREFACE_DETECT_KEY=//p' /opt/piket-menwa/.env | tr -d '\r\n"')
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "x-api-key: $K" \
  -H 'Content-Type: application/json' http://127.0.0.1:8100/api/v1/detection/detect
```

- `400` → CompreFace hidup, masalahnya di tempat lain
- `000` atau connection refused → tunnel/CompreFace mati → pakai jalur QR di atas

Kalau tunnel yang mati, cek di sandbox: `sudo systemctl status piket-cf-tunnel`.
Kalau container yang mati: `sudo docker ps` di sandbox (harusnya otomatis nyala lagi karena `restart: unless-stopped`).

## Kalau sandbox Instabox-nya mati (penyebab paling sering)

CompreFace **tidak** jalan di VPS app (RAM 1 GB tidak cukup) — ia jalan di sandbox Instabox.
Mesin free otomatis **pause setelah 8 jam berjalan** (cap 480 menit/run) atau 30 menit idle.
Saat sandbox mati, tunnel `127.0.0.1:8100` hilang → app mengembalikan pesan "Layanan verifikasi wajah
sedang tidak tersedia".

VPS app punya `piket-keepalive.timer` yang sekarang **self-healing tiap 5 menit**:

1. memperpanjang activity lease (anti-pause karena idle), dan
2. kalau sandbox ternyata mati (`HTTP 409 machine_not_running`), **membangunkan otomatis** lewat API
   `POST /v1/machines/<id>/wake` lalu menunggu port `8100` hidup lagi (maks ~2 menit).

Cek statusnya di VPS app:

```bash
systemctl status piket-keepalive --no-pager      # run terakhir: "lease ok"
journalctl -u piket-keepalive -n 20 --no-pager   # kalau ada "sandbox tidak jalan (409)" -> auto wake
ss -ltn | grep 8100                              # tunnel hidup?
```

Kalau masih kosong, bangunkan manual dari laptop yang punya akses Instabox:

```bash
instabox wake abdul-server    # nama mesin sandbox CompreFace piket-menwa
instabox get abdul-server     # pastikan State: Running
```

Setelah sandbox Running, container (`piket-cf-*`) dan `piket-cf-tunnel.service` nyala otomatis;
tunggu ±30–60 detik sampai port `8100` muncul di VPS app. Sementara itu, anggota tetap bisa absen
lewat jalur QR kalau `FACE_ENABLED=false` (lihat bagian atas).

## Balik lagi ke mode wajah (kalau sudah beres)

```bash
sed -i 's/^FACE_ENABLED=.*/FACE_ENABLED=true/' /opt/piket-menwa/.env
systemctl restart piket-menwa
```

Cek hasilnya: `curl -s http://127.0.0.1:8080/api/state | grep -o 'faceEnabled[^,]*'`

## Aturan aman

1. **Selalu salin `.env` dulu sebelum diubah:**
   ```bash
   cd /opt/piket-menwa && cp .env ".env.bak-$(date +%F-%H%M)"
   ```
2. **Jangan pernah edit `data/`** — di situ ada database absen, bukti foto, dan template wajah.
3. **Jangan `pnpm install` di VPS** — RAM-nya cuma 1 GB, server bisa beku (lihat README utama).
4. Setelah ganti mode, **beri tahu anggota** — kalau mode wajah nyala, yang belum mendaftarkan wajah
   akan diminta scan sekali saat login berikutnya.

## Mengukur kualitas verifikasi wajah

Sejak 2026-10-17 ada empat perbaikan supaya user tidak perlu mengulang scan
(**tidak ada template yang perlu didaftarkan ulang**):

| Perubahan | Alasan |
|---|---|
| `FACE_TURN_MIN` 0,12 → **0,09** | user yang menoleh "tanggung" (~0,10) dulu ditolak padahal asli; foto datar nilainya ~0 jadi anti-spoof praktis sama |
| alasan baru **`too_dark`** | dulu kegagalan karena gelap dilaporkan sebagai "tidak lolos cek wajah asli". Sekarang pesannya jelas: pindah ke tempat terang |
| panduan capture di kamera | "Cahaya dari depan · jarak 30–40 cm · isi oval dengan wajah" muncul sebelum tombol Mulai |
| `IMG_LENGTH_LIMIT` 640 → **1024** | wajah di frame HP lebih detail saat dideteksi (model tetap sama, template lama tetap cocok) |

Cara mengukur (jalankan di VPS app):

```bash
cd /opt/piket-menwa
node scripts/face-stats.cjs 1      # hari ini
node scripts/face-stats.cjs 7      # seminggu
```

Cara membaca hasilnya:

- **sukses %** — target **>80%**. Di bawah itu, cek alasan terbanyak di bawah.
- **`too_dark`** banyak → user banyak scan di tempat gelap; panduan/penempatan mako perlu diperbaiki.
- **`no_turn`** masih banyak → user tidak menoleh cukup. Bisa diturunkan lagi lewat env:
  `FACE_TURN_MIN=0.08` di `.env` lalu restart (tanpa deploy).
- **`spoof`** banyak → kamera kotor / layar redup / benar-benar ada percobaan palsu.
- **`mismatch`** harus **~0**. Kalau muncul, itu indikasi serius (wajah berubah di tengah scan).

Semua ambang bisa diubah tanpa deploy lewat `.env`:
`FACE_MATCH_MIN`, `FACE_LIVE_MIN`, `FACE_MIN_PX`, `FACE_FRONTAL_MAX`, `FACE_TURN_MIN`, `FACE_DARK_LUMA`.
