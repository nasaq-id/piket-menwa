import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type RefObject } from 'react';
import type { AuthType, Member } from '../api';
import { SecretField } from '../Welcome';
import { Button } from './Button';

export function LogoutSheet({
  member, secretType, setSecretType, secretNew, setSecretNew, secretMsg, setSecretMsg, onSaveSecret, onEditKontak,
  avatarBusy, avatarInputRef, onAvatarFile, onRemoveAvatar, onLogout, ask, onClose,
}: {
  member: Member;
  secretType: AuthType; setSecretType: (t: AuthType) => void;
  secretNew: string; setSecretNew: (v: string) => void; secretMsg: { text: string; ok: boolean } | null; setSecretMsg: (v: { text: string; ok: boolean } | null) => void;
  onSaveSecret: () => void; onEditKontak: () => void; avatarBusy: boolean;
  avatarInputRef: RefObject<HTMLInputElement | null>;
  onAvatarFile: (f: File | undefined) => void; onRemoveAvatar: () => void;
  onLogout: () => void;
  ask: (opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  onClose: () => void;
}) {
  // Drag-untuk-tutup hanya dari kepala sheet supaya tidak bentrok dgn scroll isi.
  const controls = useDragControls();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Kalau ConfirmSheet teratas terbuka (mis. konfirmasi Keluar), Esc hanya untuknya.
      if (document.querySelector('[data-confirm="true"]')) return;
      onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const keluar = async () => {
    const ok = await ask({
      title: 'Keluar dari akun?',
      message: 'Kamu harus masuk lagi untuk absen dan mengisi lapsit.',
      confirmLabel: 'Keluar',
      danger: true,
    });
    if (ok) onLogout();
  };
  return (
    <motion.div
      className="sheetwrap" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="sheet" role="dialog" aria-modal="true" aria-label="Profil"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
        drag="y" dragListener={false} dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.25}
        onDragEnd={(_, info) => {
          if (info.offset.y > 90 || info.velocity.y > 500) onClose();
        }}
      >
        <div className="sheethead" onPointerDown={(e) => controls.start(e)}>
          <i className="grabber" />
          <div className="shtitle">
            <b>Profil</b>
            <span onPointerDown={(e) => e.stopPropagation()}>
              <Button variant="icon" ariaLabel="Tutup" onClick={onClose}><X size={20} /></Button>
            </span>
          </div>
        </div>
        <section className="sheetsec" aria-label="Akun">
          <h4>Akun</h4>
          <div className="profilid">
            {member.foto
              ? <img className="sheetava" src={member.foto} alt={member.nama} />
              : <i className="pdot big" style={{ background: member.warna }} />}
            <div className="who">
              <b>{member.nama}</b>
              <span className="hint">{[member.jabatan, member.angkatan].filter(Boolean).join(' · ')}</span>
            </div>
          </div>
          <input
            ref={avatarInputRef} type="file" accept="image/*" hidden
            onChange={(e) => void onAvatarFile(e.target.files?.[0])}
          />
          <div className="avatarrow">
            <Button variant="secondary" busy={avatarBusy} onClick={() => avatarInputRef.current?.click()}>
              {member.foto ? 'Ganti foto profil' : 'Tambah foto profil'}
            </Button>
            {member.foto && (
              <Button variant="secondary" busy={avatarBusy} onClick={() => void onRemoveAvatar()}>Hapus foto</Button>
            )}
          </div>
          <Button variant="secondary" onClick={onEditKontak}>Ubah NBP / WA / alias</Button>
        </section>
        <section className="sheetsec" aria-label="Keamanan">
          <h4>Keamanan</h4>
          <SecretField
            label="Ganti PIN / password" authType={secretType} onAuthType={setSecretType}
            value={secretNew} onChange={(v) => { setSecretNew(v); setSecretMsg(null); }}
            onEnter={onSaveSecret} autoComplete="new-password"
          />
          <div className="pinrow">
            <Button variant="secondary" onClick={onSaveSecret}>Simpan {secretType === 'pin' ? 'PIN' : 'password'}</Button>
            <AnimatePresence mode="wait">
              {secretMsg && (
                <motion.span
                  key={secretMsg.text} className={secretMsg.ok ? 'pinmsg ok' : 'pinmsg err'}
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {secretMsg.text}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </section>
        <section className="sheetsec" aria-label="Keluar">
          <h4>Keluar</h4>
          <Button variant="danger" onClick={() => void keluar()}>Keluar</Button>
        </section>
      </motion.div>
    </motion.div>
  );
}
