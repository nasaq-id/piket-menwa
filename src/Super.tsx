import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  deleteMember, isOnline, loadAttendance, loadEvidence, loadFaceSummary,
  loadLapsit, loadState, superGet, verifySuper,
  type AppState, type AttRow, type EvidenceRow, type FaceSummary, type FeedItem,
  type LapsitRow, type Overview, type SwapRow,
} from './api';
import { dateStr } from './piket';
import { MakoPanel } from './components/MakoPanel';
import { Button } from './components/Button';
import { ConfirmSheet } from './components/ConfirmSheet';
import { Empty } from './components/Empty';
import { PhotoPreview } from './components/PhotoPreview';
import { Toast } from './components/Toast';
import { useConfirm } from './hooks/useConfirm';
import type { PreviewState } from './hooks/useAppStore';

const fmtTime = (t: number) =>
  new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

type SuperTab = 'ringkasan' | 'absensi' | 'anggota' | 'pengaturan';

const TABS: { id: SuperTab; label: string }[] = [
  { id: 'ringkasan', label: 'Ringkasan' },
  { id: 'absensi', label: 'Absensi' },
  { id: 'anggota', label: 'Anggota' },
  { id: 'pengaturan', label: 'Pengaturan' },
];

const loadTab = (): SuperTab => {
  try {
    const t = sessionStorage.getItem('super-tab');
    if (TABS.some((x) => x.id === t)) return t as SuperTab;
  } catch { /* abaikan */ }
  return 'ringkasan';
};

