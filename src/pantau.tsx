import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence } from 'framer-motion';
import './index.css';
import { loadPantauHari, loadPantauLaporan, type LaporanPantau } from './api';
import { Empty } from './components/Empty';
import { PhotoPreview } from './components/PhotoPreview';
import type { PreviewState } from './hooks/useAppStore';
import { LaporanView } from './tabs/LaporanTab';

// Halaman pemantau senior/alumni: laporan bukti piket HANYA LIHAT, tanpa login.
// Link: /pantau/#<token> — token di hash supaya tidak ikut log server/Referer.
const token = location.hash.slice(1);

function Pantau() {
  const [members, setMembers] = useState<LaporanPantau['members']>([]);
  const [mati, setMati] = useState(!token);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  return (
    <div className="phone tac pantau">
      <header className="hd">
        <h1>Laporan Piket Menwa USB YPKP</h1>
        <p>Akses pemantau · hanya lihat</p>
      </header>
      <main>
        {mati
          ? <Empty text="Link pemantau tidak berlaku. Minta link terbaru ke pengurus." />
          : (
            <LaporanView
              members={members}
              muatBulan={async (bulan) => {
                const r = await loadPantauLaporan(token, bulan);
                if (r === 'mati') { setMati(true); return null; }
                if (r) setMembers(r.members);
                return r;
              }}
              muatHari={(t) => loadPantauHari(token, t)}
              onPreview={setPreview}
              tampilNilai={false}
              pesanGagal="Laporan gagal dimuat. Periksa koneksi internet, lalu muat ulang halaman."
            />
          )}
      </main>
      <AnimatePresence>
        {preview && <PhotoPreview preview={preview} isAdmin={false} viewerName="" onClose={() => setPreview(null)} />}
      </AnimatePresence>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Pantau />
  </StrictMode>,
);
