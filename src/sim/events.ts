import type { Vector3 } from "three";
import type { NewsItem } from "./news";

export type Weapon = "coil" | "laser" | "missile" | "lance";

/** Things that happened in the simulation which the renderer or UI may want to show. */
export type SimEvent =
  | { type: "shot"; from: Vector3; to: Vector3; color: string; weapon: Weapon }
  | { type: "blast"; at: Vector3; color: string; size: number }
  | { type: "news"; item: NewsItem; toast: boolean }
  | { type: "impact"; body: string; dir: [number, number, number]; size: string }
  | { type: "reset" };

type Listener = (e: SimEvent) => void;

export class EventBus {
  private listeners: Listener[] = [];
  on(fn: Listener) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(l => l !== fn); }; }
  emit(e: SimEvent) { for (const l of this.listeners) l(e); }
}
