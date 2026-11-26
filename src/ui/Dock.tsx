import { MOONS } from "../data/bodies";
import { CRAFT } from "../data/spacecraft";
import { ctl } from "./ctl";
import { DOCK } from "./controller";
import { FacDot, Globe, Icon } from "./common";
import { selected, tick } from "./store";

/** The planet selector: every major body one click away, with its moons and owner shown. */
export function Dock() {
  tick.value;
  const c = ctl(), w = c.world;
  const sel = selected.value;
  const craftSel = CRAFT.find(k => k.id === sel);
  const sys = craftSel ? (craftSel.body === "sun-l2" ? "earth" : w.bodies.systemOf(craftSel.body)) : w.bodies.systemOf(sel);
  const moons = MOONS.filter(m => m.parent === sys);
  const craft = CRAFT.filter(k => (k.body === sys || (sys === "earth" && k.body === "sun-l2")) && k.kind !== "landing" && c.engine.craft.get(k.id)?.active);
  const owner = (id: string) => w.civ.colonies.find(col => col.active && col.body === id && (id !== "earth" || w.year >= 2045))?.owner;
  return (
    <nav class="dock" aria-label="Planets">
      {(moons.length > 0 || craft.length > 0) && (
        <div class="moon-row">
          {moons.length > 0 && <span class="moon-row-label">Moons of {w.bodies.get(sys)!.name}</span>}
          {moons.map(m => (
            <button key={m.id} class={`moon-chip ${sel === m.id ? "on" : ""}`} onClick={() => c.select(m.id)}>
              <Globe id={m.id} color={m.color} size={16} />{m.name}{owner(m.id) !== undefined && <FacDot fac={owner(m.id)!} size={7} />}
            </button>
          ))}
          {craft.length > 0 && <span class="moon-row-label">{moons.length ? "Spacecraft" : `Spacecraft at ${w.bodies.get(sys)!.name}`}</span>}
          {craft.map(k => (
            <button key={k.id} class={`moon-chip craft ${sel === k.id ? "on" : ""}`} onClick={() => c.select(k.id)}>{k.name}</button>
          ))}
        </div>
      )}
      <div class="dock-row">
        <button class="dock-btn ctrl" onClick={() => c.step(-1)} aria-label="Previous (←)" data-tip="Previous (←)">‹</button>
        {DOCK.map(id => {
          const b = w.bodies.get(id)!;
          const on = sys === id;
          const o = owner(id);
          const besieged = w.civ.colonies.some(col => col.active && col.body === id && col.siege > 0);
          return (
            <button key={id} class={`dock-item ${on ? "on" : ""} ${besieged ? "alert" : ""}`} onClick={() => c.select(id)} aria-pressed={on}>
              <Globe id={id} color={b.color} size={id === "sun" ? 32 : id === "ceres" ? 18 : Math.round(18 + Math.min(14, b.radius * 7))} ring={id === "saturn"} glow={id === "sun"} />
              <span class="dock-name">{b.name}</span>
              {o !== undefined && <span class="dock-owner"><FacDot fac={o} size={7} /></span>}
            </button>
          );
        })}
        <button class="dock-btn ctrl" onClick={() => c.step(1)} aria-label="Next (→)" data-tip="Next (→)">›</button>
        <span class="dock-sep" />
        <button class="dock-btn" onClick={() => c.engine.zoom(0.5)} aria-label="Zoom in" data-tip="Zoom in (↑ or scroll)"><Icon name="plus" size={16} /></button>
        <button class="dock-btn" onClick={() => c.engine.zoom(2)} aria-label="Zoom out" data-tip="Zoom out (↓ or scroll)"><Icon name="minus" size={16} /></button>
        <button class="dock-btn" onClick={() => c.overview()} aria-label="Whole solar system" data-tip="Whole solar system (H)"><Icon name="home" size={16} /></button>
      </div>
    </nav>
  );
}
