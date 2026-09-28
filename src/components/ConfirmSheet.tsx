import { AnimatePresence, motion } from 'framer-motion';
import { Button } from './Button';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
}

// Bottom sheet konfirmasi berbasis Promise (lihat useAppStore.ask).
// Gaya .sheetwrap/.sheet yang sama dgn sheet lain, animasi framer-motion.
export function ConfirmSheet({ req, onResolve }: {
  req: ConfirmRequest | null;
  onResolve: (v: boolean) => void;
}) {
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
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
          >
            <i className="grabber" />
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
