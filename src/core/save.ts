import { GENERATORS } from '../data/generators';
import { UPGRADE_MAP } from '../data/upgrades';
import { SKILL_MAP } from '../data/skills';
import { TRIAL_MAP } from '../data/trials';
import { ACH_MAP } from '../data/achievements';
import { EVENT_MAP } from '../data/events';
import { defaultSettings, defaultStats, newGame, SAVE_VERSION, type GameState } from './state';

export const STORAGE_KEY = 'astral-forge-save';
const EXPORT_PREFIX = 'AF1:';

type Json = Record<string, unknown>;

/** Plain-JSON form of the state (Sets become arrays, Infinity becomes null). */
export function serialize(s: GameState): string {
  return JSON.stringify({
    ...s,
    lastSave: Date.now(),
    upgrades: [...s.upgrades],
    achievements: [...s.achievements],
    trialsDone: [...s.trialsDone],
    flags: [...s.flags],
    stats: { ...s.stats, fastestRebirth: Number.isFinite(s.stats.fastestRebirth) ? s.stats.fastestRebirth : null },
  });
}

const num = (v: unknown, fallback: number, min = 0): number =>
  typeof v === 'number' && !Number.isNaN(v) ? Math.max(min, Math.min(v, Number.MAX_VALUE)) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const pick = <T extends string | number>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** Rebuilds a valid GameState from untrusted JSON; unknown or broken fields fall back to defaults. */
export function deserialize(text: string): GameState {
  const raw = JSON.parse(text) as Json;
  if (!raw || typeof raw !== 'object') throw new Error('Save is not an object');
  const s = newGame();
  s.version = SAVE_VERSION;
  s.created = num(raw.created, s.created);
  s.lastSave = num(raw.lastSave, Date.now());
  s.stardust = num(raw.stardust, 0);
  s.runEarned = num(raw.runEarned, 0);
  s.totalEarned = num(raw.totalEarned, 0);
  const gens = Array.isArray(raw.gens) ? raw.gens : [];
  s.gens = GENERATORS.map((_, i) => Math.floor(num(gens[i], 0)));
  s.upgrades = new Set(arr(raw.upgrades).filter((id) => UPGRADE_MAP.has(id)));
  s.shards = num(raw.shards, 0);
  s.shardsTotal = num(raw.shardsTotal, s.shards);
  s.skills = {};
  if (raw.skills && typeof raw.skills === 'object') {
    for (const [id, lvl] of Object.entries(raw.skills as Json)) {
      const def = SKILL_MAP.get(id);
      if (def) s.skills[id] = Math.min(def.max, Math.floor(num(lvl, 0)));
    }
  }
  s.rebirths = Math.floor(num(raw.rebirths, 0));
  s.achievements = new Set(arr(raw.achievements).filter((id) => ACH_MAP.has(id)));
  s.trial = typeof raw.trial === 'string' && TRIAL_MAP.has(raw.trial) ? raw.trial : null;
  s.trialsDone = new Set(arr(raw.trialsDone).filter((id) => TRIAL_MAP.has(id)));
  if (Array.isArray(raw.buffs)) {
    s.buffs = (raw.buffs as Json[])
      .filter((b) => b && ['frenzy', 'clickstorm', 'combolock'].includes(b.id as string))
      .map((b) => ({ id: b.id as 'frenzy', remaining: num(b.remaining, 0), duration: num(b.duration, 1, 1) }));
  }
  s.cometTimer = num(raw.cometTimer, 45);
  s.eventTimer = num(raw.eventTimer, 120);
  const ev = raw.event as Json | null;
  if (ev && typeof ev.id === 'string' && EVENT_MAP.has(ev.id)) {
    s.event = { id: ev.id, remaining: num(ev.remaining, 0), duration: num(ev.duration, 1, 1) };
  }
  const ab = (raw.autobuy ?? {}) as Json;
  s.autobuy = {
    gens: bool(ab.gens, true),
    upgrades: bool(ab.upgrades, true),
    rebirth: bool(ab.rebirth, false),
    rebirthAt: num(ab.rebirthAt, 10, 1),
  };
  s.flags = new Set(arr(raw.flags));

  const st = (raw.stats ?? {}) as Json;
  const ds = defaultStats();
  for (const key of Object.keys(ds) as (keyof typeof ds)[]) {
    ds[key] = key === 'fastestRebirth' ? (typeof st[key] === 'number' ? (st[key] as number) : Infinity) : num(st[key], ds[key]);
  }
  s.stats = ds;

  const se = (raw.settings ?? {}) as Json;
  const d = defaultSettings();
  s.settings = {
    notation: pick(se.notation, ['standard', 'scientific', 'engineering', 'letters'] as const, d.notation),
    palette: pick(se.palette, ['brass', 'verdigris', 'rose', 'silver'] as const, d.palette),
    particles: bool(se.particles, d.particles),
    floatingText: bool(se.floatingText, d.floatingText),
    starfield: bool(se.starfield, d.starfield),
    reducedMotion: pick(se.reducedMotion, ['system', 'on', 'off'] as const, d.reducedMotion),
    volume: Math.min(1, num(se.volume, d.volume)),
    muted: bool(se.muted, d.muted),
    haptics: bool(se.haptics, d.haptics),
    autosaveSeconds: pick(se.autosaveSeconds, [10, 30, 60, 120] as const, 30),
    offlineProgress: bool(se.offlineProgress, d.offlineProgress),
    confirmRebirth: bool(se.confirmRebirth, d.confirmRebirth),
    confirmTrial: bool(se.confirmTrial, d.confirmTrial),
    newsTicker: bool(se.newsTicker, d.newsTicker),
    uiScale: Math.min(1.25, Math.max(0.85, num(se.uiScale, 1))),
    buyAmount: pick(se.buyAmount, [1, 10, 100, 'max'] as const, 1),
  };
  return s;
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function exportSave(s: GameState): string {
  return EXPORT_PREFIX + toBase64(serialize(s));
}

export function importSave(code: string): GameState {
  const trimmed = code.trim();
  const body = trimmed.startsWith(EXPORT_PREFIX) ? trimmed.slice(EXPORT_PREFIX.length) : trimmed;
  return deserialize(fromBase64(body.replace(/\s+/g, '')));
}

export function saveLocal(s: GameState): boolean {
  try {
    s.lastSave = Date.now();
    localStorage.setItem(STORAGE_KEY, serialize(s));
    return true;
  } catch {
    return false;
  }
}

export function loadLocal(): GameState | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? deserialize(text) : null;
  } catch (err) {
    console.warn('Could not load save, starting fresh', err);
    return null;
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}
