import type { Game } from '../../core/game';
import { PEARL_BASE } from '../../core/game';
import { fmt, fmtInt } from '../../core/format';
import { totalSpent } from '../../data/skills';
import { h, setText, setWidth, toggle, rollNumber } from '../dom';
import { ic } from '../icons';
import { confirmDialog } from '../modal';
import { sound } from '../audio';
import type { Panel } from './panel';

export class DrydockPanel implements Panel {
  id = 'drydock';
  label = 'Drydock';
  icon = 'cycle';
  el = h('div', { class: 'view' });
  private gain: HTMLElement;
  private btn: HTMLButtonElement;
  private next: HTMLElement;
  private nextBar: HTMLElement;
  private facts: Record<string, HTMLElement> = {};
  private respecBtn: HTMLButtonElement;

  constructor(private game: Game) {
    const hero = h('div', { class: 'nova-hero' });
    hero.innerHTML = `<div class="nova-gain">0</div>
      <div class="nova-gain-label">Black Pearls for rebuilding the sub now</div>
      <button class="btn btn-lg nova-btn" type="button">${ic('cycle')} Rebuild the sub</button>
      <div class="nova-next"><span></span><div class="bar"><div class="bar-fill"></div></div></div>`;
    this.gain = hero.querySelector('.nova-gain')!;
    this.btn = hero.querySelector('button')!;
    this.next = hero.querySelector('.nova-next span')!;
    this.nextBar = hero.querySelector('.nova-next .bar-fill')!;
    this.btn.addEventListener('click', () => this.rebuild());

    const facts = h('div', { class: 'facts' });
    const fact = (key: string, label: string) => {
      const f = h('div', { class: 'fact' }, `<div class="fact-k">${label}</div><div class="fact-v">–</div>`);
      this.facts[key] = f.querySelector('.fact-v')!;
      facts.append(f);
    };
    fact('pearls', 'Pearls to spend');
    fact('total', 'Pearls ever found');
    fact('bonus', 'Pearl bonus to lumen');
    fact('run', 'Lumen this sub');
    fact('deep', 'Deepest this sub');
    fact('count', 'Rebuilds');

    const explain = h(
      'p',
      { class: 'view-sub', style: 'margin-top:14px' },
      'Rebuilding scraps your sub: shop upgrades and banked lumen are gone. In return you get Black Pearls, which make every dive worth more for good and grow the Reef. The more lumen this sub has earned, the more pearls you get. Pearls found in chests during dives are yours to keep either way.',
    );
    const respecH = h('div', { class: 'section-h' }, 'The Reef');
    this.respecBtn = h('button', { class: 'btn btn-ghost', type: 'button' }, `${ic('cycle')} Replant the Reef`) as HTMLButtonElement;
    this.respecBtn.addEventListener('click', () => this.respec());
    const respecNote = h('p', { class: 'view-sub', style: 'margin-top:8px' }, 'Gives back every pearl you spent on the Reef so you can grow it differently.');
    this.el.append(hero, facts, explain, respecH, this.respecBtn, respecNote);
  }

  private async rebuild(): Promise<void> {
    const g = this.game;
    const gain = g.pearlGain();
    if (gain <= 0) {
      sound.denied();
      return;
    }
    if (g.s.settings.confirmRebirth) {
      const keep = Math.round(g.mods.keepShop * 100);
      const ok = await confirmDialog({
        title: 'Rebuild the sub?',
        icon: 'cycle',
        html: `<div class="dlg-hero"><div class="dlg-hero-v" style="color:var(--pearl)">+${fmt(gain)}</div><p>Black Pearls</p></div>
          <p>Your banked lumen and ${keep > 0 ? `${100 - keep}% of your` : 'all'} sub upgrades go. Pearls, the Reef, your records and finds stay.</p>`,
        confirm: 'Rebuild',
      });
      if (!ok) return;
    }
    g.rebuild();
  }

  private async respec(): Promise<void> {
    const spent = totalSpent(this.game.s.skills);
    if (spent <= 0) {
      sound.denied();
      return;
    }
    const ok = await confirmDialog({
      title: 'Replant the Reef?',
      icon: 'cycle',
      html: `<p>You get back <b>${fmt(spent)}</b> Black Pearls and the Reef starts over from one polyp.</p>`,
      confirm: 'Replant',
      danger: true,
    });
    if (ok) this.game.respec();
  }

  update(): void {
    const g = this.game;
    const s = g.s;
    const gain = g.pearlGain();
    rollNumber(this.gain, gain, (n) => `+${fmt(n)}`, { integer: gain < 1e6, speed: 6 });
    this.btn.disabled = gain <= 0 || !!g.dive;
    toggle(this.btn, 'ready', gain > 0 && gain >= Math.max(1, s.pearlsTotal * 0.5));
    if (s.lumenRun < PEARL_BASE) {
      setText(this.next, `This sub needs to earn ${fmt(PEARL_BASE)} lumen before rebuilding pays a pearl`);
      setWidth(this.nextBar, s.lumenRun / PEARL_BASE);
    } else {
      const nextAt = g.nextPearlAt();
      setText(this.next, `Next pearl when this sub has earned ${fmt(nextAt)} lumen`);
      setWidth(this.nextBar, s.lumenRun / nextAt);
    }
    rollNumber(this.facts.pearls, s.pearls, fmt, { speed: 6 });
    rollNumber(this.facts.total, s.pearlsTotal, fmt, { speed: 6 });
    setText(this.facts.bonus, `×${(g.valueMult()).toFixed(2)}`);
    setText(this.facts.run, fmt(s.lumenRun));
    setText(this.facts.deep, `${fmtInt(s.deepestRun)} m`);
    setText(this.facts.count, fmtInt(s.rebuilds));
    this.respecBtn.disabled = Object.keys(s.skills).length === 0 || !!g.dive;
  }

  badge(): boolean {
    const g = this.game;
    const gain = g.pearlGain();
    return gain > 0 && gain >= Math.max(1, g.s.pearlsTotal * 0.5);
  }

  available(): boolean {
    return this.game.s.lumenRun >= PEARL_BASE * 0.3 || this.game.s.rebuilds > 0 || this.game.s.pearlsTotal > 0;
  }
}
