import { useEffect } from "preact/hooks";
import { FACTIONS } from "../data/timeline";
import { shortDateOf } from "../sim/time";
import { ctl } from "./ctl";
import { CAT, CatIcon } from "./common";
import { dismissToast, flash, hover, panelOpen, tab, tick, toasts } from "./store";

/** Big stories pop up here for a few seconds, with a button to fly to them. */
export function Toasts() {
  const list = toasts.value;
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      const keep = toasts.value.filter(t => now - t.at < 9000);
      if (keep.length !== toasts.value.length) toasts.value = keep;
    }, 500);
    return () => clearInterval(id);
  }, []);
  const c = ctl();
  return (
    <div class="toasts" aria-live="polite">
      {list.map(t => (
        <div key={t.key} class="toast" style={{ "--cc": CAT[t.item.cat].color } as any}>
          <div class="toast-meta"><span class="cat"><CatIcon cat={t.item.cat} size={13} />{CAT[t.item.cat].label}</span><span class="mono">{shortDateOf(t.item.day)}</span>
            {t.item.facs?.map(f => <i key={f} class="fac-dot" style={{ background: FACTIONS[f].color }} />)}</div>
          <b>{t.item.title}</b>
          <p>{t.item.body}</p>
          <div class="toast-actions">
            {t.item.focus && <button class="btn small primary" onClick={() => { c.select(t.item.focus!); dismissToast(t.key); }}>Show me</button>}
            {(t.item.cat === "war" || t.item.cat === "peace") && <button class="btn small" onClick={() => { tab.value = "wars"; panelOpen.value = true; dismissToast(t.key); }}>Explain</button>}
            <button class="btn small ghost" onClick={() => dismissToast(t.key)}>Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The latest headline, always visible. Click to open the News tab. */
export function Ticker() {
  tick.value;
  const n = ctl().world.news.items[0];
  if (!n) return null;
  return (
    <button class="ticker" onClick={() => { tab.value = "news"; panelOpen.value = true; }} style={{ "--cc": CAT[n.cat].color } as any} data-tip="Open the news (B)">
      <span class="ticker-cat"><CatIcon cat={n.cat} size={13} /></span>
      <span class="ticker-date mono">{shortDateOf(n.day)}</span>
      <span class="ticker-title">{n.title}</span>
    </button>
  );
}

export function HoverTip() {
  const h = hover.value;
  if (!h) return null;
  const w = ctl().world;
  const col = w.civ.colonies.find(c => c.active && c.body === h.id && (h.id !== "earth" || w.year >= 2045));
  return (
    <div class="hover-tip" style={{ transform: `translate(${h.x + 14}px, ${h.y + 14}px)` }}>
      <b>{h.name}</b>
      {col && <span><i class="fac-dot" style={{ background: FACTIONS[col.owner].color }} /> {FACTIONS[col.owner].short}{col.siege > 0 ? " · under attack" : ""}</span>}
      <span class="muted">Click to select · double-click to fly close</span>
    </div>
  );
}

export function Flash() {
  return flash.value ? <div class="flash">{flash.value}</div> : null;
}
