import { Vector3 } from "three";
import { Bodies } from "./bodies";
import { Civ, type CivSnapshot } from "./civ";
import { EventBus } from "./events";
import { God, type GodSnapshot } from "./god";
import { Impacts, type Crater } from "./impacts";
import { SkyWatcher } from "./sky";
import { applyTimeline, rollTimeline, type TimelineRoll } from "../data/timeline";
import { NewsFeed } from "./news";
import { makeRng } from "./rng";
import type { ScaleMode } from "./scale";
import { dayFromISO, MAX_DAY, MIN_DAY, yearOf } from "./time";

/** The game starts the day before the first rocket reached space. */
export const START_DAY = dayFromISO("1944-06-19");

export type Quality = "low" | "medium" | "high";

export interface Settings {
  scale: ScaleMode;
  labels: boolean;
  orbits: boolean;
  wars: boolean;
  sound: boolean;
  quality: Quality;
  /** Drop to a watchable speed when a war starts or another big story breaks. */
  slowOnEvents: boolean;
  /** Fly the camera to big stories automatically. */
  followEvents: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  scale: "compressed", labels: true, orbits: true, wars: true, sound: true, quality: "high", slowOnEvents: true, followEvents: false,
};

export interface SaveData {
  v: 2;
  day: number;
  speed: number;
  settings: Settings;
  focus: string;
  civ: CivSnapshot;
  god: GodSnapshot;
  craters?: Crater[];
  timeline?: TimelineRoll;
}

/** The whole simulation: time, bodies, civilization, god mode and the news. Knows nothing about rendering. */
export class World {
  day = START_DAY;
  speed = 30.44;
  playing = true;
  settings: Settings = { ...DEFAULT_SETTINGS };
  readonly bus = new EventBus();
  readonly news = new NewsFeed();
  readonly bodies = new Bodies();
  readonly civ: Civ;
  readonly god: God;
  readonly impacts: Impacts;
  readonly sky = new SkyWatcher();
  private lastStepDay = this.day;

  timeline: TimelineRoll;

  constructor(seed = (Math.random() * 2 ** 31) | 0) {
    // Roll this game's version of the projected future before anything reads the timeline.
    const tr = makeRng(seed + 11);
    this.timeline = rollTimeline(tr.next);
    applyTimeline(this.timeline);
    this.civ = new Civ(this.news, this.bus, makeRng(seed));
    this.impacts = new Impacts(makeRng(seed + 7));
    this.god = new God(this.civ, this.news, this.bus, this.impacts);
    this.impacts.onHit = (body, dir, size) => this.bus.emit({ type: "impact", body, dir, size });
    this.impacts.onBlast = (body, dir) => {
      const b = this.bodies.get(body)!;
      const at = this.bodies.localToWorld(b, { x: dir[0], y: dir[1], z: dir[2] }, new Vector3()).multiplyScalar(b.radius * 1.25).add(b.pos);
      this.bus.emit({ type: "blast", at, color: "#9fd8ff", size: Math.max(0.4, b.radius * 1.5) });
    };
    this.civ.reset(this.day);
    this.impacts.reset(this.day);
  }

  get year() { return yearOf(this.day); }

  step(dtReal: number) {
    if (this.playing) this.day += this.speed * dtReal;
    this.day = Math.min(MAX_DAY, Math.max(MIN_DAY, this.day));
    if (this.day >= MAX_DAY) this.playing = false;
    const dtDays = this.day - this.lastStepDay;
    if (dtDays < -0.5) { this.impacts.reset(this.day); this.sky.reset(); }
    this.lastStepDay = this.day;
    const visualSpeed = this.playing ? this.speed : 0;
    this.bodies.update(this.day, dtReal, visualSpeed, this.settings.scale);
    this.civ.update(this.day, dtReal, Math.max(this.speed, 0.04), this.bodies);
    this.god.update(this.day, dtDays);
    const post = (item: import("./news").NewsItem, toast = false) => this.bus.emit({ type: "news", item, toast });
    this.impacts.update(this.day, dtDays, dtReal, this.bodies, this.civ, this.news, post);
    if (this.speed <= 400) this.sky.update(this.day, dtDays, this.news, item => post(item, !!item.major));
  }

  /** Jump to a date. Going backwards undoes everything that happened after it. */
  setDay(day: number) {
    day = Math.min(MAX_DAY, Math.max(MIN_DAY, day));
    if (day < this.day) this.god.rewind(yearOf(day));
    this.day = day;
  }

  setWars(on: boolean) {
    this.settings.wars = on;
    this.civ.setWarsEnabled(on, this.day);
  }

  save(focus: string): SaveData {
    return { v: 2, day: this.day, speed: this.speed, settings: this.settings, focus, civ: this.civ.snapshot(this.day), god: this.god.snapshot(), craters: this.impacts.snapshot(), timeline: this.timeline };
  }

  load(s: SaveData) {
    this.day = this.lastStepDay = s.day;
    this.speed = s.speed;
    if (s.timeline) { this.timeline = s.timeline; applyTimeline(s.timeline); }
    this.settings = { ...DEFAULT_SETTINGS, ...s.settings };
    this.civ.warsEnabled = this.settings.wars;
    this.civ.restore(s.civ);
    this.god.restore(s.god);
    this.impacts.reset(s.day);
    this.impacts.restore(s.craters ?? []);
  }
}
