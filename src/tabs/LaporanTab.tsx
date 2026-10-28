import { AnimatePresence, motion } from 'framer-motion';
import { Camera, ChevronLeft, ChevronRight, ClipboardList, FileText } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadEvidence, loadLaporan, loadLapsit, type EvidenceRow, type Laporan, type LapsitRow, type Member } from '../api';
import { Empty } from '../components/Empty';
import type { AppStore, PreviewState } from '../hooks/useAppStore';

// Laporan bukti piket: kalender bulanan berwarna per hari, ketuk tanggal → foto
// bukti, ceklis & lapsit tiap petugas. Mobile-first. Dipakai MODE ADMIN (tab
// Laporan, dengan nilai) dan halaman pemantau alumni (/pantau, tanpa nilai).
type Status = 'lengkap' | 'sebagian' | 'kosong' | 'nanti';
type Petugas = Omit<Laporan['days'][number]['petugas'][number], 'nilai'> & { nilai?: number };
export type LaporanData = { bulan: string; today: string; days: { tanggal: string; petugas: Petugas[] }[] };
export type HariData = {
  evidence: Pick<EvidenceRow, 'id' | 'tugas' | 'memberId' | 'file'>[];
  lapsit: Pick<LapsitRow, 'memberId' | 'catatan'>[];
};
type Anggota = Pick<Member, 'id' | 'nama' | 'warna' | 'foto'>;

const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const LABEL: Record<Status, string> = { lengkap: 'lengkap', sebagian: 'sebagian', kosong: 'kosong', nanti: 'belum lewat' };

