import type { GameState } from '../core/state';

interface NewsItem {
  text: string | ((s: GameState) => string);
  when?: (s: GameState) => boolean;
}

const owned = (i: number, n = 1) => (s: GameState) => s.gens[i] >= n;

export const NEWS: NewsItem[] = [
  { text: 'Fishermen up top report the sea "looks a bit brighter tonight". Nobody believes them.' },
  { text: 'Weather for the trench: dark, cold, wet. Same as yesterday.' },
  { text: 'Tip: tap in a steady rhythm to build a streak. The lure likes a beat.' },
  { text: 'Tip: glimmerfish swim past now and then. Tap one for a treat.' },
  { text: 'Tip: 1 to 7 switch tabs, B changes the buy amount, Ctrl+S saves.' },
  { text: 'A passing octopus has asked us to "keep the noise down".' },
  { text: 'Local crab claims the lure was his idea. Investigation ongoing.' },
  { text: 'Reminder: the lure is not food. Please stop trying to eat the lure.' },
  { text: 'Plankton net union asks for slightly bigger holes. Request denied.', when: owned(0, 10) },
  { text: 'Shrimp in the traps have started glowing on purpose. Morale is up.', when: owned(1, 5) },
  { text: 'Jellyfish bloom drifts into the control room. Everyone stays very still.', when: owned(2) },
  { text: 'Lantern Line flickers in a pattern that might be Morse. It says "wet".', when: owned(3) },
  { text: 'Anglerfish file a complaint: "We were here first, with the lights."', when: owned(4) },
  { text: 'Coral Furnace reaches a gentle simmer. The coral seems fine with it.', when: owned(5) },
  { text: 'Squid Choir rehearses a new number. Reviews call it "flashy".', when: owned(6) },
  { text: 'Nautilus Engine completes its millionth spiral. Nobody counted, it just feels right.', when: owned(7) },
  { text: 'Bathysphere pilot sends up a single word: "Pretty." Then nothing for six hours.', when: owned(8) },
  { text: 'Sunken Lighthouse keeper still on shift, sixty years later. Please send biscuits.', when: owned(9) },
  { text: 'Leviathan Ranch hand reports a whale "smiled" at him. He is taking the day off.', when: owned(10) },
  { text: 'Kraken Heart beats once. Every lamp in the trench brightens a little.', when: owned(11) },
  { text: (s) => `Head count: ${s.gens.reduce((a, b) => a + b, 0).toLocaleString('en-US')} harvesters now work these waters.`, when: (s) => s.gens.reduce((a, b) => a + b, 0) > 50 },
  { text: 'Breaking: diver descends past the old depth record, mutters "huh", keeps going.', when: (s) => s.rebirths > 0 },
  { text: 'Black Pearl prices hit a new high at the surface market. We are not selling.', when: (s) => s.shardsTotal > 10 },
  { text: 'Marine biologists confirm the reef is growing "in a suspiciously useful shape".', when: (s) => Object.keys(s.skills).length > 5 },
  { text: 'Trench survivor: "I would not do that again. Anyway, when is the next one?"', when: (s) => s.trialsDone.size > 0 },
  { text: 'The echo hands have formed a band. Their only song is tapping.', when: (s) => (s.skills.k_echo ?? 0) > 0 },
  { text: 'Study finds glimmerfish swim past slowly on purpose. They want to be caught.', when: (s) => s.stats.comets > 10 },
  { text: 'Astronauts report a glowing smudge where an ocean used to be dark.', when: (s) => s.totalEarned > 1e30 },
  { text: 'Mathematicians run out of words for numbers. Switch to "loads".', when: (s) => s.totalEarned > 1e60 },
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
