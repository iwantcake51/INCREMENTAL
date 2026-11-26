import type { ComponentChildren } from "preact";
import { FACTIONS } from "../data/timeline";
import type { NewsCategory } from "../data/history";

const PATHS: Record<string, string> = {
  play: "M7 4l13 8-13 8z",
  pause: "M6 5h4v14H6zM14 5h4v14h-4z",
  next: "M5 5l9 7-9 7zM16 5h3v14h-3z",
  today: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 3v6l4 2",
  plus: "M11 5h2v14h-2zM5 11h14v2H5z",
  minus: "M5 11h14v2H5z",
  home: "M12 4l9 8h-3v8h-4v-5h-4v5H6v-8H3z",
  search: "M10 3a7 7 0 015.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1110 3zm0 2a5 5 0 100 10 5 5 0 000-10z",
  gear: "M12 8a4 4 0 110 8 4 4 0 010-8zm8.6 5.5l-2 .4a7 7 0 01-.8 1.9l1.2 1.7-1.6 1.6-1.7-1.2a7 7 0 01-1.9.8l-.4 2h-2.3l-.4-2a7 7 0 01-1.9-.8l-1.7 1.2-1.6-1.6 1.2-1.7a7 7 0 01-.8-1.9l-2-.4v-2.3l2-.4a7 7 0 01.8-1.9L5.5 6.8l1.6-1.6 1.7 1.2a7 7 0 011.9-.8l.4-2h2.3l.4 2a7 7 0 011.9.8l1.7-1.2 1.6 1.6-1.2 1.7a7 7 0 01.8 1.9l2 .4z",
  help: "M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2zm2.1-7.7c-.5.8-1.3 1.2-1.8 1.6-.4.3-.3.6-.3 1.1h-2c0-1 .1-1.7.9-2.3.6-.5 1.3-.8 1.5-1.3.4-.9-.3-1.9-1.4-1.9-1 0-1.6.7-1.7 1.6H8.3c.1-2 1.6-3.6 3.7-3.6 2.6 0 4.2 2.6 3.1 4.8z",
  camera: "M9 4h6l1.5 2H20a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h3.5zm3 4a4.5 4.5 0 100 9 4.5 4.5 0 000-9z",
  expand: "M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z",
  panel: "M3 4h18v16H3zm11 2v12h5V6z",
  close: "M6.4 5l5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z",
  link: "M10.6 13.4a1 1 0 001.4 1.4l4.6-4.6a3 3 0 00-4.2-4.2l-1.6 1.6 1.4 1.4 1.6-1.6a1 1 0 011.4 1.4zm2.8-2.8a1 1 0 00-1.4-1.4l-4.6 4.6a3 3 0 004.2 4.2l1.6-1.6-1.4-1.4-1.6 1.6a1 1 0 01-1.4-1.4z",
  eye: "M12 5c5 0 9 5 10 7-1 2-5 7-10 7S3 14 2 12c1-2 5-7 10-7zm0 3a4 4 0 100 8 4 4 0 000-8z",
  swords: "M4 3l7.2 7.2-1.4 1.4L4.5 6.3V3zm16 0v3.3L9.6 16.8l1.6 1.6-1.4 1.4-1.9-1.9-2.8 2.8-1.4-1.4 2.8-2.8-1.9-1.9 1.4-1.4 1.6 1.6L17.7 3zm-4.6 12.4l1.4-1.4 1.6 1.6 1.9-1.9 1.4 1.4-1.9 1.9 2.8 2.8-1.4 1.4-2.8-2.8-1.9 1.9-1.4-1.4 1.9-1.9z",
  leaf: "M20 3c0 9-4.5 15-11 15-1.1 0-2.2-.2-3.2-.6L4 21l-1.4-1.4 2.4-2.4C4.4 16.2 4 15 4 13.8 4 8.3 9 3.8 20 3zM7 15.6l6.3-6.3 1.4 1.4-6.2 6.2c.5.1 1 .1 1.5.1 4.6 0 8.1-4 8.9-11.3C10.7 6.3 6 9.6 6 13.8c0 .7.4 1.3 1 1.8z",
  alert: "M12 2.5l10.4 18H1.6zm0 4L5.1 18.5h13.8zM11 10h2v4.5h-2zm0 6h2v2h-2z",
  star: "M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.5l-6 3.4 1.3-6.7-5-4.7 6.8-.8z",
  flame: "M13.5 1.5s.8 2.8.8 5c0 2.2-1.4 3.9-3.6 3.9S7.4 8.7 7.4 6.5l.1-.4C5.4 8.6 4 12 4 15c0 4.4 3.6 7.5 8 7.5s8-3.1 8-7.5c0-5.5-2.7-10.3-6.5-13.5zM12 20.5c-1.8 0-3.2-1.4-3.2-3.1 0-1.7 1-2.8 2.9-3.2 1.9-.4 3.9-1.3 5-2.9.5 1.4.7 2.8.7 4.3 0 2.7-2.3 4.9-5.4 4.9z",
  ringed: "M12 6a6 6 0 016 6l-.1.9c1.8-1.2 2.7-2.3 2.5-2.8-.2-.4-1.3-.4-2.9.1l-.6-1.8c2.6-.8 4.6-.6 5.3.9 1 2.1-2.5 5.6-8.3 8.4-5.8 2.8-10.7 3.2-11.7 1.1-.6-1.3.5-3.1 2.8-5l1 1.6c-1.3 1.1-1.9 2-1.7 2.4.3.6 2.4.4 5.4-.6A6 6 0 1112 6z",
  satellite: "M8.5 2.6l3.5 3.5-2.1 2.1-3.5-3.5zm9 9l3.5 3.5-2.1 2.1-3.5-3.5zM12.7 7.4l3.9 3.9-4.2 4.2-3.9-3.9zM4 15a5 5 0 005 5v2a7 7 0 01-7-7zm0-3.5A8.5 8.5 0 0012.5 20",
  sun: "M12 7a5 5 0 110 10 5 5 0 010-10zM11 1h2v3h-2zm0 19h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zm12.1 12.1l1.4-1.4 2.1 2.1-1.4 1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zm12.1-12.1l2.1-2.1 1.4 1.4-2.1 2.1z",
  sparkle: "M11 2h2l1.6 5.4L20 9v2l-5.4 1.6L13 18h-2l-1.6-5.4L4 11V9l5.4-1.6zM18 15h1.5l.7 2.3 2.3.7v1.5l-2.3.7-.7 2.3H18l-.7-2.3-2.3-.7V18l2.3-.7z",
  lock: "M7 10V7a5 5 0 0110 0v3h1a1 1 0 011 1v10a1 1 0 01-1 1H6a1 1 0 01-1-1V11a1 1 0 011-1zm2 0h6V7a3 3 0 00-6 0z",
  seedling: "M12 22v-8.2C12 9.5 8.5 6 4 6H2v2c0 4.4 3.6 8 8 8v6zm1-10.4C13.6 7.2 17 4 21 4h1v1.5c0 3.9-3.1 7-7 7.5z",
  check: "M9.5 16.2L5.3 12l-1.4 1.4 5.6 5.6L21 7.5l-1.4-1.4z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
};
export function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return <svg class="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d={PATHS[name]} fill="currentColor" /></svg>;
}

