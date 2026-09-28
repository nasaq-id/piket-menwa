import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { useEffect } from 'react';
import { Button } from './Button';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
}

// Bottom sheet konfirmasi berbasis Promise (lihat hooks/useConfirm.ts).
// Gaya .sheetwrap/.sheet yang sama dgn sheet lain, animasi framer-motion.
export function ConfirmSheet({ req, onResolve }: {
  req: ConfirmRequest | null;
  onResolve: (v: boolean) => void;
}) {
  // Drag-untuk-tutup hanya dari kepala sheet supaya tidak bentrok dgn scroll isi.
  const controls = useDragControls();
  useEffect(() => {
    if (!req) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // ConfirmSheet selalu paling atas: telan Esc supaya sheet di bawahnya
      // (mis. Profil → Keluar) tidak ikut tertutup.
      e.stopImmediatePropagation();
      e.stopPropagation();
      onResolve(false);
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [req, onResolve]);
  return (
    <AnimatePresence>
      {req && (
        <motion.div
          className="sheetwrap" onClick={() => onResolve(false)}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="sheet" role="dialog" aria-modal="true" aria-label={req.title}
            data-confirm="true"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
            drag="y" dragListener={false} dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.25}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 500) onResolve(false);
            }}
          >
            <div className="sheethead" onPointerDown={(e) => controls.start(e)}>
              <i className="grabber" />
            </div>
            <b>{req.title}</b>
            <span className="hint">{req.message}</span>
            <div className="pinrow">
              <Button variant={req.danger ? 'danger' : 'primary'} onClick={() => onResolve(true)}>
                {req.confirmLabel}
              </Button>
              <Button variant="secondary" onClick={() => onResolve(false)}>
                Batal
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
