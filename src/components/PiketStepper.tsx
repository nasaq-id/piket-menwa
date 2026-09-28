import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export type StepId = 'absen' | 'bukti' | 'lapsit';

export interface StepState {
  id: StepId;
  label: string;
  sub: string;
  done: boolean;
}

// Stepper status piket: ① Absen → ② Bukti → ③ Lapsit.
// Tap langkah → scroll ke bagiannya (handler dari parent).
export function PiketStepper({ steps, active, onGo }: {
  steps: StepState[];
  active: StepId | null;
  onGo: (id: StepId) => void;
}) {
  return (
    <nav className="stepper" aria-label="Langkah piket hari ini">
      {steps.map((s, i) => {
        const isActive = active === s.id;
        return (
          <div key={s.id} className="stepwrap">
            <motion.button
              type="button"
              className={`step${s.done ? ' done' : ''}${isActive ? ' active' : ''}`}
              onClick={() => onGo(s.id)}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`${i + 1}. ${s.label} — ${s.sub}`}
              whileTap={{ scale: 0.96 }}
            >
              {isActive && (
                <motion.i
                  className="stepbg"
                  layoutId="step-active"
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                />
              )}
              <span className="stepnum" aria-hidden="true">
                {s.done ? <Check size={14} /> : <b>{i + 1}</b>}
              </span>
              <span className="steptx">
                <b>{s.label}</b>
                <span>{s.sub}</span>
              </span>
            </motion.button>
            {i < steps.length - 1 && <i className={`stepline${steps[i + 1].done || isActive ? ' on' : ''}`} aria-hidden="true" />}
          </div>
        );
      })}
    </nav>
  );
}
