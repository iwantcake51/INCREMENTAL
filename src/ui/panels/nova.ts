import type { Game } from '../../core/game';
import { fmt, fmtInt, fmtPct, fmtTime } from '../../core/format';
import { totalSpent } from '../../data/skills';
import { h, setText, setWidth, toggle } from '../dom';
import { ic } from '../icons';
import { confirmDialog } from '../modal';
import { sound } from '../audio';
import type { Panel } from './panel';

interface AutoRow {
  row: HTMLElement;
  sw: HTMLInputElement;
  sub: HTMLElement;
  unlocked: () => boolean;
  lockedText: string;
  onText: () => string;
}

export class NovaPanel implements Panel {
  id = 'nova';
  label = 'Descent';
  icon = 'anchor';
  el = h('div', { class: 'view' });
  private gain: HTMLElement;
  private btn: HTMLButtonElement;
  private next: HTMLElement;
  private nextBar: HTMLElement;
  private facts: Record<string, HTMLElement> = {};
  private autos: AutoRow[] = [];
  private respecBtn: HTMLButtonElement;
  private rebirthAt: HTMLInputElement;

  constructor(private game: Game) {
    const hero = h('div', { class: 'nova-hero' });
    hero.innerHTML = `<div class="nova-gain">0</div>
      <div class="nova-gain-label">Black Pearls waiting further down</div>
      <button class="btn btn-lg nova-btn" type="button">${ic('anchor')} Descend</button>
      <div class="nova-next"><span></span><div class="bar"><div class="bar-fill"></div></div></div>`;
    this.gain = hero.querySelector('.nova-gain')!;
    this.btn = hero.querySelector('button')!;
    this.next = hero.querySelector('.nova-next span')!;
    this.nextBar = hero.querySelector('.nova-next .bar-fill')!;
    this.btn.addEventListener('click', () => this.rebirth());

    const facts = h('div', { class: 'facts' });
    const fact = (key: string, label: string) => {
      const f = h('div', { class: 'fact' }, `<div class="fact-k">${label}</div><div class="fact-v">–</div>`);
      this.facts[key] = f.querySelector('.fact-v')!;
      facts.append(f);
    };
    fact('shards', 'Pearls to spend');
    fact('total', 'Pearls ever found');
    fact('bonus', 'Pearl bonus');
    fact('count', 'Current depth');
    fact('run', 'This dive');
    fact('fastest', 'Quickest dive');

    const explain = h(
      'p',
      { class: 'view-sub', style: 'margin-top:14px' },
      'Descending starts a fresh dive: your lumen, harvesters and workshop upgrades stay behind. You bring back Black Pearls, which boost everything for good and grow the Reef. The more lumen you gather in a dive, the more pearls are waiting.',
    );

    const autoH = h('div', { class: 'section-h' }, 'Automation');
    const autoWrap = h('div');
    const s = game.s;
    const m = () => game.mods;
    this.rebirthAt = h('input', { class: 'num-input', type: 'number', min: 1, step: 1, value: s.autobuy.rebirthAt, 'aria-label': 'Pearl target' }) as HTMLInputElement;
    this.rebirthAt.addEventListener('change', () => {
      const v = Math.max(1, Math.floor(Number(this.rebirthAt.value) || 1));
      game.s.autobuy.rebirthAt = v;
      this.rebirthAt.value = String(v);
    });
    const addAuto = (icon: string, title: string, key: 'gens' | 'upgrades' | 'rebirth', unlocked: () => boolean, lockedText: string, onText: () => string, extra?: HTMLElement) => {
      const row = h('div', { class: 'auto-row' });
      row.innerHTML = `<span class="gen-ic" style="--hue:200">${ic(icon)}</span><div class="auto-row-main"><div class="auto-row-title">${title}</div><div class="auto-row-sub"></div></div>`;
      const sw = h('input', { type: 'checkbox', class: 'switch', role: 'switch', 'aria-label': title }) as HTMLInputElement;
      sw.checked = game.s.autobuy[key] as boolean;
      sw.addEventListener('change', () => {
        (game.s.autobuy[key] as boolean) = sw.checked;
        sound.tick();
      });
      if (extra) row.append(extra);
      row.append(sw);
      autoWrap.append(row);
      this.autos.push({ row, sw, sub: row.querySelector('.auto-row-sub')!, unlocked, lockedText, onText });
    };
    addAuto('crab-claw', 'Mechanical crab', 'gens', () => m().autoGens, 'Grow Mechanical Crab on the Reef to unlock.', () => 'Builds the cheapest harvester twice a second.');
    addAuto('diving-helmet', 'Diving bell clerk', 'upgrades', () => m().autoUpgrades, 'Grow Diving Bell Clerk on the Reef to unlock.', () => 'Buys every workshop upgrade you can afford, cheapest first.');
    addAuto('anchor', 'Ballast winch', 'rebirth', () => m().autoRebirth, 'Grow Ballast Winch on the Reef to unlock.', () => 'Descends on its own once enough pearls are waiting.', this.rebirthAt);

    const respecH = h('div', { class: 'section-h' }, 'The Reef');
    this.respecBtn = h('button', { class: 'btn btn-ghost', type: 'button' }, `${ic('cycle')} Replant the Reef`) as HTMLButtonElement;
    this.respecBtn.addEventListener('click', () => this.respec());
    const respecNote = h('p', { class: 'view-sub', style: 'margin-top:8px' }, 'Gives back every pearl you spent on the Reef. It costs you the current dive.');

    this.el.append(hero, facts, explain, autoH, autoWrap, respecH, this.respecBtn, respecNote);
  }

