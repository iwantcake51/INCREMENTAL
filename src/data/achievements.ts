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

ladder('earn', 'star-formation', [
  [100, 'First Light'], [1e3, 'Glimmer'], [1e4, 'Twinkle'], [1e5, 'Shimmer'], [1e6, 'Millionaire Moth'],
  [1e8, 'Constellation'], [1e10, 'Star Cluster'], [1e12, 'Trillion Sparks'], [1e15, 'Quadrillion Queen'],
  [1e18, 'Nebular'], [1e21, 'Galactic'], [1e24, 'Supercluster'], [1e30, 'Cosmic Web'], [1e36, 'Observable Universe'],
  [1e45, 'Beyond Counting'], [1e60, 'Multiversal'], [1e80, 'Every Atom'], [1e100, 'Googol'],
], (n) => `Earn ${fmt(n)} Stardust in total.`, (s) => s.totalEarned);

ladder('cps', 'rolling-energy', [
  [1, 'Trickle'], [10, 'Stream'], [100, 'River'], [1e3, 'Waterfall'], [1e5, 'Flood'], [1e7, 'Tsunami'],
  [1e10, 'Torrent of Light'], [1e15, 'Starstorm'], [1e20, 'Supernova Wind'], [1e30, 'Big Bang Engine'],
], (n) => `Produce ${fmt(n)} Stardust per second.`, (_s, c) => c.cps);

ladder('click', 'click', [
  [1, 'Hello, Star'], [100, 'Tapper'], [1000, 'Clicker'], [5000, 'Clickaholic'], [25_000, 'Carpal Tunnel'], [100_000, 'The Hand'],
], (n) => (n === 1 ? 'Click the star for the first time.' : `Click the star ${fmtInt(n)} times.`), (s) => s.stats.clicks);

ladder('clickearn', 'glowing-hands', [
  [1e3, 'Handmade'], [1e6, 'Artisan Dust'], [1e9, 'Manual Labor'], [1e15, 'Fist of Light'], [1e24, 'Palm of Creation'],
], (n) => `Earn ${fmt(n)} Stardust from clicking.`, (s) => s.stats.clickEarned);

ladder('crit', 'on-target', [[1, 'Critical!'], [100, 'Sharpshooter'], [1000, 'Surgical Strikes']],
  (n) => (n === 1 ? 'Land a critical click.' : `Land ${fmtInt(n)} critical clicks.`), (s) => s.stats.crits);

ladder('combo', 'musical-notes', [[25, 'In the Groove'], [50, 'On Beat'], [100, 'Virtuoso'], [200, 'Maestro']],
  (n) => `Build a combo of ${n} clicks.`, (s) => s.stats.bestCombo);

GENERATORS.forEach((g) => {
  add({ id: `gen${g.id}a`, name: `First ${g.name}`, icon: g.icon, desc: `Own a ${g.name}.`, check: (s) => s.gens[g.id] >= 1 });
  add({ id: `gen${g.id}b`, name: `${g.name} Empire`, icon: g.icon, desc: `Own 100 ${g.plural}.`, check: (s) => s.gens[g.id] >= 100 });
  add({ id: `gen${g.id}c`, name: `${g.name} Dominion`, icon: g.icon, desc: `Own 250 ${g.plural}.`, check: (s) => s.gens[g.id] >= 250 });
});

const totalGens = (s: GameState) => s.gens.reduce((a, b) => a + b, 0);
ladder('gens', 'gears', [[100, 'Industrious'], [500, 'Factory Floor'], [1000, 'Megastructure'], [2500, 'Kardashev II']],
  (n) => `Own ${fmtInt(n)} generators at once.`, totalGens);

ladder('upg', 'upgrade', [[10, 'Tinker'], [50, 'Engineer'], [150, 'Architect'], [500, 'Grand Designer']],
  (n) => `Buy ${n} upgrades in total.`, (s) => s.stats.upgradesBought);

ladder('comet', 'comet-spark', [[1, 'Make a Wish'], [10, 'Comet Chaser'], [50, 'Tail Puller'], [200, 'Comet Whisperer'], [1000, 'Orbit Keeper']],
  (n) => (n === 1 ? 'Catch a comet.' : `Catch ${fmtInt(n)} comets.`), (s) => s.stats.comets);

