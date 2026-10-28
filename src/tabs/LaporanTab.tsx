import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
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
type Anggota = Pick<Member, 'id' | 'nama' | 'warna' | 'foto'> & { jabatan?: string | null };

const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const LABEL: Record<Status, string> = { lengkap: 'Lengkap', sebagian: 'Sebagian', kosong: 'Kosong', nanti: 'Terjadwal' };

const pad = (n: number) => String(n).padStart(2, '0');
const geserBulan = (bulan: string, n: number) => {
  const [y, m] = bulan.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const tglPanjang = (t: string) =>
  new Date(t + 'T00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const pct = (n: number, max: number) => (max > 0 ? Math.min(100, Math.round((n / max) * 100)) : 0);
const statusPetugas = (p: Petugas) => (lengkap(p) ? 'lengkap' : kosong(p) ? 'kosong' : 'sebagian');
const LABEL_PETUGAS = { lengkap: 'Lengkap', sebagian: 'Belum lengkap', kosong: 'Belum ada laporan' } as const;

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
      pesanGagal="Laporan gagal dimuat. Periksa koneksi dan pastikan mode admin aktif."
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

  const rekap = { lengkap: 0, sebagian: 0, kosong: 0, nanti: 0 };
  for (const [t, ps] of hariMap) {
    rekap[statusHari(t, today, ps)]++;
  }

  const detail = pilih ? hariMap.get(pilih) ?? [] : [];

  return (
    <div className="lap">
      <div className="lap-head">
        <div>
          <span className="lap-eyebrow">Laporan bukti piket</span>
          <h2 className="lap-title">{BULAN[mo - 1]} {y}</h2>
        </div>
        <div className="lap-nav">
          <button type="button" onClick={() => setBulan(geserBulan(bulan, -1))} aria-label="Bulan sebelumnya"><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => setBulan(geserBulan(bulan, 1))} aria-label="Bulan berikutnya"><ChevronRight size={18} /></button>
        </div>
      </div>

      <select className="lap-filter" value={siapa} onChange={(e) => setSiapa(e.target.value)} aria-label="Filter anggota">
        <option value="">Semua anggota</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}
      </select>

      <div className="lap-sum">
        {(['lengkap', 'sebagian', 'kosong', 'nanti'] as const).map((k) => (
          <div key={k} className={`lap-sumitem st-${k}`}>
            <b>{data ? rekap[k] : '–'}</b>
            <span>{LABEL[k]}</span>
          </div>
        ))}
      </div>

      {gagal && <Empty text={pesanGagal} />}

      <div className="lap-cal" role="grid" aria-label={`Kalender laporan ${BULAN[mo - 1]} ${y}`}>
        {HARI.map((h) => <span key={h} className="lap-wd">{h}</span>)}
        {sel.map((t, i) => {
          if (!t) return <span key={`k${i}`} />;
          const ps = hariMap.get(t);
          const st = ps ? statusHari(t, today, ps) : null;
          return (
            <button
              key={t} type="button" disabled={!ps}
              className={`lap-day${st ? ` st-${st}` : ''}${pilih === t ? ' on' : ''}${t === today ? ' today' : ''}`}
              onClick={() => setPilih(t)}
              aria-label={`${tglPanjang(t)}${st ? `, ${LABEL[st]}` : ', tidak ada piket'}`}
              aria-pressed={pilih === t}
            >
              <span>{Number(t.slice(8))}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {pilih && (
          <motion.section
            key={pilih} className="lap-detail"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <div className="lap-dhead">
              <span className="lap-eyebrow">Rincian harian</span>
              <h3>{tglPanjang(pilih)}</h3>
            </div>
            {detail.length === 0 && <Empty text="Tidak ada jadwal piket pada tanggal ini." />}
            {detail.map((p) => {
              const m = members.find((x) => x.id === p.memberId);
              const fotoSaya = (ev ?? []).filter((e) => e.memberId === p.memberId);
              const lap = laps.find((l) => l.memberId === p.memberId);
              const sp = statusPetugas(p);
              return (
                <article key={p.memberId} className="lap-card">
                  <header className="lap-chead">
                    {m?.foto
                      ? <img className="lap-ava" src={m.foto} alt="" />
                      : <span className="lap-ava lap-ini" style={{ background: m?.warna ?? '#556' }}>{nama(p.memberId).slice(0, 1)}</span>}
                    <div className="lap-who">
                      <b>{nama(p.memberId)}</b>
                      <span>{[m?.jabatan, !p.terjadwal && 'Di luar jadwal'].filter(Boolean).join(' · ') || 'Petugas piket'}</span>
                    </div>
                    <span className={`lap-badge st-${sp}`}>{LABEL_PETUGAS[sp]}</span>
                  </header>

                  <div className="lap-photos">
                    {ev === null
                      ? Array.from({ length: p.fotoMax }, (_, i) => <span key={i} className="lap-ph lap-skel" />)
                      : Array.from({ length: Math.max(p.fotoMax, fotoSaya.length) }, (_, i) => {
                        const f = fotoSaya[i];
                        return f
                          ? (
                            <button
                              key={f.id} type="button" className="lap-ph"
                              onClick={() => onPreview({ file: f.file, judul: f.tugas, by: nama(p.memberId), tanggal: pilih })}
                              aria-label={`Lihat foto ${f.tugas}`}
                            >
                              <img src={f.file} alt={f.tugas} loading="lazy" />
                              <span className="lap-cap">{f.tugas}</span>
                            </button>
                          )
                          : <span key={`x${i}`} className="lap-ph lap-none"><ImageOff size={16} /><span>Belum diunggah</span></span>;
                      })}
                  </div>

                  <dl className="lap-metrics">
                    <div>
                      <dt>Foto bukti</dt>
                      <dd>{p.foto}/{p.fotoMax}</dd>
                      <i className="lap-bar"><i style={{ width: `${pct(p.foto, p.fotoMax)}%` }} /></i>
                    </div>
                    <div>
                      <dt>Ceklis</dt>
                      <dd>{p.ceklis}/{p.ceklisMax}</dd>
                      <i className="lap-bar"><i style={{ width: `${pct(p.ceklis, p.ceklisMax)}%` }} /></i>
                    </div>
                    <div>
                      <dt>Lapsit</dt>
                      <dd>{p.lapsit ? 'Terkirim' : 'Belum'}</dd>
                      <i className="lap-bar"><i style={{ width: p.lapsit ? '100%' : '0%' }} /></i>
                    </div>
                    {tampilNilai && p.nilai !== undefined && (
                      <div>
                        <dt>Nilai</dt>
                        <dd>{Math.round(p.nilai)}</dd>
                        <i className="lap-bar"><i style={{ width: `${pct(p.nilai, 100)}%` }} /></i>
                      </div>
                    )}
                  </dl>

                  {lap && (
                    <div className="lap-lapsit">
                      <span className="lap-eyebrow">Laporan situasi</span>
                      <p>{lap.catatan}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
