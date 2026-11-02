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
  { name: 'Plankton Net', plural: 'Plankton Nets', icon: 'fishing-net', hue: 170, baseCost: 15, baseProd: 0.1, flavor: 'Strains the faint glow out of passing water.' },
  { name: 'Shrimp Trap', plural: 'Shrimp Traps', icon: 'shrimp', hue: 12, baseCost: 110, baseProd: 1, flavor: "Glowing shrimp. They don't know they work here." },
  { name: 'Jellyfish Bloom', plural: 'Jellyfish Blooms', icon: 'jellyfish', hue: 300, baseCost: 1200, baseProd: 8, flavor: 'A slow crowd of tiny drifting lamps.' },
  { name: 'Lantern Line', plural: 'Lantern Lines', icon: 'old-lantern', hue: 38, baseCost: 13_000, baseProd: 47, flavor: 'Old ship lamps strung along a sunken cable.' },
  { name: 'Anglerfish Den', plural: 'Anglerfish Dens', icon: 'angler-fish', hue: 50, baseCost: 140_000, baseProd: 260, flavor: 'Lure goes in, light comes out. Mostly light.' },
  { name: 'Coral Furnace', plural: 'Coral Furnaces', icon: 'coral', hue: 352, baseCost: 2e6, baseProd: 1_400, flavor: 'Living coral, gently simmered into glow.' },
  { name: 'Squid Choir', plural: 'Squid Choirs', icon: 'giant-squid', hue: 275, baseCost: 3.3e7, baseProd: 7_800, flavor: 'They flash in harmony. You really have to see it.' },
  { name: 'Nautilus Engine', plural: 'Nautilus Engines', icon: 'nautilus-shell', hue: 28, baseCost: 5.1e8, baseProd: 44_000, flavor: 'Spiral shells that wind light out of the dark.' },
  { name: 'Bathysphere', plural: 'Bathyspheres', icon: 'submarine', hue: 190, baseCost: 7.5e9, baseProd: 260_000, flavor: 'One pilot, one lamp and a very long rope.' },
  { name: 'Sunken Lighthouse', plural: 'Sunken Lighthouses', icon: 'lighthouse', hue: 45, baseCost: 1e11, baseProd: 1.6e6, flavor: 'It never stopped shining. It just sank.' },
  { name: 'Leviathan Ranch', plural: 'Leviathan Ranches', icon: 'sperm-whale', hue: 210, baseCost: 1.4e12, baseProd: 1e7, flavor: 'Whales so old they glow from the inside.' },
  { name: 'Kraken Heart', plural: 'Kraken Hearts', icon: 'kraken-tentacle', hue: 320, baseCost: 2e13, baseProd: 6.5e7, flavor: "Best not to ask what it ate. It glows now." },
];

export const GENERATORS: GeneratorDef[] = RAW.map((g, id) => ({ ...g, id }));

export const BASE_COST_GROWTH = 1.15;
