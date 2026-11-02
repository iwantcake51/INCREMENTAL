import type { Mods } from '../core/mods';

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  hue: number;
  max: number;
  base: number;
  growth: number;
  desc: string;
  /** Shown as "now → next". */
  fx: (lvl: number) => string;
  apply: (m: Mods, lvl: number) => void;
}

export const SHOP: ShopItem[] = [
  {
    id: 'air', name: 'Air Tanks', icon: 'air-zigzag', hue: 190, max: 30, base: 15, growth: 1.45,
    desc: 'Bigger tanks, longer dives.',
    fx: (l) => `${25 + 5 * l}s of air`,
    apply: (m, l) => (m.maxAir += 5 * l),
  },
  {
    id: 'prop', name: 'Propeller', icon: 'boat-propeller', hue: 45, max: 25, base: 20, growth: 1.5,
    desc: 'A faster sub reaches deeper water and catches fish.',
    fx: (l) => `Speed +${7 * l}%`,
    apply: (m, l) => (m.speed *= 1 + 0.07 * l),
  },
  {
    id: 'hull', name: 'Hull Plating', icon: 'checked-shield', hue: 20, max: 10, base: 60, growth: 2,
    desc: 'Take more hits before the hull gives way.',
    fx: (l) => `${3 + l} hull`,
    apply: (m, l) => (m.maxHull += l),
  },
  {
    id: 'lamp', name: 'Lamp', icon: 'light-bulb', hue: 50, max: 20, base: 25, growth: 1.5,
    desc: 'See further in the dark, and spot danger sooner.',
    fx: (l) => `Light +${12 * l}%`,
    apply: (m, l) => (m.light *= 1 + 0.12 * l),
  },
  {
    id: 'magnet', name: 'Magnet Coil', icon: 'magnet', hue: 300, max: 25, base: 30, growth: 1.5,
    desc: 'Pulls plankton, bubbles and pearls toward you.',
    fx: (l) => `Reach ${40 + 15 * l}`,
    apply: (m, l) => (m.magnet += 15 * l),
  },
  {
    id: 'jars', name: 'Sample Jars', icon: 'erlenmeyer', hue: 160, max: 40, base: 40, growth: 1.6,
    desc: 'Better jars keep more of the glow. Plankton worth more.',
    fx: (l) => `Plankton ×${(1 + 0.3 * l).toFixed(1)}`,
    apply: (m, l) => (m.moteMult *= 1 + 0.3 * l),
  },
  {
    id: 'farm', name: 'Plankton Farm', icon: 'fishing-net', hue: 140, max: 60, base: 50, growth: 1.4,
    desc: 'Nets on the dock gather lumen while you dive, and while you are away.',
    fx: (l) => (l ? `Level ${l} farm` : 'No farm yet'),
    apply: (m, l) => (m.farmLevel += l),
  },
  {
    id: 'dash', name: 'Jet Pump', icon: 'rocket-thruster', hue: 25, max: 5, base: 250, growth: 3,
    desc: 'Unlocks the dash (Space). More levels shorten its cooldown.',
    fx: (l) => (l ? `Dash every ${(4 * 0.88 ** (l - 1)).toFixed(1)}s` : 'No dash'),
    apply: (m, l) => {
      if (l) {
        m.dash = true;
        m.dashCooldown *= 0.88 ** (l - 1);
      }
    },
  },
  {
    id: 'sonar', name: 'Sonar', icon: 'radar-sweep', hue: 200, max: 2, base: 1000, growth: 10,
    desc: 'Arrows at the edge of the screen point to fish and chests. Level 2 also shows air.',
    fx: (l) => (l === 0 ? 'Off' : l === 1 ? 'Fish and chests' : 'Fish, chests and air'),
    apply: (m, l) => (m.sonar = l),
  },
  {
    id: 'ballast', name: 'Ballast Weights', icon: 'anchor', hue: 220, max: 30, base: 500, growth: 1.8,
    desc: 'Skip the shallows: every dive starts deeper.',
    fx: (l) => `Start at ${25 * l} m`,
    apply: (m, l) => (m.startDepth += 25 * l),
  },
];

export const SHOP_MAP = new Map(SHOP.map((s) => [s.id, s]));

export function shopCost(item: ShopItem, lvl: number): number {
  return Math.ceil(item.base * item.growth ** lvl);
}
