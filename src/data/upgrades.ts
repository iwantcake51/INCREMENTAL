import type { Mods } from '../core/mods';
import type { GameState } from '../core/state';
import { GENERATORS } from './generators';

export type UpgradeKind = 'gen' | 'click' | 'crit' | 'combo' | 'comet' | 'global' | 'synergy';

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  kind: UpgradeKind;
  icon: string;
  hue: number;
  /** When the upgrade shows up in the shop. */
  visible: (s: GameState) => boolean;
  apply: (m: Mods) => void;
}

export const UPGRADES: UpgradeDef[] = [];
const add = (u: UpgradeDef) => UPGRADES.push(u);
const seen = (s: GameState, cost: number) => s.runEarned >= cost * 0.2 || s.stardust >= cost * 0.5;

/* ---------- Generator tier upgrades (12 generators × 10 tiers) ---------- */
export const TIER_THRESHOLDS = [1, 5, 25, 50, 100, 150, 200, 250, 300, 400];
const TIER_COST = [10, 50, 1e3, 5e4, 5e6, 5e8, 5e10, 5e12, 5e14, 5e17];
const TIER_NAMES = ['Polished', 'Reinforced', 'Overclocked', 'Quantum', 'Stellar', 'Hyperspace', 'Celestial', 'Eternal', 'Transcendent', 'Omnipotent'];
export const tierMult = (_tier: number) => 2;

for (const g of GENERATORS) {
  TIER_THRESHOLDS.forEach((need, tier) => {
    const mult = tierMult(tier);
    add({
      id: `g${g.id}t${tier}`,
      name: `${TIER_NAMES[tier]} ${g.plural}`,
      desc: `${g.plural} are ×${mult} as efficient.`,
      cost: g.baseCost * TIER_COST[tier],
      kind: 'gen',
      icon: g.icon,
      hue: g.hue,
      visible: (s) => s.gens[g.id] >= need,
      apply: (m) => {
        m.genMult[g.id] *= mult;
      },
    });
  });
}

/* ---------- Synergies: each generator boosts the one below it ---------- */
for (let i = 0; i < GENERATORS.length - 1; i++) {
  const target = GENERATORS[i];
  const source = GENERATORS[i + 1];
  add({
    id: `syn${i}`,
    name: `${source.name} Synergy`,
    desc: `${target.plural} gain +5% production per ${source.name} owned.`,
    cost: source.baseCost * 300,
    kind: 'synergy',
    icon: 'linked-rings',
    hue: source.hue,
    visible: (s) => s.gens[i] >= 25 && s.gens[i + 1] >= 10,
    apply: (m) => {
      m.synergy.push({ target: i, source: i + 1, pct: 0.05 });
    },
  });
}

/* ---------- Click upgrades ---------- */
const CLICK: [number, string, 'base' | 'mult' | 'cps', number][] = [
  [100, 'Firm Tap', 'base', 1],
  [600, 'Steady Hands', 'mult', 2],
  [8_000, 'Star-Touched', 'mult', 2],
  [60_000, 'Resonant Tap', 'cps', 0.01],
  [5e5, 'Gilded Fingers', 'mult', 3],
  [8e6, 'Echoing Strike', 'cps', 0.02],
  [1e8, 'Meteor Knuckles', 'mult', 3],
  [5e9, 'Sympathetic Pulse', 'cps', 0.02],
  [1e11, 'Gravitic Palm', 'mult', 5],
  [1e13, 'Stellar Fist', 'cps', 0.03],
  [1e15, 'Nova Grip', 'mult', 5],
  [1e18, 'Hand of Creation', 'cps', 0.05],
  [1e21, 'Fingers of Fate', 'mult', 10],
  [1e25, 'Big Bang Tap', 'cps', 0.05],
  [1e30, 'The First Touch', 'mult', 25],
];
CLICK.forEach(([cost, name, type, v], i) => {
  add({
    id: `click${i}`,
    name,
    desc: type === 'base' ? `+${v} base click power.` : type === 'mult' ? `Click power ×${v}.` : `Clicks also gain +${v * 100}% of your production.`,
    cost,
    kind: 'click',
    icon: 'click',
    hue: 45,
    visible: (s) => seen(s, cost) || (i === 0 && s.stats.clicks >= 15),
    apply: (m) => {
      if (type === 'base') m.clickBase += v;
      else if (type === 'mult') m.clickMult *= v;
      else m.clickCpsPct += v;
    },
  });
});

