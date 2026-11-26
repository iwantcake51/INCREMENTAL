import type { Controller } from "./controller";

let current: Controller | null = null;
export function setCtl(c: Controller) { current = c; }
/** The app controller (set once at startup). */
export function ctl(): Controller { if (!current) throw new Error("controller not ready"); return current; }
