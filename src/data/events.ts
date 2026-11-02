/** Conditions that can roll at the start of a dive and last the whole dive. */
export interface DiveEvent {
  id: string;
  name: string;
  icon: string;
  desc: string;
  moteMult?: number;
  fishMult?: number;
  fishCount?: number;
  dark?: number;
  speed?: number;
  airDrain?: number;
  hazardMult?: number;
  chestMult?: number;
  current?: number;
}

export const EVENTS: DiveEvent[] = [
  { id: 'bloom', name: 'Plankton Bloom', icon: 'bubble-field', desc: 'The water is thick with glow. Plankton ×2.', moteMult: 2 },
  { id: 'blacktide', name: 'Black Tide', icon: 'low-tide', desc: 'Ink in the water: much darker, but plankton ×1.6.', dark: 0.25, moteMult: 1.6 },
  { id: 'warm', name: 'Warm Current', icon: 'waves', desc: 'A friendly current: +20% speed and air lasts longer.', speed: 1.2, airDrain: 0.85 },
  { id: 'shoal', name: 'Glimmer Shoal', icon: 'circling-fish', desc: 'Glimmerfish everywhere. Three times as many, worth double.', fishCount: 3, fishMult: 2 },
  { id: 'wreck', name: 'Shipwreck Season', icon: 'ship-wreck', desc: 'Storms sank ships up top. Chests are four times as common.', chestMult: 4 },
  { id: 'riptide', name: 'Riptide', icon: 'big-wave', desc: 'A sideways current tugs at you. Plankton ×1.5.', current: 70, moteMult: 1.5 },
  { id: 'swarm', name: 'Jelly Swarm', icon: 'jellyfish', desc: 'Jellies everywhere. Twice the danger, plankton ×2.2.', hazardMult: 2, moteMult: 2.2 },
];

export const EVENT_MAP = new Map(EVENTS.map((e) => [e.id, e]));
