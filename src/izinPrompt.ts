// Logika kapan banner izin (notifikasi & lokasi) ditampilkan. Dipisah dari
// komponen supaya bisa diuji tanpa React dan file komponen hanya ekspor komponen.
const NUDGE_NOTIF = 'piket-izin-notif';
const NUDGE_LOKASI = 'piket-izin-lokasi';
const ULANG_MS = 7 * 24 * 60 * 60 * 1000; // kalau pilih "Nanti", tanya lagi setelah 7 hari

function sudahDitandai(key: string, ttlMs = ULANG_MS): boolean {
  try {
    const last = Number(localStorage.getItem(key) ?? 0);
    return last > 0 && Date.now() - last < ttlMs;
  } catch { return false; }
}

export const tandaiNotif = (): void => {
  try { localStorage.setItem(NUDGE_NOTIF, String(Date.now())); } catch { /* abaikan */ }
};
export const tandaiLokasi = (): void => {
  try { localStorage.setItem(NUDGE_LOKASI, String(Date.now())); } catch { /* abaikan */ }
};

export type ModeNotif = 'enable' | 'ios-install' | null;

/**
 * Prompt notifikasi tampil untuk SEMUA pengguna yang membuka lewat browser
 * (terpasang maupun belum):
 * - 'enable'      → browser mendukung Web Push & izin masih default.
 * - 'ios-install' → iPhone/iPad yang masih di tab Safari: Web Push baru bisa
 *                   SETELAH dipasang ke Layar Utama, jadi banner mengarahkan
 *                   ke cara pasang (/unduh/).
 * null = tidak perlu (sudah granted/denied, tidak didukung, atau baru ditutup).
 */
export function modePromptNotif(): ModeNotif {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  if (sudahDitandai(NUDGE_NOTIF)) return null;

  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua)
    || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1); // iPadOS 13+ menyamar jadi Mac
  const standalone = (typeof window.matchMedia === 'function'
    && window.matchMedia('(display-mode: standalone)').matches)
    || (navigator as unknown as { standalone?: boolean }).standalone === true; // iOS home-screen
  const twa = typeof document !== 'undefined' && document.referrer.startsWith('android-app://');
  const terpasang = standalone || twa;

  if (ios && !terpasang) return 'ios-install';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  if (Notification.permission !== 'default') return null;
  return 'enable';
}

export type IzinLokasi = 'checking' | 'prompt' | 'granted' | 'denied' | 'unknown';

/** Baca status izin lokasi (geofence absen). 'unknown' = browser tanpa Permissions API. */
export async function cekIzinLokasi(): Promise<IzinLokasi> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'denied';
  const perms = (navigator as unknown as { permissions?: { query?: (d: { name: string }) => Promise<{ state: string }> } }).permissions;
  if (!perms?.query) return 'unknown';
  try {
    const st = await perms.query({ name: 'geolocation' });
    const s = st.state;
    return s === 'granted' || s === 'denied' || s === 'prompt' ? s : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * - state 'prompt'  → tampilkan (kalau belum ditutup dalam 7 hari).
 * - 'unknown'       → browser tanpa Permissions API: tampilkan SEKALI saja;
 *                     kalau lokasi sudah diizinkan, menekan tombol hanya
 *                     menyelesaikan permintaan tanpa dialog.
 */
export function perluPromptLokasi(state: IzinLokasi): boolean {
  if (state === 'prompt') return !sudahDitandai(NUDGE_LOKASI);
  if (state === 'unknown') return !sudahDitandai(NUDGE_LOKASI, Number.POSITIVE_INFINITY);
  return false;
}
