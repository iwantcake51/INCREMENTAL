import { IcosahedronGeometry, type BufferGeometry } from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/** An irregular, lumpy rock about 1 unit across. Different seeds give different shapes. */
export function rockGeometry(seed: number, detail = 1): BufferGeometry {
  const g = mergeVertices(new IcosahedronGeometry(1, detail).deleteAttribute("normal").deleteAttribute("uv"));
  const p = g.getAttribute("position");
  const h = (x: number, y: number, z: number) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.1) * 43758.5453; return s - Math.floor(s); };
  const stretch = [1 + h(1, 2, 3) * 0.6, 0.7 + h(4, 5, 6) * 0.4, 0.6 + h(7, 8, 9) * 0.5];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const bump = 0.75 + h(x * 2, y * 2, z * 2) * 0.35 + Math.sin(x * 3 + seed) * 0.08;
    p.setXYZ(i, x * bump * stretch[0], y * bump * stretch[1], z * bump * stretch[2]);
  }
  g.computeVertexNormals();
  return g;
}
