import { HISTORY, type NewsCategory } from "../data/history";
import { dayFromISO } from "./time";

export interface NewsItem {
  id: number;
  day: number;
  cat: NewsCategory;
  title: string;
  body: string;
  /** Body or object id to fly to. */
  focus?: string;
  /** Factions involved, for colored chips. */
  facs?: number[];
  /** Big stories pop up as banners. */
  major?: boolean;
  /** True for real history, false for the projected future. */
  real?: boolean;
}

const HISTORY_ITEMS = HISTORY.map(h => ({ ...h, day: dayFromISO(h.date) })).sort((a, b) => a.day - b.day);
const MAX_ITEMS = 300;

/** The news feed, newest first. Real history is added on its real date; the simulation adds the rest. */
export class NewsFeed {
  items: NewsItem[] = [];
  private nextId = 1;
  private historyIdx = 0;
  version = 0;

  add(item: Omit<NewsItem, "id">): NewsItem {
    const full = { ...item, id: this.nextId++ };
    // Keep newest first even when a catch-up adds slightly older items.
    let i = 0;
    while (i < this.items.length && this.items[i].day > full.day) i++;
    this.items.splice(i, 0, full);
    if (this.items.length > MAX_ITEMS) this.items.length = MAX_ITEMS;
    this.version++;
    return full;
  }

  /** Add real history items dated up to `day`. Returns the ones just added. */
  syncHistory(day: number): NewsItem[] {
    const added: NewsItem[] = [];
    while (this.historyIdx < HISTORY_ITEMS.length && HISTORY_ITEMS[this.historyIdx].day <= day) {
      const h = HISTORY_ITEMS[this.historyIdx++];
      added.push(this.add({ day: h.day, cat: h.cat, title: h.title, body: h.body, focus: h.focus, real: true, major: h.cat === "milestone" }));
    }
    return added;
  }

  /** Forget everything after `day` (used when time jumps backwards). History is restored silently up to `day`. */
  rewind(day: number) {
    this.items = this.items.filter(n => n.day <= day && !n.real);
    this.historyIdx = 0;
    while (this.historyIdx < HISTORY_ITEMS.length && HISTORY_ITEMS[this.historyIdx].day <= day) {
      const h = HISTORY_ITEMS[this.historyIdx++];
      this.add({ day: h.day, cat: h.cat, title: h.title, body: h.body, focus: h.focus, real: true });
    }
    this.version++;
  }

  restore(items: NewsItem[], historyDay: number) {
    this.items = [];
    this.rewind(historyDay);
    const real = this.items;
    this.items = [...items.filter(n => !n.real), ...real].sort((a, b) => b.day - a.day).slice(0, MAX_ITEMS);
    this.nextId = Math.max(0, ...this.items.map(n => n.id)) + 1;
    this.version++;
  }
}
