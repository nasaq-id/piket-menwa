import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Briefcase, ClipboardList, FileText, Flag, KeyRound, Medal, PenLine, ScanFace, Shield, Sprout, Users } from 'lucide-react';
import { z } from 'zod';
import { checkKontak, type AuthType } from './api';
import { Button } from './components/Button';
import { ShakeErr, TAP } from './components/Motion';
import { useTypingPlaceholder } from './hooks/useTypingPlaceholder';

export const JABATAN_LIST = [
  'Danki',
  'Kaur Ops',
  'Staff ops',
  'Kaur Min',
  'Staf min',
  'KaUrdal',
  'Anggota Urdal',
  'Provost',
  'Anggota Remaja',
] as const;

const JABATAN_ICON = [Shield, ClipboardList, FileText, Users, Briefcase, Flag, Award, Medal, Sprout] as const;

// NBP Menwa: 1494.08.148031 — ketik 12 digit, titik disisipkan otomatis.
export const formatNbp = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 12);
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6)].filter(Boolean).join('.');
};
// Sama dengan normWa di server: 08xx / +628xx / 628xx → 628xx.
export const normWa = (v: string): string | null => {
  let d = v.replace(/[\s\-().]/g, '').replace(/^\+/, '');
  if (d.startsWith('0')) d = `62${d.slice(1)}`;
  else if (d.startsWith('8')) d = `62${d}`;
  return /^628\d{7,12}$/.test(d) ? d : null;
};

// Angkatan dari 2 digit pertama NBP: 1494.08.148031 → "14" → 2014 (sama dgn server).
export const angkatanFromNbp = (nbp: string): string | null => {
  if (!/^\d{4}\.\d{2}\.\d{6}$/.test(nbp)) return null;
  const y = 2000 + Number(nbp.slice(0, 2));
  return String(y > new Date().getFullYear() + 1 ? y - 100 : y);
};

const waSchema = z.string().trim().refine((v) => normWa(v) !== null, 'No. WhatsApp tidak valid (cth: 081234567890)');
const nbpSchema = z.string().trim().refine((v) => v === '' || angkatanFromNbp(v) !== null, 'Format NBP harus seperti 1494.08.148031');
const aliasSchema = z.string().trim()
  .regex(/^[A-Za-z0-9._-]{3,20}$/, 'Alias 3–20 huruf/angka tanpa spasi')
  .regex(/[A-Za-z]/, 'Alias wajib ada hurufnya');

// Identitas login: WA wajib, alias wajib, NBP opsional (fallback login: NBP → WA → alias).
export const identitySchema = z.object({ wa: waSchema, alias: aliasSchema, nbp: nbpSchema });

// Aturan PIN/password — cermin secretError() di server.
export const secretIssue = (authType: AuthType, secret: string, angkatan: string): string | null => {
  if (authType === 'password') {
    if (secret.length < 8) return 'Password minimal 8 karakter';
    if (secret.length > 64) return 'Password maksimal 64 karakter';
    if (!/[A-Za-z]/.test(secret) || !/\d/.test(secret)) return 'Password wajib gabungan huruf dan angka';
    return null;
  }
  if (!/^\d{6,}$/.test(secret)) return 'PIN minimal 6 digit angka';
  if (/^(\d)\1+$/.test(secret)) return 'PIN tidak boleh angka sama semua';
  const asc = '01234567890123456789';
  const desc = '98765432109876543210';
  for (let i = 0; i + 6 <= secret.length; i++) {
    const s = secret.slice(i, i + 6);
    if (asc.includes(s) || desc.includes(s)) return 'PIN tidak boleh berurutan';
  }
  if (angkatan && secret.includes(angkatan)) return 'PIN tidak boleh mengandung tahun angkatan';
  return null;
};

export const profileSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(5, 'Nama minimal 5 huruf')
    .max(30, 'Nama maksimal 30 huruf')
    .regex(/^[A-Za-zÀ-ÿ'’.\- ]+$/, 'Nama hanya huruf, spasi, titik, strip'),
  alias: aliasSchema,
  nbp: nbpSchema,
  jabatan: z
    .string()
    .trim()
    .min(2, 'Jabatan minimal 2 huruf')
    .max(40, 'Jabatan maksimal 40 huruf'),
  wa: waSchema,
  authType: z.enum(['pin', 'password']),
  secret: z.string(),
}).superRefine((v, ctx) => {
  const e = secretIssue(v.authType, v.secret, angkatanFromNbp(v.nbp) ?? '');
  if (e) ctx.addIssue({ code: 'custom', path: ['secret'], message: e });
});

