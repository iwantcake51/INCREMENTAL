import type { Game } from '../../core/game';
import { fmt, fmtInt, fmtTime } from '../../core/format';
import { zoneAt } from '../../data/zones';
import { h, setText } from '../dom';
import type { Panel } from './panel';

type Row = [string, () => string];

export class StatsPanel implements Panel {
  id = 'stats';
  label = 'Logbook';
  icon = 'scroll-unfurled';
  el = h('div', { class: 'view' });
  private cells: { td: HTMLElement; fn: () => string }[] = [];

  constructor(private game: Game) {
    const s = () => this.game.s;
    const g = () => this.game;
    const groups: [string, Row[]][] = [
      ['Your sub right now', [
        ['Air', () => `${Math.round(g().mods.maxAir)}s`],
        ['Hull', () => fmtInt(g().mods.maxHull)],
        ['Speed', () => `${Math.round(g().mods.speed * 100)}%`],
        ['Lamp', () => `${Math.round(g().mods.light * 100)}%`],
        ['Magnet reach', () => fmtInt(g().mods.magnet)],
        ['Lumen multiplier', () => `×${fmt(g().mods.lumenMult * g().valueMult())}`],
        ['Farm', () => (g().farmRate > 0 ? `${fmt(g().farmRate)}/s` : 'not built')],
        ['Kept when the hull breaks', () => `${Math.round(g().mods.keepOnBreach * 100)}%`],
      ]],
      ['Records', [
        ['Deepest dive', () => `${fmtInt(s().deepest)} m (${zoneAt(s().deepest).name})`],
        ['Best single dive', () => fmt(s().stats.bestDive)],
        ['Longest streak', () => fmtInt(s().stats.bestStreak)],
      ]],
      ['All time', [
        ['Lumen gathered', () => fmt(s().lumenTotal)],
        ['Dives', () => fmtInt(s().stats.dives)],
        ['Time underwater', () => fmtTime(s().stats.diveTime)],
        ['Time played', () => fmtTime(s().stats.playTime)],
        ['Plankton collected', () => fmtInt(s().stats.motes)],
        ['Glimmerfish caught', () => fmtInt(s().stats.fish)],
        ['Chests opened', () => fmtInt(s().stats.chests)],
        ['Air bubbles', () => fmtInt(s().stats.airBubbles)],
        ['Hits taken', () => fmtInt(s().stats.hits)],
        ['Hull breaches', () => fmtInt(s().stats.breaches)],
        ['Dashes', () => fmtInt(s().stats.dashes)],
        ['Flares', () => fmtInt(s().stats.flares)],
        ['Sub upgrades bought', () => fmtInt(s().stats.shopLevels)],
        ['Rebuilds', () => fmtInt(s().rebuilds)],
        ['Black Pearls found', () => fmt(s().pearlsTotal)],
        ['From the farm', () => fmt(s().stats.farmEarned)],
        ['First dive', () => new Date(s().created).toLocaleDateString()],
      ]],
    ];
    this.el.append(h('div', { class: 'view-head' }, '<h2 class="view-title">Logbook</h2>'));
    for (const [title, rows] of groups) {
      const wrap = h('div', { class: 'stat-group' }, `<div class="section-h" style="margin-top:0">${title}</div>`);
      const table = h('table', { class: 'stat-table' });
      for (const [label, fn] of rows) {
        const tr = h('tr', {}, `<th scope="row">${label}</th><td></td>`);
        this.cells.push({ td: tr.querySelector('td')!, fn });
        table.append(tr);
      }
      wrap.append(table);
      this.el.append(wrap);
    }
  }

  update(): void {
    for (const c of this.cells) setText(c.td, c.fn());
  }
}
