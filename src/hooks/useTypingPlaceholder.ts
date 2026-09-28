import { useEffect, useState } from 'react';

// Animasi placeholder mengetik satu kata bergantian: ketik per huruf,
// jeda, hapus per huruf, lanjut ke kata berikut (gaya placeholder nama
// di wizard daftar). Berhenti (kembali '') saat tidak aktif — mis. field
// sudah berisi — dan timer dibersihkan saat komponen dilepas.
export function useTypingPlaceholder(words: string[], aktif: boolean): string {
  const [teks, setTeks] = useState('');
  const wordsKey = words.join('|');
  const jalan = aktif && wordsKey !== '';
  useEffect(() => {
    if (!jalan) return;
    const DAFTAR = wordsKey.split('|');
    let baris = 0;
    let huruf = 0;
    let hapus = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const kata = DAFTAR[baris % DAFTAR.length];
      if (!hapus) {
        huruf += 1;
        setTeks(kata.slice(0, huruf));
        if (huruf >= kata.length) {
          hapus = true;
          timer = setTimeout(tick, 1200);
          return;
        }
        timer = setTimeout(tick, 90);
      } else {
        huruf -= 1;
        setTeks(kata.slice(0, huruf));
        if (huruf <= 0) {
          hapus = false;
          baris += 1;
          timer = setTimeout(tick, 400);
          return;
        }
        timer = setTimeout(tick, 40);
      }
    };
    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, [jalan, wordsKey]);
  return jalan ? teks : '';
}
