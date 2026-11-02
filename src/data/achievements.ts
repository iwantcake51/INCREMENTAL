import type { GameState } from '../core/state';
import { GENERATORS } from './generators';
import { SKILLS } from './skills';
import { TRIALS } from './trials';
import { fmt, fmtInt } from '../core/format';

export interface AchCtx {
  cps: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  secret?: boolean;
  check: (s: GameState, c: AchCtx) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [];
const add = (a: AchievementDef) => ACHIEVEMENTS.push(a);

const ladder = (
  prefix: string,
  icon: string,
  steps: [number, string][],
  desc: (n: number) => string,
  value: (s: GameState, c: AchCtx) => number,
) => {
  steps.forEach(([n, name], i) => add({ id: `${prefix}${i}`, name, icon, desc: desc(n), check: (s, c) => value(s, c) >= n }));
};

ladder('earn', 'water-drop', [
  [100, 'A Faint Glow'], [1e3, 'Night Light'], [1e4, 'Lamp Oil'], [1e5, 'Bucket of Light'], [1e6, 'A Million Motes'],
  [1e8, 'Lit Cabin'], [1e10, 'Harbour Lights'], [1e12, 'Glowing Tide'], [1e15, 'Bright Reef'],
  [1e18, 'Lantern Sea'], [1e21, 'No More Night'], [1e24, 'Visible From Space'], [1e30, 'Every Ocean'], [1e36, 'Every World\'s Ocean'],
  [1e45, 'Past Counting'], [1e60, 'Drowned in Light'], [1e80, 'One Lumen per Atom'], [1e100, 'Googol, Glowing'],
], (n) => `Gather ${fmt(n)} lumen in total.`, (s) => s.totalEarned);

ladder('cps', 'waves', [
  [1, 'Trickle'], [10, 'Drip Line'], [100, 'Steady Flow'], [1e3, 'Spring Tide'], [1e5, 'Undertow'], [1e7, 'Rogue Wave'],
  [1e10, 'Maelstrom'], [1e15, 'Ocean Current'], [1e20, 'Planetary Tide'], [1e30, 'The Sea Breathes Light'],
], (n) => `Produce ${fmt(n)} lumen a second.`, (_s, c) => c.cps);

ladder('click', 'pointing', [
  [1, 'Hello, Lure'], [100, 'Curious Fingers'], [1000, 'Regular Tapper'], [5000, 'Wrinkly Fingers'], [25_000, 'Webbed Hands'], [100_000, 'The Tapper of the Deep'],
], (n) => (n === 1 ? 'Tap the lure for the first time.' : `Tap the lure ${fmtInt(n)} times.`), (s) => s.stats.clicks);

ladder('clickearn', 'glowing-hands', [
  [1e3, 'Handmade'], [1e6, 'Hand-Caught'], [1e9, 'Manual Labour'], [1e15, 'Strong Wrists'], [1e24, 'Palm of the Ocean'],
], (n) => `Gather ${fmt(n)} lumen by tapping.`, (s) => s.stats.clickEarned);

ladder('crit', 'clover', [[1, 'Lucky!'], [100, 'Charmed'], [1000, 'Born Under a Pearl Moon']],
  (n) => (n === 1 ? 'Land a lucky tap.' : `Land ${fmtInt(n)} lucky taps.`), (s) => s.stats.crits);

ladder('combo', 'musical-notes', [[25, 'Humming Along'], [50, 'Shanty Time'], [100, 'Full Chorus'], [200, 'The Whole Crew Sings']],
  (n) => `Keep a streak of ${n} taps going.`, (s) => s.stats.bestCombo);

GENERATORS.forEach((g) => {
  add({ id: `gen${g.id}a`, name: `First ${g.name}`, icon: g.icon, desc: `Build a ${g.name}.`, check: (s) => s.gens[g.id] >= 1 });
  add({ id: `gen${g.id}b`, name: `${g.name} Fleet`, icon: g.icon, desc: `Own 100 ${g.plural}.`, check: (s) => s.gens[g.id] >= 100 });
  add({ id: `gen${g.id}c`, name: `${g.name} Armada`, icon: g.icon, desc: `Own 250 ${g.plural}.`, check: (s) => s.gens[g.id] >= 250 });
});

const totalGens = (s: GameState) => s.gens.reduce((a, b) => a + b, 0);
ladder('gens', 'gears', [[100, 'Busy Waters'], [500, 'Crowded Reef'], [1000, 'Undersea Town'], [2500, 'Drowned City']],
  (n) => `Own ${fmtInt(n)} harvesters at once.`, totalGens);

ladder('upg', 'upgrade', [[10, 'Tinkerer'], [50, 'Shipwright'], [150, 'Chief Engineer'], [500, 'Old Salt']],
  (n) => `Buy ${n} upgrades in total.`, (s) => s.stats.upgradesBought);

ladder('comet', 'fishing-lure', [[1, 'Got One!'], [10, 'Net Gains'], [50, 'Fish Whisperer'], [200, 'Shoal Keeper'], [1000, 'Glimmer King']],
  (n) => (n === 1 ? 'Catch a glimmerfish.' : `Catch ${fmtInt(n)} glimmerfish.`), (s) => s.stats.comets);

ladder('event', 'high-tide', [[1, 'Weather Eye'], [10, 'Seasoned'], [50, 'Weathered'], [200, 'Knows Every Tide']],
  (n) => (n === 1 ? 'Ride out a sea event.' : `Ride out ${n} sea events.`), (s) => s.stats.events);

ladder('reb', 'anchor', [[1, 'Going Down'], [5, 'Deeper Still'], [10, 'Pressure Proof'], [25, 'Lost the Surface'], [100, 'Bottomless']],
  (n) => (n === 1 ? 'Make your first descent.' : `Descend ${n} times.`), (s) => s.rebirths);

ladder('shard', 'oyster-pearl', [[10, 'Pocket of Pearls'], [100, 'Pearl Purse'], [1000, 'Pearl Chest'], [1e4, 'Pearl Vault'], [1e6, 'Pearl Mountain']],
  (n) => `Find ${fmt(n)} Black Pearls in total.`, (s) => s.shardsTotal);

const skillCount = (s: GameState) => Object.values(s.skills).filter((l) => l > 0).length;
ladder('skill', 'coral', [[5, 'Polyps'], [20, 'Fringing Reef'], [40, 'Barrier Reef'], [SKILLS.length, 'The Whole Reef']],
  (n) => (n === SKILLS.length ? 'Grow every part of the Reef.' : `Grow ${n} parts of the Reef.`), skillCount);

TRIALS.forEach((t) => add({ id: `trial_${t.id}`, name: `Survived ${t.name}`, icon: t.icon, desc: `Clear the ${t.name} trench.`, check: (s) => s.trialsDone.has(t.id) }));
add({ id: 'trial_all', name: 'Trench Walker', icon: 'diving-helmet', desc: 'Clear every trench.', check: (s) => s.trialsDone.size >= TRIALS.length });

/* ---------- Secrets ---------- */
add({ id: 'sec_title', name: 'Who Built This Thing?', icon: 'scroll-unfurled', secret: true, desc: 'Tap the game title.', check: (s) => s.flags.has('title') });
add({ id: 'sec_palette', name: 'Fresh Paint', icon: 'water-splash', secret: true, desc: 'Change the water colour.', check: (s) => s.flags.has('palette') });
add({ id: 'sec_hour', name: 'Night Watch', icon: 'night-sleep', secret: true, desc: 'Play for an hour.', check: (s) => s.stats.playTime >= 3600 });
add({ id: 'sec_day', name: 'Lifer', icon: 'sunrise', secret: true, desc: 'Play for 24 hours in total.', check: (s) => s.stats.playTime >= 86400 });
add({ id: 'sec_speed', name: 'Quick Dip', icon: 'stopwatch', secret: true, desc: 'Descend within 5 minutes of starting a dive.', check: (s) => s.stats.fastestRebirth <= 300 });
add({ id: 'sec_pacifist', name: 'Hands in Pockets', icon: 'meditation', secret: true, desc: 'Gather 1M lumen in a dive without tapping.', check: (s) => s.stats.runClicks === 0 && s.runEarned >= 1e6 });
add({ id: 'sec_buffs', name: 'Double Helping', icon: 'double-fish', secret: true, desc: 'Have two glimmerfish boosts going at once.', check: (s) => s.buffs.length >= 2 });
add({ id: 'sec_away', name: 'Gone Fishing', icon: 'sleepy', secret: true, desc: 'Come back after at least an hour away.', check: (s) => s.flags.has('away') });
add({ id: 'sec_import', name: 'Message in a Bottle', icon: 'water-bottle', secret: true, desc: 'Import a save.', check: (s) => s.flags.has('import') });
add({ id: 'sec_wish', name: 'Washed Up', icon: 'water-bottle', secret: true, desc: 'Find a bottle from a tap.', check: (s) => s.flags.has('wish') });
add({ id: 'sec_respec', name: 'Replanting', icon: 'cycle', secret: true, desc: 'Regrow your Reef from scratch.', check: (s) => s.flags.has('respec') });
add({ id: 'sec_news', name: 'Tuned In', icon: 'sound-waves', secret: true, desc: 'Tap the radio.', check: (s) => s.flags.has('news') });

export const ACH_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
