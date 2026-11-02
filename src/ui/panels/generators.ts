import type { Game } from '../../core/game';
import type { BuyAmount } from '../../core/state';
import { GENERATORS } from '../../data/generators';
import { TIER_THRESHOLDS } from '../../data/upgrades';
import { fmt, fmtInt, fmtPct } from '../../core/format';
import { h, setText, setWidth, toggle, replay } from '../dom';
import { ic } from '../icons';
import { tip, consumeLongPress } from '../tooltip';
import { sound } from '../audio';
import { fx } from '../fx';
import type { Panel } from './panel';

interface Row {
  el: HTMLButtonElement;
  name: HTMLElement;
  meta: HTMLElement;
  owned: HTMLElement;
  cost: HTMLElement;
  tier: HTMLElement;
  icon: HTMLElement;
}

export class GeneratorsPanel implements Panel {
  id = 'gens';
  label = 'Machines';
  icon = 'gears';
  el = h('div', { class: 'view' });
  private rows: Row[] = [];
  private seg: HTMLElement;
  private sub: HTMLElement;

  constructor(private game: Game) {
    const head = h('div', { class: 'view-head' });
    head.innerHTML = `<div><h2 class="view-title">Machines</h2><div class="view-sub"></div></div><div class="spacer"></div>`;
    this.sub = head.querySelector('.view-sub')!;
    this.seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Buy amount' });
    for (const amt of [1, 10, 100, 'max'] as BuyAmount[]) {
      const b = h('button', { type: 'button', 'data-amt': String(amt) }, amt === 'max' ? 'Max' : `×${amt}`);
      b.addEventListener('click', () => this.setAmount(amt));
      this.seg.append(b);
    }
    head.append(this.seg);
    const list = h('div', { class: 'gen-list' });
    GENERATORS.forEach((g) => {
      const el = h('button', { class: 'gen', type: 'button', style: `--hue:${g.hue}` }) as HTMLButtonElement;
      el.innerHTML = `<span class="gen-ic">${ic(g.icon)}</span>
        <span class="gen-main"><span class="gen-name"><span></span></span><span class="gen-meta"></span>
        <span class="bar gen-tier"><span class="bar-fill" style="display:block"></span></span></span>
        <span class="gen-side"><span class="gen-owned">0</span><span class="gen-cost"></span></span>`;
      const row: Row = {
        el,
        name: el.querySelector('.gen-name span')!,
        meta: el.querySelector('.gen-meta')!,
        owned: el.querySelector('.gen-owned')!,
        cost: el.querySelector('.gen-cost')!,
        tier: el.querySelector('.bar-fill')!,
        icon: el.querySelector('.gen-ic')!,
      };
      el.addEventListener('click', () => {
        if (consumeLongPress(el)) return;
        this.buy(g.id, row);
      });
      tip(el, () => this.tipFor(g.id));
      this.rows.push(row);
      list.append(el);
    });
    this.el.append(head, list);
    this.syncSeg();
  }

  setAmount(amt: BuyAmount): void {
    this.game.s.settings.buyAmount = amt;
    sound.tick();
    this.syncSeg();
    this.update();
  }

  cycleAmount(): void {
    const order: BuyAmount[] = [1, 10, 100, 'max'];
    const i = order.indexOf(this.game.s.settings.buyAmount);
    this.setAmount(order[(i + 1) % order.length]);
  }

  private syncSeg(): void {
    const cur = String(this.game.s.settings.buyAmount);
    this.seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.amt === cur)));
  }

  private amountFor(i: number): number {
    const amt = this.game.s.settings.buyAmount;
    return amt === 'max' ? Math.max(1, this.game.maxAffordable(i)) : amt;
  }

  private buy(i: number, row: Row): void {
    const g = this.game;
    const amt = g.s.settings.buyAmount;
    const n = g.buyGen(i, amt === 'max' ? 'max' : amt);
    if (n <= 0) {
      sound.denied();
      replay(row.el, 'shake');
      return;
    }
    sound.buy(n);
    replay(row.el, 'bought');
    replay(row.owned, 'bump');
    const r = row.icon.getBoundingClientRect();
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, 10 + Math.min(20, n), { hue: GENERATORS[i].hue, speed: 3.2 });
    this.update();
  }

  private visibleCount(): number {
    const s = this.game.s;
    let highest = -1;
    s.gens.forEach((n, i) => {
      if (n > 0) highest = i;
    });
    // Reveal generators as soon as you could afford roughly half of one.
    let next = highest + 1;
    while (next < GENERATORS.length && s.runEarned >= GENERATORS[next].baseCost * 0.35) next++;
    return Math.min(GENERATORS.length, Math.max(2, next + 1));
  }

  private tipFor(i: number): string {
    const g = this.game;
    const def = GENERATORS[i];
    const owned = g.s.gens[i];
    if (this.isMystery(i)) return `<h4>Unknown machine</h4><p>Keep gathering stardust to reveal it.</p>`;
    const each = owned > 0 ? g.perGen[i] / owned : def.baseProd * g.mods.genMult[i] * g.globalMult;
    const nextTier = TIER_THRESHOLDS.find((t) => t > owned);
    return `<div class="tip-kicker">Machine ${i + 1}</div><h4>${def.name}</h4><p><i>${def.flavor}</i></p>
      <div class="tip-meta"><span>Each: ${fmt(each)}/s</span><span>Total: ${fmt(g.perGen[i])}/s</span></div>
      ${nextTier ? `<div class="tip-meta"><span>Next upgrade unlocks at</span><span>${nextTier} owned</span></div>` : ''}`;
  }

  private isMystery(i: number): boolean {
    const s = this.game.s;
    return s.gens[i] === 0 && s.runEarned < GENERATORS[i].baseCost * 0.35 && (i === 0 ? false : s.gens[i - 1] === 0);
  }

  update(): void {
    const g = this.game;
    const s = g.s;
    const visible = this.visibleCount();
    setText(this.sub, `${fmt(g.cps)} stardust per second`);
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
      setText(row.owned, fmtInt(s.gens[i]));
      const share = g.cps > 0 ? g.perGen[i] / g.cps : 0;
      if (locked) setText(row.meta, 'Sealed by this trial');
      else if (mystery) setText(row.meta, 'An unknown machine');
      else if (s.gens[i] === 0) setText(row.meta, `Produces ${fmt(def.baseProd * g.mods.genMult[i] * g.globalMult)}/s each`);
      else setText(row.meta, `${fmt(g.perGen[i])}/s · ${fmtPct(share)} of output`);
      const amtLabel = s.settings.buyAmount === 'max' ? `×${fmtInt(n)} ` : n > 1 ? `×${n} ` : '';
      setText(row.cost, locked ? '—' : `${amtLabel}${fmt(cost)}`);
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
