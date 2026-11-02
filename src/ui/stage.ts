import type { Game } from '../core/game';
import { BUFF_INFO } from '../core/game';
import { fmt, fmtTime } from '../core/format';
import { TRIAL_MAP } from '../data/trials';
import type { EventDef } from '../data/events';
import { $, h, setText, setWidth, toggle, replay, prefersReducedMotion, rollNumber, snapNumber } from './dom';
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
  private flareArc = $('flare-arc') as unknown as SVGCircleElement;
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
  private lastPop = 0;
  haptics = true;

  constructor(private game: Game) {
    this.buildStar();
    this.eventBanner = h('div', { class: 'event-banner', hidden: true });
    this.trialBanner.after(this.eventBanner);
    tip(this.eventBanner, () => {
      const e = this.game.event;
      return e ? `<div class="tip-kicker">Sea event</div><h4>${e.name}</h4><p>${e.desc}</p>` : '';
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
        title: 'Surface early?',
        icon: 'interdiction',
        html: '<p>Leaving the trench ends this dive with a descent. You keep any Black Pearls you have earned.</p>',
        confirm: 'Leave the trench',
        danger: true,
      });
      if (ok) this.game.rebirth();
    });
    tip(this.clickHint, () => {
      const m = this.game.mods;
      return `<h4>Your taps</h4><p>Tap in rhythm to build a streak (up to ×${(1 + this.game.comboCap() * m.comboPer).toFixed(2)}). Each tap has a ${Math.round(
        this.game.critChance() * 100,
      )}% chance to be lucky and pay ×${m.critMult}.${m.autoClickRate > 0 ? ` Your echo hands tap ${m.autoClickRate} times a second.` : ''}</p>`;
    });
  }

  /* ------------------------------------------------------------ star art */
  private buildStar(): void {
    // Plankton drifting around the lure: two loose rings of glowing specks.
    const plankton = (g: SVGGElement, n: number, min: number, max: number, size: number) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const r = min + Math.random() * (max - min);
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', (Math.cos(a) * r).toFixed(1));
        c.setAttribute('cy', (Math.sin(a) * r).toFixed(1));
        c.setAttribute('r', (size * (0.4 + Math.random() * 0.9)).toFixed(2));
        c.setAttribute('opacity', (0.3 + Math.random() * 0.6).toFixed(2));
        g.append(c);
      }
    };
    plankton(this.raysA, 22, 132, 192, 3);
    plankton($('rays-b') as unknown as SVGGElement, 34, 100, 150, 1.8);
    // The stalk sways via SMIL; stop it for people who asked for less motion.
    const svg = $('lure-svg') as unknown as SVGSVGElement;
    if (prefersReducedMotion()) svg.pauseAnimations();
  }

  /** Keyboard tap (Space/Enter) lands in the middle of the lure. */
  tapCenter(): void {
    const c = this.starCenter();
    this.doClick(c.x, c.y);
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
      fx.float(x, y - 20, 'The water is too still', { size: 15, color: '#ff8f7c' });
      return;
    }
    const reduced = prefersReducedMotion();
    if (!reduced) {
      this.body.animate(
        [{ transform: 'scale(1)' }, { transform: `scale(${res.crit ? 0.86 : 0.93})`, offset: 0.25 }, { transform: 'scale(1.025)', offset: 0.65 }, { transform: 'scale(1)' }],
        { duration: res.crit ? 380 : 260, easing: 'cubic-bezier(.3,.7,.4,1)' },
      );
      this.raysA.animate([{ scale: '1' }, { scale: res.crit ? '1.16' : '1.05', offset: 0.3 }, { scale: '1' }], {
        duration: 460,
        easing: 'ease-out',
      });
    }
    const combo = this.game.s.combo;
    sound.click(combo, res.crit);
    if (this.haptics) navigator.vibrate?.(res.crit ? [12, 30, 12] : 6);

    // A puff of bubbles and a few glowing motes from the tap point, plus a ripple.
    fx.bubbles(x, y, res.crit ? 14 : 4);
    fx.burst(x, y, res.crit ? 26 : 7, { speed: res.crit ? 5 : 2.6, size: res.crit ? 3 : 2.2 });
    fx.ring(x, y, res.crit ? 90 : 46, `rgba(${fx.rgb},0.55)`, 1.5, res.crit ? 40 : 26);
    if (res.crit) {
      const c = this.starCenter();
      fx.ring(c.x, c.y, 230, 'rgba(255,214,140,0.85)', 3, 44);
      fx.float(x, y - 34, `Lucky! +${fmt(res.amount)}`, { size: 28, color: '#ffcf6e', weight: 800, life: 80 });
    } else {
      fx.float(x, y - 24, `+${fmt(res.amount)}`, { size: 17 + Math.min(8, combo / 15) });
    }
    if (res.wish > 0) {
      fx.float(x, y - 64, `Bottle! +${fmt(res.wish)}`, { size: 18, color: '#c9b8ff', weight: 800, life: 90 });
      fx.bubbles(x, y, 12);
    }
  }

  /* ------------------------------------------------------------ comets */
  spawnComet(): void {
    if (this.comets.length >= 6) return;
    const fromLeft = Math.random() < 0.5;
    const w = innerWidth;
    const hgt = innerHeight;
    const el = h('button', { class: `comet${fromLeft ? ' flip' : ''}`, type: 'button', 'aria-label': 'Catch the glimmerfish' }, ic('clownfish')) as HTMLButtonElement;
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
      if (Math.random() < 0.18) fx.bubbles(c.x, c.y, 1, 0.6);
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
    fx.burst(c.x, c.y, 40, { speed: 6, size: 3 });
    fx.bubbles(c.x, c.y, 18);
    fx.ring(c.x, c.y, 140, `rgba(${fx.rgb},0.8)`, 2.5);
    if (r.kind === 'starfall') {
      fx.float(c.x, c.y - 10, `It dropped +${fmt(r.amount)}`, { size: 22, color: '#ffcf6e', weight: 800, life: 100 });
    } else {
      const info = BUFF_INFO[r.kind];
      const detail =
        r.kind === 'frenzy'
          ? `Production ×${fmt(this.game.buffMult('frenzy'))}`
          : r.kind === 'clickstorm'
            ? `Taps ×${fmt(this.game.buffMult('clickstorm'))}`
            : 'Streak held at max';
      fx.float(c.x, c.y - 10, `${info.name}!`, { size: 24, color: '#ffcf6e', weight: 800, life: 100 });
      toast({ icon: info.icon, kicker: 'Glimmerfish caught', title: info.name, body: `${detail} for ${fmtTime(r.duration)}` });
    }
  }

  /** The gauge filled: big flash of light from the lure. */
  onFlare(): void {
    const c = this.starCenter();
    sound.flare();
    if (this.haptics) navigator.vibrate?.([20, 40, 30]);
    fx.ring(c.x, c.y, 320, 'rgba(255,225,150,0.95)', 5, 50);
    fx.ring(c.x, c.y, 200, 'rgba(255,255,255,0.8)', 3, 34);
    fx.burst(c.x, c.y, 90, { speed: 9, size: 3.2, hue: 45, light: 75, life: 55 });
    fx.bubbles(c.x, c.y + 40, 30, 1.6);
    fx.float(c.x, c.y - 120, `Flare! Taps ×${fmt(this.game.buffMult('flare'))}`, { size: 30, color: '#ffe08a', weight: 800, life: 100 });
    if (!prefersReducedMotion()) {
      replay($('app'), 'quake');
      this.body.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)', offset: 0.2 }, { transform: 'scale(1)' }], { duration: 600, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    }
  }

  /* ------------------------------------------------------------ events */
  onEvent(e: EventDef): void {
    sound.event(e.tone === 'good');
    toast({ icon: e.icon, kicker: 'Sea event', title: e.name, body: e.desc, tone: 'good', ms: 6000 });
    const c = this.starCenter();
    fx.ring(c.x, c.y, Math.max(innerWidth, innerHeight), `rgba(${fx.rgb},0.3)`, 2, 70);
    replay(this.eventBanner, 'enter');
  }

  /* ------------------------------------------------------------ per frame */
  update(now: number): void {
    const g = this.game;
    const s = g.s;
    const dt = Math.max(0, Math.min(0.25, (now - this.lastFrame) / 1000));
    this.lastFrame = now;

    // The big counter rolls toward the true value; a sudden windfall gives it a little pop.
    const target = s.stardust;
    if (target - this.shown > Math.max(1000, g.cps * 20) && now - this.lastPop > 250) {
      this.lastPop = now;
      replay(this.counter, 'pop');
    }
    this.shown = target;
    rollNumber(this.counter, target, fmt, { speed: 9 });
    rollNumber(this.cpsEl, g.cps, fmt, { speed: 5 });
    rollNumber(this.clickValue, g.clickValue(), fmt, { speed: 8 });

    // Flare gauge (outer gold ring)
    const flaring = s.buffs.find((b) => b.id === 'flare');
    const surge = flaring ? flaring.remaining / flaring.duration : s.surge;
    this.flareArc.style.strokeDasharray = `${(surge * 1000).toFixed(1)} 1000`;
    toggle(this.flareArc, 'near', !flaring && s.surge >= 0.8);

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
              ? `Everything produces ×${fmt(this.game.buffMult('frenzy'))}.`
              : b.id === 'clickstorm'
                ? `Taps give ×${fmt(this.game.buffMult('clickstorm'))}.`
                : b.id === 'flare'
                  ? `Taps ×${fmt(this.game.buffMult('flare'))} and production ×${fmt(this.game.flareProd())}.`
                  : `Your streak stays at its cap (${this.game.comboCap()}).`;
          void m;
          return `<div class="tip-kicker">Glimmerfish boost</div><h4>${info.name}</h4><p>${what}</p>`;
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
      while (this.meteorAcc > 0.08) {
        this.meteorAcc -= 0.08;
        fx.mote(Math.random() * innerWidth, innerHeight * (0.2 + Math.random() * 0.8));
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
      done ? `${t.name} cleared. Descend whenever you like.` : `${t.name}: reach ${fmt(t.goal)} lumen`,
    );
    setWidth($('trial-banner-bar'), done ? 1 : Math.log10(s.runEarned + 1) / Math.log10(t.goal));
  }

  /** Descent: the water darkens from above, the lure flares, and a column of bubbles rushes up. */
  supernova(): void {
    const c = this.starCenter();
    replay($('flash'), 'go');
    if (!prefersReducedMotion()) replay($('app'), 'quake');
    fx.ring(c.x, c.y, Math.hypot(innerWidth, innerHeight), `rgba(${fx.rgb},0.7)`, 5, 80);
    fx.ring(c.x, c.y, Math.hypot(innerWidth, innerHeight) * 0.5, 'rgba(201,184,255,0.7)', 3, 90);
    fx.burst(c.x, c.y, 120, { speed: 10, size: 3, grav: -0.03 });
    for (let i = 0; i < 6; i++) setTimeout(() => fx.bubbles(c.x + (Math.random() - 0.5) * 220, c.y + 120, 22, 2.2), i * 90);
    this.shown = 0;
    for (const cm of this.comets) cm.el.remove();
    this.comets = [];
    fx.tails = [];
    if (this.haptics) navigator.vibrate?.([30, 60, 80]);
  }

  resetCounter(): void {
    this.shown = this.game.s.stardust;
    snapNumber(this.counter, this.shown);
  }
}
