import { AnimatePresence, motion } from 'framer-motion';

// Preset framer-motion bersama supaya animasi seragam di seluruh app.

// Tombol: sedikit mengecil saat ditekan.
export const TAP = { whileTap: { scale: 0.96 } } as const;

// Pesan error: muncul dengan goyangan (sama dgn error wizard pendaftaran).
export function ShakeErr({ msg }: { msg: string | null | undefined }) {
  return (
    <AnimatePresence mode="wait">
      {msg && (
        <motion.em
          key={msg}
          className="werr" role="alert"
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: 1, x: [0, -7, 7, -4, 4, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          {msg}
        </motion.em>
      )}
    </AnimatePresence>
  );
}
