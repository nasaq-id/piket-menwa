// Klien CompreFace (self-hosted, lihat infra/compreface). Dipakai HANYA
// untuk deteksi + embedding + landmark — anggota TIDAK didaftarkan di
// CompreFace; embedding disimpan terenkripsi di DB kita sendiri.

const URL_BASE = process.env.COMPREFACE_URL ?? 'http://127.0.0.1:8000';
const API_KEY = process.env.COMPREFACE_DETECT_KEY ?? '';

export interface DetectedFace {
  box: { x_min: number; y_min: number; x_max: number; y_max: number; probability: number };
  embedding: number[];
  // 5 titik [x, y]: mata, mata, hidung, sudut mulut, sudut mulut (koordinat gambar).
  landmarks: [number, number][];
}

export interface DetectResult {
  faces: DetectedFace[];
  calculator: string; // versi model embedding, mis. "insightface.Calculator@arcface_mobilefacenet"
}

export class CompreFaceError extends Error {}

export async function detectFaces(jpeg: Buffer): Promise<DetectResult> {
  if (!API_KEY) throw new CompreFaceError('COMPREFACE_DETECT_KEY belum diset');
  // status=true → respons menyertakan plugins_versions (versi model embedding).
  const q = new URLSearchParams({ face_plugins: 'calculator,landmarks', det_prob_threshold: '0.8', limit: '0', status: 'true' });
  let r: Response;
  try {
    r = await fetch(`${URL_BASE}/api/v1/detection/detect?${q}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ file: jpeg.toString('base64') }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new CompreFaceError(`CompreFace tidak bisa dihubungi: ${(e as Error).message}`);
  }
  const j = (await r.json()) as {
    result?: (DetectedFace & { box: DetectedFace['box'] })[];
    plugins_versions?: { calculator?: string };
    code?: number; message?: string;
  };
  // code 28 = "No face is found in the given image" → bukan error, cuma 0 wajah.
  if (!r.ok) {
    if (j.code === 28) return { faces: [], calculator: '' };
    throw new CompreFaceError(`CompreFace ${r.status}: ${j.message ?? 'gagal'}`);
  }
  return {
    faces: (j.result ?? []).map((f) => ({ box: f.box, embedding: f.embedding, landmarks: f.landmarks })),
    calculator: j.plugins_versions?.calculator ?? '',
  };
}

// Koefisien kalibrasi resmi CompreFace per model (endpoint /status core):
// similarity = (tanh((c0 - jarak_euclid) * c1) + 1) / 2, embedding dinormalisasi L2.
// Lihat docs/Face-Recognition-Similarity-Threshold.md di repo CompreFace.
const SIMILARITY_COEF: Record<string, [number, number]> = {
  'insightface.Calculator@arcface_mobilefacenet': [1.26538905, 5.552089201],
  'insightface.Calculator@arcface-r100-msfdrop75': [1.224676, 6.322647217],
};

export function similarity(a: number[], b: number[], calculator: string): number {
  const coef = SIMILARITY_COEF[calculator];
  if (!coef) throw new CompreFaceError(`koefisien similarity untuk ${calculator} belum dikenal`);
  const na = Math.hypot(...a);
  const nb = Math.hypot(...b);
  let d2 = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] / na - b[i] / nb;
    d2 += d * d;
  }
  return (Math.tanh((coef[0] - Math.sqrt(d2)) * coef[1]) + 1) / 2;
}
