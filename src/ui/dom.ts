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
