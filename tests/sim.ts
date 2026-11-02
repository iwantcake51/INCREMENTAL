import { Game } from '../src/core/game';
import { HAZARDS, type Dive } from '../src/core/dive';
import { SHOP, shopCost } from '../src/data/shop';
import { SKILLS, skillCost, skillUnlocked } from '../src/data/skills';

/** Small deterministic PRNG (mulberry32) so simulations are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A decent but imperfect pilot: chases plankton, grabs air when low, swerves around hazards. */
export function pilot(d: Dive, skill = 1): void {
  const s = d.sub;
  let tx = s.x;
  let ty = s.y + 260;
  const lowAir = s.air < s.maxAir * 0.3;
  let best = Infinity;
  for (const e of d.ents) {
    if (e.dead) continue;
    const want = e.kind === 'mote' || e.kind === 'chest' || (e.kind === 'air' && (lowAir || s.air < s.maxAir * 0.7)) || (e.kind === 'fish' && skill > 0.5);
    if (!want) continue;
    const dy = e.y - s.y;
    if (dy < -180) continue; // don't turn back up for scraps
    const dist = Math.hypot(e.x - s.x, dy) * (e.kind === 'air' && lowAir ? 0.3 : 1) * (e.kind === 'chest' ? 0.6 : 1);
    if (dist < best && dist < 520) {
      best = dist;
      tx = e.x;
      ty = e.y;
    }
  }
  for (const e of d.ents) {
    if (!HAZARDS.has(e.kind) || e.stun > 0) continue;
    const dx = s.x - e.x;
    const dy = s.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 120 * skill) {
      tx += (dx / dist) * 220;
      ty += (dy / dist) * 220;
      if (d.m.dash && dist < 70) d.dash();
      if (d.m.flare && dist < 90) d.flare();
    }
  }
  d.input.mode = 'pointer';
  d.input.tx = tx;
  d.input.ty = ty;
  if (s.hull <= 1 && d.lumen > 0) d.surface();
}

/** Plays dives back to back, buying upgrades in between. Time is simulated, not real. */
export function simulate(opts: { seconds: number; seed?: number; rebuildAt?: (g: Game) => boolean; log?: boolean }) {
  const realRandom = Math.random;
  Math.random = mulberry32(opts.seed ?? 1);
  try {
    const g = new Game();
    let t = 0;
    let runStart = 0;
    const rebuilds: number[] = [];
    const dives: { depth: number; banked: number; reason: string }[] = [];
    while (t < opts.seconds) {
      const d = g.startDive();
      while (!d.over && d.time < 600) {
        pilot(d);
        d.step(1 / 30);
        g.tick(1 / 30);
      }
      if (!d.over) d.surface();
      t += d.time + 4; // a few seconds at the dock between dives
      g.tick(4);
      dives.push({ depth: d.result!.depth, banked: d.result!.banked, reason: d.result!.reason });
      // shop: cheapest affordable first
      for (let k = 0; k < 200; k++) {
        const opts2 = SHOP.filter((i) => g.canBuy(i.id)).sort((a, b) => shopCost(a, g.shopLevel(a.id)) - shopCost(b, g.shopLevel(b.id)));
        if (!opts2.length) break;
        g.buy(opts2[0].id);
      }
      for (let k = 0; k < 200; k++) {
        const opts3 = SKILLS.filter((s) => skillUnlocked(s, g.s.skills) && g.skillLevel(s.id) < s.max && g.s.pearls >= skillCost(s, g.skillLevel(s.id)));
        if (!opts3.length) break;
        g.buySkill(opts3.sort((a, b) => skillCost(a, g.skillLevel(a.id)) - skillCost(b, g.skillLevel(b.id)))[0].id);
      }
      if ((opts.rebuildAt ?? ((gg) => gg.pearlGain() >= Math.max(3, gg.s.pearlsTotal)))(g)) {
        rebuilds.push(t - runStart);
        if (opts.log) console.log(`rebuild #${g.s.rebuilds + 1} after ${((t - runStart) / 60).toFixed(1)} min: +${g.pearlGain()} pearls, deepest ${g.s.deepestRun} m, dives ${g.s.stats.dives}`);
        g.rebuild();
        runStart = t;
      }
    }
    return { g, rebuilds, dives };
  } finally {
    Math.random = realRandom;
  }
}
