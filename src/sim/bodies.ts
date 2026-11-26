import { Vector3 } from "three";
import { CERES, MOONS, PLANETS, SUN, type Look, type MoonDef, type PlanetDef } from "../data/bodies";
import { eclipticDir, eclipticToScene, heliocentric, type V3 } from "./orbits";
import { bodyRadius, moonOrbitRadius, SUN_RADIUS, type ScaleMode } from "./scale";

export type BodyKind = "sun" | "planet" | "moon" | "dwarf";

// Direction each planet's north pole leans toward (ecliptic longitude, degrees), so seasons line up with reality.
const POLE_LON: Record<string, number> = { mercury: 280, venus: 301, earth: 90, mars: 353, jupiter: 248, saturn: 79.5, uranus: 257, neptune: 319 };

export interface Body {
  id: string;
  name: string;
  kind: BodyKind;
  color: string;
  radius: number;
  radiusKm: number;
  parent?: string;
  /** Scene-space position, updated every frame. */
  pos: Vector3;
  /** Spin axis (unit), and two vectors spanning the equatorial plane. */
  axis: Vector3;
  eqU: Vector3;
  eqV: Vector3;
  /** Current spin angle about the axis, radians. */
  spin: number;
  look?: Look;
  planet?: PlanetDef;
  moon?: MoonDef;
  /** Moons: orbit radius (scene) and current orbital angle. */
  orbitR: number;
  angle: number;
}

const tmp: V3 = { x: 0, y: 0, z: 0 };

function makeAxis(tiltDeg: number, poleLon: number) {
  const axis = new Vector3();
  eclipticDir(poleLon, 90 - tiltDeg, axis);
  axis.normalize();
  const ref = Math.abs(axis.y) > 0.95 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const eqU = new Vector3().crossVectors(ref, axis).normalize();
  const eqV = new Vector3().crossVectors(axis, eqU).normalize();
  return { axis, eqU, eqV };
}

export class Bodies {
  readonly list: Body[] = [];
  readonly map = new Map<string, Body>();
  readonly planets: Body[] = [];
  readonly moons: Body[] = [];

  constructor() {
    const up = makeAxis(7.25, 286);
    this.add({ id: SUN.id, name: SUN.name, kind: "sun", color: SUN.color, radius: SUN_RADIUS, radiusKm: SUN.radiusKm,
      pos: new Vector3(), ...up, spin: 0, orbitR: 0, angle: 0 });
    for (const p of PLANETS) {
      const b = this.add({ id: p.id, name: p.name, kind: "planet", color: p.color, radius: bodyRadius(p.radiusKm), radiusKm: p.radiusKm,
        pos: new Vector3(), ...makeAxis(p.tilt, POLE_LON[p.id] ?? 90), spin: 0, look: p.look, planet: p, orbitR: 0, angle: 0 });
      this.planets.push(b);
    }
    let seed = 0.37;
    for (const m of MOONS) {
      const parent = this.map.get(m.parent)!;
      const b = this.add({ id: m.id, name: m.name, kind: "moon", color: m.color, radius: bodyRadius(m.radiusKm), radiusKm: m.radiusKm,
        parent: m.parent, pos: new Vector3(), axis: parent.axis, eqU: parent.eqU, eqV: parent.eqV, spin: 0, look: m.look, moon: m,
        orbitR: moonOrbitRadius(parent.radius, m.aKm, parent.radiusKm), angle: (seed = (seed * 7.13) % 1) * Math.PI * 2 });
      this.moons.push(b);
    }
    this.add({ id: CERES.id, name: CERES.name, kind: "dwarf", color: CERES.color, radius: bodyRadius(CERES.radiusKm), radiusKm: CERES.radiusKm,
      pos: new Vector3(), ...makeAxis(4, 0), spin: 0, look: CERES.look, orbitR: 0, angle: 0 });
  }

  private add(b: Body) { this.list.push(b); this.map.set(b.id, b); return b; }

  get(id: string) { return this.map.get(id); }

  /**
   * Place every body for the given date. `dtReal` and `daysPerSec` drive spin and moon motion, which are
   * capped so they stay readable at high speed instead of strobing.
   */
  update(day: number, dtReal: number, daysPerSec: number, mode: ScaleMode) {
    const sun = this.list[0];
    sun.spin += dtReal * Math.min(daysPerSec / 25.4, 0.05) * Math.PI * 2;
    for (const b of this.planets) {
      eclipticToScene(heliocentric(b.planet!.orbit, day, tmp), mode, b.pos);
      if (b.id === "earth" && daysPerSec <= 1.5) {
        // Real orientation: Greenwich sidereal time, so day and night fall on the right continents.
        b.spin = ((280.46061837 + 360.98564736629 * day) % 360) * Math.PI / 180;
        continue;
      }
      const revPerSec = Math.min(Math.abs(daysPerSec * 24 / b.planet!.rotHours), 0.2) * Math.sign(b.planet!.rotHours);
      b.spin += revPerSec * dtReal * Math.PI * 2;
    }
    for (const b of this.moons) {
      const parent = this.map.get(b.parent!)!;
      const per = b.moon!.period;
      b.angle += Math.sign(per) * Math.min(daysPerSec / Math.abs(per), 0.5) * dtReal * Math.PI * 2;
      const c = Math.cos(b.angle), s = Math.sin(b.angle);
      b.pos.copy(parent.pos).addScaledVector(parent.eqU, c * b.orbitR).addScaledVector(parent.eqV, s * b.orbitR);
      b.spin = b.angle; // tidally locked: always shows the same face to its planet
    }
    const ceres = this.map.get("ceres")!;
    eclipticToScene(heliocentric(CERES.orbit, day, tmp), mode, ceres.pos);
    ceres.spin += dtReal * Math.min(daysPerSec / 0.378, 0.2) * Math.PI * 2;
  }

  /** The planet a body belongs to (itself for planets). */
  systemOf(id: string): string {
    const b = this.map.get(id);
    return b?.parent ?? id;
  }
}
