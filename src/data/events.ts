export interface EventDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  duration: number;
  weight: number;
  /** Positive, mixed or a gamble — tints the banner. */
  tone: 'good' | 'mixed';
  prod?: number;
  click?: number;
  cost?: number;
  crit?: number;
  comboCap?: number;
  comboHold?: boolean;
  cometEvery?: number;
  clickProdSeconds?: number;
  pulse?: number;
}

export const EVENTS: EventDef[] = [
  { id: 'meteor', name: 'Plankton Bloom', icon: 'bubble-field', tone: 'good', duration: 60, weight: 10, prod: 3,
    desc: 'The water turns thick with glowing plankton. Production ×3.' },
  { id: 'eclipse', name: 'Black Tide', icon: 'low-tide', tone: 'mixed', duration: 45, weight: 7, click: 10, prod: 0.5,
    desc: 'Ink rolls in and the harvesters go quiet, but the lure burns bright. Taps ×10, production ×0.5.' },
  { id: 'lensing', name: 'Salvage Rush', icon: 'ship-wreck', tone: 'good', duration: 40, weight: 7, cost: 0.7,
    desc: 'A wreck spills its cargo. Harvesters and upgrades cost 30% less.' },
  { id: 'alignment', name: 'Whale Song', icon: 'sperm-whale', tone: 'good', duration: 90, weight: 6, prod: 2, click: 2,
    desc: 'Something enormous sings nearby. Production and taps ×2.' },
  { id: 'swarm', name: 'Glimmer Shoal', icon: 'circling-fish', tone: 'good', duration: 30, weight: 5, cometEvery: 6,
    desc: 'A whole shoal of glimmerfish swims through. Catch as many as you can.' },
  { id: 'surge', name: 'Riptide', icon: 'big-wave', tone: 'good', duration: 35, weight: 6, comboCap: 100, comboHold: true,
    desc: 'The current carries your rhythm. Streak cap +100 and your streak never fades.' },
  { id: 'lucky', name: 'Pearl Moon', icon: 'oyster-pearl', tone: 'good', duration: 45, weight: 6, crit: 0.25,
    desc: 'Moonlight reaches all the way down. +25% chance of a lucky tap.' },
  { id: 'corona', name: 'Thermal Vent', icon: 'boiling-bubbles', tone: 'good', duration: 30, weight: 5, clickProdSeconds: 1,
    desc: 'A vent cracks open below. Every tap also grants 1 second of production.' },
  { id: 'pulsar', name: 'Tidal Pulse', icon: 'high-tide', tone: 'mixed', duration: 60, weight: 5, pulse: 6,
    desc: 'The tide breathes in and out. Production swings between ×1 and ×6, so time your buys.' },
  { id: 'drift', name: 'Warm Current', icon: 'waves', tone: 'good', duration: 180, weight: 7, prod: 1.5,
    desc: 'A slow, warm current drifts past. Production ×1.5 for a good while.' },
];

export const EVENT_MAP = new Map(EVENTS.map((e) => [e.id, e]));
const TOTAL_WEIGHT = EVENTS.reduce((a, e) => a + e.weight, 0);

export function rollEvent(exclude?: string): EventDef {
  for (let tries = 0; tries < 5; tries++) {
    let r = Math.random() * TOTAL_WEIGHT;
    for (const e of EVENTS) {
      r -= e.weight;
      if (r <= 0) {
        if (e.id !== exclude) return e;
        break;
      }
    }
  }
  return EVENTS[0];
}