const pad = (n: number) => String(n).padStart(2, '0');
const geserBulan = (bulan: string, n: number) => {
  const [y, m] = bulan.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const tglPanjang = (t: string) =>
  new Date(t + 'T00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

const lengkap = (p: Petugas) => p.foto >= p.fotoMax && p.lapsit;
const kosong = (p: Petugas) => p.foto === 0 && p.ceklis === 0 && !p.lapsit;
// Hari ini & ke depan belum dinilai (piket bisa masih berjalan).
const statusHari = (tanggal: string, today: string, ps: Petugas[]): Status => {
  if (tanggal >= today && !ps.every(lengkap)) return 'nanti';
  if (ps.every(lengkap)) return 'lengkap';
  if (ps.every(kosong)) return 'kosong';
  return 'sebagian';
};

export function LaporanTab({ store }: { store: AppStore }) {
  return (
    <LaporanView
      members={store.members}
      muatBulan={loadLaporan}
      muatHari={async (t) => {
        const [evidence, lapsit] = await Promise.all([loadEvidence(t, t), loadLapsit(t, t)]);
        return { evidence: evidence ?? [], lapsit: lapsit ?? [] };
      }}
      onPreview={store.setPreview}
      tampilNilai
      pesanGagal="Gagal memuat laporan — pastikan online & mode admin aktif."
    />
  );
}

export function LaporanView({ members, muatBulan, muatHari, onPreview, tampilNilai, pesanGagal }: {
  members: Anggota[];
  muatBulan: (bulan: string) => Promise<LaporanData | null>;
  muatHari: (tanggal: string) => Promise<HariData | null>;
  onPreview: (p: PreviewState) => void;
  tampilNilai: boolean;
  pesanGagal: string;
}) {
  const nama = (id: string) => members.find((m) => m.id === id)?.nama ?? id;
  // Sumber data lewat ref: fungsi inline pemanggil tidak memicu muat ulang tiap render.
  const sumber = useRef({ muatBulan, muatHari });
  useEffect(() => { sumber.current = { muatBulan, muatHari }; });
  const [bulan, setBulan] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });
  const [data, setData] = useState<LaporanData | null>(null);
  const [gagal, setGagal] = useState(false);
  const [siapa, setSiapa] = useState(''); // '' = semua anggota
  const [pilih, setPilih] = useState<string | null>(null);
  const [ev, setEv] = useState<HariData['evidence'] | null>(null);
  const [laps, setLaps] = useState<HariData['lapsit']>([]);

  useEffect(() => {
    let batal = false;
    (async () => {
      setData(null);
      setGagal(false);
      const r = await sumber.current.muatBulan(bulan);
      if (batal) return;
      if (!r) return setGagal(true);
      setData(r);
      // Default: hari ini kalau ada di bulan ini, selain itu tanggal laporan terakhir.
      const adaHariIni = r.days.some((d) => d.tanggal === r.today);
      setPilih(adaHariIni ? r.today : r.days.filter((d) => d.tanggal <= r.today).at(-1)?.tanggal ?? null);
    })();
    return () => { batal = true; };
  }, [bulan]);

  // Foto & lapsit hanya dimuat untuk tanggal yang dipilih (hemat kuota).
  useEffect(() => {
    if (!pilih) return;
    let batal = false;
    (async () => {
      setEv(null);
      const h = await sumber.current.muatHari(pilih);
      if (batal) return;
      setEv(h?.evidence ?? []);
      setLaps(h?.lapsit ?? []);
    })();
    return () => { batal = true; };
  }, [pilih]);

  const hariMap = useMemo(() => {
    const m = new Map<string, Petugas[]>();
    for (const d of data?.days ?? []) {
      const ps = siapa ? d.petugas.filter((p) => p.memberId === siapa) : d.petugas;
      if (ps.length) m.set(d.tanggal, ps);
    }
    return m;
  }, [data, siapa]);

  const today = data?.today ?? '';
  const [y, mo] = bulan.split('-').map(Number);
  const jmlHari = new Date(y, mo, 0).getDate();
  const offset = (new Date(y, mo - 1, 1).getDay() + 6) % 7; // Senin = kolom 0
  const sel: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: jmlHari }, (_, i) => `${bulan}-${pad(i + 1)}`),
  ];

  const rekap = { lengkap: 0, sebagian: 0, kosong: 0 };
  for (const [t, ps] of hariMap) {
    const s = statusHari(t, today, ps);
    if (s !== 'nanti') rekap[s]++;
  }

  const detail = pilih ? hariMap.get(pilih) ?? [] : [];

  return (
    <>
      <div className="lapbar">
        <button type="button" className="iconbtn" onClick={() => setBulan(geserBulan(bulan, -1))} aria-label="Bulan sebelumnya"><ChevronLeft size={20} /></button>
        <b>{BULAN[mo - 1]} {y}</b>
        <button type="button" className="iconbtn" onClick={() => setBulan(geserBulan(bulan, 1))} aria-label="Bulan berikutnya"><ChevronRight size={20} /></button>
      </div>
      <select className="lapsiapa" value={siapa} onChange={(e) => setSiapa(e.target.value)} aria-label="Filter anggota">
        <option value="">Semua anggota</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}
      </select>

      {gagal && <Empty text={pesanGagal} />}

      <div className="lapcal" role="grid" aria-label={`Kalender laporan ${BULAN[mo - 1]} ${y}`}>
        {HARI.map((h) => <span key={h} className="laphead">{h}</span>)}
        {sel.map((t, i) => {
          if (!t) return <span key={`k${i}`} />;
          const ps = hariMap.get(t);
          const st = ps ? statusHari(t, today, ps) : null;
          const n = Number(t.slice(8));
          return (
            <button
              key={t} type="button" disabled={!ps}
              className={`lapday${st ? ` st-${st}` : ''}${pilih === t ? ' on' : ''}${t === today ? ' today' : ''}`}
              onClick={() => setPilih(t)}
              aria-label={`${tglPanjang(t)}${st ? `, ${LABEL[st]}` : ', tidak ada piket'}`}
            >
              <span>{n}</span>
              {st && <i aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="laplegend" aria-hidden="true">
        <span><i className="st-lengkap" />lengkap {rekap.lengkap}</span>
        <span><i className="st-sebagian" />sebagian {rekap.sebagian}</span>
        <span><i className="st-kosong" />kosong {rekap.kosong}</span>
        <span><i className="st-nanti" />belum lewat</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {pilih && (
          <motion.section
            key={pilih} className="lapdetail"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <h2>{tglPanjang(pilih)}</h2>
            {detail.length === 0 && <Empty text="Tidak ada piket di tanggal ini." />}
            {detail.map((p) => {
              const m = members.find((x) => x.id === p.memberId);
              const fotoSaya = (ev ?? []).filter((e) => e.memberId === p.memberId);
              const lap = laps.find((l) => l.memberId === p.memberId);
              return (
                <div key={p.memberId} className="lapcard">
                  <div className="lapcardhead">
                    {m?.foto ? <img className="ava" src={m.foto} alt="" /> : <i className="pdot" style={{ background: m?.warna ?? '#888' }} />}
                    <b>{nama(p.memberId)}</b>
                    {!p.terjadwal && <em className="pill sm">di luar jadwal</em>}
                    {tampilNilai && p.nilai !== undefined && <span className="lapnilai">nilai {Math.round(p.nilai)}</span>}
                  </div>
                  <div className="lapfoto">
                    {ev === null
                      ? <span className="hint">Memuat foto…</span>
                      : Array.from({ length: Math.max(p.fotoMax, fotoSaya.length) }, (_, i) => {
                        const f = fotoSaya[i];
                        return f
                          ? (
                            <button
                              key={f.id} type="button" className="thumbbtn"
                              onClick={() => onPreview({ file: f.file, judul: f.tugas, by: nama(p.memberId), tanggal: pilih })}
                              aria-label={`Lihat foto ${f.tugas}`}
                            >
                              <img src={f.file} alt={f.tugas} />
                            </button>
                          )
                          : <span key={`x${i}`} className="lapkosong" aria-label="foto belum ada"><Camera size={16} /></span>;
                      })}
                  </div>
                  <p className="lapstat">
                    <span className={p.foto >= p.fotoMax ? 'ok' : ''}><Camera size={13} /> Foto {p.foto}/{p.fotoMax}</span>
                    <span className={p.ceklis >= p.ceklisMax ? 'ok' : ''}><ClipboardList size={13} /> Ceklis {p.ceklis}/{p.ceklisMax}</span>
                    <span className={p.lapsit ? 'ok' : ''}><FileText size={13} /> Lapsit {p.lapsit ? '✓' : 'belum'}</span>
                  </p>
                  {lap && <p className="laplapsit">“{lap.catatan}”</p>}
                </div>
              );
            })}
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
