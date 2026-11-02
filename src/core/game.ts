import { SHOP, SHOP_MAP, shopCost, type ShopItem } from '../data/shop';
import { SKILLS, SKILL_MAP, skillCost, skillUnlocked, totalSpent } from '../data/skills';
import { ACHIEVEMENTS, type AchievementDef } from '../data/achievements';
import { EVENTS, type DiveEvent } from '../data/events';
import { baseMods, type Mods } from './mods';
import { newGame, type GameState } from './state';
import { Dive, type DiveResult } from './dive';

type Events = {
  achievement: AchievementDef;
  purchase: { kind: 'shop' | 'skill'; id: string };
  diveStart: Dive;
  diveEnd: DiveResult;
  rebuild: { pearls: number };
  reset: void;
};
type Handler<T> = (payload: T) => void;

const MAX = Number.MAX_VALUE;
const safe = (v: number) => (Number.isFinite(v) ? v : v > 0 ? MAX : 0);

/** Lumen this sub has earned that yields the first Black Pearl when rebuilding. */
export const PEARL_BASE = 20000;

export class Game {
  s: GameState;
  dive: Dive | null = null;
  private modsCache: Mods | null = null;
  private listeners: { [K in keyof Events]?: Handler<Events[K]>[] } = {};
  private achTimer = 0;
  /** Lumen per second from the plankton farm, refreshed by recalc(). */
  farmRate = 0;

  constructor(state?: GameState) {
    this.s = state ?? newGame();
    this.recalc();
  }

  on<K extends keyof Events>(ev: K, fn: Handler<Events[K]>): void {
    (this.listeners[ev] ??= [] as never[]).push(fn as never);
  }
  emit<K extends keyof Events>(ev: K, payload: Events[K]): void {
    this.listeners[ev]?.forEach((fn) => (fn as Handler<Events[K]>)(payload));
  }

  /* ------------------------------------------------------------ modifiers */
  invalidate(): void {
    this.modsCache = null;
  }

  get mods(): Mods {
    return (this.modsCache ??= this.computeMods());
  }

  private computeMods(): Mods {
    const m = baseMods();
    for (const item of SHOP) {
      const lvl = this.s.shop[item.id] ?? 0;
      if (lvl > 0) item.apply(m, lvl);
    }
    for (const def of SKILLS) {
      const lvl = this.s.skills[def.id] ?? 0;
      if (lvl > 0) def.apply(m, lvl);
    }
    m.offlineEff = Math.min(1, m.offlineEff);
    m.keepShop = Math.min(1, m.keepShop);
    return m;
  }

  /** Multiplier on every lumen gain: pearls, finds and your depth record. */
  valueMult(): number {
    const m = this.mods;
    const p = this.s.pearlsTotal;
    const pearl = 1 + m.pearlPer * (p <= 100 ? p : 100 * (p / 100) ** 0.8);
    return pearl * (1 + this.s.achievements.size * m.achPer) * (1 + m.recordBonus * (this.s.deepest / 1000));
  }

  recalc(): void {
    const m = this.mods;
    const L = m.farmLevel;
    this.farmRate = L > 0 ? safe(0.35 * L * 1.13 ** L * (1 + this.s.deepest / 150) * m.farmMult * m.lumenMult * this.valueMult()) : 0;
  }

  earn(amount: number): void {
    if (!(amount > 0)) return;
    const s = this.s;
    s.lumen = safe(s.lumen + amount);
    s.lumenRun = safe(s.lumenRun + amount);
    s.lumenTotal = safe(s.lumenTotal + amount);
  }

  /* ------------------------------------------------------------ shop */
  shopLevel(id: string): number {
    return this.s.shop[id] ?? 0;
  }

  shopPrice(item: ShopItem): number {
    return shopCost(item, this.shopLevel(item.id));
  }

  canBuy(id: string): boolean {
    const item = SHOP_MAP.get(id);
    if (!item) return false;
    const lvl = this.shopLevel(id);
    return lvl < item.max && this.s.lumen >= shopCost(item, lvl);
  }

  buy(id: string): boolean {
    if (!this.canBuy(id) || this.dive) return false;
    const item = SHOP_MAP.get(id)!;
    this.s.lumen -= shopCost(item, this.shopLevel(id));
    this.s.shop[id] = this.shopLevel(id) + 1;
    this.s.stats.shopLevels++;
    this.invalidate();
    this.recalc();
    this.emit('purchase', { kind: 'shop', id });
    return true;
  }

  /* ------------------------------------------------------------ Reef */
  skillLevel(id: string): number {
    return this.s.skills[id] ?? 0;
  }

  canBuySkill(id: string): boolean {
    const def = SKILL_MAP.get(id);
    if (!def) return false;
    const lvl = this.skillLevel(id);
    return lvl < def.max && skillUnlocked(def, this.s.skills) && this.s.pearls >= skillCost(def, lvl);
  }

  buySkill(id: string): boolean {
    if (!this.canBuySkill(id)) return false;
    const def = SKILL_MAP.get(id)!;
    const lvl = this.skillLevel(id);
    this.s.pearls -= skillCost(def, lvl);
    this.s.skills[id] = lvl + 1;
    this.invalidate();
    this.recalc();
    this.emit('purchase', { kind: 'skill', id });
    return true;
  }

