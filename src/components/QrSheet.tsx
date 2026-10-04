import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { QrCode } from 'lucide-react';
import { extractQrToken } from '../qr';
import { Button } from './Button';
import { ShakeErr } from './Motion';

interface BarcodeDetectorLike { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

// Absen tanpa wajah: scan QR yang ditempel di mako (kamera dalam aplikasi),
// atau ketik / tempel kodenya kalau kamera / pemindai tidak tersedia.
export function QrSheet({ onSubmit, onClose }: {
  onSubmit: (token: string) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [kode, setKode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const busyRef = useRef(false);
  const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;

  const kirim = async (raw: string) => {
    const token = extractQrToken(raw);
    if (!token || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr(null);
    const r = await onSubmit(token);
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) setErr(r.error ?? 'Gagal absen.');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Pemindai: aktif otomatis kalau browser punya BarcodeDetector (Chrome Android).
  useEffect(() => {
    if (!Detector || !navigator.mediaDevices?.getUserMedia) return;
    let stop = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    const det = new Detector({ formats: ['qr_code'] });
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stop || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        const tick = async () => {
          if (stop) return;
          try {
            const hit = videoRef.current ? await det.detect(videoRef.current) : [];
            if (hit[0] && !busyRef.current) await kirim(hit[0].rawValue);
          } catch { /* frame gagal dibaca → coba lagi */ }
          timer = window.setTimeout(() => void tick(), 400);
        };
        void tick();
      } catch {
        setScanning(false); // izin kamera ditolak → tetap bisa ketik kode
      }
    })();
    return () => {
      stop = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      className="sheetwrap" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="sheet" role="dialog" aria-modal="true" aria-label="Absen dengan QR mako"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
      >
        <div className="sheethead"><i className="grabber" /></div>
        <b><QrCode size={15} /> Absen — scan QR di mako</b>
        {Detector && (
          <video
            ref={videoRef} muted playsInline
            style={{ width: '100%', maxHeight: 240, borderRadius: 12, background: '#000', display: scanning ? 'block' : 'none' }}
          />
        )}
        <span className="hint">
          {scanning
            ? 'Arahkan kamera ke QR yang ditempel di mako.'
            : 'Scan QR mako dengan kamera HP (otomatis terbuka di sini), atau ketik kodenya di bawah.'}
        </span>
        <input
          placeholder="Kode QR mako" value={kode} autoCapitalize="none" autoCorrect="off"
          onChange={(e) => { setKode(e.target.value); setErr(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void kirim(kode); }}
        />
        <ShakeErr msg={err} />
        <div className="row">
          <Button variant="primary" busy={busy} disabled={!kode.trim()} onClick={() => void kirim(kode)}>Absen</Button>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