  private async rebirth(): Promise<void> {
    const g = this.game;
    const gain = g.shardGain();
    if (gain <= 0) {
      sound.denied();
      return;
    }
    if (g.s.settings.confirmRebirth) {
      const ok = await confirmDialog({
        title: 'Descend?',
        icon: 'anchor',
        html: `<div class="dlg-hero"><div class="dlg-hero-v" style="color:var(--pearl)">+${fmt(gain)}</div><p>Black Pearls</p></div>
          <p>Your lumen, harvesters and ${g.mods.keepUpgrades ? 'harvester ' : ''}upgrades stay up here. Pearls, the Reef, your finds and trench rewards come with you.</p>`,
        confirm: 'Descend'
      });
      if (!ok) return;
    }
    g.rebirth();
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
      html: `<p>You get back <b>${fmt(spent)}</b> Black Pearls and the Reef starts over from one polyp. Your current dive ends.</p>`,
      confirm: 'Replant',
      danger: true,
    });
    if (ok) this.game.respec();
  }

  update(): void {
    const g = this.game;
    const s = g.s;
    const gain = g.shardGain();
    setText(this.gain, `+${fmt(gain)}`);
    this.btn.disabled = gain <= 0;
    toggle(this.btn, 'ready', gain > 0 && gain >= Math.max(1, s.shardsTotal * 0.5));
    const nextAt = g.nextShardAt();
    if (gain <= 0) setText(this.next, `Gather ${fmt(1e9 / g.mods.shardMult ** (1 / g.mods.shardExp))} lumen in one dive to find your first pearl`);
    else setText(this.next, `Next pearl at ${fmt(nextAt)} lumen this dive`);
    const prevAt = gain > 0 ? 1e9 * (gain / g.mods.shardMult) ** (1 / g.mods.shardExp) : 0;
    setWidth(this.nextBar, (s.runEarned - prevAt) / (nextAt - prevAt));

    setText(this.facts.shards, fmt(s.shards));
    setText(this.facts.total, fmt(s.shardsTotal));
    setText(this.facts.bonus, g.mods.noSkills ? 'Dormant' : `+${fmtPct(g.shardBonus())}`);
    setText(this.facts.count, fmtInt(s.rebirths + 1));
    setText(this.facts.run, fmtTime(s.stats.runTime));
    setText(this.facts.fastest, Number.isFinite(s.stats.fastestRebirth) ? fmtTime(s.stats.fastestRebirth) : '—');

    for (const a of this.autos) {
      const on = a.unlocked();
      toggle(a.row, 'locked', !on);
      a.sw.disabled = !on;
      setText(a.sub, on ? a.onText() : a.lockedText);
    }
    this.rebirthAt.disabled = !g.mods.autoRebirth;
    this.respecBtn.disabled = Object.keys(s.skills).length === 0;
  }

  badge(): boolean {
    const g = this.game;
    const gain = g.shardGain();
    return gain > 0 && gain >= Math.max(1, g.s.shardsTotal * 0.5);
  }
}