export type Profile = z.infer<typeof profileSchema>;


const AUTH_PREF = 'piket-auth-type';
const loadAuthPref = (): AuthType => {
  try { return localStorage.getItem(AUTH_PREF) === 'password' ? 'password' : 'pin'; } catch { return 'pin'; }
};

// Input rahasia + pilihan PIN (keypad angka) / Password (keyboard penuh).
export function SecretField({ label, authType, onAuthType, value, onChange, onEnter, placeholder, autoComplete }: {
  label: string; authType: AuthType; onAuthType: (t: AuthType) => void;
  value: string; onChange: (v: string) => void; onEnter?: () => void;
  placeholder?: string; autoComplete: 'current-password' | 'new-password';
}) {
  return (
    <div className="wfield">
      <span>{label}</span>
      <div className="segrow">
        {(['pin', 'password'] as const).map((t) => (
          <motion.button
            key={t} type="button" {...TAP}
            className={`jabcard ${authType === t ? 'sel' : ''}`}
            animate={{ scale: authType === t ? 1 : 0.97, opacity: authType === t ? 1 : 0.75 }}
            transition={{ duration: 0.18 }}
            onClick={() => { if (t !== authType) { onAuthType(t); onChange(''); } }}
          >
            <KeyRound size={16} /> {t === 'pin' ? 'PIN (angka)' : 'Password'}
          </motion.button>
        ))}
      </div>
      <input
        type="password" autoComplete={autoComplete}
        inputMode={authType === 'pin' ? 'numeric' : 'text'}
        maxLength={authType === 'pin' ? 12 : 64}
        placeholder={placeholder ?? (authType === 'pin' ? 'PIN min 6 digit' : 'password min 8 karakter')}
        value={value}
        onChange={(e) => onChange(authType === 'pin' ? e.target.value.replace(/\D/g, '').slice(0, 12) : e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
      />
    </div>
  );
}

// Dua jalur login lewat logo (pilihan tidak ditampilkan langsung):
//   ketuk 1× → form manual (NBP / No. WA / alias + PIN/password)
//   ketuk 2× → kamera langsung scan wajah (server mengenali pemiliknya).
// Contoh dummy untuk placeholder login (BUKAN data nyata), tampil bergantian.
const LOGIN_CONTOH = ['1494.08.100001', '081234567890', 'rajawali'];
const LOGIN_STATIS = 'NBP, No. WA, atau alias';
export function WelcomePage({ onLogin, onFaceLogin, onRegister }: {
  onLogin: (ident: string, secret: string) => Promise<{ ok: boolean; error?: string }>;
  onFaceLogin: () => void; onRegister: () => void;
}) {
  // Slot logo: taruh file di public/brand/logo-menwa.png → otomatis kepakai.
  // Belum ada file = fallback ikon Shield.
  const [logoOk, setLogoOk] = useState(true);
  const [ident, setIdent] = useState('');
  const [secret, setSecret] = useState('');
  const [authType, setAuthType] = useState<AuthType>(loadAuthPref);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  // Tanpa animasi gerak: placeholder login statis.
  const [kurangiGerak, setKurangiGerak] = useState(
    () => typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ubah = () => setKurangiGerak(mq.matches);
    mq.addEventListener('change', ubah);
    return () => mq.removeEventListener('change', ubah);
  }, []);
  // Placeholder mengetik satu contoh bergantian (tanpa awalan "contoh:"),
  // berhenti saat field sudah berisi — sama gaya dengan field nama wizard.
  const loginAnim = useTypingPlaceholder(LOGIN_CONTOH, showForm && ident === '' && !kurangiGerak);
  // Riak sentuh logo: umpan balik langsung saat pointerdown (framer-motion).
  // Logika bedakan 1×/2× tetap lewat onLogoTap + jeda TAP_WINDOW.
  const [ping, setPing] = useState(0);
  // Bedakan ketuk 1× vs 2×: tunggu sebentar setelah ketukan pertama.
  const TAP_WINDOW = 300;
  const tapTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(tapTimer.current), []);
  const onLogoTap = () => {
    if (tapTimer.current !== undefined) {
      window.clearTimeout(tapTimer.current);
      tapTimer.current = undefined;
      try { navigator.vibrate?.([15, 40, 15]); } catch { /* opsional */ }
      onFaceLogin();
      return;
    }
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = undefined;
      try { navigator.vibrate?.(15); } catch { /* opsional */ }
      setShowForm((v) => !v);
    }, TAP_WINDOW);
  };
  const pickAuth = (t: AuthType) => {
    setAuthType(t);
    try { localStorage.setItem(AUTH_PREF, t); } catch { /* abaikan */ }
  };
  const submit = async () => {
    if (!ident.trim()) return setErr('Isi NBP, No. WhatsApp, atau alias.');
    if (!secret) return setErr(`Isi ${authType === 'pin' ? 'PIN' : 'password'}.`);
    setBusy(true);
    setErr(null);
    const r = await onLogin(ident.trim(), secret);
    setBusy(false);
    if (r.ok) setSecret('');
    else setErr(r.error ?? 'Gagal masuk.');
  };
  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay },
  });
  return (
    <motion.div
      className="welcome welcome--login"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <span className="wlogowrap">
      <motion.button
        type="button"
        className="wlogo wlogotap"
        aria-label="Ketuk 1 kali untuk login manual, 2 kali untuk login dengan wajah"
        onClick={onLogoTap}
        onPointerDown={() => setPing((p) => p + 1)}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.92 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {logoOk
          ? <img src="/brand/logo-menwa.png" alt="Logo Menwa" onError={() => setLogoOk(false)} />
          : <Shield size={52} />}
      </motion.button>
      {ping > 0 && (
        <motion.span
          key={ping}
          className="wlogoring"
          aria-hidden="true"
          initial={{ opacity: 0.7, scale: 0.85 }}
          animate={{ opacity: 0, scale: 1.12 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
      )}
      </span>
      <motion.p className="whint tapHint" {...fade(0.2)}>Ketuk logo 1× login manual • 2× login dengan wajah</motion.p>
      <motion.h1 className="wtitle" {...fade(0.08)}>JURNAL PIKET MENWA USB YPKP TAHUN 2026</motion.h1>
      <motion.p className="wsub" {...fade(0.16)}>Absensi, Jadwal Piket, Bukti Tugas.</motion.p>
      <AnimatePresence initial={false}>
        {showForm && (
        <motion.form
          className="loginform"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
        >
          <label className="wfield">
            <span>NBP / No. WA / Alias</span>
            <input
              autoFocus autoComplete="username" inputMode="text" autoCapitalize="none"
              placeholder={kurangiGerak ? LOGIN_STATIS : `${loginAnim}▌`} value={ident}
              onChange={(e) => { setIdent(e.target.value.slice(0, 20)); setErr(null); }}
            />
          </label>
          <SecretField
            label="PIN / Password" authType={authType} onAuthType={pickAuth}
            value={secret} onChange={(v) => { setSecret(v); setErr(null); }}
            autoComplete="current-password"
          />
          <ShakeErr msg={err} />
          <Button variant="primary" type="submit" busy={busy}>
            <KeyRound size={18} /> Masuk
          </Button>
        </motion.form>
        )}
      </AnimatePresence>
      <motion.p className="whint" {...fade(0.32)}>
        Belum punya akun? <button className="wlink" onClick={onRegister}>Daftar</button>
      </motion.p>
      <motion.p
        className="wsecure"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.4 }}
      >
        Foto wajah dipakai untuk login & absen. Foto tidak disimpan.
      </motion.p>
    </motion.div>
  );
}

