import { ICON_PATHS } from './icons.gen';

/** Inline SVG markup for a game-icons.net glyph (CC BY 3.0, see credits). */
export function ic(name: string, cls = ''): string {
  const d = ICON_PATHS[name] ?? ICON_PATHS['help'] ?? '';
  return `<svg class="ic ${cls}" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}

/** Replace every [data-icon] placeholder inside root with its SVG. */
export function hydrateIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    el.innerHTML = ic(el.dataset.icon!);
  });
}
