// Conversions from real sizes to scene units. Distances are compressed by default so every planet fits on screen.
export type ScaleMode = "compressed" | "true";

export const SUN_RADIUS = 3.2;

export function distScale(rAU: number, mode: ScaleMode) {
  return mode === "true" ? 14 * rAU : 40 * Math.sqrt(rAU);
}

/** Drawn radius for a body of the given real radius. Sizes are exaggerated (not to scale) so small worlds stay visible. */
export function bodyRadius(km: number) {
  return Math.max(0.03, 0.55 * Math.pow(km / 6371, 0.55));
}

/** Moon orbit radius in scene units, compressed but keeping the real order of the moons. */
export function moonOrbitRadius(parentRadius: number, aKm: number, parentKm: number) {
  return parentRadius * (1.6 + 0.85 * Math.sqrt(aKm / parentKm));
}
