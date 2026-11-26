// The glue between the simulation, the 3D engine and the UI: user actions, autosave, share links and shortcuts.
import { ERAS } from "../data/timeline";
import type { NewsItem } from "../sim/news";
import { dayFromDate, dayFromISO, dayNow, isoOf, SPEEDS, yearOf } from "../sim/time";
import type { SaveData, Settings, World } from "../sim/world";
import type { Engine } from "../render/Engine";
import { chime, setSound, boom } from "./sound";
import { dialog, hideUI, lastReadNews, panelOpen, pushToast, say, selected, tab, tick, unread, type Tab } from "./store";

const SAVE_KEY = "brass-orrery:v2";
const WELCOME_KEY = "brass-orrery:welcomed";

/** Order of bodies in the planet dock and for ←/→ navigation. */
export const DOCK = ["sun", "mercury", "venus", "earth", "mars", "ceres", "jupiter", "saturn", "uranus", "neptune"];

export class Controller {
  constructor(readonly world: World, readonly engine: Engine) {}

  get settings() { return this.world.settings; }

  init() {
    const loaded = this.loadFromHash() || this.loadSave();
    if (!loaded) this.engine.rig.snapTo("sun", this.engine.target("sun")!, 300, 0.55);
    setSound(this.settings.sound);
    this.engine.setQuality(this.settings.quality);
    try { if (!localStorage.getItem(WELCOME_KEY)) dialog.value = "welcome"; } catch { /* storage blocked */ }

    this.world.bus.on(e => {
      if (e.type === "news") this.onNews(e.item, e.toast);
      if (e.type === "blast" && e.size >= 1.5) boom(0.6);
    });
    setInterval(() => this.save(), 15000);
    addEventListener("pagehide", () => this.save());
    addEventListener("keydown", e => this.onKey(e));
    // Re-render live UI ~8 times a second (the 3D view runs every frame on its own).
    setInterval(() => { tick.value++; this.updateUnread(); }, 125);
  }

  // ---------- selection and camera ----------

  select(id: string, fly = true) {
    selected.value = id;
    if (fly) this.engine.focus(id);
    else this.engine.selected = id;
    if (tab.value !== "planet" && tab.value !== "god") tab.value = "planet";
    if (!panelOpen.value && innerWidth > 760) panelOpen.value = true;
  }
  step(dir: 1 | -1) {
    const sys = this.world.bodies.systemOf(selected.value);
    const i = DOCK.indexOf(sys);
    this.select(DOCK[(i + dir + DOCK.length) % DOCK.length]);
  }
  overview() { selected.value = "sun"; this.engine.overview(); }

  // ---------- time ----------

  togglePlay() { this.world.playing = !this.world.playing; tick.value++; }
  setSpeed(v: number) { this.world.speed = v; this.world.playing = true; tick.value++; }
  speedStep(dir: 1 | -1) {
    const i = SPEEDS.findIndex(s => Math.abs(s.value - this.world.speed) < 1e-6);
    const j = Math.max(0, Math.min(SPEEDS.length - 1, (i < 0 ? 2 : i) + dir));
    this.setSpeed(SPEEDS[j].value);
  }
  jumpTo(day: number) { this.world.setDay(day); this.world.step(0); tick.value++; }
  today() { this.jumpTo(dayNow()); }
  nextMilestone() {
    const y = this.world.year;
    const nx = ERAS.find(e => e.y > y + 1e-3);
    if (nx) { this.jumpTo(dayFromDate(nx.y, 1, 1) + 0.5); if (nx.focus) this.select(nx.focus); }
  }

  // ---------- settings ----------

  setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
    if (k === "wars") this.world.setWars(v as boolean);
    else this.world.settings[k] = v;
    if (k === "sound") setSound(v as boolean);
    if (k === "quality") this.engine.setQuality(v as Settings["quality"]);
    tick.value++;
    this.save();
  }

  // ---------- news ----------

  private onNews(item: NewsItem, toast: boolean) {
    if (!toast) return;
    pushToast(item);
    const bad = item.cat === "war" || item.cat === "disaster";
    chime(bad ? "bad" : item.cat === "peace" || item.cat === "milestone" ? "good" : "neutral");
    if (this.settings.slowOnEvents && (item.cat === "war" || item.cat === "disaster") && this.world.speed > 40) {
      this.world.speed = 30.44;
      say("Slowed to 1 month/s for a big event (change in Settings)");
    }
    if (this.settings.followEvents && item.focus) this.select(item.focus);
  }
  markNewsRead() { lastReadNews.value = this.world.news.items[0]?.id ?? 0; unread.value = 0; }
  private updateUnread() {
    if (tab.value === "news" && panelOpen.value) { this.markNewsRead(); return; }
    let n = 0;
    for (const it of this.world.news.items) { if (it.id <= lastReadNews.value) break; n++; }
    unread.value = n;
  }

  // ---------- god powers ----------

  usePower(id: string, a?: number | string, b?: number | string) {
    // Asteroid strikes aim at the side of the world you're looking at, so you can watch the impact.
    if ((id === "asteroid" || id === "extinction") && typeof a === "string") {
      const body = this.world.bodies.get(a);
      if (body) {
        const d = this.engine.camera.position.clone().sub(body.pos).normalize().applyQuaternion(body.quat!.clone().invert());
        d.add({ x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5, z: (Math.random() - 0.5) * 0.5 } as any).normalize();
        this.world.impacts.aim = [d.x, d.y, d.z];
      }
    }
    const err = this.world.god.use(id, this.world.day, a, b);
    if (err) say(err);
    else { chime("good"); tick.value++; }
    return err;
  }

  toggleMeteors(size?: "small" | "large" | "huge") {
    const e = this.engine;
    e.meteorMode = size ?? (e.meteorMode ? null : "large");
    say(e.meteorMode ? "Meteor mode on: click any world to strike it (M to stop)" : "Meteor mode off");
    tick.value++;
  }

  // ---------- save, load and share ----------

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.world.save(selected.value))); } catch { /* storage full or blocked */ }
  }
  private loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw) as SaveData;
      if (s.v !== 2) return false;
      this.world.load(s);
      this.world.step(0);
      selected.value = s.focus || "earth";
      const t = this.engine.target(selected.value) ?? this.engine.target("sun")!;
      this.engine.selected = selected.value;
      this.engine.rig.snapTo(selected.value, t, selected.value === "sun" ? 300 : t.radius * 6, 0.4);
      return true;
    } catch { return false; }
  }
  newGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    location.hash = "";
    location.reload();
  }
  shareLink() {
    const url = `${location.origin}${location.pathname}#date=${isoOf(this.world.day)}&focus=${selected.value}`;
    navigator.clipboard?.writeText(url).then(() => say("Link copied: it opens this date and view"), () => say(url));
  }
  private loadFromHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    const date = h.get("date"), focus = h.get("focus");
    if (!date && !focus) return false;
    if (date && !Number.isNaN(dayFromISO(date))) { this.world.setDay(dayFromISO(date)); this.world.step(0); }
    const id = focus && this.engine.target(focus) ? focus : "sun";
    selected.value = id;
    this.engine.selected = id;
    const t = this.engine.target(id)!;
    this.engine.rig.snapTo(id, t, id === "sun" ? 300 : t.radius * 6, 0.4);
    return true;
  }
  screenshot() {
    const url = this.engine.screenshot();
    const a = document.createElement("a");
    a.href = url;
    a.download = `orrery-${Math.floor(yearOf(this.world.day))}.png`;
    a.click();
    say("Screenshot saved");
  }
  dismissWelcome() { try { localStorage.setItem(WELCOME_KEY, "1"); } catch { /* ignore */ } dialog.value = null; }

  // ---------- keyboard ----------

  private onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) { if (e.key === "Escape") t.blur(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); dialog.value = "search"; return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const go = (tb: Tab) => { tab.value = tb; panelOpen.value = true; };
    switch (e.key) {
      case " ": e.preventDefault(); this.togglePlay(); break;
      case "1": case "2": case "3": case "4": case "5": this.setSpeed(SPEEDS[+e.key - 1].value); break;
      case "[": this.speedStep(-1); break;
      case "]": this.speedStep(1); break;
      case "ArrowRight": e.preventDefault(); this.step(1); break;
      case "ArrowLeft": e.preventDefault(); this.step(-1); break;
      case "ArrowUp": case "+": case "=": e.preventDefault(); this.engine.zoom(0.6); break;
      case "ArrowDown": case "-": case "_": e.preventDefault(); this.engine.zoom(1.6); break;
      case "h": case "Home": this.overview(); break;
      case "f": this.engine.focus(selected.value); break;
      case "t": this.today(); break;
      case "n": this.nextMilestone(); break;
      case "l": this.setSetting("labels", !this.settings.labels); break;
      case "o": this.setSetting("orbits", !this.settings.orbits); break;
      case "p": go("planet"); break;
      case "g": go("god"); break;
      case "w": go("wars"); break;
      case "y": go("tech"); break;
      case "b": go("news"); break;
      case "/": e.preventDefault(); dialog.value = "search"; break;
      case "?": dialog.value = dialog.value === "help" ? null : "help"; break;
      case "u": hideUI.value = !hideUI.value; break;
      case "m": this.toggleMeteors(); break;
      case "S": this.screenshot(); break;
      case "Tab": e.preventDefault(); panelOpen.value = !panelOpen.value; break;
      case "Escape": if (dialog.value) dialog.value = null; else if (hideUI.value) hideUI.value = false; break;
    }
  }
}
