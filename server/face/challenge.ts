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
const MAX_TURN_FRAMES = 10;

type Analysis = Awaited<ReturnType<typeof analyzeFrame>>;
// front/turns terisi kalau HP mengirim frame satu per satu (POST /api/face/frame):
// tiap frame langsung dinilai, HP berhenti begitu sudah cukup menoleh.
interface Challenge {
  purpose: Purpose; memberId: string | null; action: Action; exp: number;
  front?: Promise<Analysis>; turns: Promise<Analysis>[];
}
const challenges = new Map<string, Challenge>();

export function issueChallenge(purpose: Purpose, memberId: string | null) {
  const now = Date.now();
  for (const [k, c] of challenges) if (c.exp < now) challenges.delete(k);
  const id = randomBytes(16).toString('hex');
  const action: Action = randomInt(2) === 0 ? 'kiri' : 'kanan';
  challenges.set(id, { purpose, memberId, action, exp: now + TTL_MS, turns: [] });
  return { challengeId: id, action, ttlMs: TTL_MS };
}

export type ChallengeReject = FrameReject | 'challenge' | 'frames' | 'not_frontal' | 'no_turn' | 'mismatch';
export interface ChallengeScores {
  liveFront: number | null; liveTurn: number | null;
  turnFront: number | null; turnTurn: number | null;
  // Diagnosa FRAME DEPAN (tanpa gambar) — ukuran frame/box, skor tiap model,
  // & kecerahan; nama harus cocok dgn kolom tabel face_checks.
  frameW: number | null; frameH: number | null;
  faceW: number | null; faceH: number | null;
  liveV2: number | null; liveV1se: number | null; luma: number | null;
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
export function parseFrame(f: unknown): Buffer | null {
  const m = typeof f === 'string' ? /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(f) : null;
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  return buf.length === 0 || buf.length > 2 * 1024 * 1024 ? null : buf;
}
export function parseFrames(frames: unknown): Buffer[] | null {
  if (!Array.isArray(frames) || frames.length < 2 || frames.length > 1 + MAX_TURN_FRAMES) return null;
  const out = frames.map(parseFrame);
  return out.every((b): b is Buffer => b !== null) ? out : null;
}

/**
 * Kirim frame satu per satu. Hasil cuma petunjuk untuk HP kapan berhenti
 * (turned / frame depan ditolak); keputusan tetap di runChallenge.
 */
export async function addFrame(
  challengeId: unknown, kind: unknown, buf: Buffer,
): Promise<{ ok: true; turned: boolean; stop: boolean } | { ok: false; error: string }> {
  const c = typeof challengeId === 'string' ? challenges.get(challengeId) : undefined;
  if (!c || c.exp < Date.now()) return { ok: false, error: MSG.challenge };
  if (kind === 'front') {
    if (c.front) return { ok: false, error: MSG.frames };
    c.front = analyzeFrame(buf);
    const a = await c.front;
    // Frame depan gagal → percuma lanjut menoleh; HP langsung minta keputusan.
    return { ok: true, turned: false, stop: !a.ok || Math.abs(a.frame.turn) > FACE_CFG.frontalMax };
  }
  if (kind !== 'turn' || c.turns.length >= MAX_TURN_FRAMES) return { ok: false, error: MSG.frames };
  const p = analyzeFrame(buf);
  c.turns.push(p);
  const a = await p;
  const want = c.action === 'kiri' ? 1 : -1;
  const turned = a.ok && a.frame.turn * want >= FACE_CFG.turnMin;
  return { ok: true, turned, stop: turned || (!a.ok && a.reason === 'multi_face') };
}

/**
 * frames[0] = menghadap depan, frames[1..] = setelah instruksi menoleh.
 * frames = null → pakai frame yang sudah dikirim satu per satu lewat addFrame.
 * Challenge dikonsumsi (sekali pakai) walau hasilnya gagal.
 */
export async function runChallenge(
  challengeId: unknown, purpose: Purpose, memberId: string | null, frames: Buffer[] | null,
): Promise<ChallengeOutcome> {
  const scores: ChallengeScores = {
    liveFront: null, liveTurn: null, turnFront: null, turnTurn: null,
    frameW: null, frameH: null, faceW: null, faceH: null,
    liveV2: null, liveV1se: null, luma: null,
  };
  const c = typeof challengeId === 'string' ? challenges.get(challengeId) : undefined;
  if (c) challenges.delete(challengeId as string);
  if (!c || c.exp < Date.now() || c.purpose !== purpose || c.memberId !== memberId) {
    return { ok: false, reason: 'challenge', msg: MSG.challenge, scores };
  }
  let front: Analysis;
  let turns: Analysis[];
  if (frames) {
    const [frontBuf, ...turnBufs] = frames;
    [front, ...turns] = await Promise.all([analyzeFrame(frontBuf), ...turnBufs.map(analyzeFrame)]);
  } else {
    // Tanpa frame menoleh tetap dinilai: frame depan yang gagal harus dapat alasan aslinya
    // (HP berhenti sebelum menoleh), kalau depan lolos hasilnya no_turn.
    if (!c.front) return { ok: false, reason: 'frames', msg: MSG.frames, scores };
    [front, ...turns] = await Promise.all([c.front, ...c.turns]);
  }
  // Diagnosa frame depan (ukuran frame/box, skor tiap model, luma) untuk log.
  const fillFrontDiag = (a: Analysis) => {
    scores.frameW = a.diag.frameW;
    scores.frameH = a.diag.frameH;
    scores.faceW = a.diag.faceW;
    scores.faceH = a.diag.faceH;
    scores.liveV2 = a.diag.liveV2;
    scores.liveV1se = a.diag.liveV1se;
    scores.luma = a.diag.luma;
  };
  if (!front.ok) {
    fillFrontDiag(front);
    scores.liveFront = front.live ?? null;
    return { ok: false, reason: front.reason, msg: REJECT_MSG[front.reason], scores };
  }
  fillFrontDiag(front);
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
      // Ada wajah lain di frame mana pun = tolak seluruh scan.
      if (t.reason === 'multi_face') return { ok: false, reason: t.reason, msg: REJECT_MSG[t.reason], scores };
      if (t.reason === 'spoof') spoof ??= t;
      continue;
    }
    // Log: frame yang paling jauh menoleh ke arah yang diminta.
    if (scores.turnTurn === null || t.frame.turn * want > scores.turnTurn * want) {
      scores.turnTurn = t.frame.turn;
      scores.liveTurn = t.frame.live;
    }
    if (!best && t.frame.turn * want >= FACE_CFG.turnMin) best = t.frame;
  }
  // Frame bukti (depan + menoleh) WAJIB lolos liveness penuh (batas tidak
  // diturunkan). Frame di tengah gerakan kepala sering buram → skornya turun;
  // frame itu diabaikan selama ada frame menoleh lain yang lolos penuh.
  if (!best && spoof) {
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
