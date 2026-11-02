import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { serialize, deserialize, exportSave, importSave } from '../src/core/save';
import { SKILLS, SKILL_MAP } from '../src/data/skills';
import { UPGRADES } from '../src/data/upgrades';
import { ACHIEVEMENTS } from '../src/data/achievements';
import { EVENTS } from '../src/data/events';
import { ICON_PATHS } from '../src/ui/icons.gen';
import { GENERATORS } from '../src/data/generators';
import { TRIALS } from '../src/data/trials';

describe('data integrity', () => {
  it('has unique ids everywhere', () => {
    for (const list of [SKILLS, UPGRADES, ACHIEVEMENTS, EVENTS, TRIALS]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it('skill tree is connected and nodes do not overlap', () => {
    for (const s of SKILLS) for (const r of s.req) expect(SKILL_MAP.has(r)).toBe(true);
    for (const a of SKILLS)
      for (const b of SKILLS) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.7);
  });
  it('every icon referenced by data exists', () => {
    const icons = [...GENERATORS, ...SKILLS, ...UPGRADES, ...ACHIEVEMENTS, ...EVENTS, ...TRIALS].map((x) => x.icon);
    for (const i of icons) expect(ICON_PATHS[i], i).toBeTruthy();
  });
});

describe('economy', () => {
  it('buys generators with geometric pricing', () => {
    const g = new Game();
    g.s.stardust = 1000;
    const c10 = g.genCost(0, 10);
    expect(g.maxAffordable(0)).toBeGreaterThan(0);
    expect(g.buyGen(0, 10)).toBe(10);
    expect(g.s.stardust).toBeCloseTo(1000 - c10);
    expect(g.cps).toBeGreaterThan(0);
  });
  it('max affordable never overspends', () => {
    const g = new Game();
    for (const money of [15, 99, 1234, 98765, 1e9]) {
      g.s.stardust = money;
      const n = g.maxAffordable(1);
      expect(g.genCost(1, Math.max(1, n))).toBeGreaterThan(n === 0 ? money : 0);
      if (n > 0) expect(g.genCost(1, n)).toBeLessThanOrEqual(money);
    }
  });
  it('supernova awards shards and resets the run', () => {
    const g = new Game();
    g.earn(1e13);
    const gain = g.shardGain();
    expect(gain).toBeGreaterThan(0);
    g.rebirth();
    expect(g.s.shards).toBe(gain);
    expect(g.s.stardust).toBe(0);
    expect(g.s.rebirths).toBe(1);
  });
  it('trials restrict and reward', () => {
    const g = new Game();
    g.startTrial('t_silent');
    expect(g.click()).toBeNull();
    g.earn(1e10);
    g.tick(0.05);
    expect(g.s.trialsDone.has('t_silent')).toBe(true);
  });
  it('per-second income includes taps and settles when tapping stops', () => {
    const g = new Game();
    g.s.gens[0] = 10;
    g.recalc();
    expect(g.totalRate).toBeCloseTo(g.cps);
    for (let i = 0; i < 60; i++) {
      for (let c = 0; c < 2; c++) g.click(); // ~40 taps/s at 20 ticks/s
      g.tick(0.05);
    }
    const peak = g.tapRate;
    expect(peak).toBeGreaterThan(0);
    expect(g.totalRate).toBeGreaterThan(g.cps);
    for (let i = 0; i < 100; i++) g.tick(0.05); // stop tapping for 5s
    expect(g.tapRate).toBeLessThan(peak * 0.01);
  });

  it('cosmic events apply and expire', () => {
    const g = new Game();
    g.s.gens[0] = 10;
    g.recalc();
    const before = g.cps;
    g.startEvent('meteor');
    expect(g.cps).toBeCloseTo(before * 3);
    g.tick(61);
    expect(g.s.event).toBeNull();
  });
});

describe('saves', () => {
  it('round-trips through JSON and export codes', () => {
    const g = new Game();
    g.earn(5e12);
    g.buyGen(0, 10);
    g.s.upgrades.add('click0');
    g.s.skills.ignition = 1;
    g.s.flags.add('title');
    const back = deserialize(serialize(g.s));
    expect(back.stardust).toBeCloseTo(g.s.stardust);
    expect(back.gens[0]).toBe(10);
    expect(back.upgrades.has('click0')).toBe(true);
    expect(back.skills.ignition).toBe(1);
    const viaCode = importSave(exportSave(g.s));
    expect(viaCode.totalEarned).toBe(g.s.totalEarned);
  });
  it('sanitizes hostile or broken saves', () => {
    const s = deserialize(JSON.stringify({ stardust: 'lots', gens: [5, -3, 'x'], skills: { ignition: 99, bogus: 3 }, upgrades: ['nope'], settings: { notation: 'roman' } }));
    expect(s.stardust).toBe(0);
    expect(s.gens.slice(0, 3)).toEqual([5, 0, 0]);
    expect(s.skills).toEqual({ ignition: 1 });
    expect(s.upgrades.size).toBe(0);
    expect(s.settings.notation).toBe('standard');
    expect(() => importSave('not a save')).toThrow();
  });
});
