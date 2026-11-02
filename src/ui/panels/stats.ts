import type { Game } from '../../core/game';
import { fmt, fmtInt, fmtTime, fmtPct } from '../../core/format';
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
      ['This dive', [
        ['Lumen gathered', () => fmt(s().runEarned)],
        ['Time', () => fmtTime(s().stats.runTime)],
        ['Taps', () => fmtInt(s().stats.runClicks)],
        ['Glimmerfish caught', () => fmtInt(s().stats.runComets)],
        ['Harvesters owned', () => fmtInt(s().gens.reduce((a, b) => a + b, 0))],
        ['Upgrades fitted', () => fmtInt(s().upgrades.size)],
      ]],
      ['Right now', [
        ['Income, taps included', () => `${fmt(g().totalRate)}/s`],
        ['From harvesters', () => `${fmt(g().cps)}/s`],
        ['From tapping', () => `${fmt(g().tapRate)}/s`],
        ['Lumen per tap', () => fmt(g().clickValue())],
        ['Global multiplier', () => `×${fmt(g().globalMult)}`],
        ['Lucky-tap chance', () => fmtPct(g().critChance())],
        ['Lucky-tap payout', () => `×${fmt(g().mods.critMult)}`],
        ['Longest streak allowed', () => `${g().comboCap()} (×${(1 + g().comboCap() * g().mods.comboPer).toFixed(2)})`],
        ['While away', () => `${fmtPct(g().mods.offlineEff)} for up to ${g().mods.offlineCapH}h`],
      ]],
      ['All time', [
        ['Lumen gathered', () => fmt(s().totalEarned)],
        ['Time played', () => fmtTime(s().stats.playTime)],
        ['Taps', () => fmtInt(s().stats.clicks)],
        ['Lumen from tapping', () => fmt(s().stats.clickEarned)],
        ['Lucky taps', () => fmtInt(s().stats.crits)],
        ['Longest streak', () => fmtInt(s().stats.bestCombo)],
        ['Best single tap', () => fmt(s().stats.bestClick)],
        ['Best production', () => `${fmt(s().stats.bestCps)}/s`],
        ['Harvesters built', () => fmtInt(s().stats.gensBought)],
        ['Upgrades bought', () => fmtInt(s().stats.upgradesBought)],
        ['Glimmerfish caught', () => fmtInt(s().stats.comets)],
        ['Sea events', () => fmtInt(s().stats.events)],
        ['Flares', () => fmtInt(s().stats.flares)],
        ['Descents', () => fmtInt(s().rebirths)],
        ['Black Pearls found', () => fmt(s().shardsTotal)],
        ['Gathered while away', () => fmt(s().stats.offlineEarned)],
        ['Trenches cleared', () => `${s().trialsDone.size} of 8`],
        ['First dive', () => new Date(s().created).toLocaleDateString()],
      ]],
    ];
    const head = h('div', { class: 'view-head' }, '<h2 class="view-title">Logbook</h2>');
    this.el.append(head);
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
