import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { QrCode } from 'lucide-react';
import { extractQrToken } from '../qr';
import { Button } from './Button';
import { ShakeErr } from './Motion';

interface BarcodeDetectorLike { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

const SCAN_INTERVAL_MS = 100; // 10 pembacaan/detik — kisaran umum pustaka pemindai (nimiq/qr-scanner default 25/dtk, html5-qrcode contoh 10 fps)
const MAX_SCAN_W = 640; // frame diperkecil sebelum dibaca jsQR

// Absen tanpa wajah: scan QR yang ditempel di mako (kamera dalam aplikasi),
// atau ketik / tempel kodenya kalau kamera / pemindai tidak tersedia.
export function QrSheet({ onSubmit, onClose }: {
  onSubmit: (token: string) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Loop pemindai dibuat sekali; selalu panggil onSubmit terbaru, bukan salinan render pertama.
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const [kode, setKode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const busyRef = useRef(false);
  // Pemindaian berhenti (frame dibekukan) begitu ada 1 hasil, sampai user menekan "Scan ulang".
  // Hasil decode QR sudah divalidasi koreksi error Reed-Solomon, jadi tidak perlu konfirmasi
  // berulang; tidak ada coba-ulang otomatis (hasilnya pasti sama & bikin tombol/error berkedip).
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;

  const kirim = async (raw: string) => {
    const token = extractQrToken(raw);
    if (!token || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr(null);
    const r = await onSubmitRef.current(token);
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) setErr(r.error ?? 'Gagal absen.');
  };

  // Hasil dari kamera: bekukan pemindai dulu, baru kirim.
  const dariKamera = async (raw: string) => {
    pausedRef.current = true;
    setPaused(true);
    videoRef.current?.pause();
    await kirim(raw);
  };
  const scanUlang = () => {
    setErr(null);
    pausedRef.current = false;
    setPaused(false);
    void videoRef.current?.play();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Pemindai kamera. Mesin baca: BarcodeDetector bawaan browser kalau ada (di Chrome
  // Android = mesin barcode Google ML Kit, keluarga yang sama dengan Google Lens);
  // kalau tidak (iPhone/Safari, Firefox) pakai jsQR lewat canvas.
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    let stop = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
        });
        const video = videoRef.current;
        if (stop || !video) return;
        video.srcObject = stream;
        await video.play();
        setScanning(true);

        let read: () => Promise<string | null>;
        if (Detector) {
          const det = new Detector({ formats: ['qr_code'] });
          read = async () => (await det.detect(video))[0]?.rawValue ?? null;
        } else {
          const jsQR = (await import('jsqr')).default;
          const cv = document.createElement('canvas');
          const ctx = cv.getContext('2d', { willReadFrequently: true });
          read = async () => {
            if (!ctx || !video.videoWidth) return null;
            const k = Math.min(1, MAX_SCAN_W / video.videoWidth);
            cv.width = Math.round(video.videoWidth * k);
            cv.height = Math.round(video.videoHeight * k);
            ctx.drawImage(video, 0, 0, cv.width, cv.height);
            const img = ctx.getImageData(0, 0, cv.width, cv.height);
            return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
          };
        }

        const tick = async () => {
          if (stop) return;
          if (!pausedRef.current && !busyRef.current) {
            try {
              const v = await read();
              if (v && !pausedRef.current) await dariKamera(v);
            } catch { /* frame gagal dibaca → frame berikutnya */ }
          }
          timer = window.setTimeout(() => void tick(), SCAN_INTERVAL_MS);
        };
        void tick();
      } catch {
        setScanning(false); // izin kamera ditolak / tidak ada kamera → tetap bisa ketik kode
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
        <video
          ref={videoRef} muted playsInline
          style={scanning
            ? { width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, background: '#000' }
            : { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} // tetap dirender (iOS menolak memutar video display:none)
        />
        <span className="hint">
          {busy
            ? 'Memeriksa…'
            : paused
            ? 'Pemindaian dihentikan.'
            : scanning
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
          {scanning && paused && !busy
            ? <Button variant="primary" onClick={scanUlang}>Scan ulang</Button>
            : <Button variant="primary" busy={busy} disabled={!kode.trim()} onClick={() => void kirim(kode)}>Absen</Button>}
          <Button variant="secondary" onClick={onClose}>Batal</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
