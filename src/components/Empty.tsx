// Empty state seragam: teks redup "Belum ada …" (huruf awal kapital).
export function Empty({ text }: { text: string }) {
  return <p className="hint">{text}</p>;
}
