import { FACTIONS, WAR_START_YEAR } from "../../data/timeline";
import { CAUSE_INFO, weaponAt, type Cause } from "../../sim/civ";
import { shortDateOf, yearOf } from "../../sim/time";
import { ctl } from "../ctl";
import { Bar, CAT, FacDot, Section } from "../common";
import { tick } from "../store";

const tensionColor = (t: number) => (t >= 100 ? "#ff5a3c" : t >= 70 ? "#ff8f4a" : t >= 40 ? "#f3cf82" : "#7fe0a0");

export function WarPanel() {
  tick.value;
  const c = ctl(), w = c.world, civ = w.civ;
  const year = w.year;
  const weapon = weaponAt(year);
  const pairs: { i: number; j: number; t: number; cause: Cause; truce: number }[] = [];
  for (let i = 0; i < FACTIONS.length; i++) for (let j = i + 1; j < FACTIONS.length; j++) {
    if (!civ.coloniesOf(i).length || !civ.coloniesOf(j).length || civ.atWar(i, j)) continue;
    let cause: Cause = "incident", best = -1;
    for (const k of Object.keys(civ.contrib[i][j]) as Cause[]) if (civ.contrib[i][j][k] > best) { best = civ.contrib[i][j][k]; cause = k; }
    pairs.push({ i, j, t: civ.tension[i][j], cause, truce: civ.truce[i][j] });
  }
  pairs.sort((a, b) => b.t - a.t);
  const rivalry = w.news.items.filter(n => n.cat === "rivalry").slice(0, 5);
  const active = FACTIONS.filter(f => civ.coloniesOf(f.id).length > 0);

  return (
    <div class="panel-body">
      <div class="explain">
        <b>How wars start.</b> Each pair of powers has a <em>tension</em> score. It rises from the things that start real wars:
        rival claims next door, scarce resources, lost colonies, fear of a rising power, arms races and border incidents.
        Trade and time calm it. At <b>100</b> one side declares war, but only once warships exist ({WAR_START_YEAR}).
        <span class="tag-proj">fiction</span>
      </div>

      <div class="status-row">
        <span>Weapons: <b>{weapon ? weapon.name : `none until ${WAR_START_YEAR}`}</b></span>
        <span>{civ.wars.length ? <b class="red">{civ.wars.length} war{civ.wars.length > 1 ? "s" : ""}</b> : "At peace"}</span>
        {!w.settings.wars && <span class="muted">Wars are off (Settings)</span>}
        {civ.stormUntil > year && <span>Fleets grounded by a solar storm until {Math.floor(civ.stormUntil)}</span>}
      </div>

      {year < 2045 && (
        <Section title="Real rivalry in space so far">
          <p class="hint">No space powers exist yet beyond Earth. These are real military moments in space, the backdrop for the projected future. Fast-forward to 2045 to see colonies, and 2060 for the first warships.</p>
          <ul class="mini-news">{rivalry.map(n => <li key={n.id}><span class="mono">{shortDateOf(n.day)}</span><b>{n.title}</b><span>{n.body}</span></li>)}</ul>
        </Section>
      )}

      {civ.wars.length > 0 && (
        <Section title="Wars now">
          {civ.wars.map(war => {
            const A = FACTIONS[war.a], B = FACTIONS[war.b];
            const ca = civ.coloniesOf(war.a).length, cb = civ.coloniesOf(war.b).length;
            const fleets = civ.fleets.filter(f => f.warId === war.id);
            const fight = fleets.find(f => f.state !== "transit") ?? fleets[0];
            return (
              <div class="war-card" key={war.id}>
                <div class="war-title">
                  <span><FacDot fac={war.a} /> {A.short}</span><span class="vs">vs</span><span><FacDot fac={war.b} /> {B.short}</span>
                  <span class="muted since">since {Math.floor(yearOf(war.startDay))}</span>
                </div>
                <div class="war-why"><span class="cause-chip">{CAUSE_INFO[war.cause].label}</span> Over {war.reason}.</div>
                <div class="war-real">Real-world parallel: {CAUSE_INFO[war.cause].parallel}</div>
                <div class="score">
                  <div class="score-bar">
                    <span style={{ flex: Math.max(ca, 0.3), background: A.color }}>{ca}</span>
                    <span style={{ flex: Math.max(cb, 0.3), background: B.color }}>{cb}</span>
                  </div>
                  <div class="score-legend"><span>Colonies held</span><span>{war.battles} battle{war.battles === 1 ? "" : "s"} · captured {war.captures[0]}–{war.captures[1]}</span></div>
                </div>
                <div class="weary"><span>War weariness</span><Bar value={war.weariness / war.limit} color="linear-gradient(90deg,#f3cf82,#7fe0a0)" /><span class="muted">{war.weariness / war.limit > 0.75 ? "peace likely soon" : "fighting on"}</span></div>
                {fleets.length > 0 && <ul class="fleets">{fleets.map(f => <li key={f.id}><FacDot fac={f.fac} />{FACTIONS[f.fac].short} · {f.ships} ship{f.ships === 1 ? "" : "s"} · {f.status}</li>)}</ul>}
                <div class="row">
                  {fight && <button class="btn small" onClick={() => c.select(civ.colony(fight.target).body)}>Watch the fighting</button>}
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {year >= 2045 && (
        <Section title="Powers">
          <div class="powers-grid">
            {active.map(f => {
              const cols = civ.coloniesOf(f.id);
              const enemies = civ.wars.filter(x => x.a === f.id || x.b === f.id).map(x => (x.a === f.id ? x.b : x.a));
              return (
                <div class="power-row" key={f.id} style={{ "--fc": f.color } as any}>
                  <div class="pr-name"><FacDot fac={f.id} size={11} /><b>{f.name}</b>{civ.blessUntil[f.id] > year && <span class="blessed">blessed</span>}</div>
                  <div class="pr-cols">{cols.map(col => <button key={col.id} class="col-chip" onClick={() => c.select(col.body)}>{col.name}{col.siege > 0 ? " ⚔" : ""}</button>)}</div>
                  {enemies.length > 0 && <div class="pr-war">At war with {enemies.map(e => FACTIONS[e].short).join(", ")}</div>}
                </div>
              );
            })}
            {FACTIONS.filter(f => !civ.coloniesOf(f.id).length && year >= 2150).map(f => <div class="power-row gone" key={f.id}><FacDot fac={f.id} /> {f.name}: no colonies left</div>)}
          </div>
        </Section>
      )}

      {pairs.length > 0 && (
        <Section title="Tension between powers" aside={<span class="muted">war at 100</span>}>
          <ul class="tensions">
            {pairs.slice(0, 8).map(p => (
              <li key={`${p.i}-${p.j}`}>
                <div class="t-head">
                  <span><FacDot fac={p.i} /> {FACTIONS[p.i].short} · <FacDot fac={p.j} /> {FACTIONS[p.j].short}</span>
                  <b style={{ color: tensionColor(p.t) }}>{Math.round(p.t)}</b>
                </div>
                <Bar value={p.t / 120} color={tensionColor(p.t)} marker={100 / 120} />
                <div class="t-foot">
                  {p.truce > year ? <span>Truce until {Math.floor(p.truce)}</span> : <span>Main cause: <b>{CAUSE_INFO[p.cause].label}</b></span>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Reading the map">
        <ul class="legend">
          <li><span class="lg-dot" /> A colored dot by a name shows who holds it.</li>
          <li><span class="lg-bar" /> A red bar under a name means it is under attack. When it fills, the battle is decided.</li>
          <li><span class="lg-ship">▶</span> Warships fly in formation in their power's color, with a label saying where they're going.</li>
          <li><span class="lg-line" /> A faint line points from a fleet to its target.</li>
          <li><span class="lg-shot" /> Weapon fire: coilgun slugs, laser beams (2110), antimatter missiles (2200), lances (2300).</li>
        </ul>
      </Section>

      <Section title="Recent war news">
        <ul class="mini-news">
          {w.news.items.filter(n => n.cat === "war" || n.cat === "peace" || n.cat === "tension").slice(0, 8).map(n => (
            <li key={n.id} style={{ "--cc": CAT[n.cat].color } as any}><span class="mono">{Math.floor(yearOf(n.day))}</span><b>{n.title}</b><span>{n.body}</span></li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
