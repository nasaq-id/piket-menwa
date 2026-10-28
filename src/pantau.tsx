import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence } from 'framer-motion';
import { Eye } from 'lucide-react';
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
    <div className="phone pantau">
      <header className="hd">
        <span />
        <div>
          <h1>Laporan Piket</h1>
          <p>Menwa USB YPKP</p>
        </div>
        <span />
      </header>
      <p className="pantaubar"><Eye size={15} /> Mode pantau — hanya lihat</p>
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
              pesanGagal="Gagal memuat laporan — periksa koneksi internet lalu muat ulang halaman."
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
