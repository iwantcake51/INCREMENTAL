import type { Game } from '../../core/game';
import { TRIALS } from '../../data/trials';
import { fmt } from '../../core/format';
import { h, setHtml, toggle } from '../dom';
import { ic } from '../icons';
import { confirmDialog } from '../modal';
import type { Panel } from './panel';

export class TrialsPanel implements Panel {
  id = 'trials';
  label = 'Trenches';
  icon = 'compass';
  el = h('div', { class: 'view' });
  private locked = h('div', { class: 'locked-card' });
  private list = h('div', { class: 'trial-list' });
  private rows = new Map<string, { el: HTMLElement; action: HTMLElement }>();

  constructor(private game: Game) {
    this.locked.innerHTML = `${ic('compass')}<h3>No charts yet</h3><p>Grow <b>Trench Charts</b> in the Abyss branch of the Reef. Trenches are hard dives with strange rules, and each one you clear pays off for good.</p>`;
    const head = h('div', { class: 'view-head' }, `<div><h2 class="view-title">The Trenches</h2><div class="view-sub">Entering a trench counts as a descent, so you still bring back pearls. Hit the lumen goal in that dive to keep its reward forever.</div></div>`);
    for (const t of TRIALS) {
      const el = h('div', { class: 'trial' });
      el.innerHTML = `<span class="gen-ic">${ic(t.icon)}</span>
        <div><div class="trial-name">${t.name}</div><div class="trial-rule">${t.rule}</div>
        <div class="trial-reward">Goal: ${fmt(t.goal)} lumen. Reward: <b>${t.reward}</b></div></div><div class="trial-action"></div>`;
      const action = el.querySelector<HTMLElement>('.trial-action')!;
      action.addEventListener('click', (e) => {
        if ((e.target as Element).closest('button')) void this.start(t.id);
      });
      this.rows.set(t.id, { el, action });
      this.list.append(el);
    }
    this.el.append(head, this.locked, this.list);
  }

  private async start(id: string): Promise<void> {
    const g = this.game;
    const t = TRIALS.find((x) => x.id === id)!;
    if (g.s.settings.confirmTrial) {
      const gain = g.shardGain();
      const ok = await confirmDialog({
        title: `Dive into ${t.name}?`,
        icon: t.icon,
        html: `<p><b>${t.rule}</b></p><p>Goal: ${fmt(t.goal)} lumen in one dive. Reward: ${t.reward}.</p>
          <p>Your current dive ends with a descent${gain > 0 ? ` (+${fmt(gain)} pearls)` : ''}.</p>`,
        confirm: 'Dive in',
      });
      if (!ok) return;
    }
    g.startTrial(id);
  }

  update(): void {
    const g = this.game;
    const unlocked = g.mods.trialsUnlocked || g.s.trialsDone.size > 0;
    this.locked.hidden = unlocked;
    this.list.hidden = !unlocked;
    if (!unlocked) return;
    for (const t of TRIALS) {
      const row = this.rows.get(t.id)!;
      const done = g.s.trialsDone.has(t.id);
      const active = g.s.trial === t.id;
      toggle(row.el, 'done', done);
      toggle(row.el, 'active', active);
      setHtml(
        row.action,
        active
          ? '<span class="view-sub">Down there now</span>'
          : done
            ? `<span style="color:var(--good);font-size:1.4rem">${ic('check-mark')}</span>`
            : `<button class="btn btn-sm" type="button" ${g.s.trial ? 'disabled' : ''}>Dive</button>`,
      );
    }
  }

  available(): boolean {
    return this.game.mods.trialsUnlocked || this.game.s.trialsDone.size > 0 || this.game.s.rebirths >= 2;
  }
}
