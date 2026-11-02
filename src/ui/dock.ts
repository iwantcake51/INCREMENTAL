import type { Game } from '../core/game';
import type { DiveResult } from '../core/dive';
import { fmt, fmtInt, fmtTime } from '../core/format';
import { zoneAt } from '../data/zones';
import { $, h, replay, rollNumber, snapNumber } from './dom';
import { ic } from './icons';
import { makeDialog, openDialog, closeDialog } from './modal';
import { endLabel } from './dive-view';
import { sound } from './audio';
import { fx } from './fx';

/** The left side between dives: bank, the sub at its mooring, the Dive button, records. */
export class Dock {
  private lumenEl = $('lumen');
  private rateEl = $('farm-rate');
  private diveBtn = $<HTMLButtonElement>('dive-btn');
  private cards = $('dock-cards');
  private specs = $('dock-specs');
  private cardsKey = '';

  constructor(
    private game: Game,
    private onDive: () => void,
  ) {
    this.diveBtn.addEventListener('click', () => {
      sound.unlock();
      this.onDive();
    });
    $('dock-sub').addEventListener('click', () => {
      sound.unlock();
      sound.bubble();
      const r = $('dock-sub').getBoundingClientRect();
      fx.bubbles(r.left + r.width / 2, r.top + r.height / 2, 10);
    });
  }

  update(): void {
    const g = this.game;
    const s = g.s;
    rollNumber(this.lumenEl, s.lumen, fmt, { speed: 9 });
    this.rateEl.hidden = g.farmRate <= 0;
    if (g.farmRate > 0) rollNumber(this.rateEl, g.farmRate, (n) => `+${fmt(n)} a second from the farm`, { speed: 6 });

    const m = g.mods;
    const key = `${s.deepest}|${s.last?.depth}|${s.last?.lumen}|${m.maxAir}|${m.maxHull}|${m.speed}|${m.light}|${m.magnet}|${m.dash}|${m.flare}`;
    if (key === this.cardsKey) return;
    this.cardsKey = key;
    const last = s.last;
    this.cards.innerHTML = `
      <div class="dock-card"><div class="dock-card-k">${ic('anchor')} Deepest dive</div><div class="dock-card-v">${fmtInt(s.deepest)} m</div><div class="dock-card-s">${zoneAt(s.deepest).name}</div></div>
      <div class="dock-card"><div class="dock-card-k">${ic('submarine')} Last dive</div>${
        last
          ? `<div class="dock-card-v">+${fmt(last.lumen)}</div><div class="dock-card-s">${fmtInt(last.depth)} m · ${last.reason === 'breach' ? 'hull breached' : last.reason === 'air' ? 'ran out of air' : 'surfaced'}</div>`
          : `<div class="dock-card-v">—</div><div class="dock-card-s">Nothing yet. Go on.</div>`
      }</div>`;
    this.specs.innerHTML = [
      ['air-zigzag', `${Math.round(m.maxAir)}s air`],
      ['checked-shield', `${Math.round(m.maxHull)} hull`],
      ['boat-propeller', `${Math.round(m.speed * 100)}% speed`],
      ['light-bulb', `${Math.round(m.light * 100)}% light`],
      ['magnet', `${Math.round(m.magnet)} reach`],
      ...(m.dash ? [['rocket-thruster', 'Dash']] : []),
      ...(m.flare ? [['sun-radiations', 'Flare']] : []),
    ]
      .map(([i, t]) => `<span class="spec">${ic(i)}${t}</span>`)
      .join('');
  }

  resetCounter(): void {
    snapNumber(this.lumenEl, this.game.s.lumen);
  }

  /** Summary card after a dive, with "Dive again" focused so Enter goes straight back down. */
  showSummary(r: DiveResult, record: boolean): void {
    const g = this.game;
    const { dialog, body, foot } = makeDialog('dlg-dive', r.reason === 'breach' ? 'Hull breached' : 'Back at the dock', r.reason === 'breach' ? 'sea-urchin' : 'submarine');
    const rows: [string, string][] = [
      ['Depth reached', `${fmtInt(r.depth)} m${record ? ' · new record!' : ''}`],
      ['Time down', fmtTime(r.time)],
      ['Plankton', fmtInt(r.motes)],
      ['Glimmerfish', fmtInt(r.fish)],
      ['Chests', fmtInt(r.chests)],
      ['Best streak', fmtInt(r.bestStreak)],
      ['Hits taken', fmtInt(r.hits)],
    ];
    body.innerHTML = `<div class="dlg-hero"><p>${endLabel(r.reason, g.mods.keepOnBreach)}</p>
        <div class="dlg-hero-v">+${fmt(r.banked)}</div><p>lumen banked${r.reason === 'breach' ? ` of ${fmt(r.haul)} collected` : ''}</p>
        ${r.pearls > 0 ? `<p class="dive-pearls">${ic('oyster-pearl')} +${r.pearls} Black Pearl${r.pearls > 1 ? 's' : ''} found in chests</p>` : ''}</div>
      <table class="stat-table">${rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('')}</table>`;
    const back = h('button', { class: 'btn btn-ghost', type: 'button' }, 'Back to the dock');
    const again = h('button', { class: 'btn', type: 'button', autofocus: true }, `${ic('submarine')} Dive again`);
    back.addEventListener('click', () => closeDialog(dialog));
    again.addEventListener('click', async () => {
      await closeDialog(dialog);
      this.onDive();
    });
    foot.append(back, again);
    dialog.addEventListener('close', () => setTimeout(() => dialog.remove(), 50));
    openDialog(dialog);
    replay(this.lumenEl, 'pop');
    if (record) sound.event(true);
  }
}
