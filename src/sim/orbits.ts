import type { Elements } from "../data/bodies";
import { distScale, type ScaleMode } from "./scale";

const RAD = Math.PI / 180;
export interface V3 { x: number; y: number; z: number }

/** Heliocentric ecliptic position (AU) from Keplerian elements, solving Kepler's equation. */
export function heliocentric(el: Elements, day: number, out: V3): V3 {
  const e = el.e;
  const w = (el.peri - el.node) * RAD; // argument of perihelion
  const O = el.node * RAD, inc = el.i * RAD;
  let M = (el.L0 + (360 * day) / el.T - el.peri) * RAD;
  M = ((M % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  // Newton's method; very eccentric orbits (comets) start from E = π so it always converges.
  let E = e > 0.8 ? (M < 0 ? -Math.PI : Math.PI) * 0.999 : M + e * Math.sin(M);
  for (let k = 0; k < 40; k++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  const xp = el.a * (Math.cos(E) - e), yp = el.a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(inc), si = Math.sin(inc);
  out.x = (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp;
  out.y = (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp;
  out.z = sw * si * xp + cw * si * yp;
  return out;
}

/** Ecliptic AU → scene units. Ecliptic X→x, Y→−z, Z(north)→y, with the distance compressed radially. */
export function eclipticToScene(ecl: V3, mode: ScaleMode, out: V3): V3 {
  const r = Math.hypot(ecl.x, ecl.y, ecl.z) || 1e-9;
  const k = distScale(r, mode) / r;
  out.x = ecl.x * k; out.y = ecl.z * k; out.z = -ecl.y * k;
  return out;
}

/** Unit vector in scene space for an ecliptic longitude/latitude (degrees). */
export function eclipticDir(lonDeg: number, latDeg: number, out: V3): V3 {
  const l = lonDeg * RAD, b = latDeg * RAD;
  out.x = Math.cos(b) * Math.cos(l); out.y = Math.sin(b); out.z = -Math.cos(b) * Math.sin(l);
  return out;
}

export function distanceAU(a: Elements, b: Elements, day: number) {
  const p = heliocentric(a, day, { x: 0, y: 0, z: 0 }), q = heliocentric(b, day, { x: 0, y: 0, z: 0 });
  return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
}
