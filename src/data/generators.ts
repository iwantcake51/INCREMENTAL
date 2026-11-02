export interface GeneratorDef {
  id: number;
  name: string;
  plural: string;
  icon: string;
  hue: number;
  baseCost: number;
  baseProd: number;
  flavor: string;
}

const RAW: Omit<GeneratorDef, 'id'>[] = [
  { name: 'Spark Catcher', plural: 'Spark Catchers', icon: 'sparkles', hue: 48, baseCost: 15, baseProd: 0.1, flavor: 'A butterfly net for loose starlight.' },
  { name: 'Dust Siphon', plural: 'Dust Siphons', icon: 'vacuum-cleaner', hue: 190, baseCost: 110, baseProd: 1, flavor: 'Hoovers the cosmic carpet, one mote at a time.' },
  { name: 'Comet Net', plural: 'Comet Nets', icon: 'fishing-net', hue: 200, baseCost: 1200, baseProd: 8, flavor: 'Snags passing comets by the tail.' },
  { name: 'Lunar Drill', plural: 'Lunar Drills', icon: 'drill', hue: 220, baseCost: 13_000, baseProd: 47, flavor: 'The moon had it coming.' },
  { name: 'Solar Sail', plural: 'Solar Sails', icon: 'sail', hue: 38, baseCost: 140_000, baseProd: 260, flavor: 'Catches the wind of a thousand suns.' },
  { name: 'Nebula Still', plural: 'Nebula Stills', icon: 'erlenmeyer', hue: 290, baseCost: 2e6, baseProd: 1_400, flavor: 'Distills gas clouds into pure glitter.' },
  { name: 'Pulsar Engine', plural: 'Pulsar Engines', icon: 'orbital-rays', hue: 170, baseCost: 3.3e7, baseProd: 7_800, flavor: 'Runs on the heartbeat of dead stars.' },
  { name: 'Quasar Lens', plural: 'Quasar Lenses', icon: 'telescope', hue: 260, baseCost: 5.1e8, baseProd: 44_000, flavor: 'Focuses a galactic core into a pinpoint.' },
  { name: 'Dyson Lattice', plural: 'Dyson Lattices', icon: 'holosphere', hue: 30, baseCost: 7.5e9, baseProd: 260_000, flavor: 'Wraps a star like a gift. Keeps the gift.' },
  { name: 'Galaxy Loom', plural: 'Galaxy Looms', icon: 'galaxy', hue: 320, baseCost: 1e11, baseProd: 1.6e6, flavor: 'Weaves spiral arms out of raw dust.' },
  { name: 'Void Harvester', plural: 'Void Harvesters', icon: 'vortex', hue: 250, baseCost: 1.4e12, baseProd: 1e7, flavor: 'Reaps the nothing between everything.' },
  { name: 'Big Bang Kiln', plural: 'Big Bang Kilns', icon: 'bright-explosion', hue: 10, baseCost: 2e13, baseProd: 6.5e7, flavor: 'Fires universes like pottery.' },
];

export const GENERATORS: GeneratorDef[] = RAW.map((g, id) => ({ ...g, id }));

export const BASE_COST_GROWTH = 1.15;
