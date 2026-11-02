import type { Notation } from './format';
import { GENERATORS } from '../data/generators';

export type BuyAmount = 1 | 10 | 100 | 'max';
export type Palette = 'lumen' | 'coral' | 'amber' | 'violet';

export interface Settings {
  notation: Notation;
  palette: Palette;
  particles: boolean;
  floatingText: boolean;
  starfield: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  volume: number; // 0..1
  muted: boolean;
  haptics: boolean;
  autosaveSeconds: number;
  offlineProgress: boolean;
  confirmRebirth: boolean;
  confirmTrial: boolean;
  newsTicker: boolean;
  uiScale: number; // 0.85..1.25
  buyAmount: BuyAmount;
}

export interface Buff {
  id: BuffId;
  remaining: number; // seconds
  duration: number;
}
export type BuffId = 'frenzy' | 'clickstorm' | 'combolock';

export interface Stats {
  clicks: number;
  runClicks: number;
  clickEarned: number;
  crits: number;
  comets: number;
  runComets: number;
  bestCombo: number;
  playTime: number;
  runTime: number;
  fastestRebirth: number;
  bestCps: number;
  bestClick: number;
  gensBought: number;
  upgradesBought: number;
  shardsEarned: number;
  offlineEarned: number;
  starfalls: number;
  events: number;
}

export interface GameState {
  version: number;
  created: number;
  lastSave: number;
  stardust: number;
  runEarned: number;
  totalEarned: number;
  gens: number[];
  upgrades: Set<string>;
  shards: number;
  shardsTotal: number;
  skills: Record<string, number>;
  rebirths: number;
  achievements: Set<string>;
  trial: string | null;
  trialsDone: Set<string>;
  buffs: Buff[];
  event: { id: string; remaining: number; duration: number } | null;
  eventTimer: number;
  combo: number;
  comboTimer: number;
  cometTimer: number;
  lastPurchaseAge: number; // seconds since last generator purchase (Entropy trial)
  autobuy: { gens: boolean; upgrades: boolean; rebirth: boolean; rebirthAt: number };
  flags: Set<string>; // misc one-off flags (secret achievements, seen tutorial...)
  stats: Stats;
  settings: Settings;
}

export const SAVE_VERSION = 1;

export function defaultSettings(): Settings {
  return {
    notation: 'standard',
    palette: 'lumen',
    particles: true,
    floatingText: true,
    starfield: true,
    reducedMotion: 'system',
    volume: 0.5,
    muted: false,
    haptics: true,
    autosaveSeconds: 30,
    offlineProgress: true,
    confirmRebirth: true,
    confirmTrial: true,
    newsTicker: true,
    uiScale: 1,
    buyAmount: 1,
  };
}

export function defaultStats(): Stats {
  return {
    clicks: 0,
    runClicks: 0,
    clickEarned: 0,
    crits: 0,
    comets: 0,
    runComets: 0,
    bestCombo: 0,
    playTime: 0,
    runTime: 0,
    fastestRebirth: Infinity,
    bestCps: 0,
    bestClick: 0,
    gensBought: 0,
    upgradesBought: 0,
    shardsEarned: 0,
    offlineEarned: 0,
    starfalls: 0,
    events: 0,
  };
}

export function newGame(): GameState {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    created: now,
    lastSave: now,
    stardust: 0,
    runEarned: 0,
    totalEarned: 0,
    gens: GENERATORS.map(() => 0),
    upgrades: new Set(),
    shards: 0,
    shardsTotal: 0,
    skills: {},
    rebirths: 0,
    achievements: new Set(),
    trial: null,
    trialsDone: new Set(),
    buffs: [],
    event: null,
    eventTimer: 120,
    combo: 0,
    comboTimer: 0,
    cometTimer: 45,
    lastPurchaseAge: 0,
    autobuy: { gens: true, upgrades: true, rebirth: false, rebirthAt: 10 },
    flags: new Set(),
    stats: defaultStats(),
    settings: defaultSettings(),
  };
}
