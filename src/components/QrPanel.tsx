import { useEffect, useState } from 'react';
import { QrCode, RefreshCw } from 'lucide-react';
import { loadQrToken, rotateQrToken } from '../api';
import { qrUrl } from '../qr';
import { Button } from './Button';
import { ShakeErr } from './Motion';

// Superadmin: QR statis mako untuk absen (pengganti scan wajah). Cetak / simpan
// gambarnya, tempel di mako. Bocor? "Buat QR baru" — QR lama langsung tidak berlaku.
export function QrPanel({ ask }: { ask: (o: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean> }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void loadQrToken().then(setToken); }, []);
  useEffect(() => {
    if (!token) return;
    let batal = false;
    void import('qrcode').then((m) => m.toDataURL(qrUrl(token), { width: 360, margin: 2, errorCorrectionLevel: 'M' }))
      .then((u) => { if (!batal) setImg(u); });
    return () => { batal = true; };
  }, [token]);

  const baru = async () => {
    if (!(await ask({ title: 'Buat QR baru?', message: 'QR lama yang sudah ditempel di mako langsung tidak berlaku.', confirmLabel: 'Buat baru', danger: true }))) return;
    setBusy(true);
    setErr(null);
    const t = await rotateQrToken();
    setBusy(false);
    if (t) setToken(t);
    else setErr('Gagal membuat QR baru.');
  };

  return (
    <div className="card makopanel">
      <b><QrCode size={15} /> QR absen mako</b>
      {token === null && <p className="hint werr">QR belum bisa dimuat — cek koneksi / PIN superadmin.</p>}
      {img && <img src={img} alt="QR absen mako" width={240} height={240} style={{ alignSelf: 'center', background: '#fff', borderRadius: 8 }} />}
      {token && <p className="hint">Kode manual: <b>{token}</b></p>}
      <p className="hint">
        Cetak / simpan gambar ini dan tempel di mako. Anggota scan dengan kamera HP atau lewat tombol Absen.
        {img && <> <a href={img} download="qr-absen-mako.png">Unduh gambar</a></>}
      </p>
      <ShakeErr msg={err} />
      <Button variant="secondary" busy={busy} onClick={() => void baru()}>
        <RefreshCw size={15} /> Buat QR baru
      </Button>
    </div>
  );
}
