// Anti-spoofing pasif: MiniFASNet (Silent-Face-Anti-Spoofing, Minivision,
// Apache-2.0), port ONNX dari github.com/yakhyo/face-anti-spoofing.
// Preprocessing SAMA PERSIS dgn referensinya: crop kotak wajah diperbesar
// (2.7× untuk V2, 4.0× untuk V1SE) → resize 80×80 → BGR float 0..255 NCHW.
// Output 3 kelas, index 1 = wajah asli; 2 model dirata-rata (cara Silent-Face).
import path from 'node:path';
import * as ort from 'onnxruntime-node';
import sharp, { type Sharp } from 'sharp';
import type { DetectedFace } from './compreface.ts';

const MODELS = [
  { file: 'MiniFASNetV2.onnx', scale: 2.7 },
  { file: 'MiniFASNetV1SE.onnx', scale: 4.0 },
] as const;
const SIZE = 80;

let sessions: Promise<ort.InferenceSession[]> | null = null;
const loadSessions = () => {
  sessions ??= Promise.all(MODELS.map((m) =>
    ort.InferenceSession.create(path.join(import.meta.dirname, '..', 'models', m.file))));
  return sessions;
};

const softmax = (x: Float32Array): number[] => {
  const m = Math.max(...x);
  const e = Array.from(x, (v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
};

// Port crop_face() referensi: skala dibatasi supaya crop muat di gambar.
async function cropTensor(img: Sharp, w: number, h: number, face: DetectedFace, scaleWanted: number) {
  const { x_min, y_min, x_max, y_max } = face.box;
  const bw = x_max - x_min;
  const bh = y_max - y_min;
  const scale = Math.min((h - 1) / bh, (w - 1) / bw, scaleWanted);
  const cx = x_min + bw / 2;
  const cy = y_min + bh / 2;
  const x1 = Math.max(0, Math.trunc(cx - (bw * scale) / 2));
  const y1 = Math.max(0, Math.trunc(cy - (bh * scale) / 2));
  const x2 = Math.min(w - 1, Math.trunc(cx + (bw * scale) / 2));
  const y2 = Math.min(h - 1, Math.trunc(cy + (bh * scale) / 2));
  const raw = await img.clone()
    .extract({ left: x1, top: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 })
    .resize(SIZE, SIZE, { fit: 'fill', kernel: 'linear' })
    .removeAlpha().raw().toBuffer();
  // RGB interleaved (sharp) → BGR planar (format OpenCV yg dipakai saat training).
  const t = new Float32Array(3 * SIZE * SIZE);
  const plane = SIZE * SIZE;
  for (let i = 0; i < plane; i++) {
    t[i] = raw[i * 3 + 2]; // B
    t[plane + i] = raw[i * 3 + 1]; // G
    t[2 * plane + i] = raw[i * 3]; // R
  }
  return new ort.Tensor('float32', t, [1, 3, SIZE, SIZE]);
}

/** Detail skor tiap model + diagnosa frame (ukuran & kecerahan area wajah). */
export interface LivenessDetail {
  score: number; // rata-rata kedua model, 0..1
  v2: number; // MiniFASNetV2
  v1se: number; // MiniFASNetV1SE
  frameW: number;
  frameH: number;
  luma: number; // rata-rata kecerahan 0..255 area box wajah
}

// Rata-rata kecerahan (grayscale) area box wajah — untuk memastikan penyebab
// skor liveness rendah (gelap/buram) tanpa perlu menyimpan gambar.
async function faceLuma(img: Sharp, w: number, h: number, face: DetectedFace): Promise<number> {
  const { x_min, y_min, x_max, y_max } = face.box;
  const x1 = Math.max(0, Math.trunc(x_min));
  const y1 = Math.max(0, Math.trunc(y_min));
  const x2 = Math.min(w - 1, Math.trunc(x_max));
  const y2 = Math.min(h - 1, Math.trunc(y_max));
  if (x2 <= x1 || y2 <= y1) return 0;
  const raw = await img.clone()
    .extract({ left: x1, top: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 })
    .greyscale().raw().toBuffer();
  let sum = 0;
  for (let i = 0; i < raw.length; i++) sum += raw[i];
  return raw.length ? sum / raw.length : 0;
}

/** Skor liveness + detail per model + diagnosa frame (tanpa menyimpan gambar). */
export async function livenessDetail(jpeg: Buffer, face: DetectedFace): Promise<LivenessDetail> {
  const ss = await loadSessions();
  const img = sharp(jpeg);
  const { width, height } = await img.metadata();
  if (!width || !height) throw new Error('gambar tidak terbaca');
  const reals: number[] = [];
  for (let i = 0; i < MODELS.length; i++) {
    const input = await cropTensor(img, width, height, face, MODELS[i].scale);
    const out = await ss[i].run({ [ss[i].inputNames[0]]: input });
    reals.push(softmax(out[ss[i].outputNames[0]].data as Float32Array)[1]);
  }
  return {
    score: reals.reduce((a, b) => a + b, 0) / MODELS.length,
    v2: reals[0],
    v1se: reals[1],
    frameW: width,
    frameH: height,
    luma: await faceLuma(img, width, height, face),
  };
}

/** Skor 0..1 bahwa wajah di frame ini asli (bukan foto cetak / layar / topeng). */
export async function livenessScore(jpeg: Buffer, face: DetectedFace): Promise<number> {
  return (await livenessDetail(jpeg, face)).score;
}