  /** Give back every pearl spent on the Reef. Allowed any time you're at the dock. */
  respec(): void {
    if (this.dive) return;
    this.s.pearls += totalSpent(this.s.skills);
    this.s.skills = {};
    this.s.flags.add('respec');
    this.invalidate();
    this.recalc();
    this.emit('reset', undefined);
  }

  /* ------------------------------------------------------------ dives */
  rollEvent(): DiveEvent | undefined {
    if (this.s.stats.dives < 2) return undefined; // let the first dives be plain
    return Math.random() < this.mods.eventRate ? EVENTS[Math.floor(Math.random() * EVENTS.length)] : undefined;
  }

  startDive(event = this.rollEvent()): Dive {
    const dive = new Dive(this.mods, { seed: (Math.random() * 2 ** 31) | 0, event, record: this.s.deepest, valueMult: this.valueMult() });
    dive.on((sig) => {
      if (sig.type === 'end') this.finishDive(sig.result);
    });
    this.dive = dive;
    this.emit('diveStart', dive);
    return dive;
  }

  private finishDive(r: DiveResult): void {
    const s = this.s;
    const st = s.stats;
    this.earn(r.banked);
    s.pearls += r.pearls;
    s.pearlsTotal += r.pearls;
    st.pearlsFound += r.pearls;
    st.dives++;
    st.motes += r.motes;
    st.fish += r.fish;
    st.chests += r.chests;
    st.airBubbles += r.air;
    st.hits += r.hits;
    st.dashes += r.dashes;
    st.flares += r.flares;
    st.zaps += r.zaps;
    st.diveTime += r.time;
    st.bestStreak = Math.max(st.bestStreak, r.bestStreak);
    st.bestDive = Math.max(st.bestDive, r.banked);
    if (r.reason === 'breach') st.breaches++;
    if (r.hits === 0 && r.depth >= 300) s.flags.add('nohit300');
    if (r.closeCall) s.flags.add('closecall');
    s.deepest = Math.max(s.deepest, r.depth);
    s.deepestRun = Math.max(s.deepestRun, r.depth);
    s.last = { depth: r.depth, lumen: r.banked, reason: r.reason, pearls: r.pearls };
    this.dive = null;
    this.recalc();
    this.checkAchievements();
    this.emit('diveEnd', r);
  }

  /* ------------------------------------------------------------ rebuild (prestige) */
  pearlGain(): number {
    const m = this.mods;
    let v = Math.floor((this.s.lumenRun / PEARL_BASE) ** m.pearlExp * m.pearlMult);
    if (this.s.lumenRun < PEARL_BASE) v = 0;
    if (m.depthPearls) v += Math.floor(this.s.deepestRun / 500);
    return Number.isFinite(v) ? v : MAX;
  }

  nextPearlAt(): number {
    const m = this.mods;
    return PEARL_BASE * ((Math.floor((this.s.lumenRun / PEARL_BASE) ** m.pearlExp * m.pearlMult) + 1) / m.pearlMult) ** (1 / m.pearlExp);
  }

  rebuild(): number {
    if (this.dive) return 0;
    const gain = this.pearlGain();
    const s = this.s;
    const m = this.mods;
    s.pearls += gain;
    s.pearlsTotal += gain;
    s.rebuilds++;
    const keep = m.keepShop;
    for (const id of Object.keys(s.shop)) s.shop[id] = Math.floor(s.shop[id] * keep);
    s.lumen = m.startLumen;
    s.lumenRun = 0;
    s.deepestRun = 0;
    this.invalidate();
    this.recalc();
    this.emit('rebuild', { pearls: gain });
    return gain;
  }

  /* ------------------------------------------------------------ time */
  /** Dock tick: the farm keeps working whether or not you're diving. */
  tick(dt: number): void {
    const s = this.s;
    s.stats.playTime += dt;
    if (this.farmRate > 0) {
      const g = this.farmRate * dt;
      this.earn(g);
      s.stats.farmEarned = safe(s.stats.farmEarned + g);
    }
    this.achTimer += dt;
    if (this.achTimer >= 1) {
      this.achTimer = 0;
      this.checkAchievements();
    }
  }

  checkAchievements(): void {
    const s = this.s;
    for (const a of ACHIEVEMENTS) {
      if (!s.achievements.has(a.id) && a.check(s)) {
        s.achievements.add(a.id);
        this.recalc();
        this.emit('achievement', a);
      }
    }
  }

  applyOffline(seconds: number): { seconds: number; gain: number; capped: boolean } {
    const m = this.mods;
    const cap = m.offlineCapH * 3600;
    const used = Math.min(seconds, cap);
    const gain = safe(this.farmRate * used * m.offlineEff);
    this.earn(gain);
    this.s.stats.offlineEarned = safe(this.s.stats.offlineEarned + gain);
    if (seconds >= 3600) this.s.flags.add('away');
    return { seconds: used, gain, capped: seconds > cap };
  }

  hardReset(): void {
    const settings = this.s.settings;
    this.s = newGame();
    this.s.settings = settings;
    this.dive = null;
    this.invalidate();
    this.recalc();
    this.emit('reset', undefined);
  }
}
