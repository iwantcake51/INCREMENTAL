import type { Mods } from '../core/mods';
import type { GameState } from '../core/state';
import { GENERATORS } from './generators';
import { fmt } from '../core/format';

export type Branch = 'core' | 'click' | 'prod' | 'cosmos' | 'nova' | 'hybrid' | 'attune' | 'apex';

export interface SkillDef {
  id: string;
  name: string;
  icon: string;
  branch: Branch;
  x: number;
  y: number;
  max: number;
  base: number;
  scale: number;
  /** Requires ANY of these nodes at level ≥ 1. Empty = root. */
  req: string[];
  desc: string;
  /** Human-readable total effect at a given level. */
  fx: (lvl: number) => string;
  apply: (m: Mods, lvl: number, s: GameState) => void;
}

export const BRANCH_HUE: Record<Branch, number> = {
  core: 172,
  click: 42,
  prod: 150,
  cosmos: 198,
  nova: 270,
  hybrid: 330,
  attune: 20,
  apex: 350,
};

export const BRANCH_LABEL: Record<Branch, string> = {
  core: 'Heart',
  click: 'Hands',
  prod: 'Harvest',
  cosmos: 'Currents',
  nova: 'Abyss',
  hybrid: 'Confluence',
  attune: 'Kinship',
  apex: 'Hadal',
};

