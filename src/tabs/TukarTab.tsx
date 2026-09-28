import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftRight } from 'lucide-react';
import { DAYS } from '../piket';
import type { AppStore } from '../hooks/useAppStore';
import { Button } from '../components/Button';
import { Empty } from '../components/Empty';

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  approved: { text: 'Disetujui', cls: 'badge-ok' },
  rejected: { text: 'Ditolak', cls: 'badge-no late' },
  cancelled: { text: 'Dibatalkan', cls: 'badge-no' },
};

export function TukarTab({ store }: { store: AppStore }) {
  const {
    meMember, mySlots, me, nama, warna, fromDay, setFromDay, dayDate,
    toDay, target, setToDay, setTarget, state, alasan, setAlasan, submitSwap,
    incoming, decide, outgoing, cancelSwap, admin, othersPending, expanded, setExpanded,
    swapBusy, ask,
  } = store;
  // Langkah 2: hari tujuan = semua hari selain hari asal yang ada petugasnya.
  const toDayOpts = fromDay
    ? DAYS.filter((d) => d !== fromDay && (state?.schedule[d] ?? []).length > 0)
    : [];
  // Langkah 3: petugas di hari tujuan (selain diri sendiri).
  const targetOpts = toDay ? (state?.schedule[toDay] ?? []).filter((m) => m !== me) : [];
  const lengkap = !!fromDay && !!toDay && !!target;

  const pickFrom = (d: (typeof DAYS)[number]) => {
    if (fromDay === d) return;
    setFromDay(d);
    setToDay(null);
    setTarget('');
  };
  const pickTo = (d: (typeof DAYS)[number]) => {
    if (toDay === d) return;
    setToDay(d);
    setTarget('');
  };
  const tolakMasuk = async (id: string, requester: string) => {
    const ok = await ask({
      title: 'Tolak permintaan tukar?',
      message: `Permintaan dari ${nama(requester)} akan ditolak.`,
      confirmLabel: 'Tolak',
      danger: true,
    });
    if (!ok) return;
    const w = incoming.find((x) => x.id === id) ?? othersPending.find((x) => x.id === id);
    if (w) void decide(w, false);
  };

  return (
    <>
      <h2 className="sec">Langkah 1 — Giliran kamu</h2>
      {!meMember ? (
        <Empty text="Belum ada data anggota." />
      ) : (
        <div className="opts2">
          {mySlots.map((d) => (
            <button key={d} className={`opt ${fromDay === d ? 'sel' : ''}`} onClick={() => pickFrom(d)} style={{ minHeight: '44px' }}>
              <i style={{ background: warna(me) }} />{nama(me)} • {dayDate(d)}
            </button>
          ))}
          {mySlots.length === 0 && <Empty text="Kamu tidak ada jadwal minggu ini." />}
        </div>
      )}
      <AnimatePresence initial={false}>
        {fromDay && (
          <motion.div
            key="step2"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <h2 className="sec">Langkah 2 — Tukar ke hari</h2>
            <div className="opts2">
              {toDayOpts.map((d) => (
                <button key={d} className={`opt ${toDay === d ? 'sel' : ''}`} onClick={() => pickTo(d)} style={{ minHeight: '44px' }}>
                  {dayDate(d)}
                </button>
              ))}
              {toDayOpts.length === 0 && <Empty text="Tidak ada hari tujuan yang ada petugasnya." />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {fromDay && toDay && (
          <motion.div
            key="step3"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <h2 className="sec">Langkah 3 — Dengan siapa</h2>
            <div className="opts1">
              {targetOpts.map((m) => (
                <button
                  key={m}
                  className={`opt ${target === m ? 'sel' : ''}`}
                  onClick={() => setTarget(m)}
                  style={{ minHeight: '44px' }}
                >
                  <i style={{ background: warna(m) }} />{nama(m)} • {dayDate(toDay)}
                </button>
              ))}
              {targetOpts.length === 0 && <Empty text="Belum ada rekan tukar." />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <textarea
        className="reason" rows={3}
        placeholder="Alasan (opsional), misal: ada ujian pagi"
        value={alasan} onChange={(e) => setAlasan(e.target.value)}
      />
      {lengkap && fromDay && toDay && (
        <p className="hint">{fromDay} {dayDate(fromDay)} ⇄ {toDay} {dayDate(toDay)} dengan {nama(target)}</p>
      )}
      <Button variant="primary" busy={swapBusy} disabled={!lengkap} onClick={() => void submitSwap()} style={{ width: '100%', marginTop: '10px' }}>Kirim permintaan tukar</Button>
      {incoming.map((w) => (
        <div key={w.id} className="waitcard" style={{ flexWrap: 'wrap' }}>
          <i className="pdot" style={{ background: warna(w.requester) }} />
          <span>{nama(w.requester)} meminta tukar<br />{dayDate(w.fromDay)} <ArrowLeftRight size={12} /> {dayDate(w.toDay)}</span>
          <div className="row waitrow" style={{ flexBasis: '100%', margin: '8px 0 0' }}>
            <Button variant="primary" onClick={() => void decide(w, true)} style={{ flex: 1 }}>Terima</Button>
            <Button variant="secondary" onClick={() => void tolakMasuk(w.id, w.requester)} style={{ flex: 1 }}>Tolak</Button>
          </div>
        </div>
      ))}
      {outgoing.map((w) => (
        <div key={w.id} className="waitcard" style={{ flexWrap: 'wrap' }}>
          <i className="pdot" style={{ background: warna(w.target) }} />
          <span>Ke {nama(w.target)}<br />{dayDate(w.fromDay)} <ArrowLeftRight size={12} /> {dayDate(w.toDay)} • menunggu</span>
          <div style={{ flexBasis: '100%', marginTop: '8px' }}>
            <Button variant="secondary" onClick={() => void cancelSwap(w)} style={{ width: '100%' }}>Batalkan</Button>
          </div>
        </div>
      ))}
      {admin && othersPending.length > 0 && (
        <>
          <h2 className="sec">Antrean lain (Admin override)</h2>
          {othersPending.map((w) => (
            <div key={w.id}>
              <div className="waitcard" style={{ flexWrap: 'wrap' }}>
                <i className="pdot" style={{ background: warna(w.requester) }} />
                <span>{nama(w.requester)} → {nama(w.target)}<br />{dayDate(w.fromDay)} <ArrowLeftRight size={12} /> {dayDate(w.toDay)}</span>
                <div style={{ flexBasis: '100%', marginTop: '8px' }}>
                  <Button variant="secondary" onClick={() => setExpanded(expanded === w.id ? null : w.id)} style={{ width: '100%' }}>Aksi admin</Button>
                </div>
              </div>
              {expanded === w.id && (
                <div className="row waitrow">
                  <Button variant="primary" onClick={() => { setExpanded(null); void decide(w, true); }} style={{ flex: 1 }}>Setujui</Button>
                  <Button variant="secondary" onClick={() => { setExpanded(null); void tolakMasuk(w.id, w.requester); }} style={{ flex: 1 }}>Tolak</Button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
      {(state?.swaps ?? []).some((s) => s.status !== 'pending') && (
        <>
          <h2 className="sec">Riwayat</h2>
          {(state?.swaps ?? []).filter((s) => s.status !== 'pending').map((s) => {
            const st = STATUS_LABEL[s.status] ?? { text: s.status, cls: 'badge-no' };
            return (
              <p key={s.id} className="hist">{nama(s.requester)} <ArrowLeftRight size={11} /> {nama(s.target)} • {s.fromDay} <ArrowLeftRight size={11} /> {s.toDay} • <em className={st.cls}>{st.text}</em></p>
            );
          })}
        </>
      )}
    </>
  );
}
