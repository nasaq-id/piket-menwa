import { useState } from 'react';
import { perluPromptNotif, tandaiPromptNotif } from '../notifPrompt';

/** Banner kecil di bawah header: minta izin notifikasi lewat tap user (syarat iOS & Chrome). */
export function NotifPrompt({ onEnable }: { onEnable: () => Promise<void> }) {
  const [hidden, setHidden] = useState(false);
  if (hidden || !perluPromptNotif()) return null;

  const nyalakan = async () => {
    tandaiPromptNotif();
    await onEnable(); // harus dipanggil dari gesture user
    setHidden(true);
  };
  const nanti = () => { tandaiPromptNotif(); setHidden(true); };

  return (
    <div className="notifbar" role="region" aria-label="Aktifkan notifikasi">
      <p><b>Nyalakan notifikasi</b> biar dapat info absen, terlambat, ceklis, dan pengingat piket.</p>
      <div className="row">
        <button type="button" onClick={nanti}>Nanti</button>
        <button type="button" className="primary" onClick={() => void nyalakan()}>Nyalakan</button>
      </div>
    </div>
  );
}
