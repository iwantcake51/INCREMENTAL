import { ERAS } from "../data/timeline";
import { RANKS } from "../sim/god";
import { dayFromISO, isoOf, longDateOf, SPEEDS } from "../sim/time";
import type { JSX } from "preact";
import { ctl } from "./ctl";
import { Icon, IconButton } from "./common";
import { dialog, panelOpen, tab, tick } from "./store";

export function TopBar() {
  tick.value;
  const c = ctl(), w = c.world;
  const y = w.year;
  const eraIdx = ERAS.reduce((k, e, i) => (y >= e.y ? i : k), -1);
  const era = ERAS[eraIdx];
  const god = w.god;
  return (
    <header class="topbar">
      <div class="brand">
        <div class="date" title="Current simulated date">{longDateOf(w.day)}</div>
        <div class="era">
          <span class={`era-chip ${era && !era.real ? "proj" : ""}`}>{era ? era.name : "Before spaceflight"}</span>
          {era && !era.real && <span class="tag-proj" title="Everything after 2026 is a made-up future">projected</span>}
          {!c.engine.mapsReady && <span class="loading"><i />Loading planet maps</span>}
        </div>
      </div>

      <div class="top-right">
        <button class="influence" onClick={() => { tab.value = "god"; panelOpen.value = true; }} data-tip="God mode: spend Influence on powers (G)">
          <span class="inf-icon">✦</span>
          <span class="inf-num">{Math.floor(god.influence)}</span>
          <span class="inf-rank">{RANKS[god.rank].name}</span>
        </button>
        <IconButton icon="search" label="Search" kbd="/" onClick={() => (dialog.value = "search")} />
        <IconButton icon="gear" label="Settings" onClick={() => (dialog.value = "settings")} />
        <IconButton icon="help" label="Help & shortcuts" kbd="?" onClick={() => (dialog.value = "help")} />
        <IconButton icon="panel" label={panelOpen.value ? "Hide panel" : "Show panel"} kbd="Tab" active={panelOpen.value} onClick={() => (panelOpen.value = !panelOpen.value)} />
      </div>
    </header>
  );
}

/** Play/pause, speed, date and milestone controls, shown next to the timeline. */
export function Transport(): JSX.Element {
  tick.value;
  const c = ctl(), w = c.world;
  const y = w.year;
  const next = ERAS.find(e => e.y > y + 1e-3);
  return (
    <div class="transport" role="group" aria-label="Time controls">
        <button class="play" onClick={() => c.togglePlay()} aria-label={w.playing ? "Pause (Space)" : "Play (Space)"} data-tip={w.playing ? "Pause (Space)" : "Play (Space)"}>
          <Icon name={w.playing ? "pause" : "play"} size={20} />
        </button>
        <div class="speeds">
          {SPEEDS.map((s, i) => (
            <button key={s.label} class={Math.abs(w.speed - s.value) < 1e-6 ? "on" : ""} onClick={() => c.setSpeed(s.value)} data-tip={`Key ${i + 1}`}>{s.label}</button>
          ))}
        </div>
        <label class="date-pick" data-tip="Jump to a date">
          <input type="date" min="1950-01-01" max="2600-12-31" value={isoOf(w.day)}
            onChange={e => { const d = dayFromISO((e.target as HTMLInputElement).value); if (!Number.isNaN(d)) c.jumpTo(d); }} />
        </label>
        <IconButton icon="today" label="Today" kbd="T" onClick={() => c.today()} />
        <button class="next-btn" disabled={!next} onClick={() => c.nextMilestone()} data-tip="Jump to the next milestone (N)">
          <Icon name="next" size={16} />{next ? <span>{next.name} · {next.y}</span> : <span>All milestones reached</span>}
        </button>
      </div>

  );
}
