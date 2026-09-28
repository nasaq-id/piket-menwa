import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Crosshair, MapPin } from 'lucide-react';
import { loadMako, superPut } from '../api';
import { getGeo } from '../bukti';
import { Button } from './Button';
import { ShakeErr } from './Motion';

// Superadmin: titik mako untuk geofence absen. Cara termudah: berdiri di
// mako, tap "Pakai lokasi saya sekarang", atur radius, simpan.
export function MakoPanel() {
  const [cur, setCur] = useState<{ lat: number; lng: number; radius: number } | null | undefined>(undefined);
  const [draft, setDraft] = useState<{ lat: number; lng: number; acc?: number } | null>(null);
  const [radius, setRadius] = useState('100');
  const [gpsBusy, setGpsBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void loadMako().then((m) => {
      setCur(m);
      if (m) setRadius(String(m.radius));
    });
  }, []);

  const pakaiLokasi = async () => {
    setGpsBusy(true);
    setErr(null);
    setMsg(null);
    const g = await getGeo(15_000);
    setGpsBusy(false);
    if (!g) return setErr('Lokasi tidak terbaca — izinkan akses lokasi di browser.');
    setDraft(g);
    if (g.acc > 50) setMsg(`Akurasi GPS ±${Math.round(g.acc)} m — kalau bisa ulangi dekat jendela / area terbuka.`);
  };

  const simpan = async () => {
    const p = draft ?? cur;
    if (!p) return setErr('Ambil lokasi dulu.');
    setSaveBusy(true);
    const r = await superPut('/api/settings/mako', { lat: p.lat, lng: p.lng, radius: Number(radius) });
    setSaveBusy(false);
    if (!r.ok) return setErr(r.error ?? 'Gagal simpan.');
    setCur({ lat: p.lat, lng: p.lng, radius: Number(radius) });
    setDraft(null);
    setMsg('Lokasi mako tersimpan ✓');
  };

  const shown = draft ?? cur;
  return (
    <div className="card makopanel">
      <b><MapPin size={15} /> Lokasi mako (geofence absen)</b>
      {cur === null && !draft && (
        <p className="hint werr">Belum diatur — anggota BELUM bisa absen sampai lokasi mako disimpan.</p>
      )}
      <AnimatePresence mode="wait" initial={false}>
        {shown && (
          <motion.p
            key={`${shown.lat},${shown.lng}`} className="hint"
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {draft ? 'Baru (belum disimpan): ' : 'Tersimpan: '}
            <a href={`https://maps.google.com/?q=${shown.lat},${shown.lng}`} target="_blank" rel="noreferrer">
              {shown.lat.toFixed(6)}, {shown.lng.toFixed(6)}
            </a>
            {draft?.acc !== undefined && ` (±${Math.round(draft.acc)} m)`}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="row">
        <Button variant="secondary" busy={gpsBusy} onClick={() => void pakaiLokasi()}>
          <Crosshair size={15} /> {gpsBusy ? 'Membaca GPS…' : 'Pakai lokasi saya sekarang'}
        </Button>
      </div>
      <label className="wfield">
        <span>Radius (meter)</span>
        <input type="number" inputMode="numeric" min={20} max={2000} value={radius} onChange={(e) => setRadius(e.target.value)} />
      </label>
      <ShakeErr msg={err} />
      <AnimatePresence>
        {msg && (
          <motion.p className="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{msg}</motion.p>
        )}
      </AnimatePresence>
      <Button variant="primary" busy={saveBusy} disabled={!shown} onClick={() => void simpan()}>Simpan lokasi mako</Button>
    </div>
  );
}
