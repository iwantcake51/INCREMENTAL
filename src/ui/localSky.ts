// What you'd see in the sky from the surface of a world: where the Sun and the other bodies are, and their phases.
// Uses the simulation's real geometry (the world's spin, the Sun's direction and the moons' positions).
import { Vector3 } from "three";
import type { Body } from "../sim/bodies";
import type { World } from "../sim/world";

export interface SkyObject { id: string; alt: number; az: number; /** 0–2π: 0 new, π full; under π the lit side faces right (west). */ elong: number; /** angular radius, degrees */ size: number }
export interface LocalSky { sunAlt: number; sunAz: number; hour: number; objects: SkyObject[] }

const RAD = 180 / Math.PI;
const z = new Vector3(), east = new Vector3(), south = new Vector3(), d = new Vector3(), sunDir = new Vector3();

/** Sky seen by an observer on the equator of `from` (at its prime meridian), facing south. */
export function localSky(world: World, from: string, targets: string[]): LocalSky | null {
  const B = world.bodies;
  const b = B.get(from);
  if (!b || !b.quat) return null;
  z.set(1, 0, 0).applyQuaternion(b.quat).normalize();            // zenith (local +X turns with the world)
  east.crossVectors(b.axis, z).normalize();
  south.copy(b.axis).negate();
  const altAz = (dir: Vector3) => {
    const alt = Math.asin(Math.max(-1, Math.min(1, dir.dot(z)))) * RAD;
    const az = Math.atan2(-dir.dot(east), dir.dot(south) + 1e-9) * RAD;   // from south, positive toward west
    return { alt, az };
  };
  sunDir.copy(b.pos).negate().normalize();
  const sun = altAz(sunDir);
  // local solar time: noon when the sun is highest
  const hourAngle = Math.atan2(sunDir.dot(east), sunDir.dot(z)) * RAD; // sun east of the zenith = morning
  const hour = (12 - hourAngle / 15 + 48) % 24;
  const objects: SkyObject[] = [];
  for (const id of targets) {
    const t: Body | undefined = B.get(id);
    if (!t || t === b) continue;
    d.subVectors(t.pos, b.pos);
    const dist = d.length();
    d.normalize();
    const p = altAz(d);
    const e = Math.acos(Math.max(-1, Math.min(1, sunDir.dot(d))));
    // e is the Sun–observer–object angle: 0 when the object is next to the Sun (new), π opposite (full)
    const signed = sun.az > p.az ? e : Math.PI * 2 - e;
    objects.push({ id, alt: p.alt, az: p.az, elong: signed, size: Math.atan(t.radius / dist) * RAD });
  }
  return { sunAlt: sun.alt, sunAz: sun.az, hour, objects };
}
