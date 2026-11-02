import type { Game } from '../core/game';
import { BUFF_INFO } from '../core/game';
import { fmt, fmtTime } from '../core/format';
import { TRIAL_MAP } from '../data/trials';
import type { EventDef } from '../data/events';
import { $, h, setText, setWidth, toggle, replay, prefersReducedMotion } from './dom';
import { ic } from './icons';
import { fx } from './fx';
import { sound } from './audio';
import { toast } from './toast';
import { tip } from './tooltip';
import { confirmDialog } from './modal';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface CometSprite {
  el: HTMLButtonElement;
  born: number;
  life: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  wobble: number;
  x: number;
  y: number;
  caught: boolean;
  hist: { x: number; y: number }[];
}

export class Stage {
  private star = $<HTMLButtonElement>('star');
  private body = $('star-body') as unknown as SVGGElement;
  private raysA = $('rays-a') as unknown as SVGGElement;
  private stageEl = $('stage');
  private counter = $('stardust');
  private cpsEl = $('cps');
  private comboEl = $('combo');
  private comboX = $('combo-x');
  private comboArc = $('combo-arc') as unknown as SVGCircleElement;
  private clickValue = $('click-value');
  private clickHint = $('click-hint');
  private buffsEl = $<HTMLUListElement>('buffs');
  private cometLayer = $('comet-layer');
  private trialBanner = $('trial-banner');
  private eventBanner: HTMLElement;
  private shown = 0;
  private lastFrame = performance.now();
  private buffKey = '';
  private buffEls = new Map<string, HTMLElement>();
  private comets: CometSprite[] = [];
  private cometRaf = 0;
  private lastCombo = 0;
  private meteorAcc = 0;
  haptics = true;

