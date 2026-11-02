import { describe, expect, it } from 'vitest';
import { fmt, fmtTime, fmtPct } from '../src/core/format';

describe('fmt', () => {
  it('keeps small numbers readable', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(7)).toBe('7');
    expect(fmt(1.5)).toBe('1.5');
    expect(fmt(999)).toBe('999');
  });
  it('uses suffixes in standard notation', () => {
    expect(fmt(1234, 'standard')).toBe('1.23 K');
    expect(fmt(1.5e6, 'standard')).toBe('1.5 M');
    expect(fmt(999_999, 'standard')).toBe('1 M');
    expect(fmt(2.5e15, 'standard')).toBe('2.5 Qa');
  });
  it('supports scientific, engineering and letters', () => {
    expect(fmt(12345, 'scientific')).toBe('1.23e4');
    expect(fmt(12345, 'engineering')).toBe('12.3e3');
    expect(fmt(12345, 'letters')).toBe('12.3a');
  });
  it('falls back to scientific past the suffix table and handles infinity', () => {
    expect(fmt(1e120, 'standard')).toBe('1e120');
    expect(fmt(Infinity)).toBe('∞');
  });
});

describe('fmtTime / fmtPct', () => {
  it('formats durations', () => {
    expect(fmtTime(42)).toBe('42s');
    expect(fmtTime(125)).toBe('2m 5s');
    expect(fmtTime(3 * 3600 + 120)).toBe('3h 2m');
  });
  it('formats percentages', () => {
    expect(fmtPct(0.25)).toBe('25%');
    expect(fmtPct(0.0001)).toBe('<0.1%');
  });
});
