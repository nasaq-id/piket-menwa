// QR mako: isinya URL aplikasi + ?absen=<token>. Kamera bawaan HP membuka URL itu,
// token disimpan sampai dipakai absen. Scan dalam aplikasi / ketik manual juga bisa.
const KEY = 'piket-qr';

// Ambil token dari URL QR lengkap ATAU kode polos (hasil ketik/tempel manual).
export const extractQrToken = (text: string): string => {
  const t = text.trim();
  try {
    const q = new URL(t).searchParams.get('absen');
    if (q) return q;
  } catch { /* bukan URL → anggap kode polos */ }
  return t;
};

export const qrUrl = (token: string) => `${location.origin}/?absen=${encodeURIComponent(token)}`;

export const getSavedQr = (): string | null => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};
export const saveQr = (token: string) => {
  try { localStorage.setItem(KEY, token); } catch { /* abaikan */ }
};
export const clearSavedQr = () => {
  try { localStorage.removeItem(KEY); } catch { /* abaikan */ }
};

// Dipanggil sekali saat aplikasi dibuka: simpan token dari ?absen= lalu bersihkan URL.
export const captureQrFromUrl = (): boolean => {
  const q = new URLSearchParams(location.search).get('absen');
  if (!q) return false;
  saveQr(q);
  history.replaceState(null, '', location.pathname + location.hash);
  return true;
};
