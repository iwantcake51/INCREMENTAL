export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | undefined> = {},
  html?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style') el.style.cssText = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  if (html !== undefined) el.innerHTML = html;
  return el;
}

const lastText = new WeakMap<Node, string>();
/** Only touches the DOM when the value actually changed. */
export function setText(el: Element, value: string): void {
  if (lastText.get(el) === value) return;
  lastText.set(el, value);
  el.textContent = value;
}

const lastHtml = new WeakMap<Node, string>();
export function setHtml(el: Element, value: string): void {
  if (lastHtml.get(el) === value) return;
  lastHtml.set(el, value);
  el.innerHTML = value;
}

export function toggle(el: Element, cls: string, on: boolean): void {
  if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
}

/** Restart a one-shot CSS animation class. */
export function replay(el: Element, cls: string): void {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

export function setWidth(el: HTMLElement, fraction: number): void {
  const v = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  if (el.style.width !== v) el.style.width = v;
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function prefersReducedMotion(): boolean {
  const forced = document.documentElement.dataset.motion;
  if (forced === 'on') return true;
  if (forced === 'off') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ==========================================================================
   Smooth numbers: displayed values glide toward their targets instead of
   jumping. Large changes ease in log space so a ×1000 jump still rolls up
   visibly. One shared rAF loop runs only while something is moving.
   ========================================================================== */
interface Tween {
  shown: number;
  target: number;
  format: (n: number) => string;
  integer: boolean;
  speed: number;
}
const tweens = new Map<Element, Tween>();
let tweenRaf = 0;
let tweenLast = 0;

/**
 * Show `value` in `el`, rolling smoothly from whatever it showed before.
 * `integer` keeps counts whole while they roll; `speed` is roughly 1/seconds to settle.
 */
export function rollNumber(el: Element, value: number, format: (n: number) => string, opts: { integer?: boolean; speed?: number } = {}): void {
  let t = tweens.get(el);
  if (!t) {
    t = { shown: value, target: value, format, integer: !!opts.integer, speed: opts.speed ?? 7 };
    tweens.set(el, t);
    setText(el, format(value));
    return;
  }
  t.format = format;
  if (t.target === value) return;
  t.target = value;
  if (prefersReducedMotion() || !Number.isFinite(value) || !Number.isFinite(t.shown)) {
    t.shown = value;
    setText(el, format(value));
    return;
  }
  if (!tweenRaf) {
    tweenLast = performance.now();
    tweenRaf = requestAnimationFrame(stepTweens);
  }
}

/** Jump straight to the value (after a reset, say). */
export function snapNumber(el: Element, value: number): void {
  const t = tweens.get(el);
  if (!t) return;
  t.shown = t.target = value;
  setText(el, t.format(value));
}

function stepTweens(now: number): void {
  const dt = Math.max(0, Math.min(0.1, (now - tweenLast) / 1000));
  tweenLast = now;
  let moving = false;
  for (const [el, t] of tweens) {
    if (!el.isConnected) {
      tweens.delete(el);
      continue;
    }
    if (t.shown === t.target) continue;
    const k = 1 - Math.exp(-dt * t.speed);
    const a = t.shown;
    const b = t.target;
    let next: number;
    if (a > 0 && b > 0 && (b / a > 1.6 || a / b > 1.6)) next = Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * k);
    else next = a + (b - a) * k;
    const close = Math.abs(b - next) <= Math.max(t.integer ? 0.5 : 0.005, Math.abs(b) * 2e-4);
    t.shown = close ? b : next;
    if (!close) moving = true;
    setText(el, t.format(t.integer ? Math.round(t.shown) : t.shown));
  }
  tweenRaf = moving ? requestAnimationFrame(stepTweens) : 0;
}
