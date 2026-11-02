import type { Mods } from '../core/mods';
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
  apply: (m: Mods, lvl: number) => void;
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
  click: 'Engine',
  prod: 'Lamp & Haul',
  cosmos: 'Survival',
  nova: 'Salvage',
  hybrid: 'Confluence',
  attune: 'Kinship',
  apex: 'Hadal',
};

const S: SkillDef[] = [
  /* ---------------- Heart ---------------- */
  { id: 'ignition', name: 'First Polyp', icon: 'coral', branch: 'core', x: 0, y: 0, max: 1, base: 1, scale: 1, req: [],
    desc: 'Every reef starts somewhere. Lumen ×1.5 and +5s of air.',
    fx: (l) => (l ? 'Lumen ×1.5, +5s air' : 'Not grown yet'),
    apply: (m, l) => { if (l) { m.lumenMult *= 1.5; m.maxAir += 5; } } },
  /* ---------------- Engine (north) ---------------- */
  { id: 'k_touch', name: 'Tuned Screws', icon: 'boat-propeller', branch: 'click', x: -2, y: -1.4, max: 5, base: 1, scale: 2, req: ['ignition'],
    desc: '+8% speed, per level.',
    fx: (l) => `Speed +${8 * l}%`,
    apply: (m, l) => (m.speed *= 1 + 0.08 * l) },
  { id: 'k_rhythm', name: 'Rudder Fins', icon: 'fish-escape', branch: 'click', x: -3, y: -2.6, max: 4, base: 2, scale: 2, req: ['k_touch'],
    desc: '+15% handling: you turn and speed up faster, per level.',
    fx: (l) => `Handling +${15 * l}%`,
    apply: (m, l) => (m.accel *= 1 + 0.15 * l) },
  { id: 'k_luck', name: 'Collector\'s Rhythm', icon: 'musical-notes', branch: 'click', x: -1, y: -2.6, max: 5, base: 2, scale: 2, req: ['k_touch'],
    desc: 'Your plankton streak can go 10 higher, per level.',
    fx: (l) => `Streak cap +${10 * l}`,
    apply: (m, l) => (m.streakCap += 10 * l) },
  { id: 'k_echo', name: 'Overdrive Valve', icon: 'rocket-thruster', branch: 'click', x: -2, y: -2.9, max: 5, base: 3, scale: 2, req: ['k_touch'],
    desc: 'Dash cooldown 12% shorter, per level.',
    fx: (l) => `Dash cooldown ×${(0.88 ** l).toFixed(2)}`,
    apply: (m, l) => (m.dashCooldown *= 0.88 ** l) },
  { id: 'k_sustain', name: 'Streamlining', icon: 'water-drop', branch: 'click', x: -3.5, y: -3.8, max: 3, base: 4, scale: 2, req: ['k_rhythm'],
    desc: '+5% top speed, per level.',
    fx: (l) => `+${5 * l}% top speed`,
    apply: (m, l) => (m.speed *= 1 + 0.05 * l) },
  { id: 'k_cresc', name: 'Long Stroke', icon: 'fast-arrow', branch: 'click', x: -2.6, y: -3.9, max: 3, base: 6, scale: 3, req: ['k_rhythm'],
    desc: 'Dashes go 20% further, per level.',
    fx: (l) => `Dash power ×${(1 + 0.2 * l).toFixed(1)}`,
    apply: (m, l) => (m.dashPower *= 1 + 0.2 * l) },
  { id: 'k_shatter', name: 'Ram Plate', icon: 'spiked-shell', branch: 'click', x: -1.4, y: -3.9, max: 1, base: 4, scale: 2, req: ['k_luck'],
    desc: 'Dashing into a creature stuns it instead of hurting you.',
    fx: (l) => (l ? 'Ram through creatures' : 'Not grown yet'),
    apply: (m, l) => { if (l) m.dashRam = true; } },
  { id: 'k_conduit', name: 'Momentum', icon: 'sound-waves', branch: 'click', x: -0.5, y: -3.8, max: 3, base: 25, scale: 3, req: ['k_luck'],
    desc: 'Your streak waits 0.3s longer between pickups, per level.',
    fx: (l) => `+${(0.3 * l).toFixed(1)}s streak window`,
    apply: (m, l) => (m.streakWindow += 0.3 * l) },
  { id: 'k_perfect', name: 'Second Wind', icon: 'bubbles', branch: 'click', x: -3.1, y: -5.1, max: 1, base: 300, scale: 1, req: ['k_cresc', 'k_sustain'],
    desc: 'Every dash gives back 1s of air.',
    fx: (l) => (l ? '+1s air per dash' : 'Not grown yet'),
    apply: (m, l) => { if (l) m.dashAir += 1; } },
  { id: 'k_cascade', name: 'Twin Jets', icon: 'jet-pack', branch: 'click', x: -0.9, y: -5.1, max: 1, base: 625, scale: 1, req: ['k_shatter', 'k_conduit'],
    desc: 'The dash holds two charges.',
    fx: (l) => (l ? '2 dash charges' : 'Not grown yet'),
    apply: (m, l) => { if (l) m.dashCharges = 2; } },
  { id: 'k_cosmos', name: 'Twin Screws', icon: 'spinning-blades', branch: 'click', x: -2, y: -4.7, max: 1, base: 1500, scale: 1, req: ['k_echo'],
    desc: '+20% speed.',
    fx: (l) => (l ? 'Speed +20%' : 'Not grown yet'),
    apply: (m, l) => { if (l) m.speed *= 1.2; } },
  { id: 'k_god', name: 'Leviathan Engine', icon: 'kraken-tentacle', branch: 'click', x: -2, y: -6.1, max: 1, base: 100000, scale: 1, req: ['k_cosmos'],
    desc: '+30% speed and the dash recharges twice as fast.',
    fx: (l) => (l ? 'Speed +30%, dash ×2 faster' : 'Not grown yet'),
    apply: (m, l) => { if (l) { m.speed *= 1.3; m.dashCooldown *= 0.5; } } },
  /* ---------------- Lamp & haul (east) ---------------- */
  { id: 'p_fusion', name: 'Brighter Bulbs', icon: 'light-bulb', branch: 'prod', x: 2, y: -1.4, max: 10, base: 1, scale: 1.8, req: ['ignition'],
    desc: '+20% lumen from everything, per level.',
    fx: (l) => `Lumen +${20 * l}%`,
    apply: (m, l) => (m.lumenMult *= 1 + 0.2 * l) },
  { id: 'p_found', name: 'Wide Lens', icon: 'sun-radiations', branch: 'prod', x: 1, y: -2.6, max: 3, base: 4, scale: 4, req: ['p_fusion'],
    desc: 'Your lamp lights 10% further, per level.',
    fx: (l) => `Light +${10 * l}%`,
    apply: (m, l) => (m.light *= 1 + 0.1 * l) },
  { id: 'p_mid', name: 'Strong Magnet', icon: 'magnet', branch: 'prod', x: 2, y: -2.9, max: 3, base: 30, scale: 4, req: ['p_fusion'],
    desc: 'Magnet reaches 20% further, per level.',
    fx: (l) => `Magnet +${20 * l}%`,
    apply: (m, l) => (m.magnet *= 1 + 0.2 * l) },
  { id: 'p_super', name: 'Specimen Jars', icon: 'erlenmeyer', branch: 'prod', x: 3, y: -2.6, max: 3, base: 100, scale: 4, req: ['p_fusion'],
    desc: 'Plankton worth 25% more, per level.',
    fx: (l) => `Plankton ×${(1 + 0.25 * l).toFixed(2)}`,
    apply: (m, l) => (m.moteMult *= 1 + 0.25 * l) },
  { id: 'p_assembly', name: 'Fish Finder', icon: 'clownfish', branch: 'prod', x: 0.5, y: -3.8, max: 5, base: 8, scale: 2.5, req: ['p_found'],
    desc: 'Glimmerfish worth 30% more, per level.',
    fx: (l) => `Fish ×${(1 + 0.3 * l).toFixed(1)}`,
    apply: (m, l) => (m.fishMult *= 1 + 0.3 * l) },
  { id: 'p_scale', name: 'Lure Lamp', icon: 'angler-fish', branch: 'prod', x: 0.5, y: -5, max: 3, base: 300, scale: 6, req: ['p_assembly'],
    desc: 'Glimmerfish flee 20% slower, per level.',
    fx: (l) => `Fish flee ×${(0.8 ** l).toFixed(2)}`,
    apply: (m, l) => (m.fishFlee *= 0.8 ** l) },
  { id: 'p_reson', name: 'Treasure Nose', icon: 'open-treasure-chest', branch: 'prod', x: 3.5, y: -3.8, max: 3, base: 150, scale: 4, req: ['p_super'],
    desc: 'Chests turn up 50% more often, per level.',
    fx: (l) => `Chests ×${(1 + 0.5 * l).toFixed(1)}`,
    apply: (m, l) => (m.chestRate *= 1 + 0.5 * l) },
  { id: 'p_patience', name: 'Deep Value', icon: 'high-tide', branch: 'prod', x: 3.5, y: -5, max: 5, base: 200, scale: 3, req: ['p_reson'],
    desc: '+2% lumen for every 100 m you have gone this dive, per level.',
    fx: (l) => `+${2 * l}% per 100 m`,
    apply: (m, l) => (m.depthBonus += 0.02 * l) },
  { id: 'p_fame', name: 'Collector\'s Cabinet', icon: 'triple-shells', branch: 'prod', x: 2, y: -4.2, max: 1, base: 750, scale: 1, req: ['p_mid'],
    desc: 'Each Find gives another +1% lumen.',
    fx: (l) => (l ? '2% per Find' : 'Not grown yet'),
    apply: (m, l) => (m.achPer += 0.01 * l) },
  { id: 'p_supermass', name: 'Glow Farms', icon: 'fishing-net', branch: 'prod', x: 1.4, y: -5.25, max: 5, base: 1500, scale: 4, req: ['p_fame'],
    desc: 'Plankton farm output ×2, per level.',
    fx: (l) => `Farm ×${2 ** l}`,
    apply: (m, l) => (m.farmMult *= 2 ** l) },
  { id: 'p_dilation', name: 'Night Shift', icon: 'sands-of-time', branch: 'prod', x: 2.6, y: -5.25, max: 5, base: 1000, scale: 3, req: ['p_fame'],
    desc: 'The farm works 4h longer and 10% better while you are away, per level.',
    fx: (l) => `+${4 * l}h, +${10 * l}% away`,
    apply: (m, l) => { m.offlineCapH += 4 * l; m.offlineEff += 0.1 * l; } },
  { id: 'p_horizon', name: 'Bioluminescence', icon: 'jellyfish', branch: 'prod', x: 2, y: -6.3, max: 3, base: 750000, scale: 12, req: ['p_supermass', 'p_dilation'],
    desc: 'Lumen ×2, per level.',
    fx: (l) => `Lumen ×${2 ** l}`,
    apply: (m, l) => (m.lumenMult *= 2 ** l) },
  /* ---------------- Survival (south) ---------------- */
  { id: 'c_lure', name: 'Spare Tank', icon: 'air-zigzag', branch: 'cosmos', x: 6, y: -1.4, max: 5, base: 1, scale: 2, req: ['ignition'],
    desc: '+5s of air, per level.',
    fx: (l) => `+${5 * l}s air`,
    apply: (m, l) => (m.maxAir += 5 * l) },
  { id: 'c_bright', name: 'Thick Plating', icon: 'checked-shield', branch: 'cosmos', x: 7, y: -2.6, max: 3, base: 3, scale: 2, req: ['c_lure'],
    desc: '+1 hull, per level.',
    fx: (l) => `+${l} hull`,
    apply: (m, l) => (m.maxHull += l) },
  { id: 'c_expo', name: 'Air Recycler', icon: 'cycle', branch: 'cosmos', x: 5, y: -2.6, max: 5, base: 3, scale: 2, req: ['c_lure'],
    desc: 'Air drains 6% slower, per level.',
    fx: (l) => `Air drain ×${(0.94 ** l).toFixed(2)}`,
    apply: (m, l) => (m.airDrain *= 0.94 ** l) },
  { id: 'c_wish', name: 'Bubble Catcher', icon: 'bubbles', branch: 'cosmos', x: 6, y: -2.9, max: 5, base: 38, scale: 2.5, req: ['c_lure'],
    desc: 'Air bubbles give 30% more, per level.',
    fx: (l) => `Bubbles ×${(1 + 0.3 * l).toFixed(1)}`,
    apply: (m, l) => (m.airBubble *= 1 + 0.3 * l) },
  { id: 'c_twin', name: 'Shock Absorbers', icon: 'heart-plus', branch: 'cosmos', x: 6.6, y: -3.9, max: 3, base: 62, scale: 3, req: ['c_bright'],
    desc: 'After a hit you are safe 0.4s longer, per level.',
    fx: (l) => `+${(0.4 * l).toFixed(1)}s safety`,
    apply: (m, l) => (m.invuln += 0.4 * l) },
  { id: 'c_wander', name: 'Field Repairs', icon: 'gears', branch: 'cosmos', x: 7.5, y: -3.8, max: 1, base: 200, scale: 3, req: ['c_bright'],
    desc: 'Opening a chest patches 1 hull.',
    fx: (l) => (l ? 'Chests repair 1 hull' : 'Not grown yet'),
    apply: (m, l) => { if (l) m.chestRepair = true; } },
  { id: 'c_over', name: 'Flare Launcher', icon: 'sun-radiations', branch: 'cosmos', x: 4.5, y: -3.8, max: 1, base: 100, scale: 3, req: ['c_expo'],
    desc: 'Unlocks the Flare (F): a burst of light that stuns every creature nearby.',
    fx: (l) => (l ? 'Flare unlocked' : 'Not grown yet'),
    apply: (m, l) => { if (l) m.flare = true; } },
  { id: 'c_storm', name: 'Bright Flares', icon: 'star-formation', branch: 'cosmos', x: 5.4, y: -3.9, max: 3, base: 100, scale: 3, req: ['c_expo'],
    desc: 'Flares reach 25% further, per level.',
    fx: (l) => `Flare reach ×${(1 + 0.25 * l).toFixed(2)}`,
    apply: (m, l) => (m.flareRadius *= 1 + 0.25 * l) },
  { id: 'c_gravity', name: 'Escape Pod', icon: 'diving-helmet', branch: 'cosmos', x: 6, y: -4.7, max: 3, base: 300, scale: 1, req: ['c_wish'],
    desc: 'When the hull breaks you keep 15% more of the haul, per level.',
    fx: (l) => `Keep ${Math.round((0.5 + 0.15 * l) * 100)}% on breach`,
    apply: (m, l) => (m.keepOnBreach = Math.min(1, 0.5 + 0.15 * l)) },
  { id: 'c_feast', name: 'Eel Coil', icon: 'lightning-helix', branch: 'cosmos', x: 7.1, y: -5.1, max: 1, base: 3000, scale: 1, req: ['c_twin', 'c_wander'],
    desc: 'Zaps the nearest creature every 6 seconds.',
    fx: (l) => (l ? 'Auto-zap every 6s' : 'Not grown yet'),
    apply: (m, l) => { if (l) m.zapInterval = 6; } },
  { id: 'c_solar', name: 'Quick Flares', icon: 'stopwatch', branch: 'cosmos', x: 4.9, y: -5.1, max: 3, base: 2500, scale: 1, req: ['c_over', 'c_storm'],
    desc: 'Flare cooldown 20% shorter, per level.',
    fx: (l) => `Flare cooldown ×${(0.8 ** l).toFixed(2)}`,
    apply: (m, l) => (m.flareCooldown *= 0.8 ** l) },
  { id: 'c_meteor', name: 'Hadal Hull', icon: 'sea-urchin', branch: 'cosmos', x: 6, y: -6.1, max: 1, base: 100000, scale: 1, req: ['c_gravity'],
    desc: '+3 hull, and anglerfish bites only do 1 damage.',
    fx: (l) => (l ? '+3 hull, softer bites' : 'Not grown yet'),
    apply: (m, l) => { if (l) { m.maxHull += 3; m.anglerDamage = 1; } } },
  /* ---------------- Salvage (west) ---------------- */
  { id: 'n_yield', name: 'Black Oysters', icon: 'oyster', branch: 'nova', x: -6, y: -1.4, max: 10, base: 2, scale: 2.2, req: ['ignition'],
    desc: '+20% Black Pearls from rebuilding, per level.',
    fx: (l) => `Pearls ×${(1 + 0.2 * l).toFixed(1)}`,
    apply: (m, l) => (m.pearlMult *= 1 + 0.2 * l) },
  { id: 'n_start', name: 'Stocked Locker', icon: 'open-treasure-chest', branch: 'nova', x: -5, y: -2.6, max: 5, base: 5, scale: 4, req: ['n_yield'],
    desc: 'Start every rebuild with some lumen in the bank.',
    fx: (l) => (l ? `Start with ${fmt(100 * 10 ** l)}` : 'Not grown yet'),
    apply: (m, l) => { if (l) m.startLumen = Math.max(m.startLumen, 100 * 10 ** l); } },
  { id: 'n_found', name: 'Old Blueprints', icon: 'scroll-unfurled', branch: 'nova', x: -6, y: -2.9, max: 5, base: 8, scale: 1, req: ['n_yield'],
    desc: 'Keep 10% of your shop levels when you rebuild, per level.',
    fx: (l) => `Keep ${10 * l}% of levels`,
    apply: (m, l) => (m.keepShop += 0.1 * l) },
  { id: 'n_dream', name: 'Sleeping Reef', icon: 'night-sleep', branch: 'nova', x: -7, y: -2.6, max: 5, base: 4, scale: 2, req: ['n_yield'],
    desc: 'The farm works 10% better while you are away, per level.',
    fx: (l) => `+${10 * l}% away`,
    apply: (m, l) => (m.offlineEff += 0.1 * l) },
  { id: 'n_seed', name: 'Deep Mooring', icon: 'anchor', branch: 'nova', x: -4.5, y: -3.8, max: 4, base: 100, scale: 4, req: ['n_start'],
    desc: 'Every dive starts 50 m deeper, per level.',
    fx: (l) => `Start +${50 * l} m`,
    apply: (m, l) => (m.startDepth += 50 * l) },
  { id: 'n_memory', name: 'Captain\'s Log', icon: 'compass', branch: 'nova', x: -4.5, y: -5, max: 1, base: 625, scale: 1, req: ['n_seed'],
    desc: '+5% lumen for every 1000 m of your deepest ever dive.',
    fx: (l) => (l ? '+5% per 1000 m record' : 'Not grown yet'),
    apply: (m, l) => (m.recordBonus += 0.05 * l) },
  { id: 'n_drone', name: 'Auto Winch', icon: 'ship-wheel', branch: 'nova', x: -6, y: -4.2, max: 3, base: 100, scale: 1, req: ['n_found'],
    desc: '+10% lumen banked when a dive ends, per level.',
    fx: (l) => `+${10 * l}% banked`,
    apply: (m, l) => (m.bankBonus += 0.1 * l) },
  { id: 'n_slumber', name: 'Deep Sleep', icon: 'sleepy', branch: 'nova', x: -7.5, y: -3.8, max: 5, base: 8, scale: 2.5, req: ['n_dream'],
    desc: 'The farm keeps going 4h longer while you are away, per level.',
    fx: (l) => `${8 + 4 * l}h away limit`,
    apply: (m, l) => (m.offlineCapH += 4 * l) },
  { id: 'n_trials', name: 'Pearl Diver', icon: 'oyster-pearl', branch: 'nova', x: -7.5, y: -5, max: 3, base: 150, scale: 1, req: ['n_slumber', 'n_drone'],
    desc: 'Chests hold a Black Pearl 5% more often, per level.',
    fx: (l) => `+${5 * l}% pearl chance`,
    apply: (m, l) => (m.chestPearl += 0.05 * l) },
  { id: 'n_resonance', name: 'Pearl Luster', icon: 'kaleidoscope-pearls', branch: 'nova', x: -6.6, y: -5.25, max: 4, base: 200, scale: 5, req: ['n_drone'],
    desc: 'Each Black Pearl you have ever found gives +1% more lumen, per level.',
    fx: (l) => `${5 + l}% per pearl`,
    apply: (m, l) => (m.pearlPer += 0.01 * l) },
  { id: 'n_cycle', name: 'Salvage Rights', icon: 'ship-wreck', branch: 'nova', x: -5.4, y: -5.25, max: 1, base: 6250, scale: 1, req: ['n_drone'],
    desc: 'Rebuilding also pays a pearl for every 500 m of this sub\'s deepest dive.',
    fx: (l) => (l ? '+1 pearl per 500 m' : 'Not grown yet'),
    apply: (m, l) => { if (l) m.depthPearls = true; } },
  { id: 'n_theory', name: 'Hadal Survey', icon: 'mini-submarine', branch: 'nova', x: -6, y: -6.3, max: 2, base: 5000000, scale: 20, req: ['n_resonance', 'n_cycle'],
    desc: 'The pearl formula exponent goes up by 0.03, per level.',
    fx: (l) => `Exponent ${(0.4 + 0.03 * l).toFixed(2)}`,
    apply: (m, l) => (m.pearlExp += 0.03 * l) },
  { id: 'apex', name: 'The Sleeping Leviathan', icon: 'sperm-whale', branch: 'apex', x: -6, y: -7.5, max: 1, base: 2.5e10, scale: 1, req: ['n_theory'],
    desc: 'At the very bottom something wakes and agrees to help. Lumen ×10, speed +25%, +20s air.',
    fx: (l) => (l ? 'It is awake' : 'Still sleeping'),
    apply: (m, l) => { if (l) { m.lumenMult *= 10; m.speed *= 1.25; m.maxAir += 20; } } },
  /* ---------------- Confluence ---------------- */
  { id: 'h_rhythmic', name: 'Sea Shanty', icon: 'musical-notes', branch: 'hybrid', x: -3.9, y: -6.4, max: 1, base: 6250, scale: 1, req: ['k_perfect', 'n_memory'],
    desc: '+20 streak cap, and each streak step is worth twice as much.',
    fx: (l) => (l ? '+20 cap, streak ×2' : 'Not grown yet'),
    apply: (m, l) => { if (l) { m.streakCap += 20; m.streakPer *= 2; } } },
  { id: 'h_kinship', name: 'Bow Net', icon: 'fishing-net', branch: 'hybrid', x: -0.1, y: -6.5, max: 1, base: 5000, scale: 1, req: ['k_cascade', 'p_scale'],
    desc: 'Magnet reaches 30% further.',
    fx: (l) => (l ? 'Magnet +30%' : 'Not grown yet'),
    apply: (m, l) => { if (l) m.magnet *= 1.3; } },
  { id: 'h_flare', name: 'Flare Bloom', icon: 'spiral-bloom', branch: 'hybrid', x: 4.1, y: -6.4, max: 1, base: 7500, scale: 1, req: ['c_solar', 'p_patience'],
    desc: 'Flares also pull in every plankton mote on screen.',
    fx: (l) => (l ? 'Flares pull plankton' : 'Not grown yet'),
    apply: (m, l) => { if (l) m.flarePull = true; } },
  { id: 'h_chart', name: 'Old Sailor', icon: 'lighthouse', branch: 'hybrid', x: 7.7, y: -6.4, max: 1, base: 3750, scale: 1, req: ['c_feast'],
    desc: 'Dive conditions turn up twice as often.',
    fx: (l) => (l ? 'Conditions ×2' : 'Not grown yet'),
    apply: (m, l) => { if (l) m.eventRate = Math.min(1, m.eventRate * 2); } },
];

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
