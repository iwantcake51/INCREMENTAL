import type { GameState } from '../core/state';

interface NewsItem {
  text: string | ((s: GameState) => string);
  when?: (s: GameState) => boolean;
}

const owned = (i: number, n = 1) => (s: GameState) => s.gens[i] >= n;

export const NEWS: NewsItem[] = [
  { text: 'Local star reports being "poked repeatedly". Authorities baffled.' },
  { text: 'Astronomers confirm: the night sky is 0.0001% shinier than yesterday.' },
  { text: 'Tip: keep clicking quickly to build a combo. The star likes rhythm.' },
  { text: 'Tip: comets drift across the sky now and then. Catch them for big boosts.' },
  { text: 'Tip: press 1–7 to switch tabs, B to cycle buy amount, Ctrl+S to save.' },
  { text: 'Weather forecast: 90% chance of stardust, light comet showers in the evening.' },
  { text: 'Philosophers ask: if a star is clicked and nobody hears it, does it sparkle?' },
  { text: 'Spark Catcher union demands bigger nets.', when: owned(0, 10) },
  { text: 'Dust Siphons accused of "sucking". Manufacturer: "That is the point."', when: owned(1, 5) },
  { text: 'Comet Net catches its first comet; comet reportedly "not thrilled".', when: owned(2) },
  { text: 'Moon files formal complaint about Lunar Drills. Complaint lost in vacuum.', when: owned(3) },
  { text: 'Solar Sails spotted tacking against the solar wind. Sailors impressed.', when: owned(4) },
  { text: 'Nebula Still produces a vintage stardust with "notes of hydrogen and regret".', when: owned(5) },
  { text: 'Pulsar Engines keep perfect time. Everyone is now very punctual.', when: owned(6) },
  { text: 'Quasar Lens accidentally sets a distant galaxy on fire. "Oops."', when: owned(7) },
  { text: 'Dyson Lattice completed. Star inside reportedly "a little claustrophobic".', when: owned(8) },
  { text: 'Galaxy Looms weave a spiral arm so fine it wins a fashion award.', when: owned(9) },
  { text: 'Void Harvesters reap a bumper crop of absolutely nothing. Profits soar.', when: owned(10) },
  { text: 'Big Bang Kiln fires up. Several new universes ask what is going on.', when: owned(11) },
  { text: (s) => `Census: ${s.gens.reduce((a, b) => a + b, 0).toLocaleString('en-US')} machines now orbit your star.`, when: (s) => s.gens.reduce((a, b) => a + b, 0) > 50 },
  { text: 'Breaking: star explodes, immediately feels better about itself.', when: (s) => s.rebirths > 0 },
  { text: 'Nova Shards trading at an all-time high on the interstellar exchange.', when: (s) => s.shardsTotal > 10 },
  { text: 'Constellation spotted shaped suspiciously like a skill tree.', when: (s) => Object.keys(s.skills).length > 5 },
  { text: 'Trial participant: "Who designed these? They are so mean."', when: (s) => s.trialsDone.size > 0 },
  { text: 'Echo Hands form a band. Their only song is "click".', when: (s) => (s.skills.k_echo ?? 0) > 0 },
  { text: 'Study finds 100% of comets prefer being caught by you specifically.', when: (s) => s.stats.comets > 10 },
  { text: 'Universe nearing heat death postponed indefinitely due to excessive stardust.', when: (s) => s.totalEarned > 1e30 },
  { text: 'Mathematicians run out of names for numbers. Switch to "lots".', when: (s) => s.totalEarned > 1e60 },
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