  constructor(private game: Game) {
    this.buildStar();
    this.eventBanner = h('div', { class: 'event-banner', hidden: true });
    this.trialBanner.after(this.eventBanner);
    tip(this.eventBanner, () => {
      const e = this.game.event;
      return e ? `<div class="tip-kicker">Cosmic event</div><h4>${e.name}</h4><p>${e.desc}</p>` : '';
    });

    this.star.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      sound.unlock();
      this.doClick(e.clientX, e.clientY);
    });
    this.star.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault();
        const r = this.star.getBoundingClientRect();
        this.doClick(r.left + r.width / 2, r.top + r.height / 2);
      }
    });
    $('trial-abandon').addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Abandon trial?',
        icon: 'interdiction',
        html: '<p>Leaving the trial ends this run with a Supernova. You keep any Nova Shards earned so far.</p>',
        confirm: 'Abandon trial',
        danger: true,
      });
      if (ok) this.game.rebirth();
    });
    tip(this.clickHint, () => {
      const m = this.game.mods;
      return `<h4>Your touch</h4><p>Clicks build a combo (up to ×${(1 + this.game.comboCap() * m.comboPer).toFixed(2)}). ${
        Math.round(this.game.critChance() * 100)
      }% chance to crit for ×${m.critMult}.${m.autoClickRate > 0 ? ` Echo Hands click ${m.autoClickRate}×/s for you.` : ''}</p>`;
    });
  }

  /* ------------------------------------------------------------ star art */
  private buildStar(): void {
    const ticks = $('astro-ticks');
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const major = i % 6 === 0;
      const r1 = 128;
      const r2 = major ? 140 : 134;
      const l = document.createElementNS(SVG_NS, 'line');
      l.setAttribute('x1', String(Math.cos(a) * r1));
      l.setAttribute('y1', String(Math.sin(a) * r1));
      l.setAttribute('x2', String(Math.cos(a) * r2));
      l.setAttribute('y2', String(Math.sin(a) * r2));
      if (major) l.classList.add('major');
      ticks.append(l);
    }
    const rays = (g: SVGGElement, n: number, min: number, max: number, width: number) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
        const len = min + Math.random() * (max - min);
        const l = document.createElementNS(SVG_NS, 'line');
        l.setAttribute('x1', String(Math.cos(a) * 70));
        l.setAttribute('y1', String(Math.sin(a) * 70));
        l.setAttribute('x2', String(Math.cos(a) * len));
        l.setAttribute('y2', String(Math.sin(a) * len));
        l.setAttribute('stroke-width', String(width * (0.5 + Math.random())));
        l.setAttribute('stroke-opacity', String(0.25 + Math.random() * 0.45));
        g.append(l);
      }
    };
    rays(this.raysA, 16, 150, 196, 2.2);
    rays($('rays-b') as unknown as SVGGElement, 28, 110, 160, 1.2);
  }

  starCenter(): { x: number; y: number } {
    const r = this.star.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /* ------------------------------------------------------------ clicking */
  private doClick(x: number, y: number): void {
    const res = this.game.click();
    if (!res) {
      sound.denied();
      replay(this.star, 'shake');
      fx.float(x, y - 20, 'Your hands are bound', { size: 15, color: '#e07a5f' });
      return;
    }
    const reduced = prefersReducedMotion();
    if (!reduced) {
      this.body.animate(
        [{ transform: 'scale(1)' }, { transform: `scale(${res.crit ? 0.86 : 0.93})`, offset: 0.25 }, { transform: 'scale(1.025)', offset: 0.65 }, { transform: 'scale(1)' }],
        { duration: res.crit ? 380 : 260, easing: 'cubic-bezier(.3,.7,.4,1)' },
      );
      this.raysA.animate([{ opacity: 1, scale: '1' }, { opacity: 1, scale: res.crit ? '1.18' : '1.06', offset: 0.3 }, { opacity: 1, scale: '1' }], {
        duration: 420,
        easing: 'ease-out',
      });
    }
    const combo = this.game.s.combo;
    sound.click(combo, res.crit);
    if (this.haptics) navigator.vibrate?.(res.crit ? [12, 30, 12] : 6);

    fx.burst(x, y, res.crit ? 34 : 9, { speed: res.crit ? 5.5 : 3, size: res.crit ? 3 : 2.2 });
    if (res.crit) {
      const c = this.starCenter();
      fx.ring(c.x, c.y, 220, 'rgba(255,236,190,0.9)', 3, 40);
      fx.float(x, y - 34, `✦ +${fmt(res.amount)}`, { size: 30, color: '#ffd77a', weight: 700, life: 80 });
    } else {
      fx.float(x, y - 24, `+${fmt(res.amount)}`, { size: 17 + Math.min(8, combo / 15) });
    }
    if (res.wish > 0) {
      fx.float(x, y - 64, `Wish! +${fmt(res.wish)}`, { size: 18, color: '#9ed8ea', weight: 700, life: 90 });
      fx.burst(x, y, 20, { hue: 195, speed: 4 });
    }
  }

  /* ------------------------------------------------------------ comets */
  spawnComet(): void {
    if (this.comets.length >= 6) return;
    const fromLeft = Math.random() < 0.5;
    const w = innerWidth;
    const hgt = innerHeight;
    const el = h('button', { class: 'comet', type: 'button', 'aria-label': 'Catch the comet' }) as HTMLButtonElement;
    const y0 = hgt * (0.12 + Math.random() * 0.5);
    const c: CometSprite = {
      el,
      born: performance.now(),
      life: 11000 + Math.random() * 3000,
      x0: fromLeft ? -60 : w + 60,
      y0,
      x1: fromLeft ? w + 60 : -60,
      y1: Math.min(hgt * 0.85, y0 + (Math.random() - 0.3) * hgt * 0.4),
      wobble: 20 + Math.random() * 40,
      x: -100,
      y: -100,
      caught: false,
      hist: [],
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sound.unlock();
      this.catchComet(c);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.catchComet(c);
      }
    });
    this.cometLayer.append(el);
    this.comets.push(c);
    sound.cometSpawn();
    if (!this.cometRaf) this.cometRaf = requestAnimationFrame(this.cometFrame);
  }

  private cometFrame = (now: number): void => {
    const auto = this.game.mods.cometAuto;
    for (let i = this.comets.length - 1; i >= 0; i--) {
      const c = this.comets[i];
      const t = (now - c.born) / c.life;
      if (t >= 1 || c.caught) {
        if (!c.caught) c.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished.then(() => c.el.remove());
        this.comets.splice(i, 1);
        continue;
      }
      const e = t;
      c.x = c.x0 + (c.x1 - c.x0) * e;
      c.y = c.y0 + (c.y1 - c.y0) * e + Math.sin(e * Math.PI * 3) * c.wobble;
      c.el.style.transform = `translate(${c.x}px, ${c.y}px)`;
      c.hist.push({ x: c.x, y: c.y });
      if (c.hist.length > 28) c.hist.shift();
      if (Math.random() < 0.25) fx.trail(c.x, c.y);
      if (auto && now - c.born > 1800 && c.x > 40 && c.x < innerWidth - 40) this.catchComet(c);
    }
    fx.tails = this.comets.map((c) => c.hist);
    fx.wake();
    this.cometRaf = this.comets.length ? requestAnimationFrame(this.cometFrame) : 0;
  };

  private catchComet(c: CometSprite): void {
    if (c.caught) return;
    c.caught = true;
    const r = this.game.catchComet();
    c.el.remove();
    sound.cometCatch();
    if (this.haptics) navigator.vibrate?.([10, 40, 10]);
    fx.burst(c.x, c.y, 46, { speed: 6, size: 3 });
    fx.ring(c.x, c.y, 140, 'rgba(255,240,200,0.9)', 2.5);
    if (r.kind === 'starfall') {
      fx.float(c.x, c.y - 10, `Starfall  +${fmt(r.amount)}`, { size: 22, color: '#ffd77a', weight: 700, life: 100 });
    } else {
      const info = BUFF_INFO[r.kind];
      const detail =
        r.kind === 'frenzy'
          ? `Production ×${fmt(this.game.buffMult('frenzy'))}`
          : r.kind === 'clickstorm'
            ? `Clicks ×${fmt(this.game.buffMult('clickstorm'))}`
            : 'Combo held at max';
      fx.float(c.x, c.y - 10, `${info.name}!`, { size: 24, color: '#ffd77a', weight: 700, life: 100 });
      toast({ icon: info.icon, kicker: 'Comet caught', title: info.name, body: `${detail} for ${fmtTime(r.duration)}` });
    }
  }

  /* ------------------------------------------------------------ events */
  onEvent(e: EventDef): void {
    sound.event(e.tone === 'good');
    toast({ icon: e.icon, kicker: 'Cosmic event', title: e.name, body: e.desc, tone: 'good', ms: 6000 });
    const c = this.starCenter();
    fx.ring(c.x, c.y, Math.max(innerWidth, innerHeight), 'rgba(255,230,180,0.35)', 2, 70);
    replay(this.eventBanner, 'enter');
  }

  /* ------------------------------------------------------------ per frame */
  update(now: number): void {
    const g = this.game;
    const s = g.s;
    const dt = Math.min(0.25, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    // Ease the big counter toward the true value so income feels continuous.
    const target = s.stardust;
    const diff = target - this.shown;
    if (Math.abs(diff) <= Math.max(0.5, target * 1e-6) || !Number.isFinite(diff)) this.shown = target;
    else this.shown += diff * Math.min(1, dt * 14);
    setText(this.counter, fmt(this.shown));
    setText(this.cpsEl, fmt(g.cps));
    setText(this.clickValue, fmt(g.clickValue()));

    // Combo ring
    const cap = g.comboCap();
    const frac = cap > 0 ? Math.min(1, s.combo / cap) : 0;
    this.comboArc.style.strokeDasharray = `${(frac * 1000).toFixed(1)} 1000`;
    toggle(this.comboArc, 'full', frac >= 1);
    toggle(this.comboEl, 'on', s.combo >= 2);
    if (s.combo !== this.lastCombo) {
      setText(this.comboX, `×${g.comboMult().toFixed(2)}`);
      if (s.combo > this.lastCombo && s.combo % 10 === 0) replay(this.comboEl, 'pop');
      this.lastCombo = s.combo;
    }

    this.updateBuffs();
    this.updateEvent(dt);
    this.updateTrial();
  }

  private updateBuffs(): void {
    const s = this.game.s;
    const key = s.buffs.map((b) => b.id).join(',');
    if (key !== this.buffKey) {
      this.buffKey = key;
      this.stageEl.dataset.buff = key.replace(/,/g, ' ');
      for (const [id, el] of this.buffEls) {
        if (!s.buffs.some((b) => b.id === id)) {
          el.remove();
          this.buffEls.delete(id);
        }
      }
      for (const b of s.buffs) {
        if (this.buffEls.has(b.id)) continue;
        const info = BUFF_INFO[b.id];
        const li = h('li', { class: 'buff' }, `<span class="buff-ic">${ic(info.icon)}</span><span class="buff-name">${info.name}</span><span class="buff-time"></span>`);
        tip(li, () => {
          const m = this.game.mods;
          const what =
            b.id === 'frenzy'
              ? `All production ×${fmt(this.game.buffMult('frenzy'))}.`
              : b.id === 'clickstorm'
                ? `Click power ×${fmt(this.game.buffMult('clickstorm'))}.`
                : `Combo locked at its cap (${this.game.comboCap()}).`;
          void m;
          return `<div class="tip-kicker">Comet buff</div><h4>${info.name}</h4><p>${what}</p>`;
        });
        this.buffsEl.append(li);
        this.buffEls.set(b.id, li);
      }
    }
    for (const b of s.buffs) {
      const el = this.buffEls.get(b.id);
      if (!el) continue;
      setText(el.lastElementChild!, fmtTime(b.remaining));
      el.style.setProperty('--p', (b.remaining / b.duration).toFixed(3));
    }
  }

  private updateEvent(dt: number): void {
    const g = this.game;
    const ev = g.s.event;
    const def = g.event;
    const id = def?.id ?? '';
    if (this.stageEl.dataset.event !== id) {
      this.stageEl.dataset.event = id;
      if (def) {
        this.eventBanner.className = `event-banner ${def.tone}`;
        this.eventBanner.innerHTML = `<span class="event-ic">${ic(def.icon)}</span>
          <div class="event-body"><div class="event-name">${def.name}</div><div class="event-desc">${def.desc}</div>
          <div class="bar"><div class="bar-fill"></div></div></div><span class="event-time"></span>`;
      }
      this.eventBanner.hidden = !def;
    }
    if (!ev || !def) return;
    setWidth(this.eventBanner.querySelector<HTMLElement>('.bar-fill')!, ev.remaining / ev.duration);
    setText(this.eventBanner.querySelector('.event-time')!, fmtTime(ev.remaining));
    if (def.pulse) this.stageEl.style.setProperty('--pulse', ((g.eventProdMult() - 1) / (def.pulse - 1)).toFixed(3));
    if (def.id === 'meteor' && !prefersReducedMotion()) {
      this.meteorAcc += dt;
      while (this.meteorAcc > 0.35) {
        this.meteorAcc -= 0.35 * (0.5 + Math.random());
        fx.streak(Math.random() * innerWidth * 1.3, -20 + Math.random() * innerHeight * 0.3);
      }
    }
  }

  private updateTrial(): void {
    const s = this.game.s;
    const t = s.trial ? TRIAL_MAP.get(s.trial) : undefined;
    this.trialBanner.hidden = !t;
    if (!t) return;
    const done = s.trialsDone.has(t.id);
    $('trial-banner-ic').innerHTML = ic(t.icon);
    setText(
      $('trial-banner-title'),
      done ? `${t.name} complete! Go Supernova to claim your freedom.` : `Trial: ${t.name} · reach ${fmt(t.goal)} stardust`,
    );
    setWidth($('trial-banner-bar'), done ? 1 : Math.log10(s.runEarned + 1) / Math.log10(t.goal));
  }

  /** Supernova: flash, quake, shockwave and particle storm from the star. */
  supernova(): void {
    const c = this.starCenter();
    const flash = $('flash');
    flash.style.setProperty('--fx', `${c.x}px`);
    flash.style.setProperty('--fy', `${c.y}px`);
    replay(flash, 'go');
    if (!prefersReducedMotion()) replay($('app'), 'quake');
    fx.ring(c.x, c.y, Math.hypot(innerWidth, innerHeight), 'rgba(255,240,210,0.95)', 6, 70);
    fx.ring(c.x, c.y, Math.hypot(innerWidth, innerHeight) * 0.6, 'rgba(158,216,234,0.8)', 3, 90);
    fx.burst(c.x, c.y, 220, { speed: 14, size: 3.5, grav: 0.02 });
    fx.burst(c.x, c.y, 80, { speed: 8, size: 2.5, hue: 195 });
    this.shown = 0;
    for (const cm of this.comets) cm.el.remove();
    this.comets = [];
    fx.tails = [];
    if (this.haptics) navigator.vibrate?.([30, 60, 80]);
  }

  resetCounter(): void {
    this.shown = this.game.s.stardust;
  }
}
