import { useEffect, useState } from 'react';
import { Copy, Eye, Link2Off, RefreshCw, Share2 } from 'lucide-react';
import { loadPantauToken, matikanPantau, rotatePantauToken } from '../api';
import { Button } from './Button';
import { ShakeErr } from './Motion';

// Superadmin: SATU link rahasia untuk senior/alumni melihat laporan piket tanpa
// login (hanya lihat, tanpa nilai). Bocor? "Ganti link" — link lama langsung mati.
export function PantauPanel({ ask }: { ask: (o: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean> }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [disalin, setDisalin] = useState(false);

  useEffect(() => {
    void loadPantauToken().then((t) => {
      if (t === undefined) setGagalMuat(true);
      else setToken(t);
    });
  }, []);

  const link = token ? `${location.origin}/pantau/#${token}` : '';
  const pesanWa = `Laporan piket Menwa USB YPKP (hanya lihat, tanpa login):\n${link}`;

  const buat = async (ganti: boolean) => {
    if (ganti && !(await ask({
      title: 'Ganti link pemantau?', confirmLabel: 'Ganti link', danger: true,
      message: 'Link lama langsung tidak berlaku. Kirim link baru ke grup senior/alumni.',
    }))) return;
    setBusy(true);
    setErr(null);
    const t = await rotatePantauToken();
    setBusy(false);
    if (t) setToken(t);
    else setErr('Gagal membuat link.');
  };

  const matikan = async () => {
    if (!(await ask({
      title: 'Matikan link pemantau?', confirmLabel: 'Matikan', danger: true,
      message: 'Senior/alumni tidak bisa membuka laporan sampai link baru dibuat.',
    }))) return;
    setBusy(true);
    setErr(null);
    const ok = await matikanPantau();
    setBusy(false);
    if (ok) setToken(null);
    else setErr('Gagal mematikan link.');
  };

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setDisalin(true);
      setTimeout(() => setDisalin(false), 2000);
    } catch {
      setErr('Gagal menyalin — tekan lama link di atas lalu salin manual.');
    }
  };

  return (
    <div className="card makopanel">
      <b><Eye size={15} /> Link pemantau (senior/alumni)</b>
      <p className="hint">
        Laporan piket <b>hanya lihat</b>, tanpa login: kalender, foto bukti, ceklis & lapsit. Nilai tidak ditampilkan.
      </p>
      {gagalMuat && <p className="hint werr">Link belum bisa dimuat — cek koneksi / PIN superadmin.</p>}
      {token && <p className="pantaulink">{link}</p>}
      <ShakeErr msg={err} />
      {token === null && (
        <Button busy={busy} onClick={() => void buat(false)}><Eye size={15} /> Buat link pemantau</Button>
      )}
      {token && (
        <>
          <div className="pantaurow">
            <Button variant="secondary" onClick={() => void salin()}><Copy size={15} /> {disalin ? 'Tersalin' : 'Salin'}</Button>
            <Button variant="secondary" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(pesanWa)}`, '_blank', 'noreferrer')}>
              <Share2 size={15} /> Kirim ke WA
            </Button>
          </div>
          <div className="pantaurow">
            <Button variant="secondary" busy={busy} onClick={() => void buat(true)}><RefreshCw size={15} /> Ganti link</Button>
            <Button variant="secondary" busy={busy} onClick={() => void matikan()}><Link2Off size={15} /> Matikan</Button>
          </div>
        </>
      )}
    </div>
  );
}
