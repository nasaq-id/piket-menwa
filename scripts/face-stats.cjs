#!/usr/bin/env node
// Statistik kualitas verifikasi wajah dari log face_checks.
// Jalankan di VPS app (dari /opt/piket-menwa):
//   node scripts/face-stats.cjs              # hari ini
//   node scripts/face-stats.cjs 7            # 7 hari terakhir
// Target Fase A: first-try success > 80% untuk purpose identify/enroll.
const path = require('node:path');
const Database = require(path.join(process.cwd(), 'node_modules', 'better-sqlite3'));

const days = Number(process.argv[2] || 1);
const dbFile = path.join(process.cwd(), 'data', 'piket.db');
const db = new Database(dbFile, { readonly: true });
const since = Date.now() - days * 86400_000;

const rows = db
  .prepare(`SELECT purpose, ok, reason, count(*) n FROM face_checks WHERE at >= ? GROUP BY purpose, ok, reason ORDER BY n DESC`)
  .all(since);

const total = rows.reduce((a, r) => a + r.n, 0);
const ok = rows.filter((r) => r.ok).reduce((a, r) => a + r.n, 0);
console.log(`\nVerifikasi wajah — ${days} hari terakhir`);
console.log(`  total percobaan : ${total}`);
console.log(`  sukses          : ${ok} (${total ? Math.round((100 * ok) / total) : 0}%)`);
console.log(`  target fase A   : >80% (diukur mingguan)\n`);
console.log('  rincian:');
for (const r of rows) {
  console.log(`    ${String(r.purpose).padEnd(9)} ${r.ok ? 'OK   ' : 'GAGAL'} ${String(r.reason || '-').padEnd(11)} ${r.n}`);
}
console.log('');

// Skor liveness & kecerahan percobaan terakhir — buat kalibrasi ambang.
const last = db
  .prepare(`SELECT purpose, ok, reason, round(live_v2,3) v2, round(live_v1se,3) v1se, round(luma,1) luma
            FROM face_checks WHERE at >= ? ORDER BY at DESC LIMIT 8`)
  .all(since);
if (last.length) {
  console.log('  8 percobaan terakhir (buat kalibrasi):');
  for (const r of last) {
    console.log(
      `    ${String(r.purpose).padEnd(9)} ${r.ok ? 'OK   ' : 'GAGAL'} ${String(r.reason || '-').padEnd(11)}` +
        ` live_v2=${String(r.v2 ?? '-').padStart(6)} live_v1se=${String(r.v1se ?? '-').padStart(6)} luma=${String(r.luma ?? '-').padStart(5)}`,
    );
  }
  console.log('');
}
