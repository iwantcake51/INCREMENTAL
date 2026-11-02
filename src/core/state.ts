import type { Notation } from './format';

export type Palette = 'lumen' | 'coral' | 'amber' | 'violet';

export interface Settings {
  notation: Notation;
  palette: Palette;
  particles: boolean;
  floatingText: boolean;
  starfield: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  volume: number;
  muted: boolean;
  tapSounds: boolean;
  haptics: boolean;
  autosaveSeconds: number;
  offlineProgress: boolean;
  confirmRebirth: boolean;
  newsTicker: boolean;
  uiScale: number;
  /** Steering: follow the pointer, or only move while a button/finger is held. */
  steer: 'follow' | 'hold';
}

export interface Stats {
  dives: number;
  motes: number;
  fish: number;
  chests: number;
  airBubbles: number;
  hits: number;
  breaches: number;
  dashes: number;
  flares: number;
  zaps: number;
  bestStreak: number;
  bestDive: number;
  diveTime: number;
  playTime: number;
  shopLevels: number;
  pearlsFound: number;
  offlineEarned: number;
  farmEarned: number;
}

export interface LastDive {
  depth: number;
  lumen: number;
  reason: 'surface' | 'air' | 'breach';
  pearls: number;
}

export interface GameState {
  version: number;
  created: number;
  lastSave: number;
  lumen: number;
  /** Lumen earned since the last rebuild (drives pearl gain). */
  lumenRun: number;
  lumenTotal: number;
  shop: Record<string, number>;
  pearls: number;
  pearlsTotal: number;
  skills: Record<string, number>;
  rebuilds: number;
  deepest: number;
  deepestRun: number;
  achievements: Set<string>;
  flags: Set<string>;
  stats: Stats;
  last: LastDive | null;
  settings: Settings;
}

export const SAVE_VERSION = 2;

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
    tapSounds: true,
    haptics: true,
    autosaveSeconds: 30,
    offlineProgress: true,
    confirmRebirth: true,
    newsTicker: true,
    uiScale: 1,
    steer: 'follow',
  };
}

export function defaultStats(): Stats {
  return {
    dives: 0,
    motes: 0,
    fish: 0,
    chests: 0,
    airBubbles: 0,
    hits: 0,
    breaches: 0,
    dashes: 0,
    flares: 0,
    zaps: 0,
    bestStreak: 0,
    bestDive: 0,
    diveTime: 0,
    playTime: 0,
    shopLevels: 0,
    pearlsFound: 0,
    offlineEarned: 0,
    farmEarned: 0,
  };
}

export function newGame(): GameState {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    created: now,
    lastSave: now,
    lumen: 0,
    lumenRun: 0,
    lumenTotal: 0,
    shop: {},
    pearls: 0,
    pearlsTotal: 0,
    skills: {},
    rebuilds: 0,
    deepest: 0,
    deepestRun: 0,
    achievements: new Set(),
    flags: new Set(),
    stats: defaultStats(),
    last: null,
    settings: defaultSettings(),
  };
}
