import { describe, expect, it } from 'vitest';
import { simulate } from './sim';

describe('pacing', () => {
  it('first descent comes quickly and mid-game dives stay a few minutes long', () => {
    const { g, rebirthTimes } = simulate({
      seed: 1,
      seconds: 16 * 3600,
      clicksPerSec: 4,
      rebirthAt: (g) => g.shardGain() >= Math.max(3, g.s.shardsTotal),
      log: !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SIM_LOG,
    });
    expect(rebirthTimes.length).toBeGreaterThanOrEqual(3);
    // First dive: quick but not instant. Across 30 seeds this lands at ~3–23 min.
    expect(rebirthTimes[0]).toBeGreaterThan(2 * 60);
    expect(rebirthTimes[0]).toBeLessThan(30 * 60);
    // Water pressure keeps later dives from collapsing into seconds.
    const mid = rebirthTimes.slice(3, 12);
    expect(mid.reduce((a, b) => a + b, 0) / mid.length).toBeGreaterThan(2 * 60);
    expect(g.s.totalEarned).toBeGreaterThan(1e12);
  });
});
