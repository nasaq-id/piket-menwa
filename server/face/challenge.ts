// Challenge-response wajah: server memberi instruksi arah ACAK (kiri/kanan)
// yang berlaku singkat & sekali pakai. HP mengirim 1 frame menghadap depan +
// beberapa frame setelah menoleh; server yang menilai semuanya. Foto diam
// (cetak/layar) tidak bisa menoleh sesuai perintah, rekaman video tidak bisa
// menebak arah yang diacak.
import { randomBytes, randomInt } from 'node:crypto';
import { similarity } from './compreface.ts';
import { analyzeFrame, FACE_CFG, REJECT_MSG, type FrameReject, type FrameResult } from './pipeline.ts';

// identify = login pakai wajah saja (cari di semua anggota); login = daftar ulang wajah
// setelah login manual (template belum ada).
export type Purpose = 'register' | 'login' | 'identify' | 'absen';
export type Action = 'kiri' | 'kanan';

const TTL_MS = 30_000;
const MAX_TURN_FRAMES = 4;

interface Challenge { purpose: Purpose; memberId: string | null; action: Action; exp: number }
const challenges = new Map<string, Challenge>();

export function issueChallenge(purpose: Purpose, memberId: string | null) {
  const now = Date.now();
  for (const [k, c] of challenges) if (c.exp < now) challenges.delete(k);
  const id = randomBytes(16).toString('hex');
  const action: Action = randomInt(2) === 0 ? 'kiri' : 'kanan';
  challenges.set(id, { purpose, memberId, action, exp: now + TTL_MS });
  return { challengeId: id, action, ttlMs: TTL_MS };
}

export type ChallengeReject = FrameReject | 'challenge' | 'frames' | 'not_frontal' | 'no_turn' | 'mismatch';
export interface ChallengeScores {
  liveFront: number | null; liveTurn: number | null;
  turnFront: number | null; turnTurn: number | null;
}
export type ChallengeOutcome =
  | { ok: true; front: FrameResult; turn: FrameResult; scores: ChallengeScores }
  | { ok: false; reason: ChallengeReject; msg: string; scores: ChallengeScores };

const MSG: Record<Exclude<ChallengeReject, FrameReject>, string> = {
  challenge: 'Sesi scan kedaluwarsa — tekan Mulai lagi.',
  frames: 'Data kamera tidak lengkap — coba lagi.',
  not_frontal: 'Awali dengan wajah menghadap lurus ke kamera.',
  no_turn: 'Gerakan menoleh tidak terdeteksi — ikuti arah panah, tolehkan kepala lebih jelas.',
  mismatch: 'Wajah berubah di tengah scan — pastikan hanya kamu di depan kamera.',
};

/** Decode dataURL JPEG/PNG/WebP → Buffer (maks ~2MB per frame). */
export function parseFrames(frames: unknown): Buffer[] | null {
  if (!Array.isArray(frames) || frames.length < 2 || frames.length > 1 + MAX_TURN_FRAMES) return null;
  const out: Buffer[] = [];
  for (const f of frames) {
    const m = typeof f === 'string' ? /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(f) : null;
    if (!m) return null;
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length === 0 || buf.length > 2 * 1024 * 1024) return null;
    out.push(buf);
  }
  return out;
}

/**
 * frames[0] = menghadap depan, frames[1..] = setelah instruksi menoleh.
 * Challenge dikonsumsi (sekali pakai) walau hasilnya gagal.
 */
export async function runChallenge(
  challengeId: unknown, purpose: Purpose, memberId: string | null, frames: Buffer[],
): Promise<ChallengeOutcome> {
  const scores: ChallengeScores = { liveFront: null, liveTurn: null, turnFront: null, turnTurn: null };
  const c = typeof challengeId === 'string' ? challenges.get(challengeId) : undefined;
  if (c) challenges.delete(challengeId as string);
  if (!c || c.exp < Date.now() || c.purpose !== purpose || c.memberId !== memberId) {
    return { ok: false, reason: 'challenge', msg: MSG.challenge, scores };
  }
  const [frontBuf, ...turnBufs] = frames;
  const [front, ...turns] = await Promise.all([analyzeFrame(frontBuf), ...turnBufs.map(analyzeFrame)]);
  if (!front.ok) {
    scores.liveFront = front.live ?? null;
    return { ok: false, reason: front.reason, msg: REJECT_MSG[front.reason], scores };
  }
  scores.liveFront = front.frame.live;
  scores.turnFront = front.frame.turn;
  if (Math.abs(front.frame.turn) > FACE_CFG.frontalMax) {
    return { ok: false, reason: 'not_frontal', msg: MSG.not_frontal, scores };
  }
  // + = hidung ke kanan gambar = kiri pengguna (frame kamera depan tidak dicermin).
  const want = c.action === 'kiri' ? 1 : -1;
  let spoof: { reason: FrameReject; live?: number } | null = null;
  let best: FrameResult | null = null;
  for (const t of turns) {
    if (!t.ok) {
      if (t.reason === 'spoof' || t.reason === 'multi_face') spoof ??= t;
      continue;
    }
    scores.liveTurn = t.frame.live;
    scores.turnTurn = t.frame.turn;
    if (t.frame.turn * want >= FACE_CFG.turnMin) {
      best = t.frame;
      break;
    }
  }
  // Satu frame palsu/ada wajah lain saja sudah cukup untuk menolak seluruh scan.
  if (spoof) {
    scores.liveTurn = spoof.live ?? scores.liveTurn;
    return { ok: false, reason: spoof.reason, msg: REJECT_MSG[spoof.reason], scores };
  }
  if (!best) return { ok: false, reason: 'no_turn', msg: MSG.no_turn, scores };
  // Frame depan & menoleh harus orang yang sama (cegah ganti wajah di tengah scan).
  if (similarity(front.frame.face.embedding, best.face.embedding, front.frame.calculator) < FACE_CFG.matchMin) {
    return { ok: false, reason: 'mismatch', msg: MSG.mismatch, scores };
  }
  return { ok: true, front: front.frame, turn: best, scores };
}
