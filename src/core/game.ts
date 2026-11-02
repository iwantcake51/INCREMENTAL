import { GENERATORS } from '../data/generators';
import { UPGRADES, UPGRADE_MAP, KEEPABLE, type UpgradeDef } from '../data/upgrades';
import { SKILLS, SKILL_MAP, skillCost, skillUnlocked, totalSpent } from '../data/skills';
import { TRIAL_MAP } from '../data/trials';
import { ACHIEVEMENTS, type AchievementDef } from '../data/achievements';
import { EVENT_MAP, rollEvent, type EventDef } from '../data/events';
import { baseMods, type Mods } from './mods';
import { newGame, type BuffId, type GameState } from './state';

export interface ClickResult {
  amount: number;
  crit: boolean;
  wish: number;
}

export type CometReward =
  | { kind: 'starfall'; amount: number }
  | { kind: BuffId; duration: number };

type Events = {
  achievement: AchievementDef;
  rebirth: { shards: number };
  trialComplete: string;
  comet: { twin: boolean };
  flare: void;
  event: EventDef;
  eventEnd: EventDef;
  purchase: { kind: 'gen' | 'upgrade' | 'skill'; id: string | number };
  toast: { title: string; body?: string; tone?: 'info' | 'good' | 'warn' };
  reset: void;
};
type Handler<T> = (payload: T) => void;

export const BUFF_INFO: Record<BuffId, { name: string; icon: string; base: number }> = {
  frenzy: { name: 'Feeding Frenzy', icon: 'angler-fish', base: 66 },
  clickstorm: { name: 'Eel Shock', icon: 'lightning-helix', base: 13 },
  combolock: { name: 'Steady Current', icon: 'waves', base: 30 },
  flare: { name: 'Flare', icon: 'sun-radiations', base: 8 },
};

const MAX = Number.MAX_VALUE;
/** Lumen in one dive needed for the first Black Pearl, at depth 1. */
export const PEARL_BASE = 1e8;
/** Water pressure: each descent deeper multiplies the lumen pearls need. */
export const PRESSURE = 1.5;
/** Manual taps needed to fill the flare gauge. */
export const FLARE_TAPS = 100;
const safe = (v: number) => (Number.isFinite(v) ? v : v > 0 ? MAX : 0);

export class Game {
  s: GameState;
  private modsCache: Mods | null = null;
  private listeners: { [K in keyof Events]?: Handler<Events[K]>[] } = {};

  /** Cached per tick so UI reads are free. */
  cps = 0;
  /** Smoothed lumen per second from tapping (manual taps, echo taps, bottles). */
  tapRate = 0;
  private tapAcc = 0;

  /** Everything you are earning per second right now, taps included. */
  get totalRate(): number {
    return this.cps + this.tapRate;
  }
  baseCps = 0; // without buffs (for offline and comets)
  perGen: number[] = GENERATORS.map(() => 0);
  globalMult = 1;

  private autoClickAcc = 0;
  private autoTimer = 0;
  private achTimer = 0;
  private lastEventId = '';

  constructor(state?: GameState) {
    this.s = state ?? newGame();
    this.recalc();
  }