const x = (v: number) => fmt(v);
const S: SkillDef[] = [
  /* ---------------- Heart ---------------- */
  {
    id: 'ignition', name: 'First Polyp', icon: 'coral', branch: 'core', x: 0, y: 0, max: 1, base: 1, scale: 1, req: [],
    desc: 'Every reef starts with one. Production ×2 and taps ×2.',
    fx: (l) => (l ? 'Production ×2, taps ×2' : 'Not grown yet'),
    apply: (m, l) => { if (l) { m.prodMult *= 2; m.clickMult *= 2; } },
  },

  /* ---------------- Hands (north) ---------------- */
  { id: 'k_touch', name: 'Calloused Palms', icon: 'pointing', branch: 'click', x: -2, y: -1.4, max: 5, base: 1, scale: 2, req: ['ignition'],
    desc: '+100% lumen per tap, per level.', fx: (l) => `Taps ×${1 + l}`, apply: (m, l) => (m.clickMult *= 1 + l) },
  { id: 'k_rhythm', name: 'Work Song', icon: 'musical-notes', branch: 'click', x: -3, y: -2.6, max: 4, base: 2, scale: 2, req: ['k_touch'],
    desc: 'Your streak can go 25 taps longer, per level.', fx: (l) => `+${25 * l} streak cap`, apply: (m, l) => (m.comboCap += 25 * l) },
  { id: 'k_luck', name: 'Lucky Barnacle', icon: 'clover', branch: 'click', x: -1, y: -2.6, max: 5, base: 2, scale: 2, req: ['k_touch'],
    desc: '+3% chance of a lucky tap, per level.', fx: (l) => `+${3 * l}% lucky taps`, apply: (m, l) => (m.critChance += 0.03 * l) },
  { id: 'k_echo', name: 'Echo Hands', icon: 'echo-ripples', branch: 'click', x: -2, y: -2.9, max: 10, base: 3, scale: 2, req: ['k_touch'],
    desc: 'A ghostly hand taps the lure once a second, per level.', fx: (l) => `${l} echo taps/s`, apply: (m, l) => (m.autoClickRate += l) },
  { id: 'k_sustain', name: 'Long Breath', icon: 'bubbles', branch: 'click', x: -3.5, y: -3.8, max: 3, base: 4, scale: 2, req: ['k_rhythm'],
    desc: 'Your streak waits 0.5s longer between taps, per level.', fx: (l) => `+${0.5 * l}s streak window`, apply: (m, l) => (m.comboDecay += 0.5 * l) },
  { id: 'k_cresc', name: 'Chorus', icon: 'sound-waves', branch: 'click', x: -2.6, y: -3.9, max: 3, base: 6, scale: 3, req: ['k_rhythm'],
    desc: 'Each streak step is worth +0.5% more, per level.', fx: (l) => `+${0.5 * l}% per step`, apply: (m, l) => (m.comboPer += 0.005 * l) },
  { id: 'k_shatter', name: 'Sharp Hooks', icon: 'fishing-hook', branch: 'click', x: -1.4, y: -3.9, max: 5, base: 4, scale: 2, req: ['k_luck'],
    desc: 'Lucky taps pay ×5 more, per level.', fx: (l) => `+${5 * l}× lucky pay`, apply: (m, l) => (m.critMult += 5 * l) },
  { id: 'k_conduit', name: 'Copper Wire', icon: 'lightning-arc', branch: 'click', x: -0.5, y: -3.8, max: 5, base: 25, scale: 3, req: ['k_luck'],
    desc: 'Each tap also gives 1% of your production, per level.', fx: (l) => `+${l}% of production per tap`, apply: (m, l) => (m.clickCpsPct += 0.01 * l) },
  { id: 'k_perfect', name: 'Drummer Crab', icon: 'crab', branch: 'click', x: -3.1, y: -5.1, max: 1, base: 300, scale: 1, req: ['k_cresc', 'k_sustain'],
    desc: 'Echo taps count toward your streak.', fx: (l) => (l ? 'The crab keeps time' : 'Not grown yet'), apply: (m, l) => { if (l) m.autoClickCombo = true; } },
  { id: 'k_cascade', name: 'Pearl Diver', icon: 'oyster-pearl', branch: 'click', x: -0.9, y: -5.1, max: 1, base: 625, scale: 1, req: ['k_shatter', 'k_conduit'],
    desc: '+10% lucky-tap chance, and every lucky tap adds 5 to your streak.', fx: (l) => (l ? '+10% lucky, lucky taps build streak' : 'Not grown yet'), apply: (m, l) => { if (l) { m.critChance += 0.1; m.critCombo = true; } } },
  { id: 'k_cosmos', name: 'Tentacle Grip', icon: 'suckered-tentacle', branch: 'click', x: -2, y: -4.7, max: 1, base: 1500, scale: 1, req: ['k_echo'],
    desc: 'Taps ×10.', fx: (l) => (l ? 'Taps ×10' : 'Not grown yet'), apply: (m, l) => { if (l) m.clickMult *= 10; } },
  { id: 'k_god', name: 'Hand of the Deep', icon: 'kraken-tentacle', branch: 'click', x: -2, y: -6.1, max: 1, base: 100000, scale: 1, req: ['k_cosmos'],
    desc: 'Taps ×25 and ten more echo taps a second.', fx: (l) => (l ? 'Taps ×25, +10 echo taps/s' : 'Not grown yet'), apply: (m, l) => { if (l) { m.clickMult *= 25; m.autoClickRate += 10; } } },

  /* ---------------- Harvest (east) ---------------- */
  { id: 'p_fusion', name: 'Rich Water', icon: 'water-drop', branch: 'prod', x: 2, y: -1.4, max: 10, base: 1, scale: 1.8, req: ['ignition'],
    desc: '+25% production, per level.', fx: (l) => `+${25 * l}% production`, apply: (m, l) => (m.prodAdd += 0.25 * l) },
  { id: 'p_found', name: 'Shallow Hands', icon: 'fishing-net', branch: 'prod', x: 1, y: -2.6, max: 3, base: 4, scale: 4, req: ['p_fusion'],
    desc: 'Harvesters 1–4 produce ×3, per level.', fx: (l) => `Harvesters 1–4 ×${x(3 ** l)}`, apply: (m, l) => { for (let i = 0; i < 4; i++) m.genMult[i] *= 3 ** l; } },
  { id: 'p_mid', name: 'Twilight Crews', icon: 'angler-fish', branch: 'prod', x: 2, y: -2.9, max: 3, base: 30, scale: 4, req: ['p_fusion'],
    desc: 'Harvesters 5–8 produce ×3, per level.', fx: (l) => `Harvesters 5–8 ×${x(3 ** l)}`, apply: (m, l) => { for (let i = 4; i < 8; i++) m.genMult[i] *= 3 ** l; } },
  { id: 'p_super', name: 'Midnight Crews', icon: 'submarine', branch: 'prod', x: 3, y: -2.6, max: 3, base: 100, scale: 4, req: ['p_fusion'],
    desc: 'Harvesters 9–12 produce ×3, per level.', fx: (l) => `Harvesters 9–12 ×${x(3 ** l)}`, apply: (m, l) => { for (let i = 8; i < 12; i++) m.genMult[i] *= 3 ** l; } },
  { id: 'p_assembly', name: 'Salvaged Parts', icon: 'ship-wreck', branch: 'prod', x: 0.5, y: -3.8, max: 5, base: 8, scale: 2.5, req: ['p_found'],
    desc: 'Harvesters cost 8% less, per level.', fx: (l) => `Costs ×${(0.92 ** l).toFixed(2)}`, apply: (m, l) => (m.costMult *= 0.92 ** l) },
  { id: 'p_scale', name: 'Bulk Rivets', icon: 'gears', branch: 'prod', x: 0.5, y: -5, max: 3, base: 300, scale: 6, req: ['p_assembly'],
    desc: 'Harvester prices grow 0.005 slower, per level.', fx: (l) => `Growth ${(1.15 - 0.005 * l).toFixed(3)}`, apply: (m, l) => (m.costGrowth -= 0.005 * l) },
  { id: 'p_reson', name: 'Symbiosis', icon: 'double-fish', branch: 'prod', x: 3.5, y: -3.8, max: 3, base: 150, scale: 4, req: ['p_super'],
    desc: '+5% production for every kind of harvester you own, per level.', fx: (l) => `+${5 * l}% per kind owned`, apply: (m, l) => (m.resonance += 0.05 * l) },
  { id: 'p_patience', name: 'Slow Growth', icon: 'sea-turtle', branch: 'prod', x: 3.5, y: -5, max: 5, base: 200, scale: 3, req: ['p_reson'],
    desc: 'Production creeps up 1% every 10s of a dive, up to +100% per level.', fx: (l) => `Up to +${100 * l}%`, apply: (m, l) => (m.patienceCap += l) },
  { id: 'p_fame', name: "Collector's Cabinet", icon: 'triple-shells', branch: 'prod', x: 2, y: -4.2, max: 1, base: 750, scale: 1, req: ['p_mid'],
    desc: 'Each find you have made gives another +1% production.', fx: (l) => (l ? '2% per find' : 'Not grown yet'), apply: (m, l) => (m.achPer += 0.01 * l) },
  { id: 'p_supermass', name: 'Great Barrier', icon: 'sea-urchin', branch: 'prod', x: 1.4, y: -5.25, max: 5, base: 1500, scale: 4, req: ['p_fame'],
    desc: 'Production ×2, per level.', fx: (l) => `Production ×${2 ** l}`, apply: (m, l) => (m.prodMult *= 2 ** l) },
  { id: 'p_dilation', name: 'Night Shift', icon: 'sands-of-time', branch: 'prod', x: 2.6, y: -5.25, max: 5, base: 1000, scale: 3, req: ['p_fame'],
    desc: 'Production ×1.25 and harvesters work 5% better while you are away, per level.', fx: (l) => `×${(1.25 ** l).toFixed(2)}, +${5 * l}% away`, apply: (m, l) => { m.prodMult *= 1.25 ** l; m.offlineEff += 0.05 * l; } },
  { id: 'p_horizon', name: 'The Trench Wall', icon: 'manta-ray', branch: 'prod', x: 2, y: -6.3, max: 3, base: 750000, scale: 12, req: ['p_supermass', 'p_dilation'],
    desc: 'Raises total production to the power of +0.02, per level.', fx: (l) => `Production ^${(1 + 0.02 * l).toFixed(2)}`, apply: (m, l) => (m.prodExp += 0.02 * l) },

  /* ---------------- Currents (south) ---------------- */
  { id: 'c_lure', name: 'Chum Bucket', icon: 'fish-bucket', branch: 'cosmos', x: 6, y: -1.4, max: 5, base: 1, scale: 2, req: ['ignition'],
    desc: 'Glimmerfish show up 10% more often, per level.', fx: (l) => `Wait ×${(0.9 ** l).toFixed(2)}`, apply: (m, l) => (m.cometInterval *= 0.9 ** l) },
  { id: 'c_bright', name: 'Fat Fish', icon: 'clownfish', branch: 'cosmos', x: 7, y: -2.6, max: 5, base: 3, scale: 2, req: ['c_lure'],
    desc: 'Glimmerfish rewards +20%, per level.', fx: (l) => `Rewards ×${(1 + 0.2 * l).toFixed(1)}`, apply: (m, l) => (m.cometPower *= 1 + 0.2 * l) },
  { id: 'c_expo', name: 'Lazy Fins', icon: 'seahorse', branch: 'cosmos', x: 5, y: -2.6, max: 5, base: 3, scale: 2, req: ['c_lure'],
    desc: 'Glimmerfish boosts last 15% longer, per level.', fx: (l) => `Duration ×${(1 + 0.15 * l).toFixed(2)}`, apply: (m, l) => (m.buffDuration *= 1 + 0.15 * l) },
  { id: 'c_wish', name: 'Message in a Bottle', icon: 'water-bottle', branch: 'cosmos', x: 6, y: -2.9, max: 5, base: 38, scale: 2.5, req: ['c_lure'],
    desc: 'Each tap has a 1% chance per level to wash up 10s of production.', fx: (l) => `${l}% bottle chance`, apply: (m, l) => (m.wishChance += 0.01 * l) },
  { id: 'c_twin', name: 'Pairs', icon: 'double-fish', branch: 'cosmos', x: 6.6, y: -3.9, max: 3, base: 62, scale: 3, req: ['c_bright'],
    desc: '10% chance per level that a glimmerfish brings a friend.', fx: (l) => `${10 * l}% chance of a pair`, apply: (m, l) => (m.twinCometChance += 0.1 * l) },
  { id: 'c_wander', name: 'Shoal Memory', icon: 'circling-fish', branch: 'cosmos', x: 7.5, y: -3.8, max: 3, base: 200, scale: 3, req: ['c_bright'],
    desc: 'Every glimmerfish caught this dive adds 1% production, per level.', fx: (l) => `+${l}% per fish this dive`, apply: (m, l) => (m.wanderPer += 0.01 * l) },
  { id: 'c_over', name: 'Blood in the Water', icon: 'shark-fin', branch: 'cosmos', x: 4.5, y: -3.8, max: 3, base: 100, scale: 3, req: ['c_expo'],
    desc: 'Feeding Frenzy multiplier +3, per level.', fx: (l) => `Frenzy ×${7 + 3 * l}`, apply: (m, l) => (m.frenzyMult += 3 * l) },
  { id: 'c_storm', name: 'Live Wire', icon: 'eel', branch: 'cosmos', x: 5.4, y: -3.9, max: 3, base: 100, scale: 3, req: ['c_expo'],
    desc: 'Eel Shock multiplier +33, per level.', fx: (l) => `Eel Shock ×${77 + 33 * l}`, apply: (m, l) => (m.clickstormMult += 33 * l) },
  { id: 'c_gravity', name: 'Gill Net', icon: 'fishing-net', branch: 'cosmos', x: 6, y: -4.7, max: 1, base: 300, scale: 1, req: ['c_wish'],
    desc: 'Glimmerfish get caught on their own before they swim off.', fx: (l) => (l ? 'Auto-catch glimmerfish' : 'Not grown yet'), apply: (m, l) => { if (l) m.cometAuto = true; } },
  { id: 'c_feast', name: 'Feast Day', icon: 'fish-eggs', branch: 'cosmos', x: 7.1, y: -5.1, max: 1, base: 3000, scale: 1, req: ['c_twin', 'c_wander'],
    desc: 'All glimmerfish boosts are 50% stronger.', fx: (l) => (l ? 'Boosts ×1.5' : 'Not grown yet'), apply: (m, l) => { if (l) m.buffPower *= 1.5; } },
  { id: 'c_solar', name: 'Gulf Stream', icon: 'big-wave', branch: 'cosmos', x: 4.9, y: -5.1, max: 1, base: 2500, scale: 1, req: ['c_over', 'c_storm'],
    desc: 'Glimmerfish rewards ×2 and boosts last 20% longer.', fx: (l) => (l ? 'Rewards ×2, duration ×1.2' : 'Not grown yet'), apply: (m, l) => { if (l) { m.cometPower *= 2; m.buffDuration *= 1.2; } } },
  { id: 'c_meteor', name: 'The Great Migration', icon: 'sea-serpent', branch: 'cosmos', x: 6, y: -6.1, max: 1, base: 100000, scale: 1, req: ['c_gravity'],
    desc: 'Glimmerfish come twice as often and rewards ×3.', fx: (l) => (l ? 'Wait ×0.5, rewards ×3' : 'Not grown yet'), apply: (m, l) => { if (l) { m.cometInterval *= 0.5; m.cometPower *= 3; } } },

  /* ---------------- Abyss (west) ---------------- */
  { id: 'n_yield', name: 'Black Oysters', icon: 'oyster', branch: 'nova', x: -6, y: -1.4, max: 10, base: 2, scale: 2.2, req: ['ignition'],
    desc: '+20% Black Pearls from each descent, per level.', fx: (l) => `Pearls ×${(1 + 0.2 * l).toFixed(1)}`, apply: (m, l) => (m.shardMult *= 1 + 0.2 * l) },
  { id: 'n_start', name: 'Stocked Locker', icon: 'open-treasure-chest', branch: 'nova', x: -5, y: -2.6, max: 5, base: 5, scale: 4, req: ['n_yield'],
    desc: 'Start every dive with some lumen already banked.', fx: (l) => (l ? `Start with ${x(10 ** (1 + 2 * l))}` : 'Not grown yet'), apply: (m, l) => { if (l) m.startStardust = Math.max(m.startStardust, 10 ** (1 + 2 * l)); } },
  { id: 'n_found', name: 'Mechanical Crab', icon: 'crab-claw', branch: 'nova', x: -6, y: -2.9, max: 1, base: 8, scale: 1, req: ['n_yield'],
    desc: 'Unlocks the harvester autobuyer.', fx: (l) => (l ? 'Autobuyer online' : 'Not grown yet'), apply: (m, l) => { if (l) m.autoGens = true; } },
  { id: 'n_dream', name: 'Sleeping Reef', icon: 'night-sleep', branch: 'nova', x: -7, y: -2.6, max: 5, base: 4, scale: 2, req: ['n_yield'],
    desc: 'Harvesters work 10% better while you are away, per level.', fx: (l) => `+${10 * l}% while away`, apply: (m, l) => (m.offlineEff += 0.1 * l) },
  { id: 'n_seed', name: 'Spawning Ground', icon: 'fish-eggs', branch: 'nova', x: -4.5, y: -3.8, max: 4, base: 100, scale: 4, req: ['n_start'],
    desc: 'Start every dive with 10 of the first 2 harvesters, per level.', fx: (l) => (l ? `10 each of harvesters 1–${2 * l}` : 'Not grown yet'), apply: (m, l) => (m.startGens = Math.max(m.startGens, 2 * l)) },
  { id: 'n_memory', name: 'Captain\'s Log', icon: 'scroll-unfurled', branch: 'nova', x: -4.5, y: -5, max: 1, base: 625, scale: 1, req: ['n_seed'],
    desc: 'Keep lure, lucky, streak, glimmerfish and big upgrades when you descend.', fx: (l) => (l ? 'Upgrades remembered' : 'Not grown yet'), apply: (m, l) => { if (l) m.keepUpgrades = true; } },
  { id: 'n_drone', name: 'Diving Bell Clerk', icon: 'diving-helmet', branch: 'nova', x: -6, y: -4.2, max: 1, base: 100, scale: 1, req: ['n_found'],
    desc: 'Unlocks the upgrade autobuyer.', fx: (l) => (l ? 'Clerk hired' : 'Not grown yet'), apply: (m, l) => { if (l) m.autoUpgrades = true; } },
  { id: 'n_slumber', name: 'Deep Sleep', icon: 'sleepy', branch: 'nova', x: -7.5, y: -3.8, max: 5, base: 8, scale: 2.5, req: ['n_dream'],
    desc: 'Harvesters keep going 4 hours longer while you are away, per level.', fx: (l) => `${8 + 4 * l}h away limit`, apply: (m, l) => (m.offlineCapH += 4 * l) },
  { id: 'n_trials', name: 'Trench Charts', icon: 'compass', branch: 'nova', x: -7.5, y: -5, max: 1, base: 150, scale: 1, req: ['n_slumber', 'n_drone'],
    desc: 'Unlocks the Trenches: hard dives with permanent rewards.', fx: (l) => (l ? 'Trenches open' : 'Not grown yet'), apply: (m, l) => { if (l) m.trialsUnlocked = true; } },
  { id: 'n_resonance', name: 'Pearl Luster', icon: 'kaleidoscope-pearls', branch: 'nova', x: -6.6, y: -5.25, max: 4, base: 200, scale: 5, req: ['n_drone'],
    desc: 'Every Black Pearl you have found gives +0.5% more production, per level.', fx: (l) => `${1 + 0.5 * l}% per pearl`, apply: (m, l) => (m.shardPer += 0.005 * l) },
  { id: 'n_cycle', name: 'Ballast Winch', icon: 'anchor', branch: 'nova', x: -5.4, y: -5.25, max: 1, base: 6250, scale: 1, req: ['n_drone'],
    desc: 'Unlocks automatic descents once you hit a pearl target.', fx: (l) => (l ? 'Auto-descent online' : 'Not grown yet'), apply: (m, l) => { if (l) m.autoRebirth = true; } },
  { id: 'n_theory', name: 'Hadal Survey', icon: 'mini-submarine', branch: 'nova', x: -6, y: -6.3, max: 2, base: 5000000, scale: 20, req: ['n_resonance', 'n_cycle'],
    desc: 'The pearl formula exponent goes up by 0.02, per level.', fx: (l) => `Exponent ${(0.25 + 0.02 * l).toFixed(2)}`, apply: (m, l) => (m.shardExp += 0.02 * l) },

  /* ---------------- Confluence (diagonals) ---------------- */
  { id: 'h_rhythmic', name: 'Shanty of Return', icon: 'ship-wheel', branch: 'hybrid', x: -3.9, y: -6.4, max: 1, base: 6250, scale: 1, req: ['k_perfect', 'n_memory'],
    desc: '+50 streak cap and Black Pearls ×1.25.', fx: (l) => (l ? '+50 streak, pearls ×1.25' : 'Not grown yet'), apply: (m, l) => { if (l) { m.comboCap += 50; m.shardMult *= 1.25; } } },
  { id: 'h_kinship', name: 'Many Hands', icon: 'floating-tentacles', branch: 'hybrid', x: -0.1, y: -6.5, max: 1, base: 5000, scale: 1, req: ['k_cascade', 'p_scale'],
    desc: 'Each level of Echo Hands also gives +10% production.', fx: (l) => (l ? '+10% production per Echo Hand' : 'Not grown yet'), apply: (m, l, s) => { if (l) m.prodAdd += 0.1 * (s.skills.k_echo ?? 0); } },
  { id: 'h_flare', name: 'Bioluminous Bloom', icon: 'jellyfish', branch: 'hybrid', x: 4.1, y: -6.4, max: 1, base: 7500, scale: 1, req: ['c_solar', 'p_patience'],
    desc: 'Glimmerfish boosts ×1.25 and rewards ×1.5.', fx: (l) => (l ? 'Boosts ×1.25, rewards ×1.5' : 'Not grown yet'), apply: (m, l) => { if (l) { m.buffPower *= 1.25; m.cometPower *= 1.5; } } },
  { id: 'h_chart', name: 'Old Sailor', icon: 'lighthouse', branch: 'hybrid', x: 7.7, y: -6.4, max: 1, base: 3750, scale: 1, req: ['c_feast'],
    desc: 'Glimmerfish come 10% more often and harvesters work 10% better while you are away.', fx: (l) => (l ? 'Wait ×0.9, +10% away' : 'Not grown yet'), apply: (m, l) => { if (l) { m.cometInterval *= 0.9; m.offlineEff += 0.1; } } },

  /* ---------------- Hadal ---------------- */
  { id: 'apex', name: 'The Sleeping Leviathan', icon: 'sperm-whale', branch: 'apex', x: -6, y: -7.5, max: 1, base: 2.5e+10, scale: 1, req: ['n_theory'],
    desc: 'At the very bottom, something wakes up and agrees to help. Production ×1000, taps ×1000, Black Pearls ×2.', fx: (l) => (l ? 'It is awake' : 'Still sleeping'), apply: (m, l) => { if (l) { m.prodMult *= 1000; m.clickMult *= 1000; m.shardMult *= 2; } } },
];

