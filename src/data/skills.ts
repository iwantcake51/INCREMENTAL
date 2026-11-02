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
  /** Requires ANY of these skills at level ≥ 1. Empty = root. */
  req: string[];
  desc: string;
  /** Human-readable total effect at a given level. */
  fx: (lvl: number) => string;
  apply: (m: Mods, lvl: number, s: GameState) => void;
}

export const BRANCH_HUE: Record<Branch, number> = {
  core: 48,
  click: 42,
  prod: 270,
  cosmos: 190,
  nova: 18,
  hybrid: 330,
  attune: 150,
  apex: 0,
};

export const BRANCH_LABEL: Record<Branch, string> = {
  core: 'Core',
  click: 'Touch',
  prod: 'Forge',
  cosmos: 'Cosmos',
  nova: 'Nova',
  hybrid: 'Confluence',
  attune: 'Attunement',
  apex: 'Apex',
};

const x = (v: number) => fmt(v);
const S: SkillDef[] = [
  /* ---------------- Core ---------------- */
  {
    id: 'ignition', name: 'Ignition', icon: 'sunbeams', branch: 'core', x: 0, y: 0, max: 1, base: 1, scale: 1, req: [],
    desc: 'The first star in your constellation. Production ×2 and click power ×2.',
    fx: (l) => (l ? 'Production ×2, clicks ×2' : 'Inactive'),
    apply: (m, l) => { if (l) { m.prodMult *= 2; m.clickMult *= 2; } },
  },

  /* ---------------- Touch (north) ---------------- */
  { id: 'k_touch', name: 'Kinetic Touch', icon: 'pointing', branch: 'click', x: 0, y: -1.2, max: 5, base: 1, scale: 2, req: ['ignition'],
    desc: '+100% click power per level.', fx: (l) => `Clicks ×${1 + l}`, apply: (m, l) => (m.clickMult *= 1 + l) },
  { id: 'k_rhythm', name: 'Rhythm Engine', icon: 'musical-notes', branch: 'click', x: -1.1, y: -2.1, max: 4, base: 2, scale: 2, req: ['k_touch'],
    desc: '+25 maximum combo per level.', fx: (l) => `+${25 * l} combo cap`, apply: (m, l) => (m.comboCap += 25 * l) },
  { id: 'k_luck', name: 'Lucky Strike', icon: 'clover', branch: 'click', x: 1.1, y: -2.1, max: 5, base: 2, scale: 2, req: ['k_touch'],
    desc: '+3% critical click chance per level.', fx: (l) => `+${3 * l}% crit chance`, apply: (m, l) => (m.critChance += 0.03 * l) },
  { id: 'k_echo', name: 'Echo Hands', icon: 'echo-ripples', branch: 'click', x: 0, y: -2.6, max: 10, base: 3, scale: 2, req: ['k_touch'],
    desc: 'An echo of your hand clicks the star once per second, per level.', fx: (l) => `${l} auto-clicks/s`, apply: (m, l) => (m.autoClickRate += l) },
  { id: 'k_sustain', name: 'Sustain', icon: 'sands-of-time', branch: 'click', x: -2.2, y: -2.8, max: 3, base: 4, scale: 2, req: ['k_rhythm'],
    desc: 'Combo lingers +0.5s longer per level.', fx: (l) => `+${0.5 * l}s combo window`, apply: (m, l) => (m.comboDecay += 0.5 * l) },
  { id: 'k_cresc', name: 'Crescendo', icon: 'sound-waves', branch: 'click', x: -1.4, y: -3.4, max: 3, base: 6, scale: 3, req: ['k_rhythm'],
    desc: 'Each combo stack gives +0.5% more per level.', fx: (l) => `+${0.5 * l}% per stack`, apply: (m, l) => (m.comboPer += 0.005 * l) },
  { id: 'k_shatter', name: 'Shatterpoint', icon: 'spiky-explosion', branch: 'click', x: 2.2, y: -2.8, max: 5, base: 4, scale: 2, req: ['k_luck'],
    desc: 'Critical clicks deal +5× more per level.', fx: (l) => `+${5 * l}× crit power`, apply: (m, l) => (m.critMult += 5 * l) },
  { id: 'k_conduit', name: 'Conduit', icon: 'lightning-arc', branch: 'click', x: 1.4, y: -3.4, max: 5, base: 10, scale: 3, req: ['k_luck'],
    desc: 'Clicks gain +1% of production per level.', fx: (l) => `+${l}% of production per click`, apply: (m, l) => (m.clickCpsPct += 0.01 * l) },
  { id: 'k_perfect', name: 'Perfect Rhythm', icon: 'infinity', branch: 'click', x: -2.6, y: -4.1, max: 1, base: 120, scale: 1, req: ['k_cresc', 'k_sustain'],
    desc: 'Auto-clicks build and sustain your combo.', fx: (l) => (l ? 'Echoes keep the beat' : 'Inactive'), apply: (m, l) => { if (l) m.autoClickCombo = true; } },
  { id: 'k_cascade', name: 'Cascade', icon: 'crystal-shine', branch: 'click', x: 2.6, y: -4.1, max: 1, base: 250, scale: 1, req: ['k_shatter', 'k_conduit'],
    desc: '+10% crit chance. Critical clicks add +5 combo.', fx: (l) => (l ? '+10% crit, crits chain combo' : 'Inactive'), apply: (m, l) => { if (l) { m.critChance += 0.1; m.critCombo = true; } } },
  { id: 'k_cosmos', name: 'Hand of the Cosmos', icon: 'glowing-hands', branch: 'click', x: 0, y: -4.0, max: 1, base: 600, scale: 1, req: ['k_echo'],
    desc: 'Click power ×10.', fx: (l) => (l ? 'Clicks ×10' : 'Inactive'), apply: (m, l) => { if (l) m.clickMult *= 10; } },
  { id: 'k_god', name: 'Godhand', icon: 'hand-of-god', branch: 'click', x: 0, y: -5.4, max: 1, base: 40000, scale: 1, req: ['k_cosmos'],
    desc: 'Click power ×25 and +10 auto-clicks/s.', fx: (l) => (l ? 'Clicks ×25, +10 echoes' : 'Inactive'), apply: (m, l) => { if (l) { m.clickMult *= 25; m.autoClickRate += 10; } } },

  /* ---------------- Forge (east) ---------------- */
  { id: 'p_fusion', name: 'Stellar Fusion', icon: 'atom', branch: 'prod', x: 1.2, y: 0, max: 10, base: 1, scale: 1.8, req: ['ignition'],
    desc: '+25% production per level.', fx: (l) => `+${25 * l}% production`, apply: (m, l) => (m.prodAdd += 0.25 * l) },
  { id: 'p_found', name: 'Foundations', icon: 'gear-hammer', branch: 'prod', x: 2.2, y: -0.9, max: 3, base: 4, scale: 4, req: ['p_fusion'],
    desc: 'Generators 1–4 produce ×3 per level.', fx: (l) => `Gens 1–4 ×${x(3 ** l)}`, apply: (m, l) => { for (let i = 0; i < 4; i++) m.genMult[i] *= 3 ** l; } },
  { id: 'p_mid', name: 'Mid-Tier Mastery', icon: 'gears', branch: 'prod', x: 2.6, y: 0, max: 3, base: 12, scale: 4, req: ['p_fusion'],
    desc: 'Generators 5–8 produce ×3 per level.', fx: (l) => `Gens 5–8 ×${x(3 ** l)}`, apply: (m, l) => { for (let i = 4; i < 8; i++) m.genMult[i] *= 3 ** l; } },
  { id: 'p_super', name: 'Superstructures', icon: 'big-gear', branch: 'prod', x: 2.2, y: 0.9, max: 3, base: 40, scale: 4, req: ['p_fusion'],
    desc: 'Generators 9–12 produce ×3 per level.', fx: (l) => `Gens 9–12 ×${x(3 ** l)}`, apply: (m, l) => { for (let i = 8; i < 12; i++) m.genMult[i] *= 3 ** l; } },
  { id: 'p_assembly', name: 'Efficient Assembly', icon: 'cog', branch: 'prod', x: 3.4, y: -1.6, max: 5, base: 8, scale: 2.5, req: ['p_found'],
    desc: 'Generators cost 8% less per level.', fx: (l) => `Costs ×${(0.92 ** l).toFixed(2)}`, apply: (m, l) => (m.costMult *= 0.92 ** l) },
  { id: 'p_scale', name: 'Economies of Scale', icon: 'scales', branch: 'prod', x: 4.6, y: -1.9, max: 3, base: 120, scale: 6, req: ['p_assembly'],
    desc: 'Generator price growth −0.005 per level.', fx: (l) => `Growth ${(1.15 - 0.005 * l).toFixed(3)}`, apply: (m, l) => (m.costGrowth -= 0.005 * l) },
  { id: 'p_reson', name: 'Resonance Web', icon: 'spider-web', branch: 'prod', x: 3.4, y: 1.6, max: 3, base: 60, scale: 4, req: ['p_super'],
    desc: '+5% production per level for each generator type you own.', fx: (l) => `+${5 * l}% per type owned`, apply: (m, l) => (m.resonance += 0.05 * l) },
  { id: 'p_patience', name: 'Patience', icon: 'hourglass', branch: 'prod', x: 4.6, y: 1.9, max: 5, base: 80, scale: 3, req: ['p_reson'],
    desc: 'Production grows +1% every 10s this run, up to +100% per level.', fx: (l) => `Up to +${100 * l}%`, apply: (m, l) => (m.patienceCap += l) },
  { id: 'p_fame', name: 'Hall of Fame', icon: 'laurels-trophy', branch: 'prod', x: 4.0, y: 0, max: 1, base: 300, scale: 1, req: ['p_mid'],
    desc: 'Each achievement gives an extra +1% production.', fx: (l) => (l ? '2% per achievement' : 'Inactive'), apply: (m, l) => (m.achPer += 0.01 * l) },
  { id: 'p_supermass', name: 'Supermassive', icon: 'planet-core', branch: 'prod', x: 5.2, y: -0.8, max: 5, base: 600, scale: 4, req: ['p_fame'],
    desc: 'Production ×2 per level.', fx: (l) => `Production ×${2 ** l}`, apply: (m, l) => (m.prodMult *= 2 ** l) },
  { id: 'p_dilation', name: 'Time Dilation', icon: 'stopwatch', branch: 'prod', x: 5.2, y: 0.8, max: 5, base: 400, scale: 3, req: ['p_fame'],
    desc: 'Production ×1.25 and +5% offline efficiency per level.', fx: (l) => `×${(1.25 ** l).toFixed(2)}, +${5 * l}% offline`, apply: (m, l) => { m.prodMult *= 1.25 ** l; m.offlineEff += 0.05 * l; } },
  { id: 'p_horizon', name: 'Event Horizon', icon: 'eclipse-flare', branch: 'prod', x: 6.4, y: 0, max: 3, base: 300_000, scale: 12, req: ['p_supermass', 'p_dilation'],
    desc: 'Raise total production to the power +0.02 per level.', fx: (l) => `Production ^${(1 + 0.02 * l).toFixed(2)}`, apply: (m, l) => (m.prodExp += 0.02 * l) },

  /* ---------------- Cosmos (south) ---------------- */
  { id: 'c_lure', name: 'Comet Lure', icon: 'comet-spark', branch: 'cosmos', x: 0, y: 1.2, max: 5, base: 1, scale: 2, req: ['ignition'],
    desc: 'Comets appear 10% more often per level.', fx: (l) => `Interval ×${(0.9 ** l).toFixed(2)}`, apply: (m, l) => (m.cometInterval *= 0.9 ** l) },
  { id: 'c_bright', name: 'Bright Tails', icon: 'star-prominences', branch: 'cosmos', x: -1.1, y: 2.1, max: 5, base: 3, scale: 2, req: ['c_lure'],
    desc: 'Comet rewards +20% per level.', fx: (l) => `Rewards ×${(1 + 0.2 * l).toFixed(1)}`, apply: (m, l) => (m.cometPower *= 1 + 0.2 * l) },
  { id: 'c_expo', name: 'Long Exposure', icon: 'sundial', branch: 'cosmos', x: 1.1, y: 2.1, max: 5, base: 3, scale: 2, req: ['c_lure'],
    desc: 'Comet buffs last 15% longer per level.', fx: (l) => `Duration ×${(1 + 0.15 * l).toFixed(2)}`, apply: (m, l) => (m.buffDuration *= 1 + 0.15 * l) },
  { id: 'c_wish', name: 'Wishing Star', icon: 'falling-star', branch: 'cosmos', x: 0, y: 2.6, max: 5, base: 15, scale: 2.5, req: ['c_lure'],
    desc: 'Each manual click has a 1% chance per level to grant 10s of production.', fx: (l) => `${l}% wish chance`, apply: (m, l) => (m.wishChance += 0.01 * l) },
  { id: 'c_twin', name: 'Twin Comets', icon: 'perpendicular-rings', branch: 'cosmos', x: -2.2, y: 2.8, max: 3, base: 25, scale: 3, req: ['c_bright'],
    desc: '10% chance per level for a comet to bring a twin.', fx: (l) => `${10 * l}% twin chance`, apply: (m, l) => (m.twinCometChance += 0.1 * l) },
  { id: 'c_wander', name: 'Wandering Stars', icon: 'star-cycle', branch: 'cosmos', x: -1.4, y: 3.4, max: 3, base: 80, scale: 3, req: ['c_bright'],
    desc: 'Each comet caught this run gives +1% production per level.', fx: (l) => `+${l}% per comet this run`, apply: (m, l) => (m.wanderPer += 0.01 * l) },
  { id: 'c_over', name: 'Overdrive', icon: 'fire', branch: 'cosmos', x: 2.2, y: 2.8, max: 3, base: 40, scale: 3, req: ['c_expo'],
    desc: 'Frenzy multiplier +3 per level.', fx: (l) => `Frenzy ×${7 + 3 * l}`, apply: (m, l) => (m.frenzyMult += 3 * l) },
  { id: 'c_storm', name: 'Thunderclap', icon: 'lightning-helix', branch: 'cosmos', x: 1.4, y: 3.4, max: 3, base: 40, scale: 3, req: ['c_expo'],
    desc: 'Click Storm multiplier +33 per level.', fx: (l) => `Click Storm ×${77 + 33 * l}`, apply: (m, l) => (m.clickstormMult += 33 * l) },
  { id: 'c_gravity', name: 'Gravity Well', icon: 'magnet', branch: 'cosmos', x: 0, y: 4.0, max: 1, base: 120, scale: 1, req: ['c_wish'],
    desc: 'Comets are caught automatically before they fly away.', fx: (l) => (l ? 'Auto-catch comets' : 'Inactive'), apply: (m, l) => { if (l) m.cometAuto = true; } },
  { id: 'c_feast', name: 'Celestial Feast', icon: 'spiral-bloom', branch: 'cosmos', x: -2.6, y: 4.1, max: 1, base: 1200, scale: 1, req: ['c_twin', 'c_wander'],
    desc: 'All comet buffs are 50% stronger.', fx: (l) => (l ? 'Buffs ×1.5' : 'Inactive'), apply: (m, l) => { if (l) m.buffPower *= 1.5; } },
  { id: 'c_solar', name: 'Solar Wind', icon: 'tornado', branch: 'cosmos', x: 2.6, y: 4.1, max: 1, base: 1000, scale: 1, req: ['c_over', 'c_storm'],
    desc: 'Comet rewards ×2 and buffs last 20% longer.', fx: (l) => (l ? 'Rewards ×2, duration ×1.2' : 'Inactive'), apply: (m, l) => { if (l) { m.cometPower *= 2; m.buffDuration *= 1.2; } } },
  { id: 'c_meteor', name: 'Meteor Storm', icon: 'burning-meteor', branch: 'cosmos', x: 0, y: 5.4, max: 1, base: 40000, scale: 1, req: ['c_gravity'],
    desc: 'Comets appear twice as often and rewards ×3.', fx: (l) => (l ? 'Interval ×0.5, rewards ×3' : 'Inactive'), apply: (m, l) => { if (l) { m.cometInterval *= 0.5; m.cometPower *= 3; } } },

  /* ---------------- Nova (west) ---------------- */
  { id: 'n_yield', name: 'Nova Yield', icon: 'crystal-growth', branch: 'nova', x: -1.2, y: 0, max: 10, base: 2, scale: 2.2, req: ['ignition'],
    desc: '+20% Nova Shards from Supernovas per level.', fx: (l) => `Shards ×${(1 + 0.2 * l).toFixed(1)}`, apply: (m, l) => (m.shardMult *= 1 + 0.2 * l) },
  { id: 'n_start', name: 'Head Start', icon: 'energy-arrow', branch: 'nova', x: -2.2, y: -0.9, max: 5, base: 5, scale: 4, req: ['n_yield'],
    desc: 'Begin each run with more Stardust.', fx: (l) => (l ? `Start with ${x(10 ** (1 + 2 * l))}` : 'Inactive'), apply: (m, l) => { if (l) m.startStardust = Math.max(m.startStardust, 10 ** (1 + 2 * l)); } },
  { id: 'n_found', name: 'Automated Foundry', icon: 'robot-grab', branch: 'nova', x: -2.6, y: 0, max: 1, base: 8, scale: 1, req: ['n_yield'],
    desc: 'Unlocks the generator autobuyer.', fx: (l) => (l ? 'Autobuyer online' : 'Inactive'), apply: (m, l) => { if (l) m.autoGens = true; } },
  { id: 'n_dream', name: 'Dream Engine', icon: 'dream-catcher', branch: 'nova', x: -2.2, y: 0.9, max: 5, base: 4, scale: 2, req: ['n_yield'],
    desc: '+10% offline efficiency per level.', fx: (l) => `+${10 * l}% offline`, apply: (m, l) => (m.offlineEff += 0.1 * l) },
  { id: 'n_seed', name: 'Seed Stars', icon: 'sprout', branch: 'nova', x: -3.4, y: -1.6, max: 4, base: 40, scale: 4, req: ['n_start'],
    desc: 'Start each run with 10 of the first 2 generators per level.', fx: (l) => (l ? `10 each of gens 1–${2 * l}` : 'Inactive'), apply: (m, l) => (m.startGens = Math.max(m.startGens, 2 * l)) },
  { id: 'n_memory', name: 'Memory of Light', icon: 'crystal-ball', branch: 'nova', x: -4.6, y: -1.9, max: 1, base: 250, scale: 1, req: ['n_seed'],
    desc: 'Keep click, crit, combo, comet and global upgrades through Supernovas.', fx: (l) => (l ? 'Upgrades remembered' : 'Inactive'), apply: (m, l) => { if (l) m.keepUpgrades = true; } },
  { id: 'n_drone', name: 'Procurement Drone', icon: 'vintage-robot', branch: 'nova', x: -4.0, y: 0, max: 1, base: 40, scale: 1, req: ['n_found'],
    desc: 'Unlocks the upgrade autobuyer.', fx: (l) => (l ? 'Drone online' : 'Inactive'), apply: (m, l) => { if (l) m.autoUpgrades = true; } },
  { id: 'n_slumber', name: 'Long Slumber', icon: 'night-sleep', branch: 'nova', x: -3.4, y: 1.6, max: 5, base: 8, scale: 2.5, req: ['n_dream'],
    desc: '+4 hours of maximum offline time per level.', fx: (l) => `${8 + 4 * l}h offline cap`, apply: (m, l) => (m.offlineCapH += 4 * l) },
  { id: 'n_trials', name: 'Trials of the Void', icon: 'crossed-swords', branch: 'nova', x: -4.6, y: 1.9, max: 1, base: 60, scale: 1, req: ['n_slumber', 'n_drone'],
    desc: 'Unlocks Trials: restricted runs with permanent rewards.', fx: (l) => (l ? 'Trials unlocked' : 'Inactive'), apply: (m, l) => { if (l) m.trialsUnlocked = true; } },
  { id: 'n_resonance', name: 'Nova Resonance', icon: 'rolling-energy', branch: 'nova', x: -5.2, y: -0.8, max: 4, base: 80, scale: 5, req: ['n_drone'],
    desc: 'Each Nova Shard ever earned gives +0.5% more production per level.', fx: (l) => `${1 + 0.5 * l}% per shard`, apply: (m, l) => (m.shardPer += 0.005 * l) },
  { id: 'n_cycle', name: 'Cycle Engine', icon: 'recycle', branch: 'nova', x: -5.2, y: 0.8, max: 1, base: 2500, scale: 1, req: ['n_drone'],
    desc: 'Unlocks auto-Supernova at a shard target of your choice.', fx: (l) => (l ? 'Auto-Supernova online' : 'Inactive'), apply: (m, l) => { if (l) m.autoRebirth = true; } },
  { id: 'n_theory', name: 'Supernova Theory', icon: 'open-book', branch: 'nova', x: -6.4, y: 0, max: 2, base: 2_000_000, scale: 20, req: ['n_resonance', 'n_cycle'],
    desc: 'Shard formula exponent +0.02 per level.', fx: (l) => `Exponent ${(0.25 + 0.02 * l).toFixed(2)}`, apply: (m, l) => (m.shardExp += 0.02 * l) },

  /* ---------------- Confluence (diagonals) ---------------- */
  { id: 'h_rhythmic', name: 'Rhythmic Rebirth', icon: 'yin-yang', branch: 'hybrid', x: -3.7, y: -3.5, max: 1, base: 2500, scale: 1, req: ['k_perfect', 'n_memory'],
    desc: '+50 combo cap and Nova Shards ×1.25.', fx: (l) => (l ? '+50 combo, shards ×1.25' : 'Inactive'), apply: (m, l) => { if (l) { m.comboCap += 50; m.shardMult *= 1.25; } } },
  { id: 'h_kinship', name: 'Kinship', icon: 'linked-rings', branch: 'hybrid', x: 3.7, y: -3.5, max: 1, base: 2000, scale: 1, req: ['k_cascade', 'p_scale'],
    desc: 'Each level of Echo Hands also gives +10% production.', fx: (l) => (l ? '+10% production per Echo' : 'Inactive'), apply: (m, l, s) => { if (l) m.prodAdd += 0.1 * (s.skills.k_echo ?? 0); } },
  { id: 'h_flare', name: 'Solar Flare', icon: 'sun', branch: 'hybrid', x: 3.7, y: 3.5, max: 1, base: 3000, scale: 1, req: ['c_solar', 'p_patience'],
    desc: 'Buffs ×1.25 and comet rewards ×1.5.', fx: (l) => (l ? 'Buffs ×1.25, rewards ×1.5' : 'Inactive'), apply: (m, l) => { if (l) { m.buffPower *= 1.25; m.cometPower *= 1.5; } } },
  { id: 'h_chart', name: 'Stellar Cartography', icon: 'compass', branch: 'hybrid', x: -3.7, y: 3.5, max: 1, base: 1500, scale: 1, req: ['c_feast', 'n_trials'],
    desc: 'Comets appear 10% more often and +10% offline efficiency.', fx: (l) => (l ? 'Interval ×0.9, +10% offline' : 'Inactive'), apply: (m, l) => { if (l) { m.cometInterval *= 0.9; m.offlineEff += 0.1; } } },

  /* ---------------- Apex ---------------- */
  { id: 'apex', name: 'Singularity', icon: 'magic-swirl', branch: 'apex', x: -7.8, y: 0, max: 1, base: 1e10, scale: 1, req: ['n_theory'],
    desc: 'Everything you have built folds into one point. Production ×1000, clicks ×1000, shards ×2.', fx: (l) => (l ? 'You are the universe' : 'Inactive'), apply: (m, l) => { if (l) { m.prodMult *= 1000; m.clickMult *= 1000; m.shardMult *= 2; } } },
];

/* ---------------- Attunements: one per generator, two arcs ---------------- */
GENERATORS.forEach((g, i) => {
  const upper = i < 6;
  const k = upper ? i : i - 6;
  const deg = (upper ? -27 - 9 * k : 27 + 9 * k) * (Math.PI / 180);
  const r = 6.2;
  S.push({
    id: `att${i}`,
    name: `${g.name} Attunement`,
    icon: g.icon,
    branch: 'attune',
    x: +(r * Math.cos(deg)).toFixed(2),
    y: +(r * Math.sin(deg)).toFixed(2),
    max: 5,
    base: Math.round(30 * 1.7 ** i),
    scale: 3.2,
    req: [k === 0 ? (upper ? 'p_scale' : 'p_patience') : `att${i - 1}`],
    desc: `${g.plural} produce ×2 per level.`,
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

