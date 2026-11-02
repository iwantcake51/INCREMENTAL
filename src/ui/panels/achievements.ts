import type { Game } from '../../core/game';
import { ACHIEVEMENTS } from '../../data/achievements';
import { fmtPct } from '../../core/format';
import { h, setText, setWidth, toggle } from '../dom';
import { ic } from '../icons';
import { tip } from '../tooltip';
import type { Panel } from './panel';

export class AchievementsPanel implements Panel {
  id = 'ach';
  label = 'Finds';
  icon = 'triple-shells';
  el = h('div', { class: 'view' });
  private count: HTMLElement;
  private bar: HTMLElement;
  private tiles = new Map<string, HTMLElement>();
  private last = -1;

  constructor(private game: Game) {
    const head = h('div', { class: 'view-head' });
    head.innerHTML = `<div><h2 class="view-title">Finds</h2><div class="view-sub"></div></div><div class="spacer"></div>
      <div class="ach-progress"><div class="bar"><div class="bar-fill"></div></div></div>`;
    this.count = head.querySelector('.view-sub')!;
    this.bar = head.querySelector('.bar-fill')!;
    const grid = h('div', { class: 'ach-grid' });
    for (const a of ACHIEVEMENTS) {
      const t = h('span', { class: 'ach', tabindex: 0, role: 'img', 'aria-label': a.name });
      t.innerHTML = ic(a.secret ? 'help' : a.icon);
      tip(t, () => {
        const got = this.game.s.achievements.has(a.id);
        if (a.secret && !got) return `<div class="tip-kicker">Secret</div><h4>Still hidden</h4><p>Some finds only show themselves once you stumble on them.</p>`;
        return `<div class="tip-kicker">${got ? 'Found' : 'Not yet'}</div><h4>${a.name}</h4><p>${a.desc}</p>`;
      });
      this.tiles.set(a.id, t);
      grid.append(t);
    }
    this.el.append(head, grid);
  }

  update(): void {
    const s = this.game.s;
    if (s.achievements.size === this.last) return;
    this.last = s.achievements.size;
    for (const a of ACHIEVEMENTS) {
      const t = this.tiles.get(a.id)!;
      const got = s.achievements.has(a.id);
      toggle(t, 'got', got);
      if (got && a.secret && !t.dataset.revealed) {
        t.dataset.revealed = '1';
        t.innerHTML = ic(a.icon);
      }
    }
    setText(this.count, `${s.achievements.size} of ${ACHIEVEMENTS.length} found, worth +${fmtPct(s.achievements.size * this.game.mods.achPer)} production`);
    setWidth(this.bar, s.achievements.size / ACHIEVEMENTS.length);
  }
}