/* ---------------- Kinship: one per harvester, a two-sided canopy over the Harvest bough ---------------- */
GENERATORS.forEach((g, i) => {
  const left = i < 6;
  const k = left ? i : i - 6;
  S.push({
    id: `att${i}`,
    name: `${g.name} Kinship`,
    icon: g.icon,
    branch: 'attune',
    x: +(2 + (left ? -1 : 1) * 0.95 * (k + 1)).toFixed(2),
    y: +(-7.5 - 0.26 * k).toFixed(2),
    max: 5,
    base: Math.round(75 * 1.7 ** i),
    scale: 3.2,
    req: k === 0 ? ['p_horizon', left ? 'p_scale' : 'p_patience'] : [`att${i - 1}`],
    desc: `${g.plural} produce ×2, per level.`,
    fx: (l) => `${g.plural} ×${2 ** l}`,
    apply: (m, l) => (m.genMult[i] *= 2 ** l),
  });
});

export const SKILLS = S;
export const SKILL_MAP = new Map(S.map((s) => [s.id, s]));

export function skillCost(def: SkillDef, lvl: number): number {
  return Math.ceil(def.base * def.scale ** lvl);
}

export function skillUnlocked(def: SkillDef, skills: Record<string, number>): boolean {
  return def.req.length === 0 || def.req.some((r) => (skills[r] ?? 0) > 0);
}

export function totalSpent(skills: Record<string, number>): number {
  let total = 0;
  for (const [id, lvl] of Object.entries(skills)) {
    const def = SKILL_MAP.get(id);
    if (!def) continue;
    for (let i = 0; i < lvl; i++) total += skillCost(def, i);
  }
  return total;
}
