import { useMemo, useState } from "preact/hooks";
import type { NewsCategory } from "../../data/history";
import { FACTIONS } from "../../data/timeline";
import { shortDateOf, yearOf } from "../../sim/time";
import { ctl } from "../ctl";
import { CAT, CatIcon } from "../common";
import { lastReadNews, tick } from "../store";

const FILTERS: { id: string; label: string; cats?: NewsCategory[]; real?: boolean }[] = [
  { id: "all", label: "All" },
  { id: "war", label: "Wars", cats: ["war"] },
  { id: "politics", label: "Peace & tension", cats: ["peace", "tension", "rivalry"] },
  { id: "progress", label: "Milestones", cats: ["milestone", "colony"] },
  { id: "science", label: "Science", cats: ["science"] },
  { id: "real", label: "Real history", real: true },
];

export function NewsPanel() {
  tick.value;
  const c = ctl(), w = c.world;
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const version = w.news.version;
  const items = useMemo(() => {
    const f = FILTERS.find(x => x.id === filter)!;
    const needle = q.trim().toLowerCase();
    return w.news.items.filter(n => (!f.cats || f.cats.includes(n.cat)) && (!f.real || n.real) && (!needle || (n.title + " " + n.body).toLowerCase().includes(needle)));
  }, [version, filter, q]);
  const groups = useMemo(() => {
    const g: { year: number; items: typeof items }[] = [];
    for (const n of items) { const y = Math.floor(yearOf(n.day)); if (!g.length || g[g.length - 1].year !== y) g.push({ year: y, items: [] }); g[g.length - 1].items.push(n); }
    return g;
  }, [items]);
  const readUpTo = lastReadNews.value;
  return (
    <div class="panel-body news">
      <div class="news-tools">
        <div class="chips" role="tablist">
          {FILTERS.map(f => <button key={f.id} class={`chip ${filter === f.id ? "on" : ""}`} onClick={() => setFilter(f.id)}>{f.label}</button>)}
        </div>
        <input class="news-search" type="search" placeholder="Search the news…" value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} />
      </div>
      {groups.length === 0 && <p class="hint">Nothing here yet. Press play or fast-forward and stories will appear as they happen.</p>}
      {groups.slice(0, 40).map(g => (
        <section key={g.year} class="news-year">
          <h4>{g.year}{g.year > 2026 && <span class="tag-proj">projected</span>}</h4>
          {g.items.map(n => (
            <article key={n.id} class={`story ${n.major ? "major" : ""} ${n.id > readUpTo ? "new" : ""}`} style={{ "--cc": CAT[n.cat].color } as any}>
              <div class="story-meta">
                <span class="cat"><CatIcon cat={n.cat} size={13} />{CAT[n.cat].label}</span>
                <span class="mono">{shortDateOf(n.day)}</span>
                {n.facs?.map(f => <i key={f} class="fac-dot" style={{ background: FACTIONS[f].color }} title={FACTIONS[f].name} />)}
              </div>
              <h5>{n.title}</h5>
              <p>{n.body}</p>
              {n.focus && <button class="link" onClick={() => c.select(n.focus!)}>Show me →</button>}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
