import { useState } from "preact/hooks";
import { FACTIONS } from "../../data/timeline";
import { COLONY_SITES, GOALS, POWERS, RANKS, TERRAFORMABLE, type Power } from "../../sim/god";
import { ctl } from "../ctl";
import { Bar, FacDot, Icon, Section } from "../common";
import { tick } from "../store";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function FacSelect({ value, onChange, exclude }: { value: number; onChange: (v: number) => void; exclude?: number }) {
  const w = ctl().world;
  return (
    <select value={value} onChange={e => onChange(+(e.target as HTMLSelectElement).value)}>
      {FACTIONS.map(f => <option key={f.id} value={f.id} disabled={f.id === exclude || (w.year >= 2045 && !w.civ.coloniesOf(f.id).length)}>{f.name}</option>)}
    </select>
  );
}

function PowerCard({ p }: { p: Power }) {
  const c = ctl(), w = c.world, god = w.god;
  const [open, setOpen] = useState(false);
  const [a, setA] = useState<number | string>(p.target === "colonySite" ? COLONY_SITES.find(s => w.civ.canFound(s)) ?? "io" : p.target === "terraform" ? "mars" : p.target === "body" ? "moon" : 0);
  const [b, setB] = useState<number>(1);
  const why = god.availability(p, w.year);
  const locked = god.rank < p.rank;
  // For "war" targets, fall back to the first war if the chosen one has ended.
  const target = p.target === "war" ? (w.civ.wars.some(x => x.id === a) ? a : w.civ.wars[0]?.id) : a;
  const cast = () => { if (!c.usePower(p.id, target, b)) setOpen(false); };
  const needsTarget = p.target !== "none";
  return (
    <div class={`power ${locked ? "locked" : ""} ${why ? "unavail" : ""}`}>
      <button class="power-main" onClick={() => (needsTarget ? setOpen(!open) : cast())} disabled={!!why && !open} aria-expanded={open}>
        <span class="power-icon"><Icon name={locked ? "lock" : p.icon} size={20} /></span>
        <span class="power-text">
          <b>{p.name}</b>
          <span>{p.desc}</span>
          {why && <em>{why}</em>}
        </span>
        <span class="power-cost">✦ {god.costOf(p)}</span>
      </button>
      {open && !locked && (
        <div class="power-form">
          {p.target === "pair" && <><FacSelect value={a as number} onChange={setA} /><span>and</span><FacSelect value={b} onChange={setB} exclude={a as number} /></>}
          {p.target === "faction" && <FacSelect value={a as number} onChange={setA} />}
          {p.target === "war" && (
            w.civ.wars.length ? (
              <select value={target as number} onChange={e => setA(+(e.target as HTMLSelectElement).value)}>
                {w.civ.wars.map(x => <option key={x.id} value={x.id}>{FACTIONS[x.a].short} vs {FACTIONS[x.b].short}</option>)}
              </select>
            ) : <span class="muted">No wars right now.</span>
          )}
          {p.target === "colonySite" && <>
            <select value={a as string} onChange={e => setA((e.target as HTMLSelectElement).value)}>
              {COLONY_SITES.map(s => <option key={s} value={s} disabled={!w.civ.canFound(s)}>{cap(s)}{w.civ.canFound(s) ? "" : " (settled)"}</option>)}
            </select>
            <span>for</span><FacSelect value={b} onChange={setB} />
          </>}
          {p.target === "body" && (
            <select value={a as string} onChange={e => setA((e.target as HTMLSelectElement).value)}>
              {w.bodies.list.filter(b => b.kind !== "sun").map(b => <option key={b.id} value={b.id}>{b.name}{w.civ.colonies.some(col => col.active && col.body === b.id) ? " (settled)" : ""}</option>)}
            </select>
          )}
          {p.target === "terraform" && (
            <select value={a as string} onChange={e => setA((e.target as HTMLSelectElement).value)}>
              {TERRAFORMABLE.map(s => <option key={s} value={s} disabled={w.god.terraformLevel(s, w.year) > 0}>{cap(s)}</option>)}
            </select>
          )}
          <button class="btn primary" onClick={cast} disabled={!!why}>Use · ✦ {god.costOf(p)}</button>
        </div>
      )}
    </div>
  );
}

export function GodPanel() {
  tick.value;
  const w = ctl().world, god = w.god;
  const r = god.rank, next = RANKS[r + 1];
  const toNext = next ? (god.earned - RANKS[r].at) / (next.at - RANKS[r].at) : 1;
  return (
    <div class="panel-body">
      <div class="god-head">
        <div class="inf-big"><span>✦</span>{Math.floor(god.influence)}</div>
        <div class="rank">
          <div class="kicker">Rank {r + 1} of {RANKS.length}</div>
          <h2 class="title">{RANKS[r].name}</h2>
          <div class="muted">{RANKS[r].blurb}</div>
        </div>
      </div>
      <div class="rank-bar">
        <Bar value={toNext} color="linear-gradient(90deg,#d9a64a,#f3cf82)" />
        <span class="muted">{next ? `${Math.floor(god.earned)} / ${next.at} earned · next: ${next.name}` : "Highest rank reached"}</span>
      </div>
      <p class="hint">You earn Influence over time: more colonies and peaceful years earn faster, and goals pay bonuses. Spend it on powers below. Fast-forward to 2045 for colonies and 2060 for wars.</p>

      <Section title="Powers">
        <div class="powers">{POWERS.map(p => <PowerCard key={p.id} p={p} />)}</div>
      </Section>

      <Section title="Goals" aside={<span class="muted">{god.goals.size}/{GOALS.length}</span>}>
        <ul class="goals">
          {GOALS.map(g => (
            <li key={g.id} class={god.goals.has(g.id) ? "done" : ""}>
              <span class="check">{god.goals.has(g.id) && <Icon name="check" size={13} />}</span>
              <span><b>{g.name}</b><span>{g.desc}</span></span>
              <span class="reward">+{g.reward}</span>
            </li>
          ))}
        </ul>
      </Section>

      {(FACTIONS.some(f => w.civ.blessUntil[f.id] > w.year) || w.civ.stormUntil > w.year) && (
        <Section title="Blessings in effect">
          <div class="chips">
            {FACTIONS.filter(f => w.civ.blessUntil[f.id] > w.year).map(f => <span key={f.id} class="fac-chip"><FacDot fac={f.id} />{f.short} blessed until {Math.floor(w.civ.blessUntil[f.id])}</span>)}
            {w.civ.stormUntil > w.year && <span class="fac-chip"><Icon name="sun" size={13} /> Fleets grounded until {Math.floor(w.civ.stormUntil)}</span>}
          </div>
        </Section>
      )}
    </div>
  );
}
