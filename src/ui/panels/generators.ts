import type { Game } from '../../core/game';
import type { BuyAmount } from '../../core/state';
import { GENERATORS } from '../../data/generators';
import { TIER_THRESHOLDS } from '../../data/upgrades';
import { fmt, fmtInt, fmtPct, fmtTime } from '../../core/format';
import { h, setText, setWidth, toggle, replay, rollNumber } from '../dom';
import { ic } from '../icons';
import { tip, consumeLongPress } from '../tooltip';
import { sound } from '../audio';
import { fx } from '../fx';
import type { Panel } from './panel';

interface Row {
  el: HTMLButtonElement;
  name: HTMLElement;
  tag: HTMLElement;
  meta: HTMLElement;
  owned: HTMLElement;
  cost: HTMLElement;
  tier: HTMLElement;
  icon: HTMLElement;
}

const AMOUNTS: BuyAmount[] = [1, 10, 100, 'next', 'max'];
const AMOUNT_LABEL: Record<string, string> = { 1: '×1', 10: '×10', 100: '×100', next: 'Next', max: 'Max' };
const AMOUNT_TIP: Record<string, string> = {
  1: 'Buy one at a time',
  10: 'Buy ten at a time',
  100: 'Buy a hundred at a time',
  next: 'Buy just enough to reach the next workshop upgrade (5, 25, 50, 100…)',
  max: 'Buy as many as you can afford',
};

export class GeneratorsPanel implements Panel {
  id = 'gens';
  label = 'Harvest';
  icon = 'fishing-net';
  el = h('div', { class: 'view' });
  private rows: Row[] = [];
  private seg: HTMLElement;
  private sub: HTMLElement;
  private spendBtn: HTMLButtonElement;
  private best = -1;

  constructor(private game: Game) {
    const head = h('div', { class: 'view-head' });
    head.innerHTML = `<div><h2 class="view-title">Harvesters</h2><div class="view-sub"></div></div><div class="spacer"></div>`;
    this.sub = head.querySelector('.view-sub')!;
    this.spendBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-tip': 'Buy the cheapest harvesters until you run out (X)' }, `${ic('coins-pile')} Spend all`) as HTMLButtonElement;
    this.spendBtn.addEventListener('click', () => this.spendAll());
    this.seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Buy amount' });
    for (const amt of AMOUNTS) {
      const b = h('button', { type: 'button', 'data-amt': String(amt), 'data-tip': AMOUNT_TIP[String(amt)] }, AMOUNT_LABEL[String(amt)]);
      b.addEventListener('click', () => this.setAmount(amt));
      this.seg.append(b);
    }
    head.append(this.spendBtn, this.seg);
    const list = h('div', { class: 'gen-list' });
    GENERATORS.forEach((g) => {
      const el = h('button', { class: 'gen', type: 'button', style: `--hue:${g.hue}` }) as HTMLButtonElement;
      el.innerHTML = `<span class="gen-ic" style="--hue:${g.hue}">${ic(g.icon)}</span>
        <span class="gen-main"><span class="gen-name"><span></span><span class="gen-tag" hidden>best value</span></span><span class="gen-meta"></span>
        <span class="bar gen-tier"><span class="bar-fill" style="display:block"></span></span></span>
        <span class="gen-side"><span class="gen-owned">0</span><span class="gen-cost"></span></span>`;
      const row: Row = {
        el,
        name: el.querySelector('.gen-name span')!,
        tag: el.querySelector('.gen-tag')!,
        meta: el.querySelector('.gen-meta')!,
        owned: el.querySelector('.gen-owned')!,
        cost: el.querySelector('.gen-cost')!,
        tier: el.querySelector('.bar-fill')!,
        icon: el.querySelector('.gen-ic')!,
      };
      this.bindHold(el, () => this.buy(g.id, row, true));
      el.addEventListener('click', () => {
        if (consumeLongPress(el) || this.heldFired) {
          this.heldFired = false;
          return;
        }
        this.buy(g.id, row, false);
      });
      tip(el, () => this.tipFor(g.id));
      this.rows.push(row);
      list.append(el);
    });
    this.el.append(head, list);
    this.syncSeg();
  }