// Field identitas — dipakai di pendaftaran & sheet lengkapi kontak.
export function AliasField({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter?: () => void }) {
  // Spasi diblokir, tapi user dikasih tahu kenapa (ketik atau paste "Bang Jago").
  const [spaceWarn, setSpaceWarn] = useState(false);
  const warnTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(warnTimer.current), []);
  const change = (raw: string) => {
    const hasSpace = /\s/.test(raw);
    window.clearTimeout(warnTimer.current);
    setSpaceWarn(hasSpace);
    if (hasSpace) warnTimer.current = window.setTimeout(() => setSpaceWarn(false), 3500);
    onChange(raw.replace(/\s/g, '').slice(0, 20));
  };
  return (
    <label className="wfield">
      <span>Nama alias / panggilan</span>
      <input
        autoCapitalize="none" autoComplete="nickname" maxLength={40}
        placeholder="cth: gofur" value={value} aria-invalid={spaceWarn}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
      />
      <AnimatePresence>
        {spaceWarn && (
          <motion.em
            className="werr" role="alert"
            initial={{ opacity: 0, x: 0 }}
            animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            Alias tidak boleh pakai spasi — contoh: bangjago atau bang_jago
          </motion.em>
        )}
      </AnimatePresence>
      <small className="hint">Bisa dipakai login kalau lupa NBP/No. WA. 3–20 huruf/angka, tanpa spasi.</small>
    </label>
  );
}

