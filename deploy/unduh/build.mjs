#!/usr/bin/env node
/**
 * Bangun halaman unduh APK statis (self-contained) dari template.
 *
 *   node deploy/unduh/build.mjs
 *
 * Input:
 *   APP_URL   — alamat publik aplikasi; kalau kosong dibaca dari deploy/deploy.env
 *   APK_PATH  — default android/app-release-signed.apk (harus APK yang benar-benar dilayani)
 *
 * Output: deploy/unduh/index.html (di-gitignore; berisi domain asli + QR).
 * Template di repo hanya berisi placeholder supaya domain tidak ikut ter-commit.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const TEMPLATE = path.join(HERE, 'index.template.html');
const OUTPUT = path.join(HERE, 'index.html');
const GH_URL = 'https://github.com/nohypelabs/piket-menwa/releases/latest/download/piket-menwa.apk';

/** Baca APP_URL dari env, atau dari deploy/deploy.env (file lokal, di-gitignore). */
async function resolveAppUrl() {
  const fromEnv = (process.env.APP_URL || '').trim();
  if (fromEnv) return fromEnv;

  const envFile = path.join(ROOT, 'deploy/deploy.env');
  if (existsSync(envFile)) {
    const text = await readFile(envFile, 'utf8');
    const m = text.match(/^\s*APP_URL\s*=\s*"?([^"\n]+)"?\s*$/m);
    if (m) return m[1].trim();
  }
  return 'https://piket.example.com';
}

async function resolveVersion() {
  for (const f of ['android/twa-manifest.json', 'android/twa-manifest.example.json']) {
    const p = path.join(ROOT, f);
    if (existsSync(p)) {
      try {
        const m = JSON.parse(await readFile(p, 'utf8'));
        if (m.appVersion) return String(m.appVersion);
      } catch {
        /* lanjut ke fallback */
      }
    }
  }
  return '1.0.0';
}

const formatBytesMb = (bytes) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes / 1e6) + ' MB';

const formatDate = (date) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(date);

const appUrl = (await resolveAppUrl()).replace(/\/+$/, '');
const pageUrl = `${appUrl}/unduh/`;
const apkUrl = `${appUrl}/unduh/piket-menwa.apk`;
const apkPath = process.env.APK_PATH || path.join(ROOT, 'android/app-release-signed.apk');

if (!existsSync(apkPath)) {
  console.error(`APK tidak ditemukan: ${apkPath}\nSet APK_PATH atau taruh APK rilis di sana.`);
  process.exit(1);
}

const apk = await readFile(apkPath);
const apkStat = await stat(apkPath);
const sha256 = createHash('sha256').update(apk).digest('hex');
const version = await resolveVersion();

const qrSvg = await QRCode.toString(pageUrl, {
  type: 'svg',
  margin: 1,
  width: 216,
  errorCorrectionLevel: 'M',
  color: { dark: '#0f1413', light: '#ffffff' },
});

// Pastikan QR benar-benar bisa dipindai dan mengarah ke halaman unduh.
{
  const raster = await sharp(Buffer.from(qrSvg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(raster.data), raster.info.width, raster.info.height);
  if (!decoded || decoded.data !== pageUrl) {
    console.error(`QR gagal diverifikasi (hasil: ${decoded ? decoded.data : 'tidak terbaca'}, harusnya: ${pageUrl})`);
    process.exit(1);
  }
}

const logoWebp = await sharp(path.join(ROOT, 'public/brand/logo-menwa.png'))
  .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 82 })
  .toBuffer();
const logoDataUri = `data:image/webp;base64,${logoWebp.toString('base64')}`;

const replacements = {
  __LOGO_SRC__: logoDataUri,
  __APP_URL__: appUrl,
  __PAGE_URL__: pageUrl,
  __APK_URL__: apkUrl,
  __APK_LINK__: apkUrl,
  __APK_FILENAME__: 'piket-menwa.apk',
  __VERSION__: version,
  __SIZE__: formatBytesMb(apkStat.size),
  __DATE__: formatDate(apkStat.mtime),
  __SHA256__: sha256,
  __GH_URL__: GH_URL,
  __QR_SVG__: qrSvg.trim(),
};

let html = await readFile(TEMPLATE, 'utf8');
for (const [key, value] of Object.entries(replacements)) {
  html = html.split(key).join(value);
}

const leftovers = html.match(/__[A-Z0-9_]+__/g);
if (leftovers) {
  console.error(`Placeholder belum terisi: ${[...new Set(leftovers)].join(', ')}`);
  process.exit(1);
}

await writeFile(OUTPUT, html, 'utf8');

console.log(`Halaman unduh siap: ${path.relative(ROOT, OUTPUT)} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
console.log(`  URL halaman : ${pageUrl}`);
console.log(`  URL APK     : ${apkUrl}`);
console.log(`  APK         : ${path.relative(ROOT, apkPath)} — ${formatBytesMb(apkStat.size)}, v${version}, ${formatDate(apkStat.mtime)}`);
console.log(`  SHA-256     : ${sha256}`);
console.log('');
console.log('Unggah ke server yang melayani /unduh/ (contoh):');
console.log('  scp deploy/unduh/index.html root@PUBLIC_HOST:/var/www/piket-menwa-unduh/index.html');