/* ---------- Crit / combo / comet ---------- */
const MISC: [UpgradeKind, number, string, string, string, (m: Mods) => void][] = [
  ['crit', 2e5, 'Keen Eye', '+3% critical click chance.', 'on-target', (m) => (m.critChance += 0.03)],
  ['crit', 5e8, 'Shatterpoint', 'Critical clicks deal +10× more.', 'on-target', (m) => (m.critMult += 10)],
  ['crit', 5e12, 'Supercritical', '+5% crit chance and +15× crit power.', 'on-target', (m) => ((m.critChance += 0.05), (m.critMult += 15))],
  ['combo', 3_000, 'Rhythm', 'Combo cap +25.', 'musical-notes', (m) => (m.comboCap += 25)],
  ['combo', 2e6, 'Momentum', 'Each combo stack gives +0.5% more.', 'musical-notes', (m) => (m.comboPer += 0.005)],
  ['combo', 3e9, 'Flow State', 'Combo lasts +0.75s longer between clicks.', 'musical-notes', (m) => (m.comboDecay += 0.75)],
  ['combo', 2e14, 'Unbroken', 'Combo cap +50.', 'musical-notes', (m) => (m.comboCap += 50)],
  ['comet', 5e4, 'Comet Lure', 'Comets appear 15% more often.', 'comet-spark', (m) => (m.cometInterval *= 0.85)],
  ['comet', 5e6, 'Long Tail', 'Comet buffs last 20% longer.', 'comet-spark', (m) => (m.buffDuration *= 1.2)],
  ['comet', 5e8, 'Bright Comets', 'Comet rewards ×1.5.', 'comet-spark', (m) => (m.cometPower *= 1.5)],
  ['comet', 5e11, 'Star Shepherd', 'Comets appear 15% more often.', 'comet-spark', (m) => (m.cometInterval *= 0.85)],
  ['comet', 5e15, 'Tailwind', 'Comet buffs last 25% longer, rewards ×1.5.', 'comet-spark', (m) => ((m.buffDuration *= 1.25), (m.cometPower *= 1.5))],
];
MISC.forEach(([kind, cost, name, desc, icon, apply], i) => {
  add({ id: `${kind}${i}`, name, desc, cost, kind, icon, hue: kind === 'crit' ? 0 : kind === 'combo' ? 300 : 195, visible: (s) => seen(s, cost), apply });
});

/* ---------- Global multipliers ---------- */
const GLOBAL: [number, string, number][] = [
  [2e5, 'Cosmic Alignment', 1.5],
  [5e7, 'Gravity Lensing', 1.5],
  [2e10, 'Dark Energy', 2],
  [1e13, 'Stellar Nursery', 2],
  [1e16, 'Hawking Radiation', 2],
  [1e19, 'Cosmic Inflation', 3],
  [1e23, 'Multiverse Bridge', 3],
  [1e28, 'Omega Point', 5],
  [1e34, 'Heat Death Reversal', 5],
  [1e42, 'Infinite Expanse', 10],
  [1e55, 'Beyond the Horizon', 25],
  [1e75, 'Final Light', 100],
];
GLOBAL.forEach(([cost, name, mult], i) => {
  add({
    id: `global${i}`,
    name,
    desc: `All production ×${mult}.`,
    cost,
    kind: 'global',
    icon: 'sun-radiations',
    hue: 270,
    visible: (s) => seen(s, cost),
    apply: (m) => (m.prodMult *= mult),
  });
});

export const UPGRADE_MAP = new Map(UPGRADES.map((u) => [u.id, u]));

/** Upgrade kinds that survive a Supernova once "Memory of Light" is learned. */
export const KEEPABLE: ReadonlySet<UpgradeKind> = new Set(['click', 'crit', 'combo', 'comet', 'global']);
