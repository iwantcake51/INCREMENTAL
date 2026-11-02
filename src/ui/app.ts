import { Game } from '../core/game';
import { loadLocal, saveLocal } from '../core/save';
import { fmt } from '../core/format';
import { TRIAL_MAP } from '../data/trials';
import type { AchievementDef } from '../data/achievements';
import { pickNews } from '../data/news';
import { $, h, setText, toggle, replay, prefersReducedMotion } from './dom';
import { ic, hydrateIcons } from './icons';
import { fx, sky } from './fx';
import { sound } from './audio';
import { initToasts, toast } from './toast';
import { initTooltip, refreshTip, hideTip } from './tooltip';
import { openDialog } from './modal';
import { applySettings, buildSettings, buildHelp, showOffline } from './dialogs';
import { Stage } from './stage';
import type { Panel } from './panels/panel';
import { GeneratorsPanel } from './panels/generators';
import { UpgradesPanel } from './panels/upgrades';
import { SkillsPanel } from './panels/skills';
import { NovaPanel } from './panels/nova';
import { TrialsPanel } from './panels/trials';
import { AchievementsPanel } from './panels/achievements';
import { StatsPanel } from './panels/stats';

const TAB_KEY = 'astral-forge-tab';
const TICK_MS = 50;

export class App {
  game: Game;
  private stage!: Stage;
  private panels: Panel[] = [];
  private tabs = new Map<string, { btn: HTMLButtonElement; dot: HTMLElement }>();
  private active = 'gens';
  private gensPanel!: GeneratorsPanel;
  private settingsDlg!: HTMLDialogElement;
  private helpDlg!: HTMLDialogElement;
  private lastTick = performance.now();
  private lastPanel = 0;
  private lastSlow = 0;
  private lastSave = Date.now();
  private newsIdx = -1;
  private tickerAnim: Animation | null = null;
  private tickerTimer = 0;

  constructor() {
    const loaded = loadLocal();
    this.game = new Game(loaded ?? undefined);
    const firstVisit = !loaded;

    hydrateIcons();
    initToasts($('toasts'));
    initTooltip($('tooltip'));
    fx.init($<HTMLCanvasElement>('fx'));
    sky.init($<HTMLCanvasElement>('sky'));
    applySettings(this.game.s.settings);

    this.stage = new Stage(this.game);
    this.stage.haptics = this.game.s.settings.haptics;
    this.buildPanels();
    this.bindGameEvents();
    this.bindChrome();
    this.settingsDlg = buildSettings(this.game, () => this.onReset());
    this.helpDlg = buildHelp();

    requestAnimationFrame(() => {
      this.placeSky();
      if (firstVisit) setTimeout(() => openDialog(this.helpDlg), 400);
    });

    // Offline progress
    if (loaded && this.game.s.settings.offlineProgress) {
      const away = (Date.now() - loaded.lastSave) / 1000;
      if (away > 30) this.awardOffline(away);
    }
    this.game.recalc();
    this.stage.resetCounter();

    setInterval(() => this.logic(), TICK_MS);
    requestAnimationFrame(this.frame);
    this.nextNews();
  }

  /* ------------------------------------------------------------ panels & tabs */
  private buildPanels(): void {
    this.gensPanel = new GeneratorsPanel(this.game);
    this.panels = [
      this.gensPanel,
      new UpgradesPanel(this.game),
      new SkillsPanel(this.game),
      new NovaPanel(this.game),
      new TrialsPanel(this.game),
      new AchievementsPanel(this.game),
      new StatsPanel(this.game),
    ];
    const tabsEl = $('tabs');
    const views = $('views');
    for (const p of this.panels) {
      const btn = h('button', {
        class: 'tab',
        type: 'button',
        role: 'tab',
        id: `tab-${p.id}`,
        'aria-controls': `view-${p.id}`,
        'aria-selected': 'false',
        tabindex: -1,
      }) as HTMLButtonElement;
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
    let saved = 'gens';
    try {
      saved = localStorage.getItem(TAB_KEY) ?? 'gens';
    } catch {
      /* storage blocked */
    }
    this.updateTabAvailability();
    this.show(this.panels.some((p) => p.id === saved && (p.available?.() ?? true)) ? saved : 'gens', false);
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
          toast({ icon: p.icon, kicker: 'New section', title: p.label, tone: 'good' });
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
      // Computer slept with the tab open: treat as offline time.
      if (this.game.s.settings.offlineProgress) this.awardOffline(dt);
      return;
    }
    this.game.tick(dt);
    if (Date.now() - this.lastSave > this.game.s.settings.autosaveSeconds * 1000) this.save();
  }

