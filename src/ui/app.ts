import { Game } from '../core/game';
import { loadLocal, saveLocal } from '../core/save';
import { fmt, fmtInt } from '../core/format';
import { pickNews } from '../data/news';
import { ZONES, zoneIndex } from '../data/zones';
import type { AchievementDef } from '../data/achievements';
import { $, h, setText, toggle, replay, prefersReducedMotion, rollNumber } from './dom';
import { ic, hydrateIcons } from './icons';
import { fx, sky, CREATURES } from './fx';
import { sound } from './audio';
import { initToasts, toast } from './toast';
import { initTooltip, refreshTip, hideTip } from './tooltip';
import { openDialog } from './modal';
import { applySettings, buildSettings, buildHelp, showOffline } from './dialogs';
import { Dock } from './dock';
import { DiveView } from './dive-view';
import type { Panel } from './panels/panel';
import { ShopPanel } from './panels/shop';
import { SkillsPanel } from './panels/skills';
import { DrydockPanel } from './panels/drydock';
import { AchievementsPanel } from './panels/achievements';
import { StatsPanel } from './panels/stats';

const TAB_KEY = 'lanterndeep-tab';
const TICK_MS = 50;

export class App {
  game: Game;
  private dock!: Dock;
  private diveView!: DiveView;
  private panels: Panel[] = [];
  private tabs = new Map<string, { btn: HTMLButtonElement; dot: HTMLElement }>();
  private active = 'shop';
  private settingsDlg!: HTMLDialogElement;
  private helpDlg!: HTMLDialogElement;
  private lastTick = performance.now();
  private lastPanel = 0;
  private lastSlow = 0;
  private lastSave = Date.now();
  private newsIdx = -1;
  private tickerAnim: Animation | null = null;
  private tickerTimer = 0;
  private recordBefore = 0;

  constructor() {
    const loaded = loadLocal();
    this.game = new Game(loaded ?? undefined);
    const firstVisit = !loaded || loaded.flags.has('legacy');
    this.game.s.flags.delete('legacy');

    hydrateIcons();
    initToasts($('toasts'));
    initTooltip($('tooltip'));
    fx.init($<HTMLCanvasElement>('fx'));
    sky.init($<HTMLCanvasElement>('sky'));
    applySettings(this.game.s.settings);

    this.dock = new Dock(this.game, () => this.startDive());
    this.diveView = new DiveView(this.game, () => this.afterDive());
    this.buildPanels();
    this.bindGameEvents();
    this.bindChrome();
    this.settingsDlg = buildSettings(this.game, () => this.onReset());
    this.helpDlg = buildHelp();

    requestAnimationFrame(() => {
      sky.build();
      if (firstVisit) setTimeout(() => openDialog(this.helpDlg), 400);
    });

    if (loaded && this.game.s.settings.offlineProgress) {
      const away = (Date.now() - loaded.lastSave) / 1000;
      if (away > 30) this.awardOffline(away);
    }
    this.game.recalc();
    this.dock.resetCounter();
    this.syncLife();

    setInterval(() => this.logic(), TICK_MS);
    requestAnimationFrame(this.frame);
    this.nextNews();
  }

  /* ------------------------------------------------------------ diving */
  private startDive(): void {
    if (this.game.dive) return;
    hideTip();
    document.querySelectorAll('dialog[open]').forEach((d) => (d as HTMLDialogElement).close());
    this.recordBefore = this.game.s.deepest;
    const dive = this.game.startDive();
    this.diveView.start(dive);
  }

  private afterDive(): void {
    const last = this.game.s.last;
    if (!last) return;
    this.syncLife();
    this.save();
    // The full result went out on the diveEnd event; the dock just needs the summary.
    if (this.pendingResult) this.dock.showSummary(this.pendingResult, last.depth > this.recordBefore && this.recordBefore > 0);
    this.pendingResult = null;
    const held = this.deferred;
    this.deferred = [];
    setTimeout(() => this.announce(held), 600);
  }

  private pendingResult: import('../core/dive').DiveResult | null = null;
  private deferred: AchievementDef[] = [];

  private announce(batch: AchievementDef[]): void {
    if (!batch.length) return;
    sound.achievement();
    if (batch.length <= 2) for (const x of batch) toast({ icon: x.icon, kicker: 'New find', title: x.name, body: x.desc });
    else toast({ icon: 'triple-shells', kicker: `${batch.length} new finds`, title: batch.map((x) => x.name).slice(0, 3).join(', ') + (batch.length > 3 ? '…' : ''), body: `+${batch.length}% lumen` });
  }

  /** Creatures from every zone you've reached drift past the dock. */
  private syncLife(): void {
    const zi = zoneIndex(this.game.s.deepest);
    const per = Math.ceil(CREATURES.length / ZONES.length);
    const counts = CREATURES.map((_, i) => (i < (zi + 1) * per ? 1 + (i % 2) : 0));
    sky.setLife(counts, this.game.farmRate + this.game.s.deepest);
    sky.setDepth(zi * 2);
  }

