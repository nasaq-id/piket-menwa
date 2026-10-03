import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCw, ScanFace } from 'lucide-react';
import { tingStage, warmAudio } from '../face';
import { sendFaceFrame, type FaceAction } from '../api';
import { TAP } from './Motion';

// Scan wajah challenge-response: HP cuma memotret, SERVER yang menilai
// (liveness, arah menoleh, kecocokan). Urutan: tatap depan → server kasih
// arah acak → tolehkan kepala → beberapa frame dikirim.
type Phase = 'starting' | 'ready' | 'front' | 'turn' | 'sending' | 'done' | 'error' | 'failed';

// Frame menoleh dikirim satu per satu mulai TURN_START_MS setelah panah muncul;
// berhenti begitu server bilang sudah cukup menoleh, paling lama TURN_MAX_MS.
const TURN_START_MS = 500;
const TURN_GAP_MS = 150;
const TURN_MAX_MS = 4000;
const TURN_MAX_FRAMES = 10;
// Cadangan kalau kirim per frame gagal (server lama/jaringan): kirim sekaligus.
const TURN_SHOTS_MS = [900, 1300, 1700, 2100, 2600, 3100];

export function FaceCam({ title, autoStart = false, getChallenge, submit, onClose }: {
  title: string;
  // true = langsung scan begitu kamera siap (tanpa tombol Mulai).
  autoStart?: boolean;
  getChallenge: () => Promise<{ ok: true; challengeId: string; action: FaceAction } | { ok: false; error: string }>;
  submit: (challengeId: string, frames: string[]) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [action, setAction] = useState<FaceAction | null>(null);
  const [msg, setMsg] = useState('Meminta izin kamera…');
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error('Browser tidak mendukung kamera — buka lewat Chrome + HTTPS.'), { name: 'NoSupport' });
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
        });
        if (!alive.current) return;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        setPhase('ready');
        setMsg(autoStart ? 'Posisikan wajah di dalam oval…' : 'Posisikan wajah di dalam oval, lalu tap Mulai.');
      } catch (e) {
        if (!alive.current) return;
        const name = (e as Error).name;
        setMsg(name === 'NotAllowedError'
          ? 'Izin kamera DITOLAK. Tap ikon gembok di address bar → Camera → Allow, lalu reload. Kalau dibuka dari WA/Telegram, salin link ke Chrome.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'Kamera depan tidak ditemukan di perangkat ini.'
            : (e as Error).message);
        setPhase('failed');
      }
    })();
    return () => {
      alive.current = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // Kamera dinyalakan sekali per pemasangan; autoStart tetap selama FaceCam terbuka
    // (App memasang ulang komponen tiap mode berganti lewat key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Frame dikirim TANPA dicermin (pratinjau saja yang dicermin lewat CSS).
  const grab = (): string | null => {
    const v = videoRef.current;
    if (!v?.videoWidth) return null;
    const s = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * s);
    c.height = Math.round(v.videoHeight * s);
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const vib = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* opsional */ } };

  const run = async () => {
    warmAudio();
    setAction(null);
    setPhase('front');
    setMsg('Tatap lurus ke kamera…');
    const ch = await getChallenge();
    if (!alive.current) return;
    if (!ch.ok) {
      setPhase('error');
      setMsg(ch.error);
      return;
    }
    await wait(400);
    const front = grab();
    if (!front) {
      setPhase('error');
      setMsg('Kamera belum siap — coba lagi.');
      return;
    }
    tingStage(0);
    vib(15);
    setAction(ch.action);
    setPhase('turn');
    setMsg(ch.action === 'kiri' ? 'Tolehkan kepala ke KIRI' : 'Tolehkan kepala ke KANAN');
    // Frame depan dinilai sambil user mulai menoleh.
    let stop = false;
    const frontSent = sendFaceFrame(ch.challengeId, 'front', front).then((r) => {
      if (r?.stop) stop = true;
      return r;
    });
    const t0 = performance.now();
    let streamed = true;
    let sent = 0;
    await wait(TURN_START_MS);
    while (!stop && alive.current && sent < TURN_MAX_FRAMES && performance.now() - t0 < TURN_MAX_MS) {
      const f = grab();
      const r = f ? await sendFaceFrame(ch.challengeId, 'turn', f) : null;
      if (!r) { streamed = false; break; }
      sent++;
      if (r.stop) break;
      await wait(TURN_GAP_MS);
    }
    if (streamed && !(await frontSent)) streamed = false;
    let frames: string[] = [];
    if (!streamed) {
      // Cadangan: potret ulang dengan jadwal tetap, kirim sekaligus.
      const turns: string[] = [];
      let at0 = 0;
      for (const at of TURN_SHOTS_MS) {
        await wait(at - at0);
        at0 = at;
        const f = grab();
        if (f) turns.push(f);
      }
      frames = [front, ...turns];
    }
    if (!alive.current) return;
    setPhase('sending');
    setMsg('Memverifikasi…');
    const r = await submit(ch.challengeId, frames);
    if (!alive.current) return;
    if (r.ok) {
      tingStage(2);
      vib([20, 40, 30]);
      setPhase('done');
      setMsg('Terverifikasi ✓');
    } else {
      vib(80);
      setPhase('error');
      setMsg(r.error ?? 'Verifikasi gagal — coba lagi.');
    }
  };

  // Mulai otomatis sekali saat kamera siap; beri jeda singkat untuk memposisikan wajah.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoStart || phase !== 'ready' || autoRan.current) return;
    autoRan.current = true;
    const t = setTimeout(() => void run(), 700);
    return () => clearTimeout(t);
    // run() sengaja tidak di deps: cukup dipicu sekali saat phase jadi 'ready'.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, phase]);

  const busy = phase === 'front' || phase === 'turn' || phase === 'sending';
  const pop = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { duration: 0.18 },
  } as const;
  const ovalClass = phase === 'done' ? 'ovok' : 'ovrun';
  return (
    <div className="camwrap">
      <motion.div
        className="camcard"
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <b>{title}</b>
        <div className="camstage">
          <div className="camview">
            <video ref={videoRef} playsInline muted autoPlay />
            <svg className="ovalsvg" viewBox="0 0 100 140" preserveAspectRatio="none">
              <ellipse cx="50" cy="60" rx="30" ry="42" className="ovbg" />
              {(busy || phase === 'done') && (
                <motion.ellipse
                  cx="50" cy="60" rx="30" ry="42" className={ovalClass}
                  pathLength={100} strokeDasharray="100"
                  // Oval "menggambar diri" selama scan; penuh + menyala saat berhasil.
                  initial={{ strokeDashoffset: 100 }}
                  animate={{ strokeDashoffset: phase === 'front' ? 70 : phase === 'turn' ? 35 : 0 }}
                  transition={{ duration: phase === 'turn' ? 3 : 0.4, ease: 'easeOut' }}
                />
              )}
            </svg>
          </div>
          {/* Di luar .camview (yang dicermin) supaya panah tidak ikut terbalik:
              pratinjau = cermin, jadi kiri layar = kiri pengguna. */}
          <AnimatePresence>
            {phase === 'turn' && action && (
              <motion.div
                key={action}
                className={`turncue ${action}`}
                initial={{ opacity: 0, x: action === 'kiri' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {action === 'kiri' ? <ArrowLeft size={44} /> : <ArrowRight size={44} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={msg}
            className={`hint ${phase === 'error' || phase === 'failed' ? 'werr' : ''} ${phase === 'turn' ? 'turnmsg' : ''}`}
            initial={{ opacity: 0, y: 6 }}
            animate={phase === 'error' ? { opacity: 1, y: 0, x: [0, -7, 7, -4, 4, 0] } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: phase === 'error' ? 0.35 : 0.18 }}
          >
            {msg}
          </motion.p>
        </AnimatePresence>
        <div className="row">
          <AnimatePresence mode="popLayout" initial={false}>
            {phase === 'ready' && (
              <motion.button key="mulai" className="primary cta" onClick={() => void run()} {...TAP} {...pop}>
                <ScanFace size={20} /> Mulai
              </motion.button>
            )}
            {phase === 'error' && (
              <motion.button key="ulang" className="primary" onClick={() => void run()} {...TAP} {...pop}>
                <RotateCw size={15} /> Coba lagi
              </motion.button>
            )}
            {phase === 'done' && (
              <motion.button key="ok" className="primary" disabled {...pop}>
                <motion.span
                  className="inflex"
                  initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                >
                  <Check size={15} />
                </motion.span>
                Berhasil
              </motion.button>
            )}
            {!busy && phase !== 'done' && (
              <motion.button key="tutup" onClick={onClose} {...TAP} {...pop}>Tutup</motion.button>
            )}
          </AnimatePresence>
        </div>
        <p className="hint dim">Foto wajah hanya diproses sesaat di server kami lalu dibuang — tidak disimpan.</p>
      </motion.div>
    </div>
  );
}
