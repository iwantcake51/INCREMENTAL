import { SHOP_MAP } from '../data/shop';
import { SKILL_MAP } from '../data/skills';
import { ACH_MAP } from '../data/achievements';
import { defaultSettings, defaultStats, newGame, type GameState } from './state';

export const STORAGE_KEY = 'lanterndeep-save';
const EXPORT_PREFIX = 'LD1:';

type Json = Record<string, unknown>;

/** Plain-JSON form of the state (Sets become arrays, Infinity becomes null). */
export function serialize(s: GameState): string {
  return JSON.stringify({
    ...s,
    lastSave: Date.now(),
    achievements: [...s.achievements],
    flags: [...s.flags],
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
  // Saves from before the sub rewrite (version < 2) are a different game: keep only settings.
  const legacy = num(raw.version, 1) < 2;
  s.created = num(raw.created, s.created);
  s.lastSave = num(raw.lastSave, Date.now());
  if (!legacy) {
    s.lumen = num(raw.lumen, 0);
    s.lumenRun = num(raw.lumenRun, 0);
    s.lumenTotal = num(raw.lumenTotal, 0);
    if (raw.shop && typeof raw.shop === 'object') {
      for (const [id, lvl] of Object.entries(raw.shop as Json)) {
        const item = SHOP_MAP.get(id);
        if (item) s.shop[id] = Math.min(item.max, Math.floor(num(lvl, 0)));
      }
    }
    s.pearls = Math.floor(num(raw.pearls, 0));
    s.pearlsTotal = Math.floor(num(raw.pearlsTotal, s.pearls));
    if (raw.skills && typeof raw.skills === 'object') {
      for (const [id, lvl] of Object.entries(raw.skills as Json)) {
        const def = SKILL_MAP.get(id);
        if (def) s.skills[id] = Math.min(def.max, Math.floor(num(lvl, 0)));
      }
    }
    s.rebuilds = Math.floor(num(raw.rebuilds, 0));
    s.deepest = num(raw.deepest, 0);
    s.deepestRun = num(raw.deepestRun, 0);
    s.achievements = new Set(arr(raw.achievements).filter((id) => ACH_MAP.has(id)));
    s.flags = new Set(arr(raw.flags));
    const st = (raw.stats ?? {}) as Json;
    const ds = defaultStats();
    for (const key of Object.keys(ds) as (keyof typeof ds)[]) ds[key] = num(st[key], ds[key]);
    s.stats = ds;
    const last = raw.last as Json | null;
    if (last && typeof last === 'object') {
      s.last = {
        depth: num(last.depth, 0),
        lumen: num(last.lumen, 0),
        reason: pick(last.reason, ['surface', 'air', 'breach'] as const, 'surface'),
        pearls: num(last.pearls, 0),
      };
    }
  } else {
    s.flags.add('legacy');
  }

  const se = (raw.settings ?? {}) as Json;
  const d = defaultSettings();
  s.settings = {
    notation: pick(se.notation, ['standard', 'scientific', 'engineering', 'letters'] as const, d.notation),
    palette: pick(se.palette, ['lumen', 'coral', 'amber', 'violet'] as const, d.palette),
    particles: bool(se.particles, d.particles),
    floatingText: bool(se.floatingText, d.floatingText),
    starfield: bool(se.starfield, d.starfield),
    reducedMotion: pick(se.reducedMotion, ['system', 'on', 'off'] as const, d.reducedMotion),
    volume: Math.min(1, num(se.volume, d.volume)),
    muted: bool(se.muted, d.muted),
    tapSounds: bool(se.tapSounds, d.tapSounds),
    haptics: bool(se.haptics, d.haptics),
    autosaveSeconds: pick(se.autosaveSeconds, [10, 30, 60, 120] as const, 30),
    offlineProgress: bool(se.offlineProgress, d.offlineProgress),
    confirmRebirth: bool(se.confirmRebirth, d.confirmRebirth),
    newsTicker: bool(se.newsTicker, d.newsTicker),
    uiScale: Math.min(1.25, Math.max(0.85, num(se.uiScale, 1))),
    steer: pick(se.steer, ['follow', 'hold'] as const, d.steer),
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