ladder('event', 'star-formation', [[1, 'Skywatcher'], [10, 'Storm Chaser'], [50, 'Weathered'], [200, 'Master of Seasons']],
  (n) => `Witness ${n} cosmic event${n > 1 ? 's' : ''}.`, (s) => s.stats.events);

ladder('reb', 'bright-explosion', [[1, 'Supernova'], [5, 'Serial Exploder'], [10, 'Phoenix'], [25, 'Eternal Return'], [100, 'Ouroboros']],
  (n) => `Go Supernova ${n} time${n > 1 ? 's' : ''}.`, (s) => s.rebirths);

ladder('shard', 'crystal-cluster', [[10, 'Shard Collector'], [100, 'Crystal Hoard'], [1000, 'Prism Vault'], [1e4, 'Gem of Ages'], [1e6, 'Shard Singularity']],
  (n) => `Earn ${fmt(n)} Nova Shards in total.`, (s) => s.shardsTotal);

const skillCount = (s: GameState) => Object.values(s.skills).filter((l) => l > 0).length;
ladder('skill', 'star-swirl', [[5, 'Stargazer'], [20, 'Astronomer'], [40, 'Cartographer'], [SKILLS.length, 'Whole Sky']],
  (n) => (n === SKILLS.length ? 'Learn every node in the constellation.' : `Learn ${n} constellation nodes.`), skillCount);

TRIALS.forEach((t) => add({ id: `trial_${t.id}`, name: `Survivor: ${t.name}`, icon: t.icon, desc: `Complete the ${t.name} trial.`, check: (s) => s.trialsDone.has(t.id) }));
add({ id: 'trial_all', name: 'Void Walker', icon: 'crossed-swords', desc: 'Complete every trial.', check: (s) => s.trialsDone.size >= TRIALS.length });

/* ---------- Secrets ---------- */
add({ id: 'sec_title', name: 'Who Made This?', icon: 'scroll-unfurled', secret: true, desc: 'Click the game title.', check: (s) => s.flags.has('title') });
add({ id: 'sec_palette', name: 'Interior Decorator', icon: 'magic-swirl', secret: true, desc: 'Change the color palette.', check: (s) => s.flags.has('palette') });
add({ id: 'sec_hour', name: 'Night Owl', icon: 'night-sleep', secret: true, desc: 'Play for an hour.', check: (s) => s.stats.playTime >= 3600 });
add({ id: 'sec_day', name: 'Dedicated', icon: 'sunrise', secret: true, desc: 'Play for 24 hours in total.', check: (s) => s.stats.playTime >= 86400 });
add({ id: 'sec_speed', name: 'Speedrunner', icon: 'stopwatch', secret: true, desc: 'Go Supernova within 5 minutes of a run starting.', check: (s) => s.stats.fastestRebirth <= 300 });
add({ id: 'sec_pacifist', name: 'Hands Off', icon: 'meditation', secret: true, desc: 'Earn 1M Stardust in a run without clicking.', check: (s) => s.stats.runClicks === 0 && s.runEarned >= 1e6 });
add({ id: 'sec_buffs', name: 'Double Trouble', icon: 'perpendicular-rings', secret: true, desc: 'Have two comet buffs active at once.', check: (s) => s.buffs.length >= 2 });
add({ id: 'sec_away', name: 'Sleepwalker', icon: 'sleepy', secret: true, desc: 'Return after at least an hour away.', check: (s) => s.flags.has('away') });
add({ id: 'sec_import', name: 'Time Traveler', icon: 'sands-of-time', secret: true, desc: 'Import a save.', check: (s) => s.flags.has('import') });
add({ id: 'sec_wish', name: 'Wish Granted', icon: 'falling-star', secret: true, desc: 'Trigger a Wishing Star.', check: (s) => s.flags.has('wish') });
add({ id: 'sec_respec', name: 'Second Thoughts', icon: 'cycle', secret: true, desc: 'Respec your constellation.', check: (s) => s.flags.has('respec') });
add({ id: 'sec_news', name: 'Well Informed', icon: 'scroll-unfurled', secret: true, desc: 'Click the news ticker.', check: (s) => s.flags.has('news') });

export const ACH_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
