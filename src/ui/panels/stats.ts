import type { Game } from '../../core/game';
import { fmt, fmtInt, fmtTime, fmtPct } from '../../core/format';
import { h, setText } from '../dom';
import type { Panel } from './panel';

type Row = [string, () => string];

export class StatsPanel implements Panel {
  id = 'stats';
  label = 'Ledger';
  icon = 'scroll-unfurled';
  el = h('div', { class: 'view' });
  private cells: { td: HTMLElement; fn: () => string }[] = [];

  constructor(private game: Game) {
    const s = () => this.game.s;
    const g = () => this.game;
    const groups: [string, Row[]][] = [
      ['This run', [
        ['Stardust earned', () => fmt(s().runEarned)],
        ['Time', () => fmtTime(s().stats.runTime)],
        ['Clicks', () => fmtInt(s().stats.runClicks)],
        ['Comets caught', () => fmtInt(s().stats.runComets)],
        ['Machines owned', () => fmtInt(s().gens.reduce((a, b) => a + b, 0))],
        ['Upgrades owned', () => fmtInt(s().upgrades.size)],
      ]],
      ['Right now', [
        ['Production', () => `${fmt(g().cps)}/s`],
        ['Click power', () => fmt(g().clickValue())],
        ['Global multiplier', () => `×${fmt(g().globalMult)}`],
        ['Crit chance', () => fmtPct(g().critChance())],
        ['Crit power', () => `×${fmt(g().mods.critMult)}`],
        ['Combo cap', () => `${g().comboCap()} (×${(1 + g().comboCap() * g().mods.comboPer).toFixed(2)})`],
        ['Offline efficiency', () => `${fmtPct(g().mods.offlineEff)} for up to ${g().mods.offlineCapH}h`],
      ]],
      ['All time', [
        ['Stardust earned', () => fmt(s().totalEarned)],
        ['Time played', () => fmtTime(s().stats.playTime)],
        ['Clicks', () => fmtInt(s().stats.clicks)],
        ['Stardust from clicks', () => fmt(s().stats.clickEarned)],
        ['Critical clicks', () => fmtInt(s().stats.crits)],
        ['Best combo', () => fmtInt(s().stats.bestCombo)],
        ['Best click', () => fmt(s().stats.bestClick)],
        ['Best production', () => `${fmt(s().stats.bestCps)}/s`],
        ['Machines built', () => fmtInt(s().stats.gensBought)],
        ['Upgrades bought', () => fmtInt(s().stats.upgradesBought)],
        ['Comets caught', () => fmtInt(s().stats.comets)],
        ['Cosmic events', () => fmtInt(s().stats.events)],
        ['Supernovas', () => fmtInt(s().rebirths)],
        ['Nova Shards earned', () => fmt(s().shardsTotal)],
        ['Earned while away', () => fmt(s().stats.offlineEarned)],
        ['Trials completed', () => `${s().trialsDone.size} / 8`],
        ['Started', () => new Date(s().created).toLocaleDateString()],
      ]],
    ];
    const head = h('div', { class: 'view-head' }, '<h2 class="view-title">Ledger</h2>');
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
