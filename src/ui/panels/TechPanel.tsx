import { ERAS } from "../../data/timeline";
import { ctl } from "../ctl";
import { Bar, Section } from "../common";
import { tick } from "../store";

export function TechPanel() {
  tick.value;
  const c = ctl(), w = c.world, y = w.year;
  const k = ERAS.reduce((acc, e, i) => (y >= e.y ? i : acc), -1);
  const era = ERAS[k], next = ERAS[k + 1];
  const from = era ? era.y : 1950;
  return (
    <div class="panel-body">
      <div class="era-card">
        <div class="kicker">Current era · {Math.floor(y)} {era && !era.real && <span class="tag-proj">projected</span>}</div>
        <h2 class="title">{era ? era.name : "Before spaceflight"}</h2>
        <p class="lead">{era ? era.d : "No human-made object has reached orbit yet. Press play or fast-forward to watch the space age begin."}</p>
        {era?.shows && <p class="shows"><b>In space now:</b> {era.shows}</p>}
        {era?.focus && <button class="btn small" onClick={() => c.select(era.focus!)}>Show me</button>}
      </div>
      {next && (
        <div class="next-card">
          <div class="row-between"><span>Next: <b>{next.name}</b> in {Math.max(0, next.y - y).toFixed(1)} years</span><span class="mono">{next.y}</span></div>
          <Bar value={(y - from) / (next.y - from)} color="linear-gradient(90deg,#d9a64a,#f3cf82)" />
          <div class="row"><button class="btn" onClick={() => c.nextMilestone()}>Jump there</button><button class="btn" onClick={() => c.setSpeed(3652.5)}>Fast-forward</button></div>
        </div>
      )}
      <Section title="Timeline" aside={<span class="muted">real until 2026, then projected</span>}>
        <ol class="era-list">
          {ERAS.map((e, i) => (
            <li key={e.y} class={`${i <= k ? "done" : ""} ${i === k ? "now" : ""}`}>
              <span class="yr">{e.y}</span>
              <span class="tick" />
              <span class="era-text">
                <b>{e.name}</b>{!e.real && <span class="tag-proj">projected</span>}{e.weapon && <span class="tag-war">{e.weapon}</span>}
                {e.shows && <span class="shows-small">{e.shows}</span>}
              </span>
              {e.focus && <button class="link" onClick={() => { if (y < e.y) c.jumpTo((e.y - 2000) * 365.25 + 1); c.select(e.focus!); }}>{y < e.y ? "Go" : "Show"}</button>}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
