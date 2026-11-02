import type { GameState } from '../core/state';
import { SKILLS } from './skills';
import { SHOP } from './shop';
import { fmt, fmtInt } from '../core/format';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  secret?: boolean;
  check: (s: GameState) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [];
const add = (a: AchievementDef) => ACHIEVEMENTS.push(a);

const ladder = (prefix: string, icon: string, steps: [number, string][], desc: (n: number) => string, value: (s: GameState) => number) => {
  steps.forEach(([n, name], i) => add({ id: `${prefix}${i}`, name, icon, desc: desc(n), check: (s) => value(s) >= n }));
};

ladder('depth', 'anchor', [
  [50, 'Getting Wet'], [100, 'Past the Kelp'], [250, 'Lights Fading'], [500, 'Twilight Tourist'], [1000, 'One Kilometre Down'],
  [2000, 'Midnight Regular'], [3500, 'Into the Trench'], [5000, 'Crushing Depths'], [7500, 'Nearly the Bottom'], [10000, 'Ten Thousand Metres'],
], (n) => `Reach ${fmtInt(n)} m in a dive.`, (s) => s.deepest);

ladder('lumen', 'water-drop', [
  [100, 'A Faint Glow'], [1e3, 'Night Light'], [1e4, 'Lamp Oil'], [1e5, 'Bucket of Light'], [1e6, 'A Million Motes'],
  [1e8, 'Harbour Lights'], [1e10, 'Glowing Tide'], [1e12, 'Lantern Sea'], [1e15, 'No More Night'], [1e18, 'Visible From Space'],
], (n) => `Gather ${fmt(n)} lumen in total.`, (s) => s.lumenTotal);

ladder('dives', 'submarine', [[1, 'First Dive'], [10, 'Regular'], [50, 'Old Hand'], [200, 'Lives Down There'], [1000, 'Gills']],
  (n) => (n === 1 ? 'Finish your first dive.' : `Finish ${fmtInt(n)} dives.`), (s) => s.stats.dives);

ladder('fish', 'clownfish', [[1, 'Got One!'], [25, 'Net Gains'], [100, 'Fish Whisperer'], [500, 'Shoal Keeper'], [2000, 'Glimmer King']],
  (n) => (n === 1 ? 'Catch a glimmerfish.' : `Catch ${fmtInt(n)} glimmerfish.`), (s) => s.stats.fish);

ladder('motes', 'bubble-field', [[100, 'Scooper'], [1000, 'Hoover'], [10_000, 'Plankton Baron'], [100_000, 'Living Net']],
  (n) => `Collect ${fmtInt(n)} plankton motes.`, (s) => s.stats.motes);

ladder('chests', 'open-treasure-chest', [[1, 'Finders Keepers'], [10, 'Treasure Hunter'], [50, 'Wreck Diver'], [200, 'Salvage King']],
  (n) => (n === 1 ? 'Open a treasure chest.' : `Open ${n} chests.`), (s) => s.stats.chests);

ladder('streak', 'musical-notes', [[10, 'Humming Along'], [25, 'Shanty Time'], [50, 'Full Chorus'], [80, 'The Whole Crew Sings']],
  (n) => `Collect ${n} plankton in one unbroken streak.`, (s) => s.stats.bestStreak);

ladder('shop', 'gears', [[10, 'Tinkerer'], [50, 'Shipwright'], [150, 'Chief Engineer'], [400, 'Old Salt']],
  (n) => `Buy ${n} sub upgrades in total.`, (s) => s.stats.shopLevels);

ladder('rebuild', 'cycle', [[1, 'New Hull'], [5, 'Serial Rebuilder'], [20, 'The Ship of Theseus'], [100, 'Dry Dock Legend']],
  (n) => (n === 1 ? 'Rebuild your sub for the first time.' : `Rebuild your sub ${n} times.`), (s) => s.rebuilds);

ladder('pearl', 'oyster-pearl', [[1, 'Black Pearl'], [25, 'Pearl Purse'], [250, 'Pearl Chest'], [2500, 'Pearl Vault']],
  (n) => (n === 1 ? 'Get a Black Pearl.' : `Get ${fmt(n)} Black Pearls in total.`), (s) => s.pearlsTotal);

ladder('reef', 'coral', [[5, 'Polyps'], [20, 'Fringing Reef'], [40, 'Barrier Reef'], [SKILLS.length, 'The Whole Reef']],
  (n) => (n === SKILLS.length ? 'Grow every part of the Reef.' : `Grow ${n} parts of the Reef.`), (s) => Object.values(s.skills).filter((l) => l > 0).length);

ladder('flares', 'sun-radiations', [[1, 'Light Show'], [50, 'Flare Gun']], (n) => (n === 1 ? 'Fire a flare.' : `Fire ${n} flares.`), (s) => s.stats.flares);
ladder('dash', 'rocket-thruster', [[1, 'Zoom'], [100, 'Jet Setter']], (n) => (n === 1 ? 'Dash for the first time.' : `Dash ${n} times.`), (s) => s.stats.dashes);

add({ id: 'maxed', name: 'Fully Fitted', icon: 'checked-shield', desc: 'Max out any sub upgrade.', check: (s) => SHOP.some((i) => (s.shop[i.id] ?? 0) >= i.max) });

/* ---------- Secrets ---------- */
add({ id: 'sec_nohit', name: 'Untouched', icon: 'heart-plus', secret: true, desc: 'Reach 300 m without taking a single hit.', check: (s) => s.flags.has('nohit300') });
add({ id: 'sec_close', name: 'Close Call', icon: 'air-zigzag', secret: true, desc: 'Surface with less than 2 seconds of air left.', check: (s) => s.flags.has('closecall') });
add({ id: 'sec_breach', name: 'Spring a Leak', icon: 'sea-urchin', secret: true, desc: 'Have your hull give way.', check: (s) => s.stats.breaches > 0 });
add({ id: 'sec_title', name: 'Who Built This Thing?', icon: 'scroll-unfurled', secret: true, desc: 'Tap the game title.', check: (s) => s.flags.has('title') });
add({ id: 'sec_palette', name: 'Fresh Paint', icon: 'water-splash', secret: true, desc: 'Change the water colour.', check: (s) => s.flags.has('palette') });
add({ id: 'sec_hour', name: 'Night Watch', icon: 'night-sleep', secret: true, desc: 'Play for an hour.', check: (s) => s.stats.playTime >= 3600 });
add({ id: 'sec_away', name: 'Gone Fishing', icon: 'sleepy', secret: true, desc: 'Come back after at least an hour away.', check: (s) => s.flags.has('away') });
add({ id: 'sec_import', name: 'Message in a Bottle', icon: 'water-bottle', secret: true, desc: 'Import a save.', check: (s) => s.flags.has('import') });
add({ id: 'sec_respec', name: 'Replanting', icon: 'cycle', secret: true, desc: 'Regrow your Reef from scratch.', check: (s) => s.flags.has('respec') });
add({ id: 'sec_news', name: 'Tuned In', icon: 'sound-waves', secret: true, desc: 'Tap the radio.', check: (s) => s.flags.has('news') });

export const ACH_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
