import { motion } from 'framer-motion';
import type { MouseEventHandler, ReactNode } from 'react';
import { TAP } from './Motion';

// Satu komponen tombol berbasis token (fase 0). Semua varian minimal 44px.
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';

export function Button({ variant = 'primary', busy = false, type = 'button', disabled, onClick, ariaLabel, children }: {
  variant?: ButtonVariant;
  busy?: boolean;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <motion.button
      type={type}
      className={`btn btn--${variant}`}
      disabled={disabled || busy}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      {...TAP}
    >
      {busy && <span className="spin" aria-hidden="true" />}
      {children}
    </motion.button>
  );
}
