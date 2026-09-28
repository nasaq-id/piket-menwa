// Efek suara & getar untuk alur scan wajah (Web Audio, tanpa file).
// Pengenalan wajah sendiri sekarang di SERVER (lihat server/face/).

let audioCtx: AudioContext | null = null;

// Panggil di dalam tap tombol (butuh gesture browser).
export function warmAudio() {
  try {
    audioCtx ??= new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch { /* suara opsional */ }
}

interface ToneOpts {
  type?: OscillatorType;
  peak?: number;
  detune?: number;
  filterFreq?: number;
  filterQ?: number;
}

// Nada dasar + amplop cepat (attack pendek, decay eksponensial) — building
// block untuk lapisan-lapisan suara di bawah.
function tone(ctx: AudioContext, t0: number, freq: number, dur: number, opts: ToneOpts = {}) {
  const { type = 'sine', peak = 0.4, detune = 0, filterFreq, filterQ = 1 } = opts;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, dur * 0.25));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  if (filterFreq) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFreq, t0);
    f.Q.value = filterQ;
    o.connect(f);
    f.connect(g);
  } else {
    o.connect(g);
  }
  g.connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

// Sapuan frekuensi naik cepat lewat lowpass yang ikut menyapu — kesan
// "scan"/"lock-on" radar ala antarmuka sci-fi, bukan sinus polos.
function chirp(ctx: AudioContext, t0: number, fromFreq: number, toFreq: number, dur: number, peak = 0.28) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(fromFreq, t0);
  o.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur);
  f.type = 'lowpass';
  f.frequency.setValueAtTime(fromFreq * 2, t0);
  f.frequency.exponentialRampToValueAtTime(toFreq * 2.2, t0 + dur);
  f.Q.value = 0.8;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

// Login/absen/verifikasi wajah berhasil — "akses diterima": chirp naik
// cepat + dua nada harmonis interval kwint (sedikit di-detune biar berasa
// digital, bukan organ), ditutup shimmer tinggi pendek. Signature dipakai
// apa adanya di App.tsx (ting(990, 0.18)).
export function ting(freq = 880, dur = 0.15, delay = 0) {
  try {
    warmAudio();
    if (!audioCtx || audioCtx.state !== 'running') return;
    const ctx = audioCtx;
    const t0 = ctx.currentTime + delay;
    chirp(ctx, t0, freq * 0.6, freq * 1.05, dur * 0.45, 0.22);
    tone(ctx, t0 + dur * 0.15, freq, dur * 0.6, { type: 'triangle', peak: 0.32 });
    tone(ctx, t0 + dur * 0.32, freq * 1.5, dur * 0.55, { type: 'sine', peak: 0.24, detune: 4 });
    tone(ctx, t0 + dur * 0.32, freq * 1.5, dur * 0.5, { type: 'sine', peak: 0.12, detune: -4 });
    tone(ctx, t0 + dur * 0.5, freq * 3, dur * 0.25, { type: 'sine', peak: 0.06 }); // shimmer
  } catch { /* suara opsional */ }
}

// Nada per tahap pendaftaran wajah (tahan → kanan → kiri): tiap tahap
// lolos terasa seperti radar lock-on — sapuan cepat + ping pendek, nada
// makin tinggi tiap tahap biar progres kerasa.
export const tingStage = (n: number) => {
  try {
    warmAudio();
    if (!audioCtx || audioCtx.state !== 'running') return;
    const ctx = audioCtx;
    const t0 = ctx.currentTime;
    const base = [660, 880, 1175][n] ?? 880;
    chirp(ctx, t0, base * 0.7, base * 1.15, 0.09, 0.22);
    tone(ctx, t0 + 0.05, base, 0.14, { type: 'triangle', peak: 0.26, filterFreq: base * 3 });
    tone(ctx, t0 + 0.05, base * 2, 0.1, { type: 'sine', peak: 0.08 });
  } catch { /* suara opsional */ }
};
