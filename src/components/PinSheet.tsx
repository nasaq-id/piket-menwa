import { motion, useDragControls } from 'framer-motion';
import { useEffect } from 'react';
import { Button } from './Button';

export function PinSheet({ pinInput, setPinInput, submitPin, onClose, busy }: {
  pinInput: string; setPinInput: (v: string) => void; submitPin: () => void; onClose: () => void; busy?: boolean;
}) {
  // Drag-untuk-tutup hanya dari kepala sheet supaya tidak bentrok dgn scroll isi.
  const controls = useDragControls();
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <motion.div
      className="sheetwrap" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="sheet" role="dialog" aria-modal="true" aria-label="Masuk mode Admin"
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
        </div>
        <b>Masuk mode Admin</b>
        <span className="hint">Masukkan PIN Admin (1× per sesi)</span>
        <input
          type="password" inputMode="numeric" autoFocus
          placeholder="PIN Admin" value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submitPin(); }}
        />
        <div className="row">
          <Button variant="primary" busy={busy} onClick={submitPin}>Masuk</Button>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
