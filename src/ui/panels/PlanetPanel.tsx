import { useEffect, useRef } from "preact/hooks";
import { BAR_NAMES, CERES, MOONS, PLANETS, SUN } from "../../data/bodies";
import { FACTIONS } from "../../data/timeline";
import { distanceAU } from "../../sim/orbits";
import { ctl } from "../ctl";
import { Bar, FacChip, Globe, Section } from "../common";
import { selected, tick } from "../store";
import { drawVignette } from "../vignette";
import { toF } from "../units";

const LIGHT_MIN_PER_AU = 8.3167;
const fmtLight = (au: number) => { const m = au * LIGHT_MIN_PER_AU; return m < 60 ? `${m.toFixed(1)} min` : `${(m / 60).toFixed(2)} h`; };

function Vignette({ kind }: { kind: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loop = (t: number) => { if (ref.current) drawVignette(ref.current, kind, reduced ? 0 : t / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [kind]);
  return <canvas class="vignette" ref={ref} aria-label="Animated scene of life on this world" />;
}

export function PlanetPanel() {
  tick.value;
  const c = ctl(), w = c.world;
  const id = selected.value;
  const b = w.bodies.get(id);
  if (!b) {
    const name = id === "ark" ? "Generation ship" : id === "voyager1" ? "Voyager 1" : "Voyager 2";
    return (
      <div class="panel-body">
        <h2 class="title">{name}</h2>
        <p class="lead">{id === "ark" ? "Projected: a fusion-driven generation ship carrying thousands of settlers to Alpha Centauri, 4.4 light-years away." : "A real spacecraft launched in 1977 and still sending data. Its path here follows its actual flybys."}</p>
        <button class="btn" onClick={() => c.engine.focus(id)}>Fly to it</button>
      </div>
    );
  }
  const planet = PLANETS.find(p => p.id === id);
  const moon = MOONS.find(m => m.id === id);
  const year = w.year;
  const colony = w.civ.colonies.find(col => col.active && col.body === id && (id !== "earth" || year >= 2045));
  const tf = w.god.terraformLevel(id, year);
  const earth = PLANETS[2].orbit;
  const facts: [string, string][] = planet?.facts ?? (id === "sun" ? SUN.facts : []);
  const trivia = planet?.trivia ?? (id === "sun" ? SUN.trivia : []);
  const blurb = moon?.blurb ?? (id === "ceres" ? CERES.blurb : null);
  const kindText = b.kind === "planet" ? "Planet" : b.kind === "moon" ? `Moon of ${w.bodies.get(b.parent!)!.name}` : b.kind === "dwarf" ? "Dwarf planet" : "Star";
  return (
    <div class="panel-body">
      <div class="planet-head">
        <Globe color={b.color} size={52} ring={id === "saturn"} glow={id === "sun"} />
        <div>
          <div class="kicker">{kindText}</div>
          <h2 class="title">{b.name}</h2>
        </div>
        <button class="btn small" onClick={() => c.engine.focus(id)} data-tip="Fly to it (F)">Fly to</button>
      </div>

      {planet && (
        <div class="live-stats">
          <div><span>From Sun</span><b>{planet.orbit.a.toFixed(2)} AU</b></div>
          <div><span>From Earth</span><b>{id === "earth" ? "home" : `${distanceAU(earth, planet.orbit, w.day).toFixed(2)} AU`}</b></div>
          <div><span>Sunlight takes</span><b>{fmtLight(planet.orbit.a)}</b></div>
          <div><span>Radio to Earth</span><b>{id === "earth" ? "—" : fmtLight(distanceAU(earth, planet.orbit, w.day))}</b></div>
        </div>
      )}
      {blurb && <p class="lead">{blurb}</p>}

      {(colony || tf > 0) && (
        <Section title="Civilization" aside={<span class="tag-proj">projected</span>}>
          {colony && (
            <div class="colony-card" style={{ "--fc": FACTIONS[colony.owner].color } as any}>
              <div><b>{colony.name}</b> · held by <FacChip fac={colony.owner} /></div>
              {colony.owner !== colony.fac && <div class="muted">Founded by the {FACTIONS[colony.fac].name}. Occupied colonies may rise up.</div>}
              {colony.siege > 0 && <div class="alert-line">⚔ Under attack by the {FACTIONS[colony.besiegedBy]?.name}<Bar value={colony.siege} color="#ff5a3c" /></div>}
            </div>
          )}
          {tf > 0 && <div class="tf"><span>Terraforming</span><Bar value={tf} color="linear-gradient(90deg,#c8643c,#3d7a3a,#1b5f9e)" /><b>{Math.round(tf * 100)}%</b></div>}
        </Section>
      )}

      {facts.length > 0 && (
        <Section title="Facts" aside={<span class="src">NASA fact sheets</span>}>
          <dl class="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{toF(v)}</dd></div>)}</dl>
          <ul class="trivia">{trivia.map(t => <li key={t}>{toF(t)}</li>)}</ul>
        </Section>
      )}

      {planet && (
        <Section title={`Life on ${planet.name}`}>
          <Vignette kind={planet.life.kind} />
          <div class="life-head"><span class={`pill ${planet.life.status}`}>{planet.life.statusText}</span><span class="mono">{planet.life.count}</span></div>
          <p class="lead">{toF(planet.life.text)}</p>
          <div class="hab">
            {BAR_NAMES.map((n, k) => <div key={n} class="hab-row"><span>{n}</span><Bar value={planet.life.bars[k] / 100} color="linear-gradient(90deg,#d9a64a,#7fe0a0)" /></div>)}
            <div class="src">Best local habitat: {planet.life.where}</div>
          </div>
        </Section>
      )}
    </div>
  );
}
