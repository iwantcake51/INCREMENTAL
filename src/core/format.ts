export type Notation = 'standard' | 'scientific' | 'engineering' | 'letters';

const SHORT = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg', 'UVg', 'DVg', 'TVg', 'QaVg', 'QiVg', 'SxVg', 'SpVg', 'OcVg', 'NoVg', 'Tg'];

let notation: Notation = 'standard';
export function setNotation(n: Notation): void {
  notation = n;
}

function trimFixed(v: number, digits: number): string {
  // toFixed then strip trailing zeros ("1.50" -> "1.5", "2.00" -> "2")
  const s = v.toFixed(digits);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

function mantissa(v: number): string {
  // 3 significant digits: 1.23 / 12.3 / 123
  if (v >= 100) return trimFixed(v, 0);
  if (v >= 10) return trimFixed(v, 1);
  return trimFixed(v, 2);
}

function letters(index: number): string {
  // 1 -> a, 26 -> z, 27 -> aa ...
  let s = '';
  let n = index;
  while (n > 0) {
    n--;
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

/** Format a number for display. Integers below 1000 stay exact; everything else gets 3 significant digits. */
export function fmt(value: number, n: Notation = notation): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : value < 0 ? '-∞' : '0';
  if (value < 0) return '-' + fmt(-value, n);
  if (value < 1000) {
    if (value === 0) return '0';
    if (value < 10 && !Number.isInteger(value)) return trimFixed(value, value < 0.01 ? 4 : 2);
    if (value < 100 && !Number.isInteger(value)) return trimFixed(value, 1);
    return Math.floor(value).toString();
  }
  let exp = Math.floor(Math.log10(value));
  let man = value / 10 ** exp;
  // Guard against 9.9999 rounding up to 10.0
  if (man >= 9.995) {
    man /= 10;
    exp += 1;
  }
  switch (n) {
    case 'scientific':
      return `${trimFixed(man, 2)}e${exp}`;
    case 'engineering': {
      const e3 = exp - (exp % 3);
      return `${mantissa(value / 10 ** e3)}e${e3}`;
    }
    case 'letters': {
      const tier = Math.floor(exp / 3);
      return mantissa(value / 10 ** (tier * 3)) + letters(tier);
    }
    default: {
      const tier = Math.floor(exp / 3);
      if (tier < SHORT.length) {
        let m = value / 10 ** (tier * 3);
        if (m >= 999.5 && tier + 1 < SHORT.length) return `1 ${SHORT[tier + 1]}`;
        return `${mantissa(m)} ${SHORT[tier]}`;
      }
      return `${trimFixed(man, 2)}e${exp}`;
    }
  }
}

/** Whole numbers (counts, owned amounts) with thousands separators until they get large. */
export function fmtInt(value: number): string {
  if (value < 1e6) return Math.floor(value).toLocaleString('en-US');
  return fmt(value);
}

export function fmtPct(fraction: number): string {
  const pct = fraction * 100;
  if (pct > 0 && pct < 0.1) return '<0.1%';
  if (pct >= 1e4) return fmt(pct) + '%';
  return (Math.abs(pct) >= 100 ? pct.toFixed(0) : trimFixed(pct, 1)) + '%';
}

export function fmtMult(mult: number): string {
  return '×' + (mult >= 1000 ? fmt(mult) : trimFixed(mult, mult >= 100 ? 0 : 2));
}

export function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '∞';
  seconds = Math.max(0, seconds);
  if (seconds < 1) return '<1s';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 365) return `${fmt(d / 365)}y`;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}