export function NbpField({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter?: () => void }) {
  const angkatan = angkatanFromNbp(value);
  return (
    <label className="wfield">
      <span>NBP (Nomor Buku Pokok) Menwa</span>
      <input
        inputMode="numeric" maxLength={14}
        placeholder="cth: 1494.08.148031" value={value}
        onChange={(e) => onChange(formatNbp(e.target.value))}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.small
          key={angkatan ?? 'kosong'}
          className={`hint ${angkatan ? 'ok' : ''}`}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.18 }}
        >
          {angkatan
            ? `Angkatan ${angkatan} (dari 2 digit pertama NBP).`
            : 'Angkatan otomatis dari NBP. Belum punya NBP? Kosongkan — bisa diisi nanti.'}
        </motion.small>
      </AnimatePresence>
    </label>
  );
}

export function WaField({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter?: () => void }) {
  return (
    <label className="wfield">
      <span>No. WhatsApp</span>
      <input
        type="tel" inputMode="tel" autoComplete="tel" maxLength={18}
        placeholder="cth: 081234567890" value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d+\s-]/g, ''))}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
      />
    </label>
  );
}

// Urutan langkah; index dipakai di go() untuk validasi + cek server.
// Urusan wajah dikumpulkan di akhir: PIN/password → persetujuan → scan wajah.
// Langkah terakhir (Scan Wajah) = kamera; wizard tetap terpasang di bawahnya
// supaya isian tidak hilang kalau scan ditutup/gagal.
const STEP_LABELS = ['Nama Lengkap', 'Alias', 'NBP', 'Jabatan', 'No. WhatsApp', 'PIN / Password', 'Persetujuan Data Wajah', 'Scan Wajah'];
const S = { nama: 0, alias: 1, nbp: 2, jabatan: 3, wa: 4, secret: 5, consent: 6 } as const;
const LAST = S.consent; // langkah form terakhir; sesudahnya kamera
const stepSchemas: Partial<Record<number, z.ZodType>> = {
  [S.nama]: profileSchema.shape.nama,
  [S.alias]: aliasSchema,
  [S.nbp]: nbpSchema,
  [S.wa]: waSchema,
};
// Field yang dicek ketersediaannya di server per langkah.
const stepCheck: Partial<Record<number, 'alias' | 'nbp' | 'wa'>> = { [S.alias]: 'alias', [S.nbp]: 'nbp', [S.wa]: 'wa' };
const CHECK_LABEL = { alias: 'Alias', nbp: 'NBP', wa: 'No. WhatsApp' } as const;

