import { describe, expect, it } from 'vitest';
import { Game, PEARL_BASE } from '../src/core/game';
import { Dive, HAZARDS } from '../src/core/dive';
import { baseMods } from '../src/core/mods';
import { serialize, deserialize, exportSave, importSave } from '../src/core/save';
import { SKILLS, SKILL_MAP } from '../src/data/skills';
import { SHOP } from '../src/data/shop';
import { ACHIEVEMENTS } from '../src/data/achievements';
import { EVENTS } from '../src/data/events';
import { ZONES, moteValue, zoneAt } from '../src/data/zones';
import { ICON_PATHS } from '../src/ui/icons.gen';
import { pilot } from './sim';

const play = (d: Dive, seconds = 600) => {
  while (!d.over && d.time < seconds) {
    pilot(d);
    d.step(1 / 30);
  }
  return d;
};

describe('data integrity', () => {
  it('has unique ids everywhere', () => {
    for (const list of [SKILLS, SHOP, ACHIEVEMENTS, EVENTS]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it('the Reef is connected and its nodes do not overlap', () => {
    for (const s of SKILLS) for (const r of s.req) expect(SKILL_MAP.has(r)).toBe(true);
    for (const a of SKILLS) for (const b of SKILLS) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.7);
  });
  it('every icon referenced by data exists', () => {
    for (const x of [...SKILLS, ...SHOP, ...ACHIEVEMENTS, ...EVENTS]) expect(ICON_PATHS[x.icon], x.icon).toBeTruthy();
  });
  it('zones go deeper and richer', () => {
    for (let i = 1; i < ZONES.length; i++) {
      expect(ZONES[i].from).toBeGreaterThan(ZONES[i - 1].from);
      expect(ZONES[i].richness).toBeGreaterThan(ZONES[i - 1].richness);
    }
    expect(zoneAt(2000).name).toBe('The Abyss');
    expect(moteValue(1000)).toBeGreaterThan(moteValue(100) * 5);
  });
});

describe('dives', () => {
  it('are deterministic for a seed', () => {
    const a = play(new Dive(baseMods(), { seed: 42, record: 0, valueMult: 1 }));
    const b = play(new Dive(baseMods(), { seed: 42, record: 0, valueMult: 1 }));
    expect(a.result).toEqual(b.result);
    expect(a.result!.motes).toBeGreaterThan(5);
    expect(a.result!.haul).toBeGreaterThan(0);
  });

  it('run out of air if you just sit there, and keep the whole haul', () => {
    const d = new Dive(baseMods(), { seed: 3, record: 0, valueMult: 1 });
    while (!d.over) d.step(1 / 30);
    expect(d.result!.reason).toBe('air');
    expect(d.result!.time).toBeGreaterThan(20);
    expect(d.result!.banked).toBe(d.result!.haul);
  });

  it('surfacing keeps everything; a breach keeps only part', () => {
    const m = baseMods();
    const d = new Dive(m, { seed: 5, record: 0, valueMult: 1 });
    d.lumen = 1000;
    d.surface();
    expect(d.result!.banked).toBe(1000);

    const d2 = new Dive(m, { seed: 5, record: 0, valueMult: 1 });
    d2.lumen = 1000;
    const jelly = { kind: 'jelly' as const, x: d2.sub.x, y: d2.sub.y, vx: 0, vy: 0, r: 22, value: 0, phase: 0, homeY: d2.sub.y, stun: 0, t: 0, dir: 1, pulled: false, dead: false };
    for (let i = 0; i < 10 && !d2.over; i++) {
      d2.ents.push({ ...jelly, x: d2.sub.x, y: d2.sub.y, homeY: d2.sub.y });
      d2.sub.inv = 0;
      d2.step(1 / 60);
    }
    expect(d2.result!.reason).toBe('breach');
    expect(d2.result!.banked).toBeCloseTo(d2.result!.haul * m.keepOnBreach);
    expect(d2.result!.banked).toBeLessThan(d2.result!.haul);
  });

  it('pick up plankton, build a streak, and get pulled in by the magnet', () => {
    const d = new Dive(baseMods(), { seed: 9, record: 0, valueMult: 1 });
    d.ents = d.ents.filter((e) => !HAZARDS.has(e.kind));
    for (let i = 0; i < 5; i++) d.ents.push({ kind: 'mote', x: d.sub.x + 30 + i * 4, y: d.sub.y, vx: 0, vy: 0, r: 7, value: 1, phase: 0, homeY: d.sub.y, stun: 0, t: 0, dir: 1, pulled: false, dead: false });
    for (let i = 0; i < 60; i++) d.step(1 / 60);
    expect(d.streak).toBeGreaterThanOrEqual(3);
    expect(d.lumen).toBeGreaterThan(5);
  });

  it('flares stun nearby creatures and dashes need the jet pump', () => {
    const m = baseMods();
    const d = new Dive(m, { seed: 11, record: 0, valueMult: 1 });
    expect(d.dash()).toBe(false);
    expect(d.flare()).toBe(false);
    m.dash = true;
    m.flare = true;
    const d2 = new Dive(m, { seed: 11, record: 0, valueMult: 1 });
    d2.ents.push({ kind: 'eel', x: d2.sub.x + 50, y: d2.sub.y, vx: 0, vy: 0, r: 16, value: 0, phase: 0, homeY: d2.sub.y, stun: 0, t: 0, dir: 1, pulled: false, dead: false });
    expect(d2.dash()).toBe(true);
    expect(d2.flare()).toBe(true);
    expect(d2.ents.find((e) => e.kind === 'eel' && e.x === d2.sub.x + 50)?.stun ?? 1).toBeGreaterThan(0);
  });
});

describe('economy', () => {
  it('banks dive lumen, buys upgrades and records depth', () => {
    const g = new Game();
    const d = g.startDive(undefined);
    play(d);
    expect(g.dive).toBeNull();
    expect(g.s.lumen).toBeGreaterThan(0);
    expect(g.s.deepest).toBeGreaterThan(0);
    g.s.lumen = 1e6;
    const air = g.mods.maxAir;
    expect(g.buy('air')).toBe(true);
    expect(g.mods.maxAir).toBe(air + 5);
  });

  it('rebuilding pays pearls and resets the sub', () => {
    const g = new Game();
    g.earn(PEARL_BASE * 10);
    g.s.shop.air = 5;
    const gain = g.pearlGain();
    expect(gain).toBeGreaterThan(0);
    g.rebuild();
    expect(g.s.pearls).toBe(gain);
    expect(g.s.shop.air).toBe(0);
    expect(g.s.lumen).toBe(0);
    expect(g.valueMult()).toBeGreaterThan(1);
  });

  it('the farm earns while you are away', () => {
    const g = new Game();
    g.s.shop.farm = 5;
    g.invalidate();
    g.recalc();
    expect(g.farmRate).toBeGreaterThan(0);
    const r = g.applyOffline(3600);
    expect(r.gain).toBeGreaterThan(0);
  });
});

describe('saves', () => {
  it('round-trip through JSON and export codes', () => {
    const g = new Game();
    g.earn(5e5);
    g.s.shop.prop = 3;
    g.s.skills.ignition = 1;
    g.s.deepest = 420;
    g.s.flags.add('title');
    const back = deserialize(serialize(g.s));
    expect(back.lumen).toBeCloseTo(g.s.lumen);
    expect(back.shop.prop).toBe(3);
    expect(back.skills.ignition).toBe(1);
    expect(back.deepest).toBe(420);
    expect(importSave(exportSave(g.s)).lumenTotal).toBe(g.s.lumenTotal);
  });

  it('sanitize hostile or broken saves, and keep only settings from old clicker saves', () => {
    const s = deserialize(JSON.stringify({ version: 2, lumen: 'lots', shop: { air: 999, bogus: 3 }, skills: { ignition: 99 }, settings: { notation: 'roman' } }));
    expect(s.lumen).toBe(0);
    expect(s.shop).toEqual({ air: 30 });
    expect(s.skills).toEqual({ ignition: 1 });
    expect(s.settings.notation).toBe('standard');
    const legacy = deserialize(JSON.stringify({ version: 1, stardust: 1e12, gens: [5], settings: { palette: 'coral' } }));
    expect(legacy.lumen).toBe(0);
    expect(legacy.settings.palette).toBe('coral');
    expect(() => importSave('not a save')).toThrow();
  });
});