  /* ------------------------------------------------------------ hold to buy */
  private heldFired = false;
  private bindHold(el: HTMLElement, fire: () => boolean): void {
    let timer = 0;
    let count = 0;
    const stop = () => {
      clearTimeout(timer);
      timer = 0;
    };
    const loop = () => {
      if (!fire()) return stop();
      this.heldFired = true;
      count++;
      // Starts gently, then speeds up the longer you hold.
      timer = window.setTimeout(loop, Math.max(45, 160 * 0.88 ** count));
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.pointerType === 'touch') return; // touch uses long-press for details
      count = 0;
      this.heldFired = false;
      timer = window.setTimeout(loop, 380);
    });
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointerleave', stop);
    el.addEventListener('pointercancel', stop);
  }

  setAmount(amt: BuyAmount): void {
    this.game.s.settings.buyAmount = amt;
    sound.tick();
    this.syncSeg();
    this.update();
  }

  cycleAmount(): void {
    const i = AMOUNTS.indexOf(this.game.s.settings.buyAmount);
    this.setAmount(AMOUNTS[(i + 1) % AMOUNTS.length]);
  }

  private syncSeg(): void {
    const cur = String(this.game.s.settings.buyAmount);
    this.seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.amt === cur)));
  }

  private amountFor(i: number): number {
    const amt = this.game.s.settings.buyAmount;
    if (amt === 'max') return Math.max(1, this.game.maxAffordable(i));
    if (amt === 'next') {
      const owned = this.game.s.gens[i];
      const next = TIER_THRESHOLDS.find((t) => t > owned);
      return next ? next - owned : 1;
    }
    return amt;
  }

  private buy(i: number, row: Row, quiet: boolean): boolean {
    const g = this.game;
    const n = g.buyGen(i, g.s.settings.buyAmount === 'max' ? 'max' : this.amountFor(i));
    if (n <= 0) {
      if (!quiet) {
        sound.denied();
        replay(row.el, 'shake');
      }
      return false;
    }
    sound.buy(n);
    replay(row.el, 'bought');
    replay(row.owned, 'bump');
    const r = row.icon.getBoundingClientRect();
    fx.bubbles(r.left + r.width / 2, r.top + r.height / 2, 4 + Math.min(10, n));
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, 6 + Math.min(14, n), { hue: GENERATORS[i].hue, speed: 3 });
    this.update();
    return true;
  }

  spendAll(): void {
    const n = this.game.buyCheapest();
    if (n <= 0) {
      sound.denied();
      replay(this.spendBtn, 'shake');
      return;
    }
    sound.buy(n);
    const r = this.spendBtn.getBoundingClientRect();
    fx.bubbles(r.left + r.width / 2, r.top, 16);
    fx.float(r.left + r.width / 2, r.top - 10, `+${fmtInt(n)} harvesters`, { size: 16, color: '#9fe6a0' });
    for (const row of this.rows) if (!row.el.hidden) replay(row.el, 'bought');
    this.update();
  }

  private visibleCount(): number {
    const s = this.game.s;
    let highest = -1;
    s.gens.forEach((n, i) => {
      if (n > 0) highest = i;
    });
    let next = highest + 1;
    while (next < GENERATORS.length && s.runEarned >= GENERATORS[next].baseCost * 0.35) next++;
    return Math.min(GENERATORS.length, Math.max(2, next + 1));
  }

  /** Lumen per second one more of this harvester would add (ignores synergy changes). */
  private unitProd(i: number): number {
    const g = this.game;
    const owned = g.s.gens[i];
    return owned > 0 ? g.perGen[i] / owned : GENERATORS[i].baseProd * g.mods.genMult[i] * g.globalMult;
  }

  /** Seconds a single purchase takes to pay for itself. */
  private payback(i: number): number {
    const p = this.unitProd(i);
    return p > 0 ? this.game.genCost(i) / p : Infinity;
  }

  private tipFor(i: number): string {
    const g = this.game;
    const def = GENERATORS[i];
    if (this.isMystery(i)) return `<h4>Something in the dark</h4><p>Gather a bit more lumen and you'll see what it is.</p>`;
    const nextTier = TIER_THRESHOLDS.find((t) => t > g.s.gens[i]);
    const wait = g.genCost(i) > g.s.stardust && g.cps > 0 ? (g.genCost(i) - g.s.stardust) / g.cps : 0;
    return `<div class="tip-kicker">Harvester ${i + 1}</div><h4>${def.name}</h4><p><i>${def.flavor}</i></p>
      <div class="tip-meta"><span>Each: ${fmt(this.unitProd(i))}/s</span><span>Total: ${fmt(g.perGen[i])}/s</span></div>
      <div class="tip-meta"><span>One more pays for itself in</span><span>${fmtTime(this.payback(i))}</span></div>
      ${wait > 0 ? `<div class="tip-meta"><span>Affordable in</span><span>${fmtTime(wait)}</span></div>` : ''}
      ${nextTier ? `<div class="tip-meta"><span>Next workshop upgrade at</span><span>${nextTier} owned</span></div>` : ''}
      <div class="tip-meta"><span style="color:var(--muted)">Hold to keep buying</span></div>`;
  }

  private isMystery(i: number): boolean {
    const s = this.game.s;
    return s.gens[i] === 0 && s.runEarned < GENERATORS[i].baseCost * 0.35 && (i === 0 ? false : s.gens[i - 1] === 0);
  }

  update(): void {
    const g = this.game;
    const s = g.s;
    const visible = this.visibleCount();
    setText(this.sub, `${fmt(g.cps)} lumen a second`);
    this.spendBtn.disabled = g.genCost(0) > s.stardust && g.genCost(1) > s.stardust;

    // Best value: the visible, buildable harvester with the shortest payback.
    let best = -1;
    let bestPay = Infinity;
    for (let i = 0; i < visible; i++) {
      if (g.genLocked(i) || this.isMystery(i)) continue;
      const p = this.payback(i);
      if (p < bestPay) {
        bestPay = p;
        best = i;
      }
    }
    this.best = s.gens.some((n) => n > 0) ? best : -1;

    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const shown = i < visible;
      if (row.el.hidden === shown) row.el.hidden = !shown;
      if (!shown) continue;
      const def = GENERATORS[i];
      const locked = g.genLocked(i);
      const mystery = this.isMystery(i);
      toggle(row.el, 'mystery', mystery);
      toggle(row.el, 'locked', locked);
      const n = this.amountFor(i);
      const cost = g.genCost(i, n);
      const can = !locked && cost <= s.stardust;
      toggle(row.el, 'can', can);
      row.el.setAttribute('aria-disabled', String(!can));
      setText(row.name, mystery ? '???' : def.name);
      row.tag.hidden = i !== this.best;
      rollNumber(row.owned, s.gens[i], fmtInt, { integer: true, speed: 10 });
      const share = g.cps > 0 ? g.perGen[i] / g.cps : 0;
      if (locked) setText(row.meta, 'Out of reach in this trench');
      else if (mystery) setText(row.meta, 'Something moving in the dark');
      else if (s.gens[i] === 0) setText(row.meta, `Makes ${fmt(this.unitProd(i))}/s each`);
      else setText(row.meta, `${fmt(g.perGen[i])}/s, ${fmtPct(share)} of the haul`);
      const amtLabel = n > 1 || s.settings.buyAmount === 'max' || s.settings.buyAmount === 'next' ? `×${fmtInt(n)} ` : '';
      const wait = !can && !locked && g.cps > 0 ? (cost - s.stardust) / g.cps : 0;
      setText(row.cost, locked ? '—' : `${amtLabel}${fmt(cost)}${wait > 0 ? ` · ${fmtTime(wait)}` : ''}`);
      const owned = s.gens[i];
      const nextIdx = TIER_THRESHOLDS.findIndex((t) => t > owned);
      if (nextIdx === -1) setWidth(row.tier, 1);
      else {
        const prev = nextIdx === 0 ? 0 : TIER_THRESHOLDS[nextIdx - 1];
        setWidth(row.tier, (owned - prev) / (TIER_THRESHOLDS[nextIdx] - prev));
      }
    }
  }
}
