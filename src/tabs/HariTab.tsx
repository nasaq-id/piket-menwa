import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Check, ChevronDown, Clock, Lock, MapPin, PartyPopper } from 'lucide-react';
import { BREAKDOWN } from '../breakdown';
import { ABSEN_BUKA_MENIT, ABSEN_TELAT_MENIT, dateStr, geserJam } from '../piket';
import { isOnline } from '../api';
import type { AppStore } from '../hooks/useAppStore';
import { Button } from '../components/Button';
import { PiketStepper, type StepId } from '../components/PiketStepper';

const fmtTanggal = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
const todayLong = () => {
  const s = fmtTanggal.format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function HariTab({ store }: { store: AppStore }) {
  const {
    today, crew, att, members, nama, warna, jamHari, mySlots, me, unlocked, absenBusy,
    needVerify, checks, ev, uploadingTugas, taskTap, pickPhoto, photoRef, doneCount,
    pendingTugas, onFile, bdDone, bdOpen, setBdOpen, bdSecOpen, setBdSecOpen,
    nilaiHariIni, lapsit, lapsitText, setLapsitText, kirimLapsit, lapsitOpen,
    lapsitOpenAt, jamSelesaiHariIni, tmr, crewBesok, state, setPreview,
    buktiOpen, setBuktiOpen, toggleBd, lapsitBusy,
  } = store;
  const [jamMulai, jamSelesai] = jamHari.split('–').map((x) => x.trim());
  const myAtt = att.find((a) => a.memberId === me && a.tanggal === dateStr(0));

  // ---- Stepper (turunan tampilan saja, tanpa request baru) ----
  const isPetugas = today !== 'Libur' && crew.includes(me);
  const lapsitSent = lapsit.length > 0;
  const buktiLengkap = checks.length > 0 && ev.length >= checks.length;
  const active: StepId | null = !isPetugas
    ? null
    : !unlocked ? 'absen' : !buktiLengkap ? 'bukti' : !lapsitSent ? 'lapsit' : null;

  // Accordion bukti otomatis terbuka saat langkah aktif = Bukti.
  useEffect(() => {
    if (isPetugas && active === 'bukti') setBuktiOpen(true);
  }, [isPetugas, active, setBuktiOpen]);

  const goStep = (id: StepId) => {
    if (id === 'bukti') setBuktiOpen(true);
    window.setTimeout(() => {
      document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, id === 'bukti' ? 120 : 0);
  };

  const lapsitAlasan = !unlocked
    ? 'Absen dulu (scan wajah di mako) untuk membuka lapsit.'
    : !buktiLengkap
      ? `Lengkapi ${checks.length} foto bukti dulu.`
      : `Lapsit bisa dikirim mulai ${lapsitOpenAt} (30 menit sebelum piket selesai jam ${jamSelesaiHariIni}).`;
  const lapsitBisa = unlocked && buktiLengkap && lapsitOpen;

  return (
    <>
      <p className="tgl">{todayLong()}</p>
      {today === 'Libur' ? (
        <div className="hero"><b><PartyPopper size={17} /> Libur</b><span>Sabtu–Minggu tidak ada piket.</span></div>
      ) : (
        <div className="hero">
          <div className="herotop">
            <em className="pill">hari ini</em>
            <span className="hday">{today}</span>
          </div>
          <div className="heroatt">
            {crew.map((id) => {
              const row = att.find((a) => a.memberId === id);
              const m = members.find((x) => x.id === id);
              return (
                <div key={id} className="attrow ghost">
                  {m?.foto
                    ? <img className="ava" src={m.foto} alt={nama(id)} />
                    : <i style={{ background: warna(id) }} />}
                  <span>{nama(id)}</span>
                  {m && isOnline(m) && <i className="onlinedot" title="online" />}
                  <em className={row ? (row.status === 'terlambat' ? 'badge-no late' : 'badge-ok') : 'badge-no'}>
                    {row ? `${row.status === 'terlambat' ? 'terlambat' : 'hadir'} ${row.jam}` : 'belum'}
                  </em>
                </div>
              );
            })}
            {crew.length === 0 && <span className="hint">Belum ada jadwal.</span>}
          </div>
          <div className="herojam">
            <Clock size={14} />
            <span className="jlabel">mulai</span><b>{(jamHari.split('–')[0] ?? '').trim()}</b>
            <span className="jarrow">→</span>
            <span className="jlabel">selesai</span><b>{(jamHari.split('–')[1] ?? '').trim()}</b>
          </div>
        </div>
      )}
      {isPetugas && (
        <PiketStepper
          active={active}
          onGo={goStep}
          steps={[
            {
              id: 'absen',
              label: 'Absen',
              sub: unlocked && myAtt ? `${myAtt.jam}${myAtt.status === 'terlambat' ? ' · terlambat' : ''}` : 'scan wajah di mako',
              done: unlocked,
            },
            { id: 'bukti', label: 'Bukti', sub: `${ev.length}/${checks.length}`, done: buktiLengkap },
            {
              id: 'lapsit',
              label: 'Lapsit',
              sub: lapsitSent ? 'terkirim' : lapsitOpen ? 'bisa dikirim' : `mulai ${lapsitOpenAt}`,
              done: lapsitSent,
            },
          ]}
        />
      )}
      {today !== 'Libur' && (
        <>
          {mySlots.length === 0 && (
            <p className="hint">Kamu belum terdaftar sebagai petugas piket minggu ini — minta Admin tambahkan via tab Mingguan (mode Admin).</p>
          )}
          <div id="sec-absen" style={{ scrollMarginTop: '12px' }}>
          <AnimatePresence mode="wait" initial={false}>
            {crew.includes(me) && !unlocked && (
              <motion.div
                key="absen"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <Button
                  variant="primary"
                  busy={absenBusy}
                  onClick={() => void needVerify()}
                  ariaLabel="Absen tiba dengan scan wajah di mako"
                  style={{ width: '100%', marginTop: '10px' }}
                >
                  {absenBusy
                    ? <><MapPin size={15} /> Mengecek lokasi…</>
                    : <><Camera size={15} /> Absen tiba (scan wajah di mako)</>}
                </Button>
                {jamMulai && (
                  <p className="hint">
                    Absen dibuka {geserJam(jamMulai, -ABSEN_BUKA_MENIT)}–{jamSelesai}. Lewat {geserJam(jamMulai, ABSEN_TELAT_MENIT)} tercatat terlambat. Wajib di area mako (GPS aktif).
                  </p>
                )}
              </motion.div>
            )}
            {unlocked && myAtt && (
              <motion.p
                key="sudah" className="hint"
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Check size={13} /> Sudah absen {myAtt.jam}{myAtt.status === 'terlambat' ? ' (terlambat)' : ''} — checklist & bukti terbuka.
              </motion.p>
            )}
          </AnimatePresence>
          </div>
          <div className="bdgroup" id="sec-bukti" style={{ scrollMarginTop: '12px' }}>
            <button className="bdhead" onClick={() => setBuktiOpen((o) => !o)} aria-expanded={buktiOpen} style={{ minHeight: '44px' }}>
              <span>Bukti Piket (Wajib)</span>
              <em>{ev.length}/{checks.length}</em>
              <ChevronDown size={16} className={buktiOpen ? 'rot' : ''} />
            </button>
            <AnimatePresence initial={false}>
              {buktiOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  {checks.length > 0 && (
                    <div className="progress buktiProg" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={checks.length} aria-label="Progress bukti piket">
                      <i style={{ width: `${(doneCount / checks.length) * 100}%` }} />
                    </div>
                  )}
                  {!unlocked && <p className="hint"><Lock size={12} /> Absen dulu (scan wajah di mako) untuk membuka bukti.</p>}
                  <ul className="tasks">
                    {checks.map((c) => {
                      const ph = ev.find((e) => e.tugas === c.judul);
                      const busy = uploadingTugas === c.judul;
                      return (
                        <li
                          key={c.judul}
                          className={unlocked ? '' : 'locked'}
                          onClick={() => taskTap(c)}
                        >
                          <button
                            className="cam"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!unlocked) return needVerify();
                              if (ph) setPreview({ file: ph.file, judul: c.judul, by: nama(ph.memberId), tanggal: dateStr(0) });
                              else pickPhoto(c.judul);
                            }}
                            aria-label={ph ? `Lihat foto ${c.judul}` : `Ambil foto ${c.judul}`}
                          >
                            {ph
                              ? <img src={ph.file} alt={c.judul} />
                              : busy ? <span className="spin" /> : <Camera size={17} />}
                          </button>
                          <span className={`ttitle ${c.done ? 'strike' : ''}`}>{c.judul}</span>
                          <span className={`box ${c.done ? 'on' : ''}`}>{c.done ? <Check size={13} /> : ''}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <input
                    ref={photoRef} type="file" accept="image/*" capture="environment" hidden
                    onChange={(e) => { void onFile(pendingTugas ?? '', e.target.files?.[0]); e.target.value = ''; }}
                  />
                  <p className="hint">1 tugas = 1 foto milikmu sendiri, tercentang otomatis saat foto terkirim. Foto yang sudah terkirim tidak bisa diganti. {ev.length}/{checks.length} berfoto.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="bdgroup top">
            <button className="bdhead" onClick={() => setBdSecOpen((v) => !v)} aria-expanded={bdSecOpen} style={{ minHeight: '44px' }}>
              <span>Rincian Tugas (Opsional · ikut nilai)</span>
              <em>{bdDone.length}/{BREAKDOWN.reduce((s, g) => s + g.items.length, 0)}</em>
              <ChevronDown size={16} className={bdSecOpen ? 'rot' : ''} />
            </button>
          </div>
          <AnimatePresence initial={false}>
            {bdSecOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                style={{ overflow: 'hidden' }}
              >
                <p className="hint">
                  Tercatat di server, ikut menentukan nilai piketmu.
                  {nilaiHariIni != null && <> Nilai hari ini: <b>{nilaiHariIni}</b>/100.</>}
                </p>
                {BREAKDOWN.map((g, gi) => {
                  const done = g.items.filter((_, ii) => bdDone.includes(`${gi}:${ii}`)).length;
                  const open = !!bdOpen[gi];
                  return (
                    <div key={gi} className="bdgroup">
                      <button className="bdhead" onClick={() => setBdOpen((o) => ({ ...o, [gi]: !o[gi] }))} aria-expanded={open} style={{ minHeight: '44px' }}>
                        <span>{gi + 1}. {g.title}</span>
                        <em>{done}/{g.items.length}</em>
                        <ChevronDown size={16} className={open ? 'rot' : ''} />
                      </button>
                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.ul
                            className="tasks"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            style={{ overflow: 'hidden' }}
                          >
                            {g.items.map((it, ii) => {
                              const k = `${gi}:${ii}`;
                              const on = bdDone.includes(k);
                              return (
                                <li key={k} className={unlocked ? '' : 'locked'} onClick={() => toggleBd(k)}>
                                  <span className={`box ${on ? 'on' : ''}`}>{on ? <Check size={13} /> : ''}</span>
                                  <span className={on ? 'strike' : ''}>{it}</span>
                                </li>
                              );
                            })}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
          <div id="sec-lapsit" style={{ scrollMarginTop: '12px' }}>
          <h2>Catatan Lapsit — Akhir Piket</h2>
          {lapsit.length > 0 ? (
            lapsit.map((l) => (
              <div key={l.id} className="card sm">
                <b>{nama(l.memberId)}</b>
                <span>{l.catatan}</span>
                <span className="dim">
                  {new Date(l.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {l.lat && l.lng ? ` • ${Number(l.lat).toFixed(5)}, ${Number(l.lng).toFixed(5)}` : ' • GPS off'}
                </span>
              </div>
            ))
          ) : lapsitBisa ? (
            <>
              <textarea
                className="reason" rows={3}
                placeholder="Tulis laporan situasi akhir piket…"
                value={lapsitText} onChange={(e) => setLapsitText(e.target.value)}
              />
              <Button
                variant="primary"
                busy={lapsitBusy}
                disabled={!unlocked || ev.length < checks.length || checks.length === 0 || !lapsitOpen}
                onClick={() => void kirimLapsit()}
                style={{ width: '100%', marginTop: '10px' }}
              >
                Kirim lapsit akhir piket
              </Button>
            </>
          ) : (
            <motion.div
              className="waitcard"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Lock size={15} />
              <span>{lapsitAlasan}</span>
            </motion.div>
          )}
          </div>
          {tmr !== 'Libur' && crewBesok.length > 0 && (
            <p className="besok">● Besok: {crewBesok.map(nama).join(' & ')} • mulai {(state?.jam[tmr] ?? '09.00–15.00').split('–')[0]}</p>
          )}
        </>
      )}
    </>
  );
}
