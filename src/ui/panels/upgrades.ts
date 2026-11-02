import type { Game } from '../../core/game';
import { UPGRADE_MAP, type UpgradeDef, type UpgradeKind } from '../../data/upgrades';
import { fmt, fmtTime } from '../../core/format';
import { h, setText, toggle } from '../dom';
import { ic } from '../icons';
import { tip, consumeLongPress, hideTip } from '../tooltip';
import { sound } from '../audio';
import { fx } from '../fx';
import type { Panel } from './panel';

const FILTER_KEY = 'lanterndeep-upg-filter';

const KIND_LABEL: Record<UpgradeKind, string> = {
  gen: 'Harvester upgrade',
  click: 'Lure upgrade',
  crit: 'Luck upgrade',
  combo: 'Streak upgrade',
  comet: 'Glimmerfish upgrade',
  global: 'Big upgrade',
  synergy: 'Synergy',
};

export class UpgradesPanel implements Panel {
  id = 'upgrades';
  label = 'Workshop';
  icon = 'upgrade';
  el = h('div', { class: 'view' });
  private grid = h('div', { class: 'upg-grid' });
  private empty = h('div', { class: 'empty' });
  private ownedWrap = h('div', { class: 'owned-strip' });
  private ownedIcons = h('div', { class: 'owned-icons' });
  private buyAll: HTMLButtonElement;
  private count: HTMLElement;
  private key = '';
  private ownedKey = -1;
  private tiles = new Map<string, HTMLButtonElement>();
  private shop: UpgradeDef[] = [];
  private filter: HTMLInputElement;

  constructor(private game: Game) {
    const head = h('div', { class: 'view-head' });
    head.innerHTML = `<div><h2 class="view-title">Workshop</h2><div class="view-sub"></div></div><div class="spacer"></div>`;
    this.count = head.querySelector('.view-sub')!;
    this.buyAll = h('button', { class: 'btn btn-sm', type: 'button' }, `${ic('check-mark')} Buy all`) as HTMLButtonElement;
    this.buyAll.addEventListener('click', () => {
      const n = this.game.buyAllUpgrades();
      if (n > 0) {
        sound.upgrade();
        const r = this.buyAll.getBoundingClientRect();
        fx.burst(r.left + r.width / 2, r.top, 30, { speed: 4 });
        this.update();
      } else sound.denied();
    });
    // "Only what I can afford" filter, remembered per browser.
    const filterLabel = h('label', { class: 'filter-toggle' });
    this.filter = h('input', { type: 'checkbox', class: 'switch', role: 'switch' }) as HTMLInputElement;
    try {
      this.filter.checked = localStorage.getItem(FILTER_KEY) === '1';
    } catch {
      /* storage blocked */
    }
    this.filter.addEventListener('change', () => {
      try {
        localStorage.setItem(FILTER_KEY, this.filter.checked ? '1' : '0');
      } catch {
        /* ignore */
      }
      sound.tick();
      this.key = '';
      this.update();
    });
    filterLabel.append(this.filter, document.createTextNode('Only what I can afford'));
    head.append(filterLabel, this.buyAll);
    this.ownedWrap.innerHTML = '<h3>Fitted this dive</h3>';
    this.ownedWrap.append(this.ownedIcons);
    this.el.append(head, this.grid, this.empty, this.ownedWrap);
  }

  private tipHtml(u: UpgradeDef, owned = false): string {
    const g = this.game;
    const cost = g.upgradeCost(u);
    const ok = cost <= g.s.stardust;
    const wait = !ok && g.cps > 0 ? (cost - g.s.stardust) / g.cps : 0;
    return `<div class="tip-kicker">${KIND_LABEL[u.kind]}</div><h4>${u.name}</h4><p>${u.desc}</p>
      ${owned ? '<div class="tip-meta"><span>Fitted</span></div>' : `<div class="tip-meta"><span>Cost</span><span class="tip-cost ${ok ? 'ok' : ''}">${fmt(cost)}</span></div>${
        wait > 0 ? `<div class="tip-meta"><span>Affordable in</span><span>${fmtTime(wait)}</span></div>` : ''
      }`}`;
  }