  /* ------------------------------------------------------------ panels & tabs */
  private buildPanels(): void {
    this.panels = [new ShopPanel(this.game), new SkillsPanel(this.game), new DrydockPanel(this.game), new AchievementsPanel(this.game), new StatsPanel(this.game)];
    const tabsEl = $('tabs');
    const views = $('views');
    for (const p of this.panels) {
      const btn = h('button', { class: 'tab', type: 'button', role: 'tab', id: `tab-${p.id}`, 'aria-controls': `view-${p.id}`, 'aria-selected': 'false', tabindex: -1 }) as HTMLButtonElement;
      btn.innerHTML = `${ic(p.icon)}<span class="tab-label">${p.label}</span><span class="tab-dot"></span>`;
      btn.addEventListener('click', () => this.show(p.id, true));
      btn.setAttribute('aria-label', p.label);
      tabsEl.append(btn);
      this.tabs.set(p.id, { btn, dot: btn.querySelector('.tab-dot')! });
      p.el.id = `view-${p.id}`;
      p.el.setAttribute('role', 'tabpanel');
      p.el.setAttribute('aria-labelledby', `tab-${p.id}`);
      p.el.hidden = true;
      views.append(p.el);
    }
    tabsEl.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const visible = this.panels.filter((p) => !this.tabs.get(p.id)!.btn.hidden);
      const i = visible.findIndex((p) => p.id === this.active);
      const next = visible[(i + (e.key === 'ArrowRight' ? 1 : -1) + visible.length) % visible.length];
      this.show(next.id, true);
      this.tabs.get(next.id)!.btn.focus();
    });
    let saved = 'shop';
    try {
      saved = localStorage.getItem(TAB_KEY) ?? 'shop';
    } catch {
      /* storage blocked */
    }
    this.updateTabAvailability();
    this.show(this.panels.some((p) => p.id === saved && (p.available?.() ?? true)) ? saved : 'shop', false);
  }

  private show(id: string, user: boolean): void {
    const panel = this.panels.find((p) => p.id === id);
    if (!panel) return;
    hideTip();
    for (const p of this.panels) {
      const on = p.id === id;
      const tab = this.tabs.get(p.id)!;
      tab.btn.setAttribute('aria-selected', String(on));
      tab.btn.tabIndex = on ? 0 : -1;
      if (p.el.hidden === on) p.el.hidden = !on;
    }
    if (user && id !== this.active) {
      replay(panel.el, 'enter');
      sound.tick();
    }
    this.active = id;
    panel.onShow?.();
    panel.update();
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {
      /* ignore */
    }
  }

  private updateTabAvailability(): void {
    for (const p of this.panels) {
      const tab = this.tabs.get(p.id)!;
      const avail = p.available?.() ?? true;
      if (tab.btn.hidden === avail) {
        tab.btn.hidden = !avail;
        if (avail && this.lastSlow > 0) {
          replay(tab.btn, 'bump');
          toast({ icon: p.icon, kicker: 'Something new', title: p.label, tone: 'good' });
        }
      }
      toggle(tab.dot, 'on', avail && p.id !== this.active && (p.badge?.() ?? false));
    }
  }

  /* ------------------------------------------------------------ loops */
  private logic(): void {
    const now = performance.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (dt > 60) {
      if (this.game.s.settings.offlineProgress) this.awardOffline(dt);
      return;
    }
    this.game.tick(dt);
    if (Date.now() - this.lastSave > this.game.s.settings.autosaveSeconds * 1000 && !this.game.dive) this.save();
  }

  private frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    if (document.hidden || this.diveView.active) return;
    if (now - this.lastPanel > 100) {
      this.lastPanel = now;
      this.dock.update();
      this.panels.find((p) => p.id === this.active)?.update();
      rollNumber($('shards-top'), this.game.s.pearls, fmt, { speed: 6 });
    }
    if (now - this.lastSlow > 500) {
      this.lastSlow = now;
      const pending = this.game.pearlGain();
      $('chip-shards').hidden = this.game.s.pearlsTotal <= 0 && pending <= 0;
      const pend = $('shards-pending');
      pend.hidden = pending <= 0;
      if (pending > 0) setText(pend, `+${fmt(pending)} if you rebuild`);
      const d = this.game.s.deepest;
      $('depth-tag').hidden = d <= 0;
      setText($('depth-num'), `${fmtInt(d)} m`);
      this.updateTabAvailability();
      refreshTip();
    }
  };

  private save(show = true): void {
    this.lastSave = Date.now();
    if (saveLocal(this.game.s) && show) {
      const note = $('save-note');
      note.textContent = 'Saved';
      replay(note, 'show');
    }
  }

  private awardOffline(seconds: number): void {
    const r = this.game.applyOffline(seconds);
    if (r.gain > 0 && seconds > 60) showOffline(r, this.game.mods.offlineCapH, this.game.mods.offlineEff);
  }

  /* ------------------------------------------------------------ game events */
  private bindGameEvents(): void {
    const g = this.game;
    let pending: AchievementDef[] = [];
    g.on('achievement', (a) => {
      // While diving, hold finds back and announce them at the dock.
      if (this.diveView.active || g.dive) {
        this.deferred.push(a);
        return;
      }
      if (!pending.length)
        queueMicrotask(() => {
          const batch = pending;
          pending = [];
          this.announce(batch);
        });
      pending.push(a);
    });
    g.on('diveEnd', (r) => (this.pendingResult = r));
    g.on('rebuild', ({ pearls }) => {
      sound.rebirth();
      replay($('flash'), 'go');
      if (!prefersReducedMotion()) replay($('app'), 'quake');
      replay($('chip-shards'), 'bump');
      this.dock.resetCounter();
      if (pearls > 0) toast({ icon: 'oyster-pearl', kicker: 'A new sub', title: `+${fmt(pearls)} Black Pearls`, body: 'Spend them growing the Reef.', tone: 'shard' });
      this.updateTabAvailability();
      this.save();
    });
    g.on('reset', () => this.onReset());
  }

  private onReset(): void {
    this.dock.resetCounter();
    applySettings(this.game.s.settings);
    const wasOpen = this.settingsDlg.open;
    this.settingsDlg.remove();
    this.settingsDlg = buildSettings(this.game, () => this.onReset());
    if (wasOpen) openDialog(this.settingsDlg);
    this.syncLife();
    this.updateTabAvailability();
    if (!(this.panels.find((p) => p.id === this.active)?.available?.() ?? true)) this.show('shop', false);
    this.panels.forEach((p) => p.update());
  }

  /* ------------------------------------------------------------ chrome */
  private bindChrome(): void {
    const g = this.game;
    $('btn-settings').addEventListener('click', () => {
      sound.unlock();
      openDialog(this.settingsDlg);
    });
    $('btn-help').addEventListener('click', () => openDialog(this.helpDlg));
    const mute = $('btn-mute');
    const syncMute = () => {
      mute.innerHTML = ic(g.s.settings.muted ? 'speaker-off' : 'speaker');
      mute.setAttribute('aria-pressed', String(g.s.settings.muted));
    };
    syncMute();
    mute.addEventListener('click', () => {
      sound.unlock();
      g.s.settings.muted = !g.s.settings.muted;
      applySettings(g.s.settings);
      syncMute();
      sound.tick();
    });
    document.addEventListener('change', syncMute);

    $('brand').addEventListener('click', () => {
      g.s.flags.add('title');
      const r = $('brand').getBoundingClientRect();
      fx.bubbles(r.left + 18, r.top + r.height / 2, 12);
      sound.unlock();
      sound.bubble();
    });
    $('ticker').addEventListener('click', () => {
      g.s.flags.add('news');
      this.nextNews();
    });

    const unlock = () => sound.unlock();
    addEventListener('pointerdown', unlock, { once: true, capture: true });
    addEventListener('keydown', unlock, { once: true, capture: true });

    addEventListener('keydown', (e) => {
      if (this.diveView.active) return; // the dive handles its own keys
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select') || document.querySelector('dialog[open]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.save();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !t.closest('button, a, [role="tab"]')) {
        e.preventDefault();
        this.startDive();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= this.panels.length) {
        const p = this.panels[n - 1];
        if (!this.tabs.get(p.id)!.btn.hidden) this.show(p.id, true);
      } else if (e.key.toLowerCase() === 'm') mute.click();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save(false);
      else this.lastPanel = 0;
    });
    addEventListener('pagehide', () => this.save(false));

    setInterval(() => {
      document.title = document.hidden ? `${fmt(g.s.lumen)} lumen · Lanterndeep` : 'Lanterndeep';
    }, 1000);
  }

  /* ------------------------------------------------------------ ticker */
  private nextNews(): void {
    const track = $('ticker').querySelector('.ticker-track') as HTMLElement;
    const text = $('ticker-text');
    const item = pickNews(this.game.s, this.newsIdx);
    this.newsIdx = item.index;
    text.textContent = item.text;
    this.tickerAnim?.cancel();
    clearTimeout(this.tickerTimer);
    if (prefersReducedMotion()) {
      text.style.transform = 'translate(0, -50%)';
      this.tickerTimer = window.setTimeout(() => this.nextNews(), 9000);
      return;
    }
    const from = track.clientWidth;
    const to = -text.scrollWidth;
    const duration = ((from - to) / 70) * 1000;
    this.tickerAnim = text.animate([{ transform: `translate(${from}px, -50%)` }, { transform: `translate(${to}px, -50%)` }], { duration, easing: 'linear' });
    this.tickerAnim.onfinish = () => this.nextNews();
  }
}
