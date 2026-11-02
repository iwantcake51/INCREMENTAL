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
  { id: 'meteor', name: 'Meteor Shower', icon: 'burning-meteor', tone: 'good', duration: 60, weight: 10, prod: 3,
    desc: 'Debris rains into your collectors. Production ×3.' },
  { id: 'eclipse', name: 'Solar Eclipse', icon: 'eclipse', tone: 'mixed', duration: 45, weight: 7, click: 10, prod: 0.5,
    desc: 'The sky darkens and the star burns hot to the touch. Clicks ×10, production ×0.5.' },
  { id: 'lensing', name: 'Gravitational Lensing', icon: 'magnifying-glass', tone: 'good', duration: 40, weight: 7, cost: 0.7,
    desc: 'Space bends and prices with it. Generators and upgrades cost 30% less.' },
  { id: 'alignment', name: 'Stellar Alignment', icon: 'star-formation', tone: 'good', duration: 90, weight: 6, prod: 2, click: 2,
    desc: 'The planets line up. Production and clicks ×2.' },
  { id: 'swarm', name: 'Comet Swarm', icon: 'comet-spark', tone: 'good', duration: 30, weight: 5, cometEvery: 6,
    desc: 'A swarm of comets crosses the sky. Catch as many as you can!' },
  { id: 'surge', name: 'Stardust Surge', icon: 'musical-notes', tone: 'good', duration: 35, weight: 6, comboCap: 100, comboHold: true,
    desc: 'The star hums along. Combo cap +100 and your combo never fades.' },
  { id: 'lucky', name: 'Lucky Constellation', icon: 'clover', tone: 'good', duration: 45, weight: 6, crit: 0.25,
    desc: 'The stars smile on you. +25% critical click chance.' },
  { id: 'corona', name: 'Coronal Burst', icon: 'sun-radiations', tone: 'good', duration: 30, weight: 5, clickProdSeconds: 1,
    desc: 'Plasma leaps from the star. Every click also grants 1 second of production.' },
  { id: 'pulsar', name: 'Pulsar Beat', icon: 'orbital-rays', tone: 'mixed', duration: 60, weight: 5, pulse: 6,
    desc: 'A nearby pulsar throbs. Production swings between ×1 and ×6 — time your buys.' },
  { id: 'drift', name: 'Nebula Drift', icon: 'fluffy-cloud', tone: 'good', duration: 180, weight: 7, prod: 1.5,
    desc: 'A slow, rich nebula drifts past. Production ×1.5 for a while.' },
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
