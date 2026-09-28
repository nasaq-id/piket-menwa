import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCw, ScanFace } from 'lucide-react';
import { tingStage, warmAudio } from '../face';
import type { FaceAction } from '../api';

// Scan wajah challenge-response: HP cuma memotret, SERVER yang menilai
// (liveness, arah menoleh, kecocokan). Urutan: tatap depan → server kasih
// arah acak → tolehkan kepala → beberapa frame dikirim.
type Phase = 'starting' | 'ready' | 'front' | 'turn' | 'sending' | 'done' | 'error' | 'failed';

// Jeda pengambilan frame setelah instruksi menoleh muncul (ms).
const TURN_SHOTS_MS = [900, 1300, 1700, 2100];

export function FaceCam({ title, getChallenge, submit, onClose }: {
  title: string;
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
        setMsg('Posisikan wajah di dalam oval, lalu tap Mulai.');
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
    const turns: string[] = [];
    let t0 = 0;
    for (const at of TURN_SHOTS_MS) {
      await wait(at - t0);
      t0 = at;
      const f = grab();
      if (f) turns.push(f);
    }
    if (!alive.current) return;
    setPhase('sending');
    setMsg('Memverifikasi…');
    const r = await submit(ch.challengeId, [front, ...turns]);
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

  const busy = phase === 'front' || phase === 'turn' || phase === 'sending';
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
              {(busy || phase === 'done') && <ellipse cx="50" cy="60" rx="30" ry="42" className={ovalClass} />}
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
        <p className={`hint ${phase === 'error' || phase === 'failed' ? 'werr' : ''} ${phase === 'turn' ? 'turnmsg' : ''}`}>{msg}</p>
        <div className="row">
          {phase === 'ready' && (
            <button className="primary cta" onClick={() => void run()}><ScanFace size={20} /> Mulai</button>
          )}
          {phase === 'error' && (
            <button className="primary" onClick={() => void run()}><RotateCw size={15} /> Coba lagi</button>
          )}
          {phase === 'done' && <button className="primary" disabled><Check size={15} /> Berhasil</button>}
          {!busy && phase !== 'done' && <button onClick={onClose}>Tutup</button>}
        </div>
        <p className="hint dim">Foto wajah hanya diproses sesaat di server kami lalu dibuang — tidak disimpan.</p>
      </motion.div>
    </div>
  );
}
