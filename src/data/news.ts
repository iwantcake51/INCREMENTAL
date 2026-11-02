import type { GameState } from '../core/state';

interface NewsItem {
  text: string | ((s: GameState) => string);
  when?: (s: GameState) => boolean;
}

const deeper = (m: number) => (s: GameState) => s.deepest >= m;

export const NEWS: NewsItem[] = [
  { text: 'Fishermen up top report the sea "looks a bit brighter tonight". Nobody believes them.' },
  { text: 'Weather for the trench: dark, cold, wet. Same as yesterday.' },
  { text: 'Tip: grab plankton in quick succession to build a streak. Every pickup in a streak is worth more.' },
  { text: 'Tip: surfacing always keeps your whole haul. A broken hull only keeps part of it.' },
  { text: 'Tip: air bubbles come in little columns. Grab them before you get greedy.' },
  { text: 'Tip: glimmerfish run from you. A faster sub, a dash or the Lure Lamp helps.' },
  { text: 'Harbour master reminds divers: the sub is not a toy. It is, however, quite fun.' },
  { text: 'Local crab claims to have designed the propeller. Investigation ongoing.' },
  { text: 'A passing octopus has asked us to keep the engine noise down.' },
  { text: 'Jellyfish union: "We are not in the way. You are in the way."', when: deeper(150) },
  { text: 'Twilight Zone tourism up 400% since you started showing up.', when: deeper(250) },
  { text: 'Eel spotted carrying what appears to be your missing hubcap.', when: deeper(300) },
  { text: 'Anglerfish report: "We saw a very bright fish. It was a submarine."', when: deeper(650) },
  { text: 'One kilometre down. The sub makes a noise like a sigh. That is probably fine.', when: deeper(1000) },
  { text: 'Pressure at your record depth could crush a car. Your sub is, for now, not a car.', when: deeper(1500) },
  { text: 'Scientists confirm there is no bottom. They will update this once you find one.', when: deeper(3500) },
  { text: (s) => `Dock records: ${s.stats.dives.toLocaleString('en-US')} dives and counting.`, when: (s) => s.stats.dives >= 10 },
  { text: 'Plankton farm workers ask for a raise. Paid in plankton. Request granted.', when: (s) => (s.shop.farm ?? 0) > 3 },
  { text: 'Black Pearl prices hit a new high at the surface market. We are not selling.', when: (s) => s.pearlsTotal > 5 },
  { text: 'Marine biologists say the reef is growing "in a suspiciously useful shape".', when: (s) => Object.keys(s.skills).length > 5 },
  { text: 'Breaking: diver rebuilds sub from scratch, insists it is "the same sub".', when: (s) => s.rebuilds > 0 },
  { text: 'Glimmerfish have started a support group.', when: (s) => s.stats.fish > 50 },
];

export function pickNews(s: GameState, last: number): { text: string; index: number } {
  const pool: number[] = [];
  NEWS.forEach((n, i) => {
    if (i !== last && (!n.when || n.when(s))) pool.push(i);
  });
  const index = pool[Math.floor(Math.random() * pool.length)] ?? 0;
  const item = NEWS[index];
  return { text: typeof item.text === 'function' ? item.text(s) : item.text, index };
}
