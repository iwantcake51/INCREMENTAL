import type { Game } from '../../core/game';
import { SHOP, shopCost, type ShopItem } from '../../data/shop';
import { fmt, fmtTime } from '../../core/format';
import { h, setText, toggle, replay } from '../dom';
import { ic } from '../icons';
import { tip, consumeLongPress } from '../tooltip';
import { sound } from '../audio';
import { fx } from '../fx';
import type { Panel } from './panel';

interface Row {
  el: HTMLButtonElement;
  lvl: HTMLElement;
  fx: HTMLElement;
  cost: HTMLElement;
  icon: HTMLElement;
}

export class ShopPanel implements Panel {
  id = 'shop';
  label = 'Sub';
  icon = 'submarine';
  el = h('div', { class: 'view' });
  private rows = new Map<string, Row>();
  private sub: HTMLElement;

  constructor(private game: Game) {
    const head = h('div', { class: 'view-head' }, `<div><h2 class="view-title">Your sub</h2><div class="view-sub"></div></div>`);
    this.sub = head.querySelector('.view-sub')!;
    const list = h('div', { class: 'gen-list' });
    for (const item of SHOP) {
      const el = h('button', { class: 'gen', type: 'button', style: `--hue:${item.hue}` }) as HTMLButtonElement;
      el.innerHTML = `<span class="gen-ic" style="--hue:${item.hue}">${ic(item.icon)}</span>
        <span class="gen-main"><span class="gen-name"><span>${item.name}</span><span class="shop-lvl"></span></span>
        <span class="gen-meta"></span></span>
        <span class="gen-side"><span class="gen-cost"></span></span>`;
      const row: Row = {
        el,
        lvl: el.querySelector('.shop-lvl')!,
        fx: el.querySelector('.gen-meta')!,
        cost: el.querySelector('.gen-cost')!,
        icon: el.querySelector('.gen-ic')!,
      };
      el.addEventListener('click', () => {
        if (consumeLongPress(el)) return;
        this.buy(item, row);
      });
      tip(el, () => this.tipFor(item));
      this.rows.set(item.id, row);
      list.append(el);
    }
    this.el.append(head, list);
  }

  private tipFor(item: ShopItem): string {
    const g = this.game;
    const lvl = g.shopLevel(item.id);
    const maxed = lvl >= item.max;
    const cost = maxed ? 0 : shopCost(item, lvl);
    const ok = g.s.lumen >= cost;
    const wait = !maxed && !ok && g.farmRate > 0 ? (cost - g.s.lumen) / g.farmRate : 0;
    return `<div class="tip-kicker">Level ${lvl} of ${item.max}</div><h4>${item.name}</h4><p>${item.desc}</p>
      <div class="tip-meta"><span>Now</span><span>${item.fx(lvl)}</span></div>
      ${maxed ? '<div class="tip-meta"><span>Maxed out</span></div>' : `<div class="tip-meta"><span>Next</span><span>${item.fx(lvl + 1)}</span></div>
      <div class="tip-meta"><span>Cost</span><span class="tip-cost ${ok ? 'ok' : ''}">${fmt(cost)}</span></div>`}
      ${wait > 0 ? `<div class="tip-meta"><span>The farm affords it in</span><span>${fmtTime(wait)}</span></div>` : ''}`;
  }

  private buy(item: ShopItem, row: Row): void {
    if (!this.game.buy(item.id)) {
      sound.denied();
      replay(row.el, 'shake');
      return;
    }
    sound.upgrade();
    replay(row.el, 'bought');
    const r = row.icon.getBoundingClientRect();
    fx.bubbles(r.left + r.width / 2, r.top + r.height / 2, 10);
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, 16, { hue: item.hue, speed: 3.2 });
    this.update();
  }

  update(): void {
    const g = this.game;
    let total = 0;
    for (const item of SHOP) {
      const row = this.rows.get(item.id)!;
      const lvl = g.shopLevel(item.id);
      total += lvl;
      const maxed = lvl >= item.max;
      const cost = maxed ? 0 : shopCost(item, lvl);
      const can = !maxed && g.s.lumen >= cost;
      toggle(row.el, 'can', can);
      toggle(row.el, 'maxed', maxed);
      setText(row.lvl, `${lvl}/${item.max}`);
      setText(row.fx, maxed ? `${item.fx(lvl)} · maxed` : lvl === 0 ? `${item.desc}` : `${item.fx(lvl)} → ${item.fx(lvl + 1)}`);
      setText(row.cost, maxed ? 'Max' : fmt(cost));
    }
    setText(this.sub, `${total} upgrades fitted. Upgrades stay until you rebuild the sub.`);
  }

  badge(): boolean {
    return SHOP.some((i) => this.game.canBuy(i.id));
  }
}