  private buy(u: UpgradeDef, tile: HTMLButtonElement): void {
    if (consumeLongPress(tile)) return;
    if (!this.game.buyUpgrade(u.id)) {
      sound.denied();
      tile.animate([{ translate: '-3px 0' }, { translate: '3px 0' }, { translate: '0 0' }], { duration: 200 });
      return;
    }
    sound.upgrade();
    hideTip();
    const r = tile.getBoundingClientRect();
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, 26, { hue: u.hue, speed: 4 });
    fx.ring(r.left + r.width / 2, r.top + r.height / 2, 60, 'rgba(255,230,170,0.8)', 2, 28);
    tile.classList.add('out');
    this.tiles.delete(u.id);
    setTimeout(() => {
      tile.remove();
      this.key = '';
      this.update();
    }, 330);
  }

  private render(): void {
    const keep = new Set(this.shop.map((u) => u.id));
    for (const [id, el] of this.tiles) {
      if (!keep.has(id)) {
        el.remove();
        this.tiles.delete(id);
      }
    }
    this.shop.forEach((u, i) => {
      let tile = this.tiles.get(u.id);
      if (!tile) {
        tile = h('button', { class: 'upg', type: 'button', style: `--hue:${u.hue};animation-delay:${Math.min(i, 12) * 18}ms`, 'aria-label': u.name }) as HTMLButtonElement;
        tile.innerHTML = `${ic(u.icon)}<span class="upg-kind"></span>`;
        const t = tile;
        tile.addEventListener('click', () => this.buy(u, t));
        tip(tile, () => this.tipHtml(u));
        this.tiles.set(u.id, tile);
      }
      // keep DOM order equal to price order
      if (this.grid.children[i] !== tile) this.grid.insertBefore(tile, this.grid.children[i] ?? null);
    });
  }

  private renderOwned(): void {
    const s = this.game.s;
    this.ownedIcons.innerHTML = '';
    for (const id of s.upgrades) {
      const u = UPGRADE_MAP.get(id);
      if (!u) continue;
      const span = h('span', { style: `--hue:${u.hue}` }, ic(u.icon));
      tip(span, () => this.tipHtml(u, true));
      this.ownedIcons.append(span);
    }
    this.ownedWrap.hidden = s.upgrades.size === 0;
  }

  update(): void {
    const g = this.game;
    this.shop = g.shopUpgrades().slice(0, 80);
    if (this.filter.checked) this.shop = this.shop.filter((u) => g.upgradeCost(u) <= g.s.stardust);
    const key = this.shop.map((u) => u.id).join('|');
    if (key !== this.key) {
      this.key = key;
      this.render();
    }
    if (g.s.upgrades.size !== this.ownedKey) {
      this.ownedKey = g.s.upgrades.size;
      this.renderOwned();
    }
    const blocked = g.mods.noUpgrades;
    let affordable = 0;
    for (const u of this.shop) {
      const can = !blocked && g.upgradeCost(u) <= g.s.stardust;
      if (can) affordable++;
      const tile = this.tiles.get(u.id);
      if (tile) toggle(tile, 'can', can);
    }
    this.buyAll.disabled = affordable === 0;
    setText(this.count, blocked ? 'Closed during the Empty Workshop trench' : `${this.shop.length} on the shelf, ${affordable} you can afford`);
    const none = this.shop.length === 0;
    this.empty.hidden = !none;
    if (none) this.empty.innerHTML = `<b>The shelves are bare</b>Build harvesters and gather lumen. New upgrades turn up as you grow.`;
  }

  badge(): boolean {
    const g = this.game;
    if (g.mods.noUpgrades) return false;
    for (const u of g.shopUpgrades()) if (g.upgradeCost(u) <= g.s.stardust) return true;
    return false;
  }
}
