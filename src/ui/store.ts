import { signal } from "@preact/signals";
import type { NewsItem } from "../sim/news";

export type Tab = "planet" | "god" | "wars" | "tech" | "news";

/** Bumped ~8 times a second; components that show live numbers read it to re-render. */
export const tick = signal(0);
/** Bumped when planet portraits finish rendering. */
export const thumbVersion = signal(0);
export const selected = signal("earth");
export const tab = signal<Tab>("planet");
export const panelOpen = signal(typeof innerWidth === "number" ? innerWidth > 760 : true);
export const hover = signal<{ id: string; name: string; x: number; y: number } | null>(null);
export const dialog = signal<null | "help" | "search" | "settings" | "welcome">(null);
export const hideUI = signal(false);
export const unread = signal(0);
export const lastReadNews = signal(0);

export interface Toast { key: number; item: NewsItem; at: number }
export const toasts = signal<Toast[]>([]);
let toastKey = 1;
export function pushToast(item: NewsItem) {
  const list = [...toasts.value, { key: toastKey++, item, at: performance.now() }];
  toasts.value = list.slice(-3);
}
export function dismissToast(key: number) { toasts.value = toasts.value.filter(t => t.key !== key); }

export const flash = signal<string | null>(null);
let flashTimer = 0;
/** A short message at the bottom of the screen ("Link copied", "Saved"...). */
export function say(msg: string) {
  flash.value = msg;
  clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => (flash.value = null), 2200);
}
