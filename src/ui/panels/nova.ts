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
  label = 'Supernova';
  icon = 'bright-explosion';
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
      <div class="nova-gain-label">Nova Shards waiting in your star</div>
      <button class="btn btn-lg nova-btn" type="button">${ic('bright-explosion')} Go Supernova</button>
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
    fact('shards', 'Unspent shards');
    fact('total', 'Shards earned');
    fact('bonus', 'Shard bonus');
    fact('count', 'Supernovas');
    fact('run', 'This run');
    fact('fastest', 'Fastest run');

    const explain = h(
      'p',
      { class: 'view-sub', style: 'margin-top:14px' },
      'A Supernova resets your stardust, machines and upgrades. In return you keep every Nova Shard you earn: each one permanently boosts production, and you spend them on the Constellation. Shards scale with the stardust you gather in a run.',
    );

    const autoH = h('div', { class: 'section-h' }, 'Automation');
    const autoWrap = h('div');
    const s = game.s;
    const m = () => game.mods;
    this.rebirthAt = h('input', { class: 'num-input', type: 'number', min: 1, step: 1, value: s.autobuy.rebirthAt, 'aria-label': 'Shard target' }) as HTMLInputElement;
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
    addAuto('robot-grab', 'Machine autobuyer', 'gens', () => m().autoGens, 'Learn Automated Foundry in the Constellation.', () => 'Buys the cheapest machine twice a second.');
    addAuto('vintage-robot', 'Upgrade drone', 'upgrades', () => m().autoUpgrades, 'Learn Procurement Drone in the Constellation.', () => 'Buys every affordable upgrade, cheapest first.');
    addAuto('recycle', 'Auto-Supernova', 'rebirth', () => m().autoRebirth, 'Learn Cycle Engine in the Constellation.', () => 'Goes Supernova once the pending shards reach your target.', this.rebirthAt);

    const respecH = h('div', { class: 'section-h' }, 'Constellation');
    this.respecBtn = h('button', { class: 'btn btn-ghost', type: 'button' }, `${ic('cycle')} Respec constellation`) as HTMLButtonElement;
    this.respecBtn.addEventListener('click', () => this.respec());
    const respecNote = h('p', { class: 'view-sub', style: 'margin-top:8px' }, 'Refunds every shard you spent. Costs you the current run (a Supernova without shards).');

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
        title: 'Go Supernova?',
        icon: 'bright-explosion',
        html: `<div class="dlg-hero"><div class="dlg-hero-v" style="color:var(--shard)">+${fmt(gain)}</div><p>Nova Shards</p></div>
          <p>Your stardust, machines and ${g.mods.keepUpgrades ? 'machine ' : ''}upgrades will reset. Shards, constellation, achievements and trial rewards stay.</p>`,
        confirm: 'Go Supernova',
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
      title: 'Respec constellation?',
      icon: 'cycle',
      html: `<p>You will get back <b>${fmt(spent)}</b> shards and every node will be forgotten. Your current run ends.</p>`,
      confirm: 'Respec',
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
    if (gain <= 0) setText(this.next, `Reach ${fmt(1e9 / g.mods.shardMult ** (1 / g.mods.shardExp))} stardust this run for your first shard`);
    else setText(this.next, `Next shard at ${fmt(nextAt)} stardust this run`);
    const prevAt = gain > 0 ? 1e9 * (gain / g.mods.shardMult) ** (1 / g.mods.shardExp) : 0;
    setWidth(this.nextBar, (s.runEarned - prevAt) / (nextAt - prevAt));

    setText(this.facts.shards, fmt(s.shards));
    setText(this.facts.total, fmt(s.shardsTotal));
    setText(this.facts.bonus, g.mods.noSkills ? 'Dormant' : `+${fmtPct(g.shardBonus())}`);
    setText(this.facts.count, fmtInt(s.rebirths));
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
