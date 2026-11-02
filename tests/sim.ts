import { Game } from '../src/core/game';
import { GENERATORS } from '../src/data/generators';
import { SKILLS, skillCost, skillUnlocked } from '../src/data/skills';

/** A scripted "reasonable player": clicks a few times a second, buys the best-value machine, all upgrades, catches half the comets. */
export function simulate(opts: { seconds: number; clicksPerSec: number; rebirthAt: (g: Game) => boolean; log?: boolean }) {
  const g = new Game();
  g.on('comet', () => {
    if (Math.random() < 0.5) g.catchComet();
  });
  const rebirthTimes: number[] = [];
  let t = 0;
  let runStart = 0;
  while (t < opts.seconds) {
    if (!g.mods.noClick) for (let c = 0; c < opts.clicksPerSec; c++) g.click();
    g.tick(1);
    g.buyAllUpgrades();
    for (let k = 0; k < 60; k++) {
      let best = -1;
      let bestScore = 0;
      for (let i = 0; i <= g.mods.maxGenIndex; i++) {
        const cost = g.genCost(i);
        const unit = GENERATORS[i].baseProd * g.mods.genMult[i] * g.globalMult;
        const score = unit / cost;
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
      if (best < 0 || g.genCost(best) > g.s.stardust) break;
      g.buyGen(best, 1);
    }
    if (opts.rebirthAt(g)) {
      rebirthTimes.push(t - runStart);
      if (opts.log) console.log(`rebirth #${g.s.rebirths + 1} after ${((t - runStart) / 60).toFixed(1)} min, +${g.shardGain()} shards, cps ${g.cps.toExponential(2)}`);
      g.rebirth();
      runStart = t;
      // spend shards: cheapest available node first
      for (let k = 0; k < 200; k++) {
        const opts2 = SKILLS.filter((s) => skillUnlocked(s, g.s.skills) && (g.s.skills[s.id] ?? 0) < s.max).sort(
          (a, b) => skillCost(a, g.s.skills[a.id] ?? 0) - skillCost(b, g.s.skills[b.id] ?? 0),
        );
        if (!opts2.length || !g.buySkill(opts2[0].id)) break;
      }
    }
    t++;
  }
  return { g, rebirthTimes };
}
