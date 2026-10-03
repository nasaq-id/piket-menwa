// Analisis satu frame kamera di SERVER: deteksi + embedding (CompreFace) +
// anti-spoofing (MiniFASNet) + arah hadap (landmark). HP tidak pernah
// dipercaya menghitung embedding sendiri. Frame hanya diproses di memori.
import sharp from 'sharp';
import { detectFaces, similarity, type DetectedFace } from './compreface.ts';
import { livenessDetail } from './liveness.ts';

// Batas operasi — satu tempat, bisa di-tune via env saat kalibrasi lapangan.
const num = (name: string, def: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
};
export const FACE_CFG = {
  // Similarity CompreFace; >0.5 disarankan untuk sistem keamanan tinggi.
  matchMin: num('FACE_MATCH_MIN', 0.9),
  // Skor MiniFASNet rata-rata 2 model; referensi Silent-Face memakai argmax (≈0.5).
  liveMin: num('FACE_LIVE_MIN', 0.8),
  // Lebar kotak wajah minimal (px) — wajah terlalu kecil/jauh = kualitas buruk.
  minFacePx: num('FACE_MIN_PX', 90),
  // Pergeseran hidung thd tengah mata, relatif lebar wajah: di bawah ini = menghadap depan,
  // di atas turnMin = menoleh. Dikalibrasi dari tes kamera asli.
  // Tes kamera HP 2026-09-28: depan |turn| ≤ 0.047, menoleh ≈ 0.18–0.20.
  frontalMax: num('FACE_FRONTAL_MAX', 0.06),
  turnMin: num('FACE_TURN_MIN', 0.12),
};

export type FrameReject = 'no_face' | 'multi_face' | 'too_small' | 'spoof';
export interface FrameResult {
  face: DetectedFace;
  calculator: string;
  live: number;
  // + = hidung bergeser ke KANAN gambar. Frame kamera depan TIDAK dicermin →
  // kanan gambar = kiri pengguna.
  turn: number;
}

// Diagnosa per frame (TANPA gambar) untuk tabel face_checks: ukuran frame &
// box wajah, skor tiap model liveness, dan kecerahan area wajah. Null bila
// belum/tidak tersedia (mis. frame ditolak sebelum wajah terdeteksi).
export interface FrameDiagnostics {
  frameW: number | null;
  frameH: number | null;
  faceW: number | null;
  faceH: number | null;
  liveV2: number | null;
  liveV1se: number | null;
  luma: number | null;
}

const diagBase = (w: number | null, h: number | null): FrameDiagnostics => ({
  frameW: w, frameH: h, faceW: null, faceH: null, liveV2: null, liveV1se: null, luma: null,
});

// Dimensi gambar dari header (tanpa decode penuh) — dipakai saat wajah tidak ada.
const frameSize = async (jpeg: Buffer): Promise<{ w: number | null; h: number | null }> => {
  try {
    const m = await sharp(jpeg).metadata();
    return { w: m.width ?? null, h: m.height ?? null };
  } catch {
    return { w: null, h: null };
  }
};

export async function analyzeFrame(jpeg: Buffer): Promise<
  | { ok: true; frame: FrameResult; diag: FrameDiagnostics }
  | { ok: false; reason: FrameReject; live?: number; diag: FrameDiagnostics }
> {
  const size = await frameSize(jpeg);
  const { faces, calculator } = await detectFaces(jpeg);
  if (faces.length === 0) return { ok: false, reason: 'no_face', diag: diagBase(size.w, size.h) };
  if (faces.length > 1) return { ok: false, reason: 'multi_face', diag: diagBase(size.w, size.h) };
  const face = faces[0];
  const fw = face.box.x_max - face.box.x_min;
  const fh = face.box.y_max - face.box.y_min;
  const diag = diagBase(size.w, size.h);
  diag.faceW = Math.round(fw);
  diag.faceH = Math.round(fh);
  if (fw < FACE_CFG.minFacePx) return { ok: false, reason: 'too_small', diag };
  const d = await livenessDetail(jpeg, face);
  diag.frameW = d.frameW;
  diag.frameH = d.frameH;
  diag.liveV2 = d.v2;
  diag.liveV1se = d.v1se;
  diag.luma = d.luma;
  if (d.score < FACE_CFG.liveMin) return { ok: false, reason: 'spoof', live: d.score, diag };
  const [e1, e2, nose] = face.landmarks;
  const turn = (nose[0] - (e1[0] + e2[0]) / 2) / fw;
  return { ok: true, frame: { face, calculator, live: d.score, turn }, diag };
}

/** Similarity tertinggi sample thd salah satu embedding terdaftar (model harus sama). */
export function bestMatch(sample: FrameResult, enrolled: { calculator: string; embeddings: number[][] }): number {
  if (enrolled.calculator !== sample.calculator) return 0;
  return Math.max(0, ...enrolled.embeddings.map((e) => similarity(sample.face.embedding, e, sample.calculator)));
}

export const REJECT_MSG: Record<FrameReject, string> = {
  no_face: 'Wajah tidak terdeteksi — pastikan wajah terlihat jelas dan cukup cahaya.',
  multi_face: 'Terdeteksi lebih dari satu wajah — pastikan hanya kamu di depan kamera.',
  too_small: 'Wajah terlalu jauh — dekatkan HP ke wajah.',
  spoof: 'Wajah tidak lolos cek wajah asli. Jauhkan HP ±30–40 cm, cari tempat terang, tahan diam, lalu coba lagi.',
};
