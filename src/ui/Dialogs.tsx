import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { shortDateOf } from "../sim/time";
import type { Quality } from "../sim/world";
import { ctl } from "./ctl";
import { CAT, Icon } from "./common";
import { TEXTURE_CREDIT } from "../render/textures";
import { dialog, tick } from "./store";

function Modal({ title, children, wide }: { title: string; children: ComponentChildren; wide?: boolean }) {
  return (
    <div class="modal-bg" onClick={e => { if (e.target === e.currentTarget) dialog.value = null; }}>
      <div class={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button class="icon-btn" onClick={() => (dialog.value = null)} aria-label="Close"><Icon name="close" /></button></header>
        <div class="modal-body">{children}</div>
      </div>
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Space", "Play / pause"], ["1 – 5", "Speed: 1 hour/s … 10 years/s"], ["[  ]", "Slower / faster"],
  ["← →", "Previous / next planet"], ["↑ ↓  or scroll", "Zoom in / out"], ["H", "Whole solar system"], ["F", "Fly to the selected world"],
  ["Double-click", "Fly in close"], ["N", "Next milestone"], ["T", "Today"], ["P G W Y B", "World, God, Wars, Tech, News tabs"],
  ["Tab", "Show / hide the panel"], ["/ or Ctrl+K", "Search"], ["L / O", "Labels / orbits"], ["U", "Hide all UI (cinematic)"], ["Shift+S", "Screenshot"], ["?", "This help"],
];

export function Help() {
  return (
    <Modal title="How to play" wide>
      <div class="help-grid">
        <div>
          <h3>Look around</h3>
          <p>Drag to rotate. Scroll or pinch to zoom: you can go from the whole solar system right down to a few kilometres above a planet's surface. Click a planet, or use the dock at the bottom, to fly there. The camera follows it along its orbit.</p>
          <h3>Watch history unfold</h3>
          <p>Everything up to today is real: orbits from NASA JPL, real launches, real anti-satellite tests. After 2026 the future is projected. Colonies appear from 2045, warships in 2060. Wars then break out on their own when tensions boil over.</p>
          <h3>Play god</h3>
          <p>You earn Influence as civilization grows. Spend it in the God tab to calm or inflame rivals, bless a power, end wars, plant colonies, terraform worlds and more. Higher ranks unlock bigger powers, and goals pay bonuses.</p>
          <p class="muted">Your game saves automatically in this browser.</p>
          <p class="muted small">{TEXTURE_CREDIT}. Orbits: NASA JPL. Facts: NASA planetary fact sheets.</p>
        </div>
        <div>
          <h3>Shortcuts</h3>
          <dl class="keys">{SHORTCUTS.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl>
        </div>
      </div>
    </Modal>
  );
}

export function Welcome() {
  const c = ctl();
  return (
    <Modal title="Welcome to the Brass Orrery">
      <ol class="welcome">
        <li><b>It's live.</b> The planets are where they really are today, from NASA orbital data.</li>
        <li><b>Explore.</b> Pick a world in the dock at the bottom, then scroll to zoom right down to its surface.</li>
        <li><b>Fast-forward.</b> Press <kbd>5</kbd> or drag the timeline. Watch satellites, colonies, cargo ships and new tech fill the solar system.</li>
        <li><b>Play god.</b> Earn Influence and use powers from the <b>God</b> tab. Powers start working once colonies exist (2045).</li>
      </ol>
      <div class="row">
        <button class="btn primary" onClick={() => { c.dismissWelcome(); c.select("earth"); }}>Start at Earth</button>
        <button class="btn" onClick={() => { c.dismissWelcome(); c.setSpeed(365.25); }}>Start fast-forwarding</button>
        <button class="btn ghost" onClick={() => { c.dismissWelcome(); dialog.value = "help"; }}>Controls</button>
      </div>
    </Modal>
  );
}

export function Search() {
  const c = ctl(), w = c.world;
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    const bodies = w.bodies.list.map(b => ({ kind: "World", label: b.name, sub: b.kind === "moon" ? `Moon of ${w.bodies.get(b.parent!)!.name}` : b.kind, run: () => c.select(b.id) }));
    const extra = [
      { kind: "Spacecraft", label: "Voyager 1", sub: "launched 1977", run: () => { if (w.year < 1977.7) c.jumpTo((1980 - 2000) * 365.25); c.select("voyager1"); } },
      { kind: "Spacecraft", label: "Voyager 2", sub: "launched 1977", run: () => { if (w.year < 1977.7) c.jumpTo((1990 - 2000) * 365.25); c.select("voyager2"); } },
    ];
    const news = w.news.items.slice(0, 200).map(it => ({ kind: CAT[it.cat].label, label: it.title, sub: shortDateOf(it.day), run: () => { if (it.focus) c.select(it.focus); } }));
    const all = [...bodies, ...extra, ...news];
    return (n ? all.filter(r => (r.label + " " + r.sub).toLowerCase().includes(n)) : [...bodies.slice(0, 10), ...extra]).slice(0, 12);
  }, [q]);
  const go = (k: number) => { const r = results[k]; if (r) { r.run(); dialog.value = null; } };
  return (
    <Modal title="Search">
      <input ref={input} class="search-input" placeholder="A planet, moon, spacecraft or headline…" value={q}
        onInput={e => { setQ((e.target as HTMLInputElement).value); setI(0); }}
        onKeyDown={e => { if (e.key === "ArrowDown") { e.preventDefault(); setI(Math.min(results.length - 1, i + 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setI(Math.max(0, i - 1)); } else if (e.key === "Enter") go(i); else if (e.key === "Escape") dialog.value = null; }} />
      <ul class="results">
        {results.map((r, k) => <li key={k} class={k === i ? "on" : ""} onMouseEnter={() => setI(k)} onClick={() => go(k)}><span class="r-kind">{r.kind}</span><b>{r.label}</b><span class="muted">{r.sub}</span></li>)}
        {results.length === 0 && <li class="muted">No matches</li>}
      </ul>
    </Modal>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="toggle">
      <span><b>{label}</b>{hint && <span class="muted">{hint}</span>}</span>
      <input type="checkbox" checked={value} onChange={e => onChange((e.target as HTMLInputElement).checked)} />
    </label>
  );
}

export function Settings() {
  tick.value;
  const c = ctl(), s = c.settings;
  return (
    <Modal title="Settings">
      <div class="settings">
        <Toggle label="True-scale distances" hint="Real proportions. The outer planets get very far apart." value={s.scale === "true"} onChange={v => c.setSetting("scale", v ? "true" : "compressed")} />
        <Toggle label="Labels" hint="Names, owners and fleet tags (L)" value={s.labels} onChange={v => c.setSetting("labels", v)} />
        <Toggle label="Orbits" hint="Orbit lines and trails (O)" value={s.orbits} onChange={v => c.setSetting("orbits", v)} />
        <Toggle label="Wars" hint="Turn off for a peaceful future" value={s.wars} onChange={v => c.setSetting("wars", v)} />
        <Toggle label="Slow down for big events" hint="Drop to 1 month/s when a war or disaster starts" value={s.slowOnEvents} onChange={v => c.setSetting("slowOnEvents", v)} />
        <Toggle label="Follow big events" hint="Fly the camera to major stories" value={s.followEvents} onChange={v => c.setSetting("followEvents", v)} />
        <Toggle label="Sound" value={s.sound} onChange={v => c.setSetting("sound", v)} />
        <div class="setting-row">
          <span><b>Graphics quality</b><span class="muted">Lower it if things feel slow ({Math.round(c.engine.fps)} fps now)</span></span>
          <div class="seg">{(["low", "medium", "high"] as Quality[]).map(q => <button key={q} class={s.quality === q ? "on" : ""} onClick={() => c.setSetting("quality", q)}>{q}</button>)}</div>
        </div>
        <div class="row">
          <button class="btn" onClick={() => c.shareLink()}><Icon name="link" size={16} /> Copy link to this view</button>
          <button class="btn" onClick={() => c.screenshot()}><Icon name="camera" size={16} /> Screenshot</button>
          <button class="btn danger" onClick={() => { if (confirm("Start over? Your saved game will be erased.")) c.newGame(); }}>New game</button>
        </div>
      </div>
    </Modal>
  );
}
