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

/* ---------- Harvester upgrades: 10 per harvester, each tier does something different ---------- */
export const TIER_THRESHOLDS = [1, 5, 25, 50, 100, 150, 200, 250, 300, 400];
const TIER_COST = [10, 50, 1e3, 5e4, 5e6, 5e8, 5e10, 5e12, 5e14, 5e17];

/** One themed perk per harvester, unlocked at 200 owned. */
const PERKS: [string, string, (m: Mods) => void][] = [
  ['Plankton Lures', 'Glimmerfish show up 8% more often.', (m) => (m.cometInterval *= 0.92)],
  ['Lucky Shrimp', '+2% chance of a lucky tap.', (m) => (m.critChance += 0.02)],
  ['Pulsing Bells', 'Your streak can go 20 taps longer.', (m) => (m.comboCap += 20)],
  ['Long Wicks', 'Flares last 1.5 seconds longer.', (m) => (m.flareBonus += 1.5)],
  ['Sharper Teeth', 'Lucky taps pay ×5 more.', (m) => (m.critMult += 5)],
  ['Banked Coals', 'Harvesters work 10% better while you are away.', (m) => (m.offlineEff += 0.1)],
  ['Call and Response', 'Two more echo taps a second.', (m) => (m.autoClickRate += 2)],
  ['Wound Springs', 'The flare gauge fills 15% faster.', (m) => (m.flareFill *= 1.15)],
  ['Deep Samples', '+15% Black Pearls from each descent.', (m) => (m.shardMult *= 1.15)],
  ['Guiding Beam', 'Glimmerfish rewards ×1.5.', (m) => (m.cometPower *= 1.5)],
  ['Old Songs', 'Sea events last 25% longer.', (m) => (m.eventDuration *= 1.25)],
  ['Heartbeat', 'All production ×2.', (m) => (m.prodMult *= 2)],
];

/** Dot colour on the workshop tile shows what kind of upgrade it is. */
const TIER_HUE = [170, 45, 300, 120, 170, 210, 30, 170, 260, 170];