export function ProfilePage({ onDone, onCancel, names, existing, scanning = false }: {
  onDone: (p: Profile) => void; onCancel: () => void; names: string[];
  existing: { nama: string; angkatan: string | null }[];
  scanning?: boolean; // kamera scan wajah (langkah terakhir) sedang terbuka
}) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [nama, setNama] = useState('');
  const [alias, setAlias] = useState('');
  const [nbp, setNbp] = useState('');
  const [jabPreset, setJabPreset] = useState('');
  const [jabCustom, setJabCustom] = useState('');
  const [wa, setWa] = useState('');
  const [consent, setConsent] = useState(false);
  const [authType, setAuthType] = useState<AuthType>('pin');
  const [secret, setSecret] = useState('');
  const [secret2, setSecret2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Teks lengkap persetujuan dibuka lewat "Selengkapnya" (framer-motion height).
  const [consentMore, setConsentMore] = useState(false);
  // Placeholder animasi dari nama pendaftar beneran (bukan hardcode).
  const phAnim = useTypingPlaceholder(names, nama === '');

  const jab = jabPreset === '__custom' ? jabCustom : jabPreset;
  const shown = scanning ? STEP_LABELS.length - 1 : step;
  const vals: Partial<Record<number, string>> = { [S.nama]: nama, [S.alias]: alias, [S.nbp]: nbp, [S.wa]: wa };
  const angkatan = angkatanFromNbp(nbp);

  // Nama + angkatan (dari NBP) yang sama = kemungkinan akun sudah ada.
  const norm = (s: string) => s.trim().toLowerCase();
  const dupe = nama.trim() !== '' && !!angkatan && existing.some(
    (e) => norm(e.nama) === norm(nama) && (e.angkatan ?? '') === angkatan,
  );

  const go = async (d: number) => {
    const ns = step + d;
    if (ns < 0 || ns > LAST) return;
    if (d > 0) {
      if (step === S.jabatan && !jab) {
        setErr('Pilih jabatan atau isi manual.');
        return;
      }
      if (step === S.secret) {
        const e = secretIssue(authType, secret, angkatan ?? '')
          ?? (secret !== secret2 ? `${authType === 'pin' ? 'PIN' : 'Password'} konfirmasi tidak sama.` : null);
        if (e) return setErr(e);
      }
      const schema = stepSchemas[step];
      if (schema) {
        const r = schema.safeParse(vals[step]);
        if (!r.success) {
          setErr(r.error.issues[0]?.message ?? 'Isian belum valid.');
          return;
        }
      }
      // Cek ke server sekarang, jangan sampai gagal setelah scan wajah.
      const field = stepCheck[step];
      const value = vals[step]?.trim();
      if (field && value) {
        setBusy(true);
        const c = await checkKontak({ [field]: value });
        setBusy(false);
        if (!c) return setErr('Gagal cek ke server — pastikan online.');
        if (c[field] === 'taken') {
          return setErr(field === 'alias'
            ? 'Alias sudah dipakai — pilih yang lain.'
            : `${CHECK_LABEL[field]} ini sudah terdaftar — silakan login.`);
        }
        if (c[field] === 'invalid') return setErr(`${CHECK_LABEL[field]} tidak valid.`);
      }
    }
    setErr(null);
    setDir(d);
    setStep(ns);
  };

  const submit = () => {
    if (!consent) {
      setErr('Persetujuan wajib — wajah dipakai untuk login & absensi piket.');
      return;
    }
    if (!jab) {
      setErr('Pilih jabatan atau isi manual.');
      return;
    }
    if (secret !== secret2) {
      setErr(`${authType === 'pin' ? 'PIN' : 'Password'} konfirmasi tidak sama.`);
      return;
    }
    const r = profileSchema.safeParse({ nama, alias, nbp, jabatan: jab, wa, authType, secret });
    if (!r.success) {
      setErr(r.error.issues[0]?.message ?? 'Isian belum valid.');
      return;
    }
    setErr(null);
    onDone(r.data);
  };

  return (
    <motion.div
      className="welcome tac"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="pbar">
        {STEP_LABELS.map((_, i) => (
          <motion.i
            key={i}
            initial={false}
            animate={{ opacity: i <= shown ? 1 : 0.25 }}
            transition={{ duration: 0.25 }}
            className={i <= shown ? 'on' : ''}
          />
        ))}
      </div>
      <p className="pstep-label">Langkah {shown + 1} dari {STEP_LABELS.length} — {STEP_LABELS[shown]}</p>
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={step}
          className="pslide"
          custom={dir}
          initial={{ opacity: 0, x: 48 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -48 * dir }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {step === S.nama && (
            <label className="wfield">
              <span>Nama lengkap</span>
              <input
                placeholder={nama ? undefined : names.length > 0 ? `contoh: ${phAnim}▌` : 'ketik nama lengkap di sini'}
                value={nama} maxLength={30}
                onChange={(e) => setNama(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void go(1); }}
              />
            </label>
          )}
          {step === S.alias && <AliasField value={alias} onChange={setAlias} onEnter={() => void go(1)} />}
          {step === S.nbp && <NbpField value={nbp} onChange={setNbp} onEnter={() => void go(1)} />}
          {step === S.jabatan && (
            <div className="wfield">
              <span>Jabatan di kompi</span>
              <div className="jabgrid">
                {JABATAN_LIST.map((j, i) => {
                  const Icon = JABATAN_ICON[i];
                  return (
                    <button
                      key={j} type="button"
                      className={`jabcard ${jabPreset === j ? 'sel' : ''}`}
                      onClick={() => setJabPreset(j)}
                    >
                      <Icon size={16} /> {j}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`jabcard ${jabPreset === '__custom' ? 'sel' : ''}`}
                  onClick={() => setJabPreset('__custom')}
                >
                  <PenLine size={16} /> Lainnya
                </button>
              </div>
              {jabPreset === '__custom' && (
                <input
                  placeholder="cth: Provos" value={jabCustom} maxLength={40}
                  onChange={(e) => setJabCustom(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void go(1); }}
                />
              )}
            </div>
          )}
          {step === S.wa && <WaField value={wa} onChange={setWa} onEnter={() => void go(1)} />}
          {step === S.consent && (
            <div className="wfield consent">
              <span>Persetujuan Pemrosesan Data Wajah</span>
              <p className="hint">
                Data wajah dipakai untuk login dan absensi piket. Foto hanya
                diproses sesaat lalu dibuang; yang disimpan hanya kode angka wajah
                (terenkripsi), bukan foto.
              </p>
              <button
                type="button" className="morebtn"
                onClick={() => setConsentMore((v) => !v)}
                aria-expanded={consentMore}
              >
                {consentMore ? 'Sembunyikan' : 'Selengkapnya'}
              </button>
              <AnimatePresence initial={false}>
                {consentMore && (
                  <motion.p
                    className="hint collapser"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  >
                    Sesuai UU No. 27/2022 (Pelindungan Data Pribadi), wajah adalah data pribadi
                    spesifik. Saat scan, foto wajah dikirim ke server aplikasi ini (bukan pihak
                    ketiga) hanya untuk diproses sesaat lalu dibuang — TIDAK disimpan. Yang
                    disimpan cuma embedding (representasi angka) terenkripsi AES-256-GCM.
                    Wajah dipakai untuk verifikasi login dan absensi kehadiran piket, jadi
                    wajib untuk semua anggota.
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="consentgrid">
                <button
                  type="button"
                  className={`jabcard ${consent ? 'sel' : ''}`}
                  onClick={() => setConsent(!consent)}
                >
                  <ScanFace size={16} /> Saya setuju data wajah saya diproses untuk login & absensi
                </button>
              </div>
            </div>
          )}
          {step === S.secret && (
            <>
              <SecretField
                label="Kunci login" authType={authType} onAuthType={setAuthType}
                value={secret} onChange={(v) => { setSecret(v); setSecret2(''); }}
                autoComplete="new-password"
                placeholder={authType === 'pin' ? 'PIN min 6 digit, misal: 482917' : 'min 8 karakter, huruf + angka'}
              />
              <label className="wfield">
                <span>Ulangi {authType === 'pin' ? 'PIN' : 'password'}</span>
                <input
                  type="password" autoComplete="new-password"
                  inputMode={authType === 'pin' ? 'numeric' : 'text'}
                  maxLength={authType === 'pin' ? 12 : 64} value={secret2}
                  onChange={(e) => setSecret2(authType === 'pin' ? e.target.value.replace(/\D/g, '').slice(0, 12) : e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void go(1); }}
                />
                <small className="hint">
                  {authType === 'pin'
                    ? `Jangan angka sama semua, berurutan${angkatan ? `, atau tahun angkatanmu (${angkatan})` : ''}.`
                    : 'Gabungan huruf dan angka, 8–64 karakter.'}
                </small>
              </label>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <ShakeErr msg={err} />
      {dupe && (
        <div className="dupebox">
          <b>Akun anda sudah terdaftar.</b>
          <span>Nama + angkatan {angkatan} ini sudah ada di sistem. Silakan login.</span>
          <Button variant="primary" onClick={onCancel}>Ke login</Button>
        </div>
      )}
      <div className="row">
        {step > 0
          ? <Button variant="secondary" onClick={() => void go(-1)}>Sebelumnya</Button>
          : <Button variant="secondary" onClick={onCancel}>Tutup</Button>}
        {step < LAST
          ? <Button variant="primary" busy={busy} disabled={dupe} onClick={() => void go(1)}>Lanjut</Button>
          : <Button variant="primary" disabled={dupe} onClick={submit}>Lanjut scan wajah</Button>}
      </div>
    </motion.div>
  );
}
