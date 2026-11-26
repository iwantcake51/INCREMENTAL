// Real surface maps. Source: Solar System Scope (solarsystemscope.com/textures), CC BY 4.0,
// based on NASA mission imagery (Blue Marble, Messenger, Viking/MGS, Cassini, Juno, Voyager, LRO).
// Moons other than ours and Ceres have no real maps here, so they stay procedural.
import { LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture, type WebGLRenderer } from "three";
import earthDay from "../assets/textures/earth_day.webp";
import earthNight from "../assets/textures/earth_night.webp";
import earthClouds from "../assets/textures/earth_clouds.webp";
import earthOcean from "../assets/textures/earth_ocean.webp";
import mars from "../assets/textures/mars.webp";
import jupiter from "../assets/textures/jupiter.webp";
import saturn from "../assets/textures/saturn.webp";
import mercury from "../assets/textures/mercury.webp";
import venus from "../assets/textures/venus.webp";
import moon from "../assets/textures/moon.webp";
import uranus from "../assets/textures/uranus.webp";
import neptune from "../assets/textures/neptune.webp";
import earthHeight from "../assets/textures/earth_height.webp";
import moonHeight from "../assets/textures/moon_height.webp";
import marsHeight from "../assets/textures/mars_height.webp";
import mercuryHeight from "../assets/textures/mercury_height.webp";

export interface BodyMaps { map?: Texture; night?: Texture; clouds?: Texture; ocean?: Texture; height?: Texture }

// Elevation: Earth from NASA Blue Marble topography, the Moon from LRO's LOLA altimeter (NASA SVS CGI Moon Kit).
// Mars and Mercury relief is derived from their imagery, since their full elevation models are gigabytes.
const SOURCES: Record<string, { map: string; night?: string; clouds?: string; ocean?: string; height?: string }> = {
  earth: { map: earthDay, night: earthNight, clouds: earthClouds, ocean: earthOcean, height: earthHeight },
  mars: { map: mars, height: marsHeight }, jupiter: { map: jupiter }, saturn: { map: saturn }, mercury: { map: mercury, height: mercuryHeight },
  venus: { map: venus }, moon: { map: moon, height: moonHeight }, uranus: { map: uranus }, neptune: { map: neptune },
};
export const HEIGHT_SCALE: Record<string, number> = { earth: 0.006, moon: 0.014, mars: 0.006, mercury: 0.006 };

export const TEXTURE_CREDIT = "Planet maps: Solar System Scope (CC BY 4.0), from NASA imagery. Elevation: NASA Blue Marble topography and NASA/LRO LOLA.";

/** Load every map in the background; `onLoad` fires per body as its maps arrive. */
export function loadMaps(renderer: WebGLRenderer, onLoad: (id: string, maps: BodyMaps) => void, onDone?: () => void) {
  const loader = new TextureLoader();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  let pending = 0;
  const load = (url: string, color: boolean) => new Promise<Texture>((resolve, reject) => {
    pending++;
    loader.load(url, t => {
      t.colorSpace = color ? SRGBColorSpace : NoColorSpace;
      t.anisotropy = aniso;
      t.minFilter = LinearMipmapLinearFilter;
      t.wrapS = RepeatWrapping;
      resolve(t);
    }, undefined, reject);
  });
  const all = Object.entries(SOURCES).map(async ([id, src]) => {
    try {
      const [map, night, clouds, ocean, height] = await Promise.all([
        load(src.map, true),
        src.night ? load(src.night, true) : undefined,
        src.clouds ? load(src.clouds, false) : undefined,
        src.ocean ? load(src.ocean, false) : undefined,
        src.height ? load(src.height, false) : undefined,
      ]);
      onLoad(id, { map, night, clouds, ocean, height });
    } catch { /* keep the procedural look if a map fails */ }
  });
  void pending;
  Promise.all(all).then(() => onDone?.());
}
