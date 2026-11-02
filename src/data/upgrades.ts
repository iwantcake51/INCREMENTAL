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
const TIER_NAMES = ['Salt-Cured', 'Riveted', 'Pressure-Sealed', 'Tide-Tuned', 'Brine-Forged', 'Phosphor', 'Fathomless', 'Leviathan-Grade', 'Primordial', 'Hadal'];
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
    desc: `${target.plural} produce +5% more for every ${source.name} you own.`,
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
  [100, 'Webbed Gloves', 'base', 1],
  [600, 'Steady Hands', 'mult', 2],
  [8_000, 'Brass Knuckles', 'mult', 2],
  [60_000, 'Sympathetic Glow', 'cps', 0.01],
  [5e5, 'Pearl-Inlaid Gauntlet', 'mult', 3],
  [8e6, 'Echolocation', 'cps', 0.02],
  [1e8, 'Pressure Fist', 'mult', 3],
  [5e9, 'Tidal Resonance', 'cps', 0.02],
  [1e11, 'Leviathan Grip', 'mult', 5],
  [1e13, 'Current Reader', 'cps', 0.03],
  [1e15, 'Kraken Arm', 'mult', 5],
  [1e18, 'Heart of the Sea', 'cps', 0.05],
  [1e21, 'Hand of the Deep', 'mult', 10],
  [1e25, 'Ocean Floor Tap', 'cps', 0.05],
  [1e30, 'The First Wave', 'mult', 25],
];
CLICK.forEach(([cost, name, type, v], i) => {
  add({
    id: `click${i}`,
    name,
    desc: type === 'base' ? `+${v} lumen per tap.` : type === 'mult' ? `Tapping the lure gives ×${v} lumen.` : `Each tap also gives ${v * 100}% of your production.`,
    cost,
    kind: 'click',
    icon: 'pointing',
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
  ['crit', 2e5, 'Rabbit Foot (Waterlogged)', '+3% chance of a lucky tap.', 'clover', (m) => (m.critChance += 0.03)],
  ['crit', 5e8, 'Barbed Lure', 'Lucky taps pay ×10 more.', 'fishing-hook', (m) => (m.critMult += 10)],
  ['crit', 5e12, 'Golden Hook', '+5% lucky-tap chance, and lucky taps pay ×15 more.', 'fishing-hook', (m) => ((m.critChance += 0.05), (m.critMult += 15))],
  ['combo', 3_000, 'Sea Shanty', 'Streak cap +25.', 'musical-notes', (m) => (m.comboCap += 25)],
  ['combo', 2e6, 'Rowing Rhythm', 'Each streak step is worth +0.5% more.', 'musical-notes', (m) => (m.comboPer += 0.005)],
  ['combo', 3e9, 'Slack Tide', 'Your streak waits 0.75s longer between taps.', 'musical-notes', (m) => (m.comboDecay += 0.75)],
  ['combo', 2e14, 'Endless Shanty', 'Streak cap +50.', 'musical-notes', (m) => (m.comboCap += 50)],
  ['comet', 5e4, 'Shiny Bait', 'Glimmerfish show up 15% more often.', 'fishing-lure', (m) => (m.cometInterval *= 0.85)],
  ['comet', 5e6, 'Slow Fins', 'Glimmerfish boosts last 20% longer.', 'fishing-lure', (m) => (m.buffDuration *= 1.2)],
  ['comet', 5e8, 'Fat Glimmerfish', 'Glimmerfish rewards ×1.5.', 'fishing-lure', (m) => (m.cometPower *= 1.5)],
  ['comet', 5e11, 'Shoal Whistle', 'Glimmerfish show up 15% more often.', 'fishing-lure', (m) => (m.cometInterval *= 0.85)],
  ['comet', 5e15, 'Glimmer Pact', 'Glimmerfish boosts last 25% longer and rewards ×1.5.', 'fishing-lure', (m) => ((m.buffDuration *= 1.25), (m.cometPower *= 1.5))],
];
MISC.forEach(([kind, cost, name, desc, icon, apply], i) => {
  add({ id: `${kind}${i}`, name, desc, cost, kind, icon, hue: kind === 'crit' ? 45 : kind === 'combo' ? 300 : 175, visible: (s) => seen(s, cost), apply });
});

/* ---------- Global multipliers ---------- */
const GLOBAL: [number, string, number][] = [
  [2e5, 'Better Brine', 1.5],
  [5e7, 'Copper Plumbing', 1.5],
  [2e10, 'Deep Pressure Pumps', 2],
  [1e13, 'Reef Cooperative', 2],
  [1e16, 'Trench Mapping', 2],
  [1e19, 'Abyssal Engineering', 3],
  [1e23, 'Leviathan Treaty', 3],
  [1e28, 'Hadal Cathedral', 5],
  [1e34, 'Sea Floor Cracking', 5],
  [1e42, 'The Lightless Sea', 10],
  [1e55, 'Below the Bottom', 25],
  [1e75, 'Where Light Begins', 100],
];
GLOBAL.forEach(([cost, name, mult], i) => {
  add({
    id: `global${i}`,
    name,
    desc: `Everything produces ×${mult}.`,
    cost,
    kind: 'global',
    icon: 'anchor',
    hue: 190,
    visible: (s) => seen(s, cost),
    apply: (m) => (m.prodMult *= mult),
  });
});

export const UPGRADE_MAP = new Map(UPGRADES.map((u) => [u.id, u]));

/** Upgrade kinds that survive a Supernova once "Memory of Light" is learned. */
export const KEEPABLE: ReadonlySet<UpgradeKind> = new Set(['click', 'crit', 'combo', 'comet', 'global']);