export default function SuperView({ onExit }: { onExit: () => void }) {
  const [ok, setOk] = useState(sessionStorage.getItem('super-pin') ? true : false);
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState<SuperTab>(loadTab);
  const [date, setDate] = useState(dateStr(0));
  const [state, setState] = useState<AppState | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [faces, setFaces] = useState<FaceSummary[]>([]);
  const [att, setAtt] = useState<AttRow[]>([]);
  const [ev, setEv] = useState<EvidenceRow[]>([]);
  const [laps, setLaps] = useState<LapsitRow[]>([]);
  const [swaps, setSwaps] = useState<SwapRow[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [lbFrom, setLbFrom] = useState(() => dateStr(0).slice(0, 8) + '01');
  const [lbTo, setLbTo] = useState(() => dateStr(0));
  const [lb, setLb] = useState<{ memberId: string; nama: string; n: number; rata2: number | null }[]>([]);
  const [toast, setToast] = useState<{ msg: string; kind: 'error' | 'ok' | 'info' } | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const { req: confirmReq, ask, resolve: resolveConfirm } = useConfirm();

  useEffect(() => {
    try {
      sessionStorage.setItem('super-tab', tab);
    } catch { /* abaikan */ }
  }, [tab]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const reloadMembers = async () => {
    const s = await loadState();
    setState(s);
    setFaces(await loadFaceSummary());
  };

  const hapus = async (id: string, nama_: string) => {
    const yes = await ask({ title: 'Hapus anggota?', message: `Hapus ${nama_} + wajah, foto & jadwalnya?`, confirmLabel: 'Hapus', danger: true });
    if (!yes) return;
    const okDel = await deleteMember(id);
    if (!okDel) {
      setToast({ msg: 'Gagal hapus (PIN superadmin / online).', kind: 'error' });
      return;
    }
    void reloadMembers();
  };

  const submitPin = async () => {
    setPinBusy(true);
    try {
      const r = await verifySuper(pin);
      if (r) setOk(true);
      else setToast({ msg: r === null ? 'Server tidak terjangkau.' : 'PIN salah.', kind: 'error' });
    } finally {
      setPinBusy(false);
    }
  };

  useEffect(() => {
    if (!ok) return;
    (async () => {
      const s = await loadState();
      setState(s);
      if (s) setSwaps(s.swaps);
      setOv(await superGet<Overview>('/api/super/overview'));
      setFeed((await superGet<FeedItem[]>('/api/super/feed?limit=50')) ?? []);
      setFaces(await loadFaceSummary());
    })();
  }, [ok]);

  useEffect(() => {
    if (!ok) return;
    (async () => {
      setAtt((await loadAttendance(date, date)) ?? []);
      setEv((await loadEvidence(date, date)) ?? []);
      setLaps((await loadLapsit(date, date)) ?? []);
    })();
  }, [ok, date]);

  useEffect(() => {
    if (!ok) return;
    (async () => {
      const r = await superGet<{ rows: { memberId: string; nama: string; n: number; rata2: number | null }[] }>(
        `/api/nilai/leaderboard?from=${lbFrom}&to=${lbTo}`,
      );
      if (!r) return;
      setLb(r.rows.sort((a, b) => (b.rata2 ?? -1) - (a.rata2 ?? -1)));
    })();
  }, [ok, lbFrom, lbTo]);

  if (!ok) {
    return (
      <motion.div
        className="super"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <h1>Superadmin</h1>
        <p className="hint">Khusus dev — monitoring seluruh data.</p>
        <input
          type="password" inputMode="numeric" placeholder="PIN superadmin"
          value={pin} onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submitPin(); }}
        />
        <div className="row">
          <Button variant="primary" busy={pinBusy} onClick={() => void submitPin()}>Masuk</Button>
          <Button variant="secondary" onClick={onExit}>Tutup</Button>
        </div>
        <AnimatePresence>
          {toast && <Toast t={toast} onClose={() => setToast(null)} />}
        </AnimatePresence>
        <ConfirmSheet req={confirmReq} onResolve={resolveConfirm} />
      </motion.div>
    );
  }

  const members = state?.members ?? [];
  const nama = (id: string) => members.find((m) => m.id === id)?.nama ?? id;
  const cards: [string, number | undefined][] = [
    ['Anggota', ov?.members],
    ['Online', ov?.online],
    ['Absen hari ini', ov?.attToday],
    ['Foto hari ini', ov?.evToday],
    ['Lapsit hari ini', ov?.lapsitToday],
    ['Tukar pending', ov?.swapsPending],
  ];

  return (
    <motion.div
      className="super"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="suphead">
        <h1>Superadmin</h1>
        <Button variant="secondary" onClick={() => { sessionStorage.removeItem('super-pin'); onExit(); }}>Tutup</Button>
      </div>
      <div className="suptabs" role="tablist" aria-label="Bagian superadmin">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`suptab${tab === t.id ? ' on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {tab === t.id && (
              <motion.span
                layoutId="suptab-ind"
                className="suptabind"
                transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
              />
            )}
            <span className="suptabtx">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {tab === 'ringkasan' && (
            <>
              <div className="supcards">
                {cards.map(([label, v], i) => (
                  <motion.div
                    key={label} className="supcard"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.05, ease: 'easeOut' }}
                  >
                    <b>{v ?? '…'}</b><span>{label}</span>
                  </motion.div>
                ))}
              </div>
              <h2>Log aktivitas</h2>
              {feed.map((f, i) => (
                <p key={i} className="hist">[{f.jenis}] {f.teks} <span className="dim">• {fmtTime(f.t)}</span></p>
              ))}
              {feed.length === 0 && <Empty text="Belum ada aktivitas." />}
            </>
          )}

          {tab === 'absensi' && (
            <>
              <h2>Rekap harian</h2>
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Tanggal rekap" />
              <h3>Absensi ({att.length})</h3>
              {att.length === 0 && <Empty text="Belum ada absen." />}
              {att.map((a) => (
                <p key={a.id} className="hist">
                  {nama(a.memberId)} — {a.status === 'terlambat' ? <b className="late">terlambat</b> : 'hadir'} {a.jam}
                  {a.jarakM != null && <span className="dim"> · {a.jarakM} m dari mako</span>}
                </p>
              ))}
              <h3>Bukti foto ({ev.length}/{state?.templateLen ?? 0} tugas)</h3>
              <div className="evthumbs">
                {ev.map((e) => (
                  <button
                    key={e.id} type="button" className="evthumbbtn"
                    onClick={() => setPreview({ file: e.file, judul: e.tugas, by: nama(e.memberId), tanggal: e.tanggal })}
                    aria-label={`Lihat foto ${e.tugas} oleh ${nama(e.memberId)}`}
                    title={`${e.tugas} — ${nama(e.memberId)}`}
                  >
                    <img src={e.file} alt={e.tugas} />
                  </button>
                ))}
              </div>
              {ev.length === 0 && <Empty text="Belum ada foto." />}
              <h3>Lapsit ({laps.length})</h3>
              {laps.map((l) => (
                <div key={l.id} className="card sm">
                  <b>{nama(l.memberId)}</b><span>{l.catatan}</span>
                  <span className="dim">{l.lat && l.lng ? `${Number(l.lat).toFixed(5)}, ${Number(l.lng).toFixed(5)}` : 'GPS off'}</span>
                </div>
              ))}
              {laps.length === 0 && <Empty text="Belum ada lapsit." />}
              <h3>Tukar ({swaps.length})</h3>
              {swaps.map((s) => (
                <p key={s.id} className="hist">{nama(s.requester)} ⇄ {nama(s.target)} • {s.status}</p>
              ))}
              {swaps.length === 0 && <Empty text="Belum ada pengajuan tukar." />}
            </>
          )}

          {tab === 'anggota' && (
            <>
              <h2>Pengguna ({members.length})</h2>
              <div className="supscroll">
                <table className="suptable">
                  <thead><tr><th></th><th>Nama</th><th>Jabatan</th><th>Wajah</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {members.map((m) => {
                      const on = isOnline(m);
                      return (
                        <tr key={m.id}>
                          <td>{m.foto ? <img className="ava" src={m.foto} alt="" /> : <i className="pdot" style={{ background: m.warna }} />}</td>
                          <td>{m.nama}{m.angkatan ? ` · ${m.angkatan}` : ''}</td>
                          <td>{m.jabatan ?? '—'}</td>
                          <td>{(faces.find((f) => f.memberId === m.id)?.count ?? 0) || '—'}</td>
                          <td><span className="presrow"><i className={on ? 'onlinedot' : 'offlinedot'} aria-hidden="true" />{on ? 'online' : 'offline'}</span></td>
                          <td>
                            <Button variant="danger" className="supdelbtn" ariaLabel={`Hapus ${m.nama}`} onClick={() => void hapus(m.id, m.nama)}>
                              Hapus
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <h2>Peringkat Nilai (rahasia)</h2>
              <div className="row">
                <input type="date" value={lbFrom} onChange={(e) => e.target.value && setLbFrom(e.target.value)} aria-label="Nilai dari tanggal" />
                <input type="date" value={lbTo} onChange={(e) => e.target.value && setLbTo(e.target.value)} aria-label="Nilai sampai tanggal" />
              </div>
              <div className="supscroll">
                <table className="suptable">
                  <thead><tr><th>#</th><th>Nama</th><th>Rata-rata</th><th>Dinilai</th></tr></thead>
                  <tbody>
                    {lb.map((r, i) => (
                      <tr key={r.memberId}>
                        <td>{i + 1}</td>
                        <td>{r.nama}</td>
                        <td><b>{r.rata2 ?? '—'}</b></td>
                        <td>{r.n}x</td>
                      </tr>
                    ))}
                    {lb.length === 0 && <tr><td colSpan={4} className="hint">Belum ada nilai terverifikasi.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'pengaturan' && (
            <>
              <h2>Pengaturan absen</h2>
              <MakoPanel />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {preview && (
          <PhotoPreview
            preview={preview}
            isAdmin
            viewerName="Admin"
            onClose={() => setPreview(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <Toast t={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>
      <ConfirmSheet req={confirmReq} onResolve={resolveConfirm} />
    </motion.div>
  );
}
