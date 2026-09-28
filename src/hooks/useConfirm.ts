import { useCallback, useRef, useState } from 'react';
import type { ConfirmRequest } from '../components/ConfirmSheet';

// Konfirmasi gaya sheet (pengganti popup browser) — Promise supaya
// pemanggil tetap sederhana: `const ok = await ask({...})`.
export function useConfirm() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);
  const ask = useCallback((opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => {
    setReq({ title: opts.title, message: opts.message, confirmLabel: opts.confirmLabel ?? 'Ya', danger: opts.danger ?? false });
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);
  const resolve = useCallback((v: boolean) => {
    resolveRef.current?.(v);
    resolveRef.current = null;
    setReq(null);
  }, []);
  return { req, ask, resolve };
}
