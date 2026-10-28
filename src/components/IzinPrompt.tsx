import { useEffect, useState } from 'react';
import {
  cekIzinLokasi, modePromptNotif, perluPromptLokasi, tandaiLokasi, tandaiNotif,
  type IzinLokasi,
} from '../izinPrompt';

/**
 * Banner izin setelah login — berlaku untuk semua pembuka web, terpasang maupun
 * belum: notifikasi (atau arahan pasang di iPhone tab Safari) + lokasi untuk
 * geofence absen. Izin selalu diminta dari tap user (syarat Chrome/iOS).
 */
export function IzinPrompt({ onEnableNotif, absenEnabled }: { onEnableNotif: () => Promise<void>; absenEnabled: boolean }) {
  const [sembunyiNotif, setSembunyiNotif] = useState(false);
  const [sembunyiLokasi, setSembunyiLokasi] = useState(false);
  const [lokasi, setLokasi] = useState<IzinLokasi>('checking');

  useEffect(() => {
    let hidup = true;
    cekIzinLokasi()
      .then((s) => { if (hidup) setLokasi(s); })
      .catch(() => { if (hidup) setLokasi('unknown'); });
    return () => { hidup = false; };
  }, []);

  const mode = sembunyiNotif ? null : modePromptNotif();
  const tampilLokasi = !sembunyiLokasi && perluPromptLokasi(lokasi);

  const nyalakanNotif = async () => {
    tandaiNotif();
    await onEnableNotif(); // harus dari gesture user
    setSembunyiNotif(true);
  };
  const nantiNotif = () => { tandaiNotif(); setSembunyiNotif(true); };

  const aktifkanLokasi = () => {
    tandaiLokasi();
    try {
      navigator.geolocation.getCurrentPosition(
        () => { /* diizinkan */ },
        () => { /* ditolak — absen akan memberi pesan sendiri */ },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
      );
    } catch { /* abaikan */ }
    setSembunyiLokasi(true);
  };
  const nantiLokasi = () => { tandaiLokasi(); setSembunyiLokasi(true); };

  if (!mode && !tampilLokasi) return null;

  return (
    <>
      {mode === 'enable' && (
        <div className="notifbar" role="region" aria-label="Aktifkan notifikasi">
          <p><b>Nyalakan notifikasi</b> biar dapat info absen, terlambat, ceklis, dan pengingat piket.</p>
          <div className="row">
            <button type="button" onClick={nantiNotif}>Nanti</button>
            <button type="button" className="primary" onClick={() => void nyalakanNotif()}>Nyalakan</button>
          </div>
        </div>
      )}

      {mode === 'ios-install' && (
        <div className="notifbar" role="region" aria-label="Pasang aplikasi untuk notifikasi">
          <p><b>Notifikasi iPhone</b> baru aktif setelah aplikasi dipasang ke Layar Utama.</p>
          <div className="row">
            <button type="button" onClick={nantiNotif}>Nanti</button>
            <button
              type="button"
              className="primary"
              onClick={() => { nantiNotif(); location.href = '/unduh/'; }}
            >
              Cara pasang
            </button>
          </div>
        </div>
      )}

      {tampilLokasi && (
        <div className="notifbar" role="region" aria-label="Aktifkan lokasi">
          <p><b>Aktifkan lokasi</b> — {absenEnabled ? 'dipakai untuk memastikan absen dilakukan di area mako (geofence).' : 'dipakai untuk mencantumkan lokasi di foto bukti piket.'}</p>
          <div className="row">
            <button type="button" onClick={nantiLokasi}>Nanti</button>
            <button type="button" className="primary" onClick={aktifkanLokasi}>Aktifkan</button>
          </div>
        </div>
      )}
    </>
  );
}
