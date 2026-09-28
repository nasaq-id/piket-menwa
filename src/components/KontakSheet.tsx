import { motion } from 'framer-motion';
import { useState } from 'react';
import { AliasField, NbpField, WaField, identitySchema } from '../Welcome';
import { ShakeErr, TAP } from './Motion';

// Isi/ubah No. WA + alias + NBP. `forced` = akun lama yang belum punya WA: tidak bisa
// ditutup sebelum tersimpan (WA jadi identitas login berikutnya).
export function KontakSheet({ forced, onSave, onClose }: {
  forced: boolean;
  onSave: (k: { wa: string; alias: string; nbp: string }) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const [wa, setWa] = useState('');
  const [alias, setAlias] = useState('');
  const [nbp, setNbp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    const v = identitySchema.safeParse({ wa, alias, nbp });
    if (!v.success) return setErr(v.error.issues[0]?.message ?? 'Isian belum valid.');
    setBusy(true);
    setErr(null);
    const r = await onSave(v.data);
    setBusy(false);
    if (!r.ok) setErr(r.error ?? 'Gagal simpan.');
  };
  return (
    <motion.div
      className="sheetwrap" onClick={forced ? undefined : onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="sheet" onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
      >
        <i className="grabber" />
        <b>{forced ? 'Lengkapi data login' : 'Ubah NBP / No. WA / alias'}</b>
        {forced && (
          <span className="hint">
            Mulai sekarang login pakai NBP, No. WhatsApp, atau alias + PIN/password, lalu verifikasi wajah.
          </span>
        )}
        <NbpField value={nbp} onChange={setNbp} />
        <WaField value={wa} onChange={setWa} />
        <AliasField value={alias} onChange={setAlias} onEnter={() => void submit()} />
        <ShakeErr msg={err} />
        <motion.button className="primary" disabled={busy} onClick={() => void submit()} {...TAP}>
          {busy ? 'Menyimpan…' : 'Simpan'}
        </motion.button>
        {!forced && <motion.button className="ghostbtn" onClick={onClose} {...TAP}>Batal</motion.button>}
      </motion.div>
    </motion.div>
  );
}
