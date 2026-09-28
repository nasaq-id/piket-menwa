import { AnimatePresence, motion } from 'framer-motion';
import type { RefObject } from 'react';
import type { AuthType, Member } from '../api';
import { SecretField } from '../Welcome';
import { TAP } from './Motion';

export function LogoutSheet({
  member, secretType, setSecretType, secretNew, setSecretNew, secretMsg, setSecretMsg, onSaveSecret, onEditKontak,
  avatarBusy, avatarInputRef, onAvatarFile, onRemoveAvatar, onLogout, onClose,
}: {
  member: Member;
  secretType: AuthType; setSecretType: (t: AuthType) => void;
  secretNew: string; setSecretNew: (v: string) => void; secretMsg: string | null; setSecretMsg: (v: string | null) => void;
  onSaveSecret: () => void; onEditKontak: () => void; avatarBusy: boolean;
  avatarInputRef: RefObject<HTMLInputElement | null>;
  onAvatarFile: (f: File | undefined) => void; onRemoveAvatar: () => void;
  onLogout: () => void; onClose: () => void;
}) {
  return (
    <motion.div
      className="sheetwrap" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="sheet" onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
        drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.25}
        onDragEnd={(_, info) => {
          if (info.offset.y > 90 || info.velocity.y > 500) onClose();
        }}
      >
        <i className="grabber" />
        {member.foto
          ? <img className="sheetava" src={member.foto} alt={member.nama} />
          : <i className="pdot big" style={{ background: member.warna }} />}
        <input
          ref={avatarInputRef} type="file" accept="image/*" hidden
          onChange={(e) => void onAvatarFile(e.target.files?.[0])}
        />
        <div className="avatarrow">
          <button className="ghostbtn sm" disabled={avatarBusy} onClick={() => avatarInputRef.current?.click()}>
            {avatarBusy ? 'memproses…' : member.foto ? 'Ganti foto profil' : 'Tambah foto profil'}
          </button>
          {member.foto && (
            <button className="ghostbtn sm" disabled={avatarBusy} onClick={() => void onRemoveAvatar()}>Hapus foto</button>
          )}
        </div>
        <b>{member.nama}</b>
        <span className="hint">{[member.jabatan, member.angkatan].filter(Boolean).join(' · ')}</span>
        <SecretField
          label="Ganti PIN / password" authType={secretType} onAuthType={setSecretType}
          value={secretNew} onChange={(v) => { setSecretNew(v); setSecretMsg(null); }}
          onEnter={onSaveSecret} autoComplete="new-password"
        />
        <div className="pinrow">
          <motion.button onClick={onSaveSecret} {...TAP}>Simpan {secretType === 'pin' ? 'PIN' : 'password'}</motion.button>
          <motion.button onClick={onEditKontak} {...TAP}>Ubah NBP / WA / alias</motion.button>
          <AnimatePresence mode="wait">
            {secretMsg && (
              <motion.span
                key={secretMsg} className="pinmsg"
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {secretMsg}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <button className="danger" onClick={onLogout}>Logout</button>
        <button className="ghostbtn" onClick={onClose}>Batal</button>
      </motion.div>
    </motion.div>
  );
}
