// Cek pipeline wajah pada file gambar — buat kalibrasi & belajar.
//   node --env-file-if-exists=.env scripts/face-check.ts foto1.jpg foto2.jpg ...
// Menampilkan per gambar: jumlah wajah, skor liveness, arah hadap; lalu
// similarity antar-pasangan gambar (butuh CompreFace jalan, lihat infra/compreface).
import fs from 'node:fs';
import path from 'node:path';
import { detectFaces, similarity, type DetectedFace } from '../server/face/compreface.ts';
import { livenessScore } from '../server/face/liveness.ts';
import { FACE_CFG } from '../server/face/pipeline.ts';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.log('pakai: node --env-file-if-exists=.env scripts/face-check.ts foto1.jpg [foto2.jpg ...]');
  process.exit(1);
}

console.log('batas:', FACE_CFG, '\n');
const got: { name: string; face: DetectedFace; calc: string }[] = [];
for (const f of files) {
  const name = path.basename(f);
  const buf = fs.readFileSync(f);
  const t0 = performance.now();
  const { faces, calculator } = await detectFaces(buf);
  const t1 = performance.now();
  if (faces.length !== 1) {
    console.log(`${name}: ${faces.length} wajah — dilewati`);
    continue;
  }
  const face = faces[0];
  const live = await livenessScore(buf, face);
  const t2 = performance.now();
  const w = face.box.x_max - face.box.x_min;
  const [e1, e2, nose] = face.landmarks;
  const turn = (nose[0] - (e1[0] + e2[0]) / 2) / w;
  const arah = Math.abs(turn) <= FACE_CFG.frontalMax ? 'depan'
    : Math.abs(turn) >= FACE_CFG.turnMin ? (turn > 0 ? 'noleh → kanan gambar' : 'noleh → kiri gambar') : 'agak miring';
  console.log(
    `${name}: wajah ${Math.round(w)}px, liveness ${live.toFixed(3)} ${live >= FACE_CFG.liveMin ? 'ASLI' : 'PALSU?'}, `
    + `arah ${turn >= 0 ? '+' : ''}${turn.toFixed(3)} (${arah}) — CompreFace ${Math.round(t1 - t0)}ms, liveness ${Math.round(t2 - t1)}ms`,
  );
  got.push({ name, face, calc: calculator });
}

if (got.length > 1) {
  console.log('\nsimilarity (≥', FACE_CFG.matchMin, '= cocok):');
  for (let i = 0; i < got.length; i++) {
    for (let j = i + 1; j < got.length; j++) {
      const s = similarity(got[i].face.embedding, got[j].face.embedding, got[i].calc);
      console.log(`  ${got[i].name} ↔ ${got[j].name}: ${s.toFixed(3)} ${s >= FACE_CFG.matchMin ? 'COCOK' : ''}`);
    }
  }
}
