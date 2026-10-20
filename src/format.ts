const en = (n: number, digits: number) => n.toLocaleString('en', { maximumFractionDigits: digits });

/** Readable amount: fewer decimals as numbers grow. */
export function num(n: number): string {
  const a = Math.abs(n);
  if (a >= 100) return en(n, 0);
  if (a >= 10) return en(n, 1);
  if (a >= 0.01 || a === 0) return en(n, 2);
  return String(Number(n.toPrecision(2)));
}

/** Axis ticks: 0, 250, 1.5K, 20K. */
export function compact(n: number): string {
  return Math.abs(n) >= 1000 ? `${en(n / 1000, 1)}K` : en(n, 2);
}

export function pct(x: number): string {
  if (x > 0 && x < 0.001) return '<0.1%';
  if (x < 1 && x > 0.999) return '>99.9%';
  return `${en(x * 100, x < 0.1 ? 1 : 0)}%`;
}

/** "1 in 37" for a chance; a dash when it can't happen. */
export function oneIn(chance: number): string {
  if (chance <= 0) return '—';
  const n = 1 / chance;
  return `1 in ${n < 10 ? en(n, 1) : en(n, 0)}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