for (const g of GENERATORS) {
  const prev = GENERATORS[g.id - 1];
  const tiers: [string, string, (m: Mods) => void][] = [
    [`Riveted ${g.plural}`, `${g.plural} produce ×2.`, (m) => (m.genMult[g.id] *= 2)],
    [`${g.name} Bell-Pull`, `${g.plural} produce ×2, and a cord from the lure means each tap also gives 2% of their output.`, (m) => ((m.genMult[g.id] *= 2), (m.tapFromGen[g.id] += 0.02))],
    [`${g.name} Colony`, `${g.plural} work better in crowds: +4% output for every one you own.`, (m) => (m.selfSyn[g.id] += 0.04)],
    [`Salvaged ${g.name} Parts`, `${g.plural} cost half as much.`, (m) => (m.genCostMult[g.id] *= 0.5)],
    [`Pressure-Sealed ${g.plural}`, `${g.plural} produce ×3.`, (m) => (m.genMult[g.id] *= 3)],
    [`${g.name} Network`, `Every 10 ${g.plural} add +1% to all production.`, (m) => (m.globalPerGen[g.id] += 0.001)],
    [PERKS[g.id][0], PERKS[g.id][1], PERKS[g.id][2]],
    [`Phosphor ${g.plural}`, `${g.plural} produce ×3.`, (m) => (m.genMult[g.id] *= 3)],
    prev
      ? [`${g.name} Mentors`, `${g.plural} teach the ${prev.plural} a thing or two: ${prev.plural} produce ×2.`, (m) => (m.genMult[prev.id] *= 2)]
      : [`${g.name} Mentors`, 'The nets teach your hands a thing or two: taps ×2.', (m) => (m.clickMult *= 2)],
    [`Hadal ${g.plural}`, `${g.plural} produce ×5.`, (m) => (m.genMult[g.id] *= 5)],
  ];
  TIER_THRESHOLDS.forEach((need, tier) => {
    const [name, desc, apply] = tiers[tier];
    add({
      id: `g${g.id}t${tier}`,
      name,
      desc,
      cost: g.baseCost * TIER_COST[tier],
      kind: 'gen',
      icon: g.icon,
      hue: TIER_HUE[tier],
      visible: (s) => s.gens[g.id] >= need,
      apply,
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
const CLICK: [number, string, 'base' | 'mult' | 'cps' | 'echo' | 'flare', number][] = [
  [40, 'Webbed Gloves', 'base', 1],
  [600, 'Steady Hands', 'mult', 2],
  [8_000, 'Brass Knuckles', 'mult', 2],
  [60_000, 'Sympathetic Glow', 'cps', 0.01],
  [5e5, 'Pearl-Inlaid Gauntlet', 'mult', 3],
  [8e6, 'Echolocation', 'echo', 2],
  [1e8, 'Pressure Fist', 'mult', 3],
  [5e9, 'Tidal Resonance', 'cps', 0.02],
  [1e11, 'Leviathan Grip', 'mult', 5],
  [1e13, 'Current Reader', 'flare', 1.25],
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
    desc:
      type === 'base'
        ? `+${v} lumen per tap.`
        : type === 'mult'
          ? `Tapping the lure gives ×${v} lumen.`
          : type === 'echo'
            ? `${v} ghostly echo taps a second, even when you're not tapping.`
            : type === 'flare'
              ? 'The flare gauge fills 25% faster.'
              : `Each tap also gives ${v * 100}% of your production.`,
    cost,
    kind: 'click',
    icon: 'pointing',
    hue: 45,
    visible: (s) => seen(s, cost) || (i === 0 && s.stats.clicks >= 8),
    apply: (m) => {
      if (type === 'base') m.clickBase += v;
      else if (type === 'mult') m.clickMult *= v;
      else if (type === 'echo') m.autoClickRate += v;
      else if (type === 'flare') m.flareFill *= v;
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
const GLOBAL: [number, string, string, string, (m: Mods) => void][] = [
  [2e5, 'Better Brine', 'Everything produces ×1.5.', 'anchor', (m) => (m.prodMult *= 1.5)],
  [5e7, 'Copper Plumbing', 'Every harvester costs 10% less.', 'gears', (m) => (m.costMult *= 0.9)],
  [2e10, 'Deep Pressure Pumps', 'Everything produces ×2.', 'anchor', (m) => (m.prodMult *= 2)],
  [1e13, 'Reef Cooperative', '+4% production for every kind of harvester you own.', 'coral', (m) => (m.resonance += 0.04)],
  [1e16, 'Trench Mapping', 'Glimmerfish rewards ×2.', 'compass', (m) => (m.cometPower *= 2)],
  [1e19, 'Abyssal Engineering', 'Everything produces ×3.', 'anchor', (m) => (m.prodMult *= 3)],
  [1e23, 'Leviathan Treaty', 'Sea events last 50% longer.', 'sperm-whale', (m) => (m.eventDuration *= 1.5)],
  [1e28, 'Hadal Cathedral', 'Everything produces ×5.', 'anchor', (m) => (m.prodMult *= 5)],
  [1e34, 'Sea Floor Cracking', 'Production creeps up 1% every 10s of a dive, up to +200%.', 'sands-of-time', (m) => (m.patienceCap += 2)],
  [1e42, 'The Lightless Sea', 'Everything produces ×10.', 'anchor', (m) => (m.prodMult *= 10)],
  [1e55, 'Below the Bottom', 'Everything produces ×25, and flares last 2s longer.', 'anchor', (m) => ((m.prodMult *= 25), (m.flareBonus += 2))],
  [1e75, 'Where Light Begins', 'Everything produces ×100.', 'anchor', (m) => (m.prodMult *= 100)],
];
GLOBAL.forEach(([cost, name, desc, icon, apply], i) => {
  add({ id: `global${i}`, name, desc, cost, kind: 'global', icon, hue: 190, visible: (s) => seen(s, cost), apply });
});

export const UPGRADE_MAP = new Map(UPGRADES.map((u) => [u.id, u]));

/** Upgrade kinds that survive a Supernova once "Memory of Light" is learned. */
export const KEEPABLE: ReadonlySet<UpgradeKind> = new Set(['click', 'crit', 'combo', 'comet', 'global']);
