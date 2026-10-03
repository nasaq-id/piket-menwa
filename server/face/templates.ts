// Template wajah per anggota: embedding CompreFace (depan + menoleh) +
// versi model, dienkripsi AES-256-GCM di tabel faces. Format lama (array
// descriptor face-api 128-d) tidak kompatibel → dianggap belum terdaftar.
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { decryptJson, encryptJson } from '../../db/crypto.ts';
import { faceChecks, faces } from '../../db/schema.sqlite.ts';
import type { ChallengeScores, Purpose } from './challenge.ts';
import type { FrameResult } from './pipeline.ts';

export interface FaceTemplate { v: 2; calculator: string; embeddings: number[][] }

const parse = (enc: string): FaceTemplate | null => {
  try {
    const t = decryptJson<FaceTemplate | unknown[]>(enc);
    return !Array.isArray(t) && t?.v === 2 ? t : null;
  } catch {
    return null; // key salah / data korup
  }
};

export function loadTemplate(memberId: string): FaceTemplate | null {
  const row = db.select().from(faces).where(eq(faces.memberId, memberId)).all()[0];
  return row ? parse(row.descriptors) : null;
}

export function allTemplates(): { memberId: string; tpl: FaceTemplate }[] {
  return db.select().from(faces).all().flatMap((r) => {
    const tpl = parse(r.descriptors);
    return tpl ? [{ memberId: r.memberId, tpl }] : [];
  });
}

export function saveTemplate(memberId: string, frames: FrameResult[]) {
  const tpl: FaceTemplate = { v: 2, calculator: frames[0].calculator, embeddings: frames.map((f) => f.face.embedding) };
  const enc = encryptJson(tpl);
  const exists = db.select({ m: faces.memberId }).from(faces).where(eq(faces.memberId, memberId)).all()[0];
  if (exists) db.update(faces).set({ descriptors: enc, updatedAt: Date.now() }).where(eq(faces.memberId, memberId)).run();
  else db.insert(faces).values({ memberId, descriptors: enc, updatedAt: Date.now() }).run();
}

/** Catat skor verifikasi (tanpa gambar/embedding) untuk kalibrasi & investigasi. */
export function logCheck(p: {
  purpose: Purpose; memberId: string | null; ok: boolean; reason?: string | null;
  scores: ChallengeScores; similarity?: number | null; ua?: string | null;
}) {
  db.insert(faceChecks).values({
    at: Date.now(), purpose: p.purpose, memberId: p.memberId, ok: p.ok ? 1 : 0, reason: p.reason ?? null,
    ...p.scores, similarity: p.similarity ?? null,
    ua: p.ua ? p.ua.slice(0, 160) : null,
  }).run();
}
