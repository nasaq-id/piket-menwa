// Logika kapan banner ajakan menyalakan notifikasi ditampilkan. Dipisah dari
// komponen supaya file komponen hanya mengekspor komponen (fast refresh) dan
// logikanya bisa diuji tanpa React.
const NUDGE_KEY = 'piket-notif-nudge';
const ULANG_MS = 7 * 24 * 60 * 60 * 1000; // kalau user pilih "Nanti", tanya lagi setelah 7 hari

/**
 * - browser mendukung Web Push (Notification + serviceWorker + PushManager),
 * - izin masih "default" (belum pernah diputuskan),
 * - aplikasi sedang berjalan sebagai aplikasi TERPASANG (TWA/PWA standalone) —
 *   di tab browser biasa banner tidak perlu (dan di iOS tab biasa izin memang tidak ada),
 * - belum pernah ditutup dalam 7 hari terakhir.
 */
export function perluPromptNotif(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (Notification.permission !== 'default') return false;
  const standalone = typeof window.matchMedia === 'function'
    && window.matchMedia('(display-mode: standalone)').matches;
  const twa = typeof document !== 'undefined' && document.referrer.startsWith('android-app://');
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (!standalone && !twa && !iosStandalone) return false;
  try {
    const last = Number(localStorage.getItem(NUDGE_KEY) ?? 0);
    if (last > 0 && Date.now() - last < ULANG_MS) return false;
  } catch { /* localStorage bisa diblokir */ }
  return true;
}

/** Tandai sudah ditanya (dipakai tombol Nanti / Nyalakan). */
export function tandaiPromptNotif(): void {
  try { localStorage.setItem(NUDGE_KEY, String(Date.now())); } catch { /* abaikan */ }
}
