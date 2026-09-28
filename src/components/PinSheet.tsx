import { motion } from 'framer-motion';
import { Button } from './Button';

export function PinSheet({ pinInput, setPinInput, submitPin, onClose, busy }: {
  pinInput: string; setPinInput: (v: string) => void; submitPin: () => void; onClose: () => void; busy?: boolean;
}) {
  return (
    <motion.div
      className="pinsheet"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <b>Masuk mode Admin</b>
      <span className="dim">Masukkan PIN Admin (1× per sesi)</span>
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
  );
}
