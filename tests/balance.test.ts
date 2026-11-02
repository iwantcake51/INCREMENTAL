import { describe, expect, it } from 'vitest';
import { simulate } from './sim';

const log = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SIM_LOG;

describe('pacing', () => {
  it('dives go deeper as the sub improves, and the first rebuild comes in reasonable time', () => {
    const { g, rebuilds, dives } = simulate({ seed: 1, seconds: 3 * 3600, log });
    if (log) {
      const sample = dives.filter((_, i) => i < 8 || i % 10 === 0).map((d, i) => `${i}:${d.depth}m/${Math.round(d.banked)}`);
      console.log('dives:', dives.length, sample.join(' '));
    }
    expect(dives.length).toBeGreaterThan(20);
    // Early dives are shallow; later dives reach much deeper water.
    expect(dives[0].depth).toBeLessThan(400);
    expect(Math.max(...dives.map((d) => d.depth))).toBeGreaterThan(800);
    // First rebuild: not instant, not a slog.
    expect(rebuilds.length).toBeGreaterThanOrEqual(1);
    expect(rebuilds[0]).toBeGreaterThan(8 * 60);
    expect(rebuilds[0]).toBeLessThan(75 * 60);
    expect(g.s.lumenTotal).toBeGreaterThan(1e4);
  }, 60000);
});
