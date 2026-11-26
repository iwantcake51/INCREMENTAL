import { Bodies } from "./bodies";
import { Civ, type CivSnapshot } from "./civ";
import { EventBus } from "./events";
import { God, type GodSnapshot } from "./god";
import { NewsFeed } from "./news";
import { makeRng } from "./rng";
import type { ScaleMode } from "./scale";
import { dayNow, MAX_DAY, MIN_DAY, yearOf } from "./time";

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
}

/** The whole simulation: time, bodies, civilization, god mode and the news. Knows nothing about rendering. */
export class World {
  day = dayNow();
  speed = 30.44;
  playing = true;
  settings: Settings = { ...DEFAULT_SETTINGS };
  readonly bus = new EventBus();
  readonly news = new NewsFeed();
  readonly bodies = new Bodies();
  readonly civ: Civ;
  readonly god: God;
  private lastStepDay = this.day;

  constructor(seed = (Math.random() * 2 ** 31) | 0) {
    this.civ = new Civ(this.news, this.bus, makeRng(seed));
    this.god = new God(this.civ, this.news, this.bus);
    this.civ.reset(this.day);
  }

  get year() { return yearOf(this.day); }

  step(dtReal: number) {
    if (this.playing) this.day += this.speed * dtReal;
    this.day = Math.min(MAX_DAY, Math.max(MIN_DAY, this.day));
    if (this.day >= MAX_DAY) this.playing = false;
    const dtDays = this.day - this.lastStepDay;
    this.lastStepDay = this.day;
    const visualSpeed = this.playing ? this.speed : 0;
    this.bodies.update(this.day, dtReal, visualSpeed, this.settings.scale);
    this.civ.update(this.day, dtReal, Math.max(this.speed, 0.04), this.bodies);
    this.god.update(this.day, dtDays);
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
    return { v: 2, day: this.day, speed: this.speed, settings: this.settings, focus, civ: this.civ.snapshot(this.day), god: this.god.snapshot() };
  }

  load(s: SaveData) {
    this.day = this.lastStepDay = s.day;
    this.speed = s.speed;
    this.settings = { ...DEFAULT_SETTINGS, ...s.settings };
    this.civ.warsEnabled = this.settings.wars;
    this.civ.restore(s.civ);
    this.god.restore(s.god);
  }
}
