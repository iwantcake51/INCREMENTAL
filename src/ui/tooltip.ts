/**
 * One shared tooltip. Desktop: hover/focus. Touch: long-press (which also suppresses the
 * tap that would otherwise buy something, so players can inspect before purchasing).
 */
type TipFn = () => string;

const providers = new WeakMap<Element, TipFn>();
let el: HTMLElement;
let anchor: Element | null = null;
let pressTimer = 0;
const suppressed = new WeakSet<Element>();

export function tip(target: Element, fn: TipFn): void {
  providers.set(target, fn);
}

function findTarget(node: EventTarget | null): Element | null {
  let n = node instanceof Element ? node : null;
  while (n) {
    if (providers.has(n) || (n as HTMLElement).dataset?.tip) return n;
    n = n.parentElement;
  }
  return null;
}

function content(target: Element): string {
  const fn = providers.get(target);
  if (fn) return fn();
  return `<p>${(target as HTMLElement).dataset.tip ?? ''}</p>`;
}

function show(target: Element): void {
  anchor = target;
  el.innerHTML = content(target);
  el.hidden = false;
  position();
}

export function hideTip(): void {
  anchor = null;
  if (el) el.hidden = true;
}

function position(): void {
  if (!anchor) return;
  const r = anchor.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return hideTip();
  const tw = el.offsetWidth;
  const th = el.offsetHeight;
  const gap = 10;
  let x = r.left + r.width / 2 - tw / 2;
  let y = r.top - th - gap;
  if (y < 8) y = r.bottom + gap;
  x = Math.max(8, Math.min(innerWidth - tw - 8, x));
  y = Math.max(8, Math.min(innerHeight - th - 8, y));
  el.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
}

/** Re-render the open tooltip (costs and affordability change over time). */
export function refreshTip(): void {
  if (!anchor) return;
  if (!anchor.isConnected) return hideTip();
  const html = content(anchor);
  if (el.innerHTML !== html) {
    el.innerHTML = html;
    position();
  }
}

/** True if the last tap on this element was a long-press (and should not trigger an action). */
export function consumeLongPress(target: Element): boolean {
  if (suppressed.has(target)) {
    suppressed.delete(target);
    return true;
  }
  return false;
}

export function initTooltip(host: HTMLElement): void {
  el = host;
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const t = findTarget(e.target);
    if (t && t !== anchor) show(t);
    else if (!t && anchor) hideTip();
  });
  document.addEventListener('pointerleave', hideTip);
  document.addEventListener('focusin', (e) => {
    const t = findTarget(e.target);
    if (t && (e.target as HTMLElement).matches(':focus-visible')) show(t);
  });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('scroll', hideTip, { capture: true, passive: true });
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    hideTip();
    const t = findTarget(e.target);
    if (!t) return;
    clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => {
      suppressed.add(t);
      show(t);
      navigator.vibrate?.(6);
    }, 380);
  });
  const cancel = () => {
    clearTimeout(pressTimer);
    if (anchor) setTimeout(hideTip, 1600);
  };
  document.addEventListener('pointerup', cancel);
  document.addEventListener('pointercancel', cancel);
  // Native long-press menu would fight with ours.
  document.addEventListener('contextmenu', (e) => {
    if (findTarget(e.target)) e.preventDefault();
  });
}