  private frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    if (document.hidden) return;
    this.stage.update(now);
    if (now - this.lastPanel > 100) {
      this.lastPanel = now;
      this.panels.find((p) => p.id === this.active)?.update();
      setText($('shards-top'), fmt(this.game.s.shards));
    }
    if (now - this.lastSlow > 500) {
      this.lastSlow = now;
      $('chip-shards').hidden = this.game.s.shardsTotal <= 0;
      this.updateTabAvailability();
      refreshTip();
    }
  };

  private save(): void {
    this.lastSave = Date.now();
    saveLocal(this.game.s);
  }

  private awardOffline(seconds: number): void {
    const r = this.game.applyOffline(seconds);
    if (r.gain > 0 && seconds > 60) showOffline(r, this.game.mods.offlineCapH, this.game.mods.offlineEff);
  }

  /* ------------------------------------------------------------ game events */
  private bindGameEvents(): void {
    const g = this.game;
    // Feats unlocked in the same moment are announced together instead of as a wall of toasts.
    let pending: AchievementDef[] = [];
    g.on('achievement', (a) => {
      if (!pending.length)
        queueMicrotask(() => {
          const batch = pending;
          pending = [];
          sound.achievement();
          if (batch.length <= 2) for (const x of batch) toast({ icon: x.icon, kicker: 'Feat unlocked', title: x.name, body: x.desc });
          else toast({ icon: 'trophy-cup', kicker: `${batch.length} feats unlocked`, title: batch.map((x) => x.name).slice(0, 3).join(', ') + (batch.length > 3 ? '…' : ''), body: `+${batch.length}% production` });
        });
      pending.push(a);
    });
    g.on('comet', ({ twin }) => {
      this.stage.spawnComet();
      if (twin) setTimeout(() => this.stage.spawnComet(), 700);
    });
    g.on('event', (e) => this.stage.onEvent(e));
    g.on('eventEnd', (e) => toast({ icon: e.icon, kicker: 'Event over', title: `${e.name} has passed`, ms: 2600 }));
    g.on('rebirth', ({ shards }) => {
      sound.rebirth();
      this.stage.supernova();
      replay($('chip-shards'), 'bump');
      if (shards > 0) toast({ icon: 'crystal-cluster', kicker: 'Supernova', title: `+${fmt(shards)} Nova Shards`, body: 'Spend them in the Constellation.', tone: 'shard' });
      this.updateTabAvailability();
      this.save();
    });
    g.on('trialComplete', (id) => {
      const t = TRIAL_MAP.get(id)!;
      sound.achievement();
      const c = this.stage.starCenter();
      fx.burst(c.x, c.y, 120, { speed: 9, size: 3 });
      toast({ icon: t.icon, kicker: 'Trial conquered', title: t.name, body: `Reward: ${t.reward}`, tone: 'good', ms: 7000 });
      this.save();
    });
    g.on('reset', () => this.onReset());
  }

  private onReset(): void {
    this.stage.resetCounter();
    this.stage.haptics = this.game.s.settings.haptics;
    applySettings(this.game.s.settings);
    // Settings dialog mirrors state, so rebuild it after imports.
    const wasOpen = this.settingsDlg.open;
    this.settingsDlg.remove();
    this.settingsDlg = buildSettings(this.game, () => this.onReset());
    if (wasOpen) openDialog(this.settingsDlg);
    this.updateTabAvailability();
    if (!(this.panels.find((p) => p.id === this.active)?.available?.() ?? true)) this.show('gens', false);
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
    this.settingsDlg?.addEventListener?.('close', syncMute);
    document.addEventListener('change', () => {
      syncMute();
      this.stage.haptics = g.s.settings.haptics;
      this.placeSky();
    });

    $('brand').addEventListener('click', () => {
      g.s.flags.add('title');
      const r = $('brand').getBoundingClientRect();
      fx.burst(r.left + 18, r.top + r.height / 2, 24, { speed: 3 });
      sound.unlock();
      sound.tick();
    });

    $('ticker').addEventListener('click', () => {
      g.s.flags.add('news');
      this.nextNews();
    });

    // First interaction anywhere unlocks audio.
    const unlock = () => sound.unlock();
    addEventListener('pointerdown', unlock, { once: true, capture: true });
    addEventListener('keydown', unlock, { once: true, capture: true });

    addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select') || document.querySelector('dialog[open]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.save();
        toast({ icon: 'save', title: 'Game saved', ms: 1800 });
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= this.panels.length) {
        const p = this.panels[n - 1];
        if (!this.tabs.get(p.id)!.btn.hidden) this.show(p.id, true);
      } else if (e.key.toLowerCase() === 'b') this.gensPanel.cycleAmount();
      else if (e.key.toLowerCase() === 'm') mute.click();
      else if (e.key.toLowerCase() === 'u') {
        if (g.buyAllUpgrades() > 0) sound.upgrade();
        else sound.denied();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
      else this.lastPanel = 0;
    });
    addEventListener('pagehide', () => this.save());
    addEventListener('resize', () => this.placeSky());

    // Tab title shows your stash while you're away.
    setInterval(() => {
      document.title = document.hidden ? `${fmt(g.s.stardust)} stardust · Astral Forge` : 'Astral Forge';
    }, 1000);
  }

  private placeSky(): void {
    const c = this.stage.starCenter();
    if (c.x || c.y) sky.setCenter(c.x / innerWidth, c.y / innerHeight);
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
