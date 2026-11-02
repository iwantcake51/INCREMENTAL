/** Depth zones. `from` is in metres. Water colours are [r, g, b]. */
export interface Zone {
  name: string;
  from: number;
  top: [number, number, number];
  bottom: [number, number, number];
  /** How dark it is outside your lamp, 0..1. */
  dark: number;
  /** Lumen per plankton mote is multiplied by this on top of the depth curve. */
  richness: number;
  blurb: string;
}

export const ZONES: Zone[] = [
  { name: 'Sunlit Shallows', from: 0, top: [26, 104, 116], bottom: [14, 70, 84], dark: 0.12, richness: 1, blurb: 'Warm, bright and mostly harmless.' },
  { name: 'Twilight Zone', from: 150, top: [12, 58, 74], bottom: [8, 38, 54], dark: 0.55, richness: 1.3, blurb: 'The light gives out. Jellies drift in the gloom.' },
  { name: 'Midnight Zone', from: 600, top: [6, 26, 40], bottom: [4, 16, 30], dark: 0.82, richness: 1.7, blurb: 'Pitch black. Something with a lantern is watching.' },
  { name: 'The Abyss', from: 1500, top: [5, 12, 28], bottom: [4, 8, 22], dark: 0.9, richness: 2.3, blurb: 'Crushing pressure, rich pickings.' },
  { name: 'Hadal Trench', from: 3500, top: [8, 5, 22], bottom: [4, 2, 12], dark: 0.95, richness: 3.2, blurb: 'The bottom of everything. Almost.' },
];

export function zoneAt(m: number): Zone {
  let z = ZONES[0];
  for (const zone of ZONES) if (m >= zone.from) z = zone;
  return z;
}

export function zoneIndex(m: number): number {
  let i = 0;
  ZONES.forEach((z, k) => {
    if (m >= z.from) i = k;
  });
  return i;
}

/** Base lumen for one plankton mote at a depth, before upgrades. */
export function moteValue(m: number): number {
  return (1 + m / 60) ** 1.6 * zoneAt(m).richness * 0.5;
}
