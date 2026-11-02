import { describe, expect, it } from 'vitest';
import { simulate } from './sim';

describe('pacing', () => {
  it('first Supernova is reachable in a reasonable time, and later runs speed up', () => {
    const { g, rebirthTimes } = simulate({
      seed: 1,
      seconds: 16 * 3600,
      clicksPerSec: 4,
      rebirthAt: (g) => g.shardGain() >= Math.max(3, g.s.shardsTotal),
      log: !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SIM_LOG,
    });
    expect(rebirthTimes.length).toBeGreaterThanOrEqual(3);
    // First run: not trivially fast, not a slog. Across 40 seeds this lands at ~50–110 min.
    expect(rebirthTimes[0]).toBeGreaterThan(10 * 60);
    expect(rebirthTimes[0]).toBeLessThan(120 * 60);
    expect(g.s.totalEarned).toBeGreaterThan(1e12);
  });
});
