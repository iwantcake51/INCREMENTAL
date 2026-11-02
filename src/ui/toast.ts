import { h, escapeHtml } from './dom';
import { ic } from './icons';

export interface ToastOpts {
  icon: string;
  title: string;
  kicker?: string;
  body?: string;
  tone?: 'default' | 'good' | 'shard';
  ms?: number;
}

let host: HTMLElement;
const MAX = 4;

export function initToasts(el: HTMLElement): void {
  host = el;
}

export function toast(o: ToastOpts): void {
  if (!host) return;
  while (host.children.length >= MAX) host.firstElementChild?.remove();
  const el = h(
    'div',
    { class: `toast ${o.tone ?? ''}` },
    `<div class="toast-ic">${ic(o.icon)}</div>
     <div>${o.kicker ? `<div class="toast-kicker">${escapeHtml(o.kicker)}</div>` : ''}
       <div class="toast-title">${escapeHtml(o.title)}</div>
       ${o.body ? `<div class="toast-body">${escapeHtml(o.body)}</div>` : ''}</div>`,
  );
  const close = () => {
    if (el.classList.contains('out')) return;
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 600);
  };
  el.addEventListener('click', close);
  host.append(el);
  setTimeout(close, o.ms ?? 4200);
}