  /* ------------------------------------------------------------ events */
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
    const s = this.s;
    const m = baseMods();
    const trial = s.trial ? TRIAL_MAP.get(s.trial) : undefined;
    trial?.restrict(m);
    if (!m.noSkills) {
      for (const def of SKILLS) {
        const lvl = s.skills[def.id] ?? 0;
        if (lvl > 0) def.apply(m, lvl, s);
      }
    }
    for (const id of s.upgrades) UPGRADE_MAP.get(id)?.apply(m);
    for (const id of s.trialsDone) TRIAL_MAP.get(id)?.bonus(m);
    m.costGrowth = Math.max(1.01, m.costGrowth);
    m.offlineEff = Math.min(1, m.offlineEff);
    m.critChance = Math.min(1, m.critChance);
    return m;
  }

  /* ------------------------------------------------------------ production */
  recalc(): void {
    const s = this.s;
    const m = this.mods;
    let types = 0;
    for (const n of s.gens) if (n > 0) types++;

    let global = (1 + m.prodAdd) * m.prodMult;
    if (!m.noSkills) global *= 1 + this.shardBonus();
    global *= 1 + s.achievements.size * m.achPer;
    global *= 1 + m.resonance * types;
    if (m.patienceCap > 0) global *= 1 + Math.min(m.patienceCap, s.stats.runTime / 1000);
    global *= 1 + m.wanderPer * s.stats.runComets;
    if (m.entropy) global *= Math.max(0.01, 0.98 ** s.lastPurchaseAge);
    let spill = 0;
    for (let i = 0; i < GENERATORS.length; i++) spill += m.globalPerGen[i] * s.gens[i];
    global *= 1 + spill;

    let raw = 0;
    for (let i = 0; i < GENERATORS.length; i++) {
      let p = s.gens[i] * GENERATORS[i].baseProd * m.genMult[i] * (1 + m.selfSyn[i] * s.gens[i]);
      for (const syn of m.synergy) if (syn.target === i) p *= 1 + syn.pct * s.gens[syn.source];
      this.perGen[i] = p;
      raw += p;
    }
    if (m.noGenProd) raw = 0;

    let base = raw * global;
    if (m.prodExp !== 1 && base > 1) base = base ** m.prodExp;
    base = safe(base);
    const frenzy = this.buffMult('frenzy') * this.eventProdMult() * this.flareProd();
    this.baseCps = base;
    this.cps = safe(base * frenzy);
    // Scale per-generator figures so they add up to the displayed total.
    const scale = raw > 0 ? this.cps / raw : 0;
    for (let i = 0; i < this.perGen.length; i++) this.perGen[i] *= scale;
    this.globalMult = raw > 0 ? this.cps / raw : global * frenzy;
    if (this.cps > s.stats.bestCps) s.stats.bestCps = this.cps;
  }

  /** The cosmic event currently in the sky, if any. */
  get event(): EventDef | undefined {
    return this.s.event ? EVENT_MAP.get(this.s.event.id) : undefined;
  }

  eventProdMult(): number {
    const e = this.event;
    if (!e) return 1;
    if (e.pulse) {
      // Smooth pulse between ×1 and ×pulse with a ~6s period.
      const t = (Math.sin((this.s.event!.duration - this.s.event!.remaining) * ((Math.PI * 2) / 6)) + 1) / 2;
      return 1 + (e.pulse - 1) * t * t;
    }
    return e.prod ?? 1;
  }

  eventCostMult(): number {
    return this.event?.cost ?? 1;
  }

  comboCap(): number {
    return this.mods.comboCap + (this.event?.comboCap ?? 0);
  }

  critChance(): number {
    return Math.min(1, this.mods.critChance + (this.event?.crit ?? 0));
  }

  /**
   * Production bonus from every shard ever earned. Linear for the first hundred or so,
   * then gently diminishing so late-game supernovas can't spiral out of control.
   */
  shardBonus(): number {
    const sh = this.s.shardsTotal;
    const eff = sh <= 100 ? sh : 100 * (sh / 100) ** 0.8;
    return eff * this.mods.shardPer;
  }

  buffMult(id: BuffId): number {
    const b = this.s.buffs.find((x) => x.id === id);
    if (!b) return 1;
    const m = this.mods;
    if (id === 'frenzy') return 1 + (m.frenzyMult - 1) * m.buffPower;
    if (id === 'clickstorm') return 1 + (m.clickstormMult - 1) * m.buffPower;
    if (id === 'flare') return 1 + 9 * m.buffPower; // taps; production uses flareProd()
    return 1;
  }

  comboMult(): number {
    return 1 + Math.min(this.s.combo, this.comboCap()) * this.mods.comboPer;
  }

  /** Value of a single non-crit click right now. */
  clickValue(): number {
    const m = this.mods;
    let linked = 0;
    for (let i = 0; i < this.perGen.length; i++) if (m.tapFromGen[i]) linked += this.perGen[i] * m.tapFromGen[i];
    const base = m.clickBase * m.clickMult + this.cps * m.clickCpsPct + linked;
    return safe(base * this.comboMult() * this.buffMult('clickstorm') * this.buffMult('flare') * (this.event?.click ?? 1));
  }

  earn(amount: number): void {
    if (!(amount > 0)) return;
    const s = this.s;
    s.stardust = safe(s.stardust + amount);
    s.runEarned = safe(s.runEarned + amount);
    s.totalEarned = safe(s.totalEarned + amount);
  }

  /* ------------------------------------------------------------ clicking */
  click(): ClickResult | null {
    const s = this.s;
    const m = this.mods;
    if (m.noClick) return null;
    const cap = this.comboCap();
    s.combo = Math.min(s.combo + 1, cap);
    s.comboTimer = m.comboDecay;
    const crit = Math.random() < this.critChance();
    if (crit && m.critCombo) s.combo = Math.min(s.combo + 5, cap);
    let amount = this.clickValue() * (crit ? m.critMult : 1);
    let wish = 0;
    if (m.wishChance > 0 && Math.random() < m.wishChance) {
      wish = this.cps * 10;
      s.flags.add('wish');
    }
    const ev = this.event;
    if (ev?.clickProdSeconds) wish += this.cps * ev.clickProdSeconds;
    // Manual taps fill the flare gauge (lucky taps count double).
    if (!s.buffs.some((b) => b.id === 'flare')) {
      s.surge = Math.min(1, s.surge + ((crit ? 2 : 1) * m.flareFill) / FLARE_TAPS);
      if (s.surge >= 1) this.startFlare();
    }
    amount = safe(amount);
    this.earn(amount + wish);
    this.tapAcc += amount + wish;
    s.stats.clicks++;
    s.stats.runClicks++;
    s.stats.clickEarned = safe(s.stats.clickEarned + amount);
    if (crit) s.stats.crits++;
    if (s.combo > s.stats.bestCombo) s.stats.bestCombo = s.combo;
    if (amount > s.stats.bestClick) s.stats.bestClick = amount;
    return { amount, crit, wish };
  }

  /* ------------------------------------------------------------ generators */
  genCost(i: number, amount = 1): number {
    const m = this.mods;
    const r = m.costGrowth;
    const first = GENERATORS[i].baseCost * m.costMult * m.genCostMult[i] * this.eventCostMult() * r ** this.s.gens[i];
    if (amount === 1) return first;
    return (first * (r ** amount - 1)) / (r - 1);
  }

  maxAffordable(i: number): number {
    const m = this.mods;
    const r = m.costGrowth;
    const first = this.genCost(i);
    if (this.s.stardust < first) return 0;
    const n = Math.floor(Math.log((this.s.stardust * (r - 1)) / first + 1) / Math.log(r));
    // Floating point can be off by one at the edge.
    return this.genCost(i, n) <= this.s.stardust ? n : Math.max(0, n - 1);
  }

  genLocked(i: number): boolean {
    return i > this.mods.maxGenIndex;
  }

  buyGen(i: number, amount: number | 'max'): number {
    if (this.genLocked(i)) return 0;
    const n = amount === 'max' ? this.maxAffordable(i) : amount;
    if (n <= 0) return 0;
    const cost = this.genCost(i, n);
    if (cost > this.s.stardust) return 0;
    this.s.stardust -= cost;
    this.s.gens[i] += n;
    this.s.stats.gensBought += n;
    this.s.lastPurchaseAge = 0;
    this.recalc();
    this.emit('purchase', { kind: 'gen', id: i });
    return n;
  }

  /* ------------------------------------------------------------ upgrades */
  upgradeCost(u: UpgradeDef): number {
    return u.cost * this.mods.upgradeCostMult * this.eventCostMult();
  }

  /** Upgrades that are visible, not yet owned, sorted by price. */
  shopUpgrades(): UpgradeDef[] {
    const s = this.s;
    const out: UpgradeDef[] = [];
    for (const u of UPGRADES) if (!s.upgrades.has(u.id) && u.visible(s)) out.push(u);
    out.sort((a, b) => a.cost - b.cost);
    return out;
  }

  buyUpgrade(id: string, silent = false): boolean {
    const u = UPGRADE_MAP.get(id);
    if (!u || this.s.upgrades.has(id) || this.mods.noUpgrades) return false;
    const cost = this.upgradeCost(u);
    if (cost > this.s.stardust) return false;
    this.s.stardust -= cost;
    this.s.upgrades.add(id);
    this.s.stats.upgradesBought++;
    this.invalidate();
    this.recalc();
    if (!silent) this.emit('purchase', { kind: 'upgrade', id });
    return true;
  }

  buyAllUpgrades(): number {
    let n = 0;
    for (const u of this.shopUpgrades()) if (this.buyUpgrade(u.id, true)) n++;
    if (n) this.emit('purchase', { kind: 'upgrade', id: 'all' });
    return n;
  }

  /* ------------------------------------------------------------ skills */
  skillLevel(id: string): number {
    return this.s.skills[id] ?? 0;
  }

  canBuySkill(id: string): boolean {
    const def = SKILL_MAP.get(id);
    if (!def) return false;
    const lvl = this.skillLevel(id);
    return lvl < def.max && skillUnlocked(def, this.s.skills) && this.s.shards >= skillCost(def, lvl);
  }

  buySkill(id: string): boolean {
    if (!this.canBuySkill(id)) return false;
    const def = SKILL_MAP.get(id)!;
    const lvl = this.skillLevel(id);
    this.s.shards -= skillCost(def, lvl);
    this.s.skills[id] = lvl + 1;
    this.invalidate();
    this.recalc();
    this.emit('purchase', { kind: 'skill', id });
    return true;
  }

  respec(): void {
    this.s.shards += totalSpent(this.s.skills);
    this.s.skills = {};
    this.s.flags.add('respec');
    this.invalidate();
    this.resetRun();
    this.emit('reset', undefined);
  }

  /* ------------------------------------------------------------ prestige */
  /** Lumen per "pearl unit" at the current depth. */
  pearlBase(): number {
    return PEARL_BASE * this.pressure();
  }

  /** How much harder pearls are to find at this depth. */
  pressure(): number {
    return PRESSURE ** Math.min(this.s.rebirths, 400);
  }

  shardGain(): number {
    const m = this.mods;
    const v = Math.floor((this.s.runEarned / this.pearlBase()) ** m.shardExp * m.shardMult);
    return Number.isFinite(v) ? v : MAX;
  }

  /** Stardust this run needed for the next shard. */
  nextShardAt(): number {
    const m = this.mods;
    return this.pearlBase() * ((this.shardGain() + 1) / m.shardMult) ** (1 / m.shardExp);
  }

  rebirth(): number {
    const gain = this.shardGain();
    const s = this.s;
    if (gain > 0) {
      s.shards = safe(s.shards + gain);
      s.shardsTotal = safe(s.shardsTotal + gain);
      s.stats.shardsEarned = s.shardsTotal;
      s.rebirths++;
      if (s.stats.runTime < s.stats.fastestRebirth) s.stats.fastestRebirth = s.stats.runTime;
    }
    s.trial = null;
    this.invalidate();
    this.resetRun();
    this.emit('rebirth', { shards: gain });
    return gain;
  }

  private resetRun(): void {
    const s = this.s;
    const keep = this.mods.keepUpgrades;
    s.stardust = 0;
    s.runEarned = 0;
    s.gens = GENERATORS.map(() => 0);
    s.upgrades = keep ? new Set([...s.upgrades].filter((id) => KEEPABLE.has(UPGRADE_MAP.get(id)!.kind))) : new Set();
    s.buffs = [];
    s.combo = 0;
    s.surge = 0;
    s.lastPurchaseAge = 0;
    s.stats.runTime = 0;
    s.stats.runClicks = 0;
    s.stats.runComets = 0;
    this.invalidate();
    const m = this.mods;
    s.stardust = m.startStardust;
    for (let i = 0; i < Math.min(m.startGens, GENERATORS.length); i++) if (!this.genLocked(i)) s.gens[i] = 10;
    this.recalc();
  }

  startTrial(id: string): void {
    if (!TRIAL_MAP.has(id)) return;
    this.rebirth();
    this.s.trial = id;
    this.invalidate();
    this.resetRun();
  }

  /* ------------------------------------------------------------ comets */
  nextCometDelay(): number {
    return (30 + Math.random() * 45) * this.mods.cometInterval;
  }

  catchComet(): CometReward {
    const s = this.s;
    const m = this.mods;
    s.stats.comets++;
    s.stats.runComets++;
    const roll = Math.random();
    let reward: CometReward;
    if (roll < 0.4) {
      // Big but bounded: never more than a slice of your bank plus two minutes of production.
      const raw = (this.baseCps * 300 + m.clickBase * m.clickMult * 150 + 25) * m.cometPower;
      const cap = s.stardust * 0.2 + this.baseCps * 120 * Math.sqrt(m.cometPower) + 50;
      const amount = safe(Math.min(raw, cap));
      this.earn(amount);
      s.stats.starfalls++;
      reward = { kind: 'starfall', amount };
    } else {
      const kind: BuffId = roll < 0.75 ? 'frenzy' : roll < 0.9 ? 'clickstorm' : 'combolock';
      const duration = BUFF_INFO[kind].base * m.buffDuration * Math.sqrt(m.cometPower);
      const existing = s.buffs.find((b) => b.id === kind);
      if (existing) {
        existing.remaining = Math.max(existing.remaining, duration);
        existing.duration = Math.max(existing.duration, duration);
      } else s.buffs.push({ id: kind, remaining: duration, duration });
      reward = { kind, duration };
    }
    this.recalc();
    return reward;
  }

  /* ------------------------------------------------------------ main tick */
  tick(dt: number): void {
    const s = this.s;
    const m = this.mods;
    s.stats.playTime += dt;
    // Fold this tick's tap earnings into a ~1s rolling rate, so the display
    // climbs while you tap and eases back down when you stop.
    if (dt > 0) {
      const k = 1 - Math.exp(-dt / 1);
      this.tapRate += (this.tapAcc / dt - this.tapRate) * k;
      // Once you've stopped, drop the leftover tail instead of showing crumbs.
      if (this.tapAcc === 0 && this.tapRate < Math.max(1e-6, this.cps * 0.03)) this.tapRate = 0;
      this.tapAcc = 0;
    }
    s.stats.runTime += dt;
    s.lastPurchaseAge += dt;

    // Buffs
    if (s.buffs.length) {
      let changed = false;
      for (const b of s.buffs) b.remaining -= dt;
      const before = s.buffs.length;
      s.buffs = s.buffs.filter((b) => b.remaining > 0);
      changed = before !== s.buffs.length;
      if (changed) this.recalc();
    }

    // Combo
    if (s.buffs.some((b) => b.id === 'combolock')) s.combo = this.comboCap();
    else if (s.combo > 0 && !this.event?.comboHold) {
      s.comboTimer -= dt;
      if (s.comboTimer <= 0) s.combo = Math.max(0, s.combo - Math.ceil(dt * 60));
    }

    this.recalc();
    this.earn(this.cps * dt);

    // Echo hands (auto-clicks). Aggregated into one expected-value payout for speed.
    if (m.autoClickRate > 0 && !m.noClick) {
      this.autoClickAcc += m.autoClickRate * dt;
      const n = Math.floor(this.autoClickAcc);
      if (n > 0) {
        this.autoClickAcc -= n;
        if (m.autoClickCombo) {
          s.combo = Math.min(s.combo + n, this.comboCap());
          s.comboTimer = m.comboDecay;
        }
        // Echoes use raw click power only; the "% of production" bonus rewards real clicks.
        const echo = m.clickBase * m.clickMult * this.comboMult() * this.buffMult('clickstorm') * this.buffMult('flare') * (this.event?.click ?? 1);
        const expected = safe(echo * (1 + this.critChance() * (m.critMult - 1)));
        this.earn(expected * n);
        this.tapAcc += expected * n;
        s.stats.clickEarned = safe(s.stats.clickEarned + expected * n);
      }
    }

    // Cosmic events
    if (s.event) {
      s.event.remaining -= dt;
      if (s.event.remaining <= 0) {
        const ended = this.event;
        s.event = null;
        this.recalc();
        if (ended) this.emit('eventEnd', ended);
      }
    } else {
      s.eventTimer -= dt;
      if (s.eventTimer <= 0) this.startEvent();
    }

    // Comets
    const swarm = this.event?.cometEvery;
    if (swarm && s.cometTimer > swarm) s.cometTimer = swarm * (0.6 + Math.random() * 0.8);
    if (!m.noComets || swarm) {
      s.cometTimer -= dt;
      if (s.cometTimer <= 0) {
        s.cometTimer = swarm ? swarm * (0.6 + Math.random() * 0.8) : this.nextCometDelay();
        this.emit('comet', { twin: Math.random() < m.twinCometChance });
      }
    }

    // Autobuyers twice a second
    this.autoTimer += dt;
    if (this.autoTimer >= 0.5) {
      this.autoTimer = 0;
      this.runAutobuyers();
    }

    // Trial completion
    if (s.trial) {
      const t = TRIAL_MAP.get(s.trial);
      if (t && s.runEarned >= t.goal && !s.trialsDone.has(t.id)) {
        s.trialsDone.add(t.id);
        this.invalidate();
        this.emit('trialComplete', t.id);
      }
    }

    // Achievements once a second
    this.achTimer += dt;
    if (this.achTimer >= 1) {
      this.achTimer = 0;
      this.checkAchievements();
    }
  }

  /** The lure flares: a short burst of ×10 taps and ×3 production. */
  startFlare(): void {
    const s = this.s;
    const m = this.mods;
    s.surge = 0;
    s.stats.flares++;
    const duration = (BUFF_INFO.flare.base + m.flareBonus) * m.buffDuration;
    s.buffs = s.buffs.filter((b) => b.id !== 'flare');
    s.buffs.push({ id: 'flare', remaining: duration, duration });
    this.recalc();
    this.emit('flare', undefined);
  }

  flareProd(): number {
    return this.s.buffs.some((b) => b.id === 'flare') ? 1 + 2 * this.mods.buffPower : 1;
  }

  startEvent(id?: string): void {
    const s = this.s;
    const def = (id && EVENT_MAP.get(id)) || rollEvent(this.lastEventId);
    this.lastEventId = def.id;
    const dur = def.duration * this.mods.eventDuration;
    s.event = { id: def.id, remaining: dur, duration: dur };
    s.eventTimer = 100 + Math.random() * 120;
    s.stats.events++;
    this.recalc();
    this.emit('event', def);
  }

  runAutobuyers(): void {
    const s = this.s;
    const m = this.mods;
    if (m.autoUpgrades && s.autobuy.upgrades && !m.noUpgrades) {
      for (const u of this.shopUpgrades()) {
        if (this.upgradeCost(u) > s.stardust) break;
        this.buyUpgrade(u.id, true);
      }
    }
    if (m.autoGens && s.autobuy.gens) this.buyCheapest(500);
    if (m.autoRebirth && s.autobuy.rebirth && !s.trial && this.shardGain() >= Math.max(1, s.autobuy.rebirthAt)) {
      this.rebirth();
    }
  }

  /**
   * Keep buying whichever harvester is cheapest until the money runs out.
   * Used by the autobuyer and the "Spend all" button. Returns how many were bought.
   */
  buyCheapest(limit = 2000): number {
    const s = this.s;
    const m = this.mods;
    let bought = 0;
    for (let iter = 0; iter < limit; iter++) {
      let best = -1;
      let bestCost = Infinity;
      for (let i = 0; i <= m.maxGenIndex; i++) {
        const c = this.genCost(i);
        if (c < bestCost) {
          bestCost = c;
          best = i;
        }
      }
      if (best < 0 || bestCost > s.stardust) break;
      s.stardust -= bestCost;
      s.gens[best]++;
      s.stats.gensBought++;
      bought++;
    }
    if (bought) {
      s.lastPurchaseAge = 0;
      this.recalc();
    }
    return bought;
  }

  checkAchievements(): void {
    const s = this.s;
    const ctx = { cps: this.cps };
    for (const a of ACHIEVEMENTS) {
      if (!s.achievements.has(a.id) && a.check(s, ctx)) {
        s.achievements.add(a.id);
        this.emit('achievement', a);
      }
    }
  }

  /* ------------------------------------------------------------ offline */
  applyOffline(seconds: number): { seconds: number; gain: number; capped: boolean } {
    const m = this.mods;
    const cap = m.offlineCapH * 3600;
    const used = Math.min(seconds, cap);
    // Buffs keep ticking while away.
    this.s.buffs = this.s.buffs.filter((b) => (b.remaining -= seconds) > 0);
    this.s.cometTimer = Math.max(5, this.s.cometTimer - seconds);
    if (this.s.event && (this.s.event.remaining -= seconds) <= 0) this.s.event = null;
    this.s.eventTimer = Math.max(20, this.s.eventTimer - seconds);
    this.s.combo = 0;
    this.recalc();
    const gain = safe(this.baseCps * used * m.offlineEff);
    this.earn(gain);
    this.s.stats.offlineEarned = safe(this.s.stats.offlineEarned + gain);
    this.s.stats.playTime += used;
    this.s.stats.runTime += used;
    if (seconds >= 3600) this.s.flags.add('away');
    return { seconds: used, gain, capped: seconds > cap };
  }

  hardReset(): void {
    const settings = this.s.settings;
    this.s = newGame();
    this.s.settings = settings;
    this.invalidate();
    this.recalc();
    this.emit('reset', undefined);
  }
}
