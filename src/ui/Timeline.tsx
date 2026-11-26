import { useRef, useState } from "preact/hooks";
import { ERAS } from "../data/timeline";
import { dayOfYear, yearOf } from "../sim/time";
import { ctl } from "./ctl";
import { tick } from "./store";

const Y0 = 1944, Y1 = 2600;
const pct = (y: number) => ((y - Y0) / (Y1 - Y0)) * 100;

/** A scrubbable timeline: drag to travel in time. Shows milestones, wars and today. */
export function Timeline() {
  tick.value;
  const c = ctl(), w = c.world;
  const ref = useRef<HTMLDivElement>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);
  const yearAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Y0 + Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * (Y1 - Y0);
  };
  const scrub = (e: PointerEvent) => c.jumpTo(dayOfYear(yearAt(e.clientX)));
  const wars = w.news.items.filter(n => n.cat === "war" && n.title.startsWith("War:")).map(n => yearOf(n.day));
  const hoverEra = hoverY !== null ? [...ERAS].reverse().find(e => e.y <= hoverY) : null;
  const nowY = new Date().getUTCFullYear() + new Date().getUTCMonth() / 12;
  return (
    <div class="timeline" ref={ref}
      onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); scrub(e); }}
      onPointerMove={e => { setHoverY(yearAt(e.clientX)); if (e.buttons & 1) scrub(e); }}
      onPointerLeave={() => setHoverY(null)}
      role="slider" aria-label="Timeline" aria-valuemin={Y0} aria-valuemax={Y1} aria-valuenow={Math.floor(w.year)}>
      <div class="tl-track">
        <div class="tl-real" style={{ width: `${pct(nowY)}%` }} />
        <div class="tl-fill" style={{ width: `${pct(w.year)}%` }} />
        {ERAS.map(e => <span key={e.y} class={`tl-era ${w.year >= e.y ? "done" : ""}`} style={{ left: `${pct(e.y)}%` }} />)}
        {wars.map((y, i) => <span key={i} class="tl-war" style={{ left: `${pct(y)}%` }} />)}
        <span class="tl-now" style={{ left: `${pct(nowY)}%` }} title="Today" />
        <span class="tl-head" style={{ left: `${pct(w.year)}%` }} />
      </div>
      <div class="tl-labels"><span>1944</span><span>today</span><span>2600</span></div>
      {hoverY !== null && (
        <div class="tl-tip" style={{ left: `${pct(hoverY)}%` }}>
          <b>{Math.floor(hoverY)}</b>{hoverEra ? ` · ${hoverEra.name}` : ""}{hoverY > nowY ? " (projected)" : ""}
        </div>
      )}
    </div>
  );
}