export function IconButton({ icon, label, onClick, active, kbd, class: cls }: { icon: string; label: string; onClick: () => void; active?: boolean; kbd?: string; class?: string }) {
  return (
    <button class={`icon-btn ${active ? "on" : ""} ${cls ?? ""}`} onClick={onClick} aria-label={label} data-tip={kbd ? `${label} (${kbd})` : label}>
      <Icon name={icon} />
    </button>
  );
}

export function FacDot({ fac, size = 9 }: { fac: number; size?: number }) {
  return <i class="fac-dot" style={{ background: FACTIONS[fac]?.color, width: `${size}px`, height: `${size}px` }} />;
}
export function FacChip({ fac }: { fac: number }) {
  return <span class="fac-chip"><FacDot fac={fac} />{FACTIONS[fac].name}</span>;
}

export const CAT: Record<NewsCategory, { label: string; color: string; icon: string }> = {
  war: { label: "War", color: "#ff6b4f", icon: "swords" },
  peace: { label: "Peace", color: "#7fe0a0", icon: "leaf" },
  tension: { label: "Tension", color: "#ffb347", icon: "alert" },
  rivalry: { label: "Real rivalry", color: "#ff9a7d", icon: "satellite" },
  science: { label: "Science", color: "#7fb2ff", icon: "ringed" },
  milestone: { label: "Milestone", color: "#f3cf82", icon: "star" },
  colony: { label: "Colony", color: "#5fe0d0", icon: "home" },
  disaster: { label: "Disaster", color: "#ff5c93", icon: "flame" },
};
export function CatIcon({ cat, size = 14 }: { cat: NewsCategory; size?: number }) {
  return <Icon name={CAT[cat].icon} size={size} />;
}

export function Section({ title, children, aside }: { title: string; children: ComponentChildren; aside?: ComponentChildren }) {
  return (
    <section class="sec">
      <header class="sec-h"><h3>{title}</h3>{aside}</header>
      {children}
    </section>
  );
}

export function Bar({ value, color, marker }: { value: number; color?: string; marker?: number }) {
  return (
    <div class="bar">
      <div class="bar-fill" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: color }} />
      {marker !== undefined && <div class="bar-mark" style={{ left: `${marker * 100}%` }} />}
    </div>
  );
}

/** CSS-rendered planet thumbnail for the dock and panel headers. */
export function Globe({ color, size = 34, ring, glow }: { color: string; size?: number; ring?: boolean; glow?: boolean }) {
  return (
    <span class={`globe ${ring ? "ringed" : ""} ${glow ? "star" : ""}`} style={{ width: `${size}px`, height: `${size}px`, "--c": color } as any} />
  );
}
