/**
 * Het inzetkaartje: heel IJsland in het klein, met een kadertje dat aangeeft
 * waar je op de grote kaart naar kijkt.
 *
 * De omtrek van het eiland komt uit hetzelfde hoogtemodel als het relief: alles
 * onder zeeniveau is zee, de rest is land. Geen aparte kaartbron nodig, en de
 * kustlijn sluit dus per definitie aan op die van de grote kaart.
 */

import sharp from 'sharp'
import { fetchDem } from '../fetch/elevation.js'
import { hexNaarRgb } from './colorize.js'
import { tileToLonLat, TILE_SIZE } from '../geo/tiles.js'

/** Ruim om het hele eiland heen, inclusief de Westfjorden en de oostkust. */
export const IJSLAND = { west: -24.65, east: -13.35, south: 63.3, north: 66.62 }

/** Onthoudt het silhouet per kleur, zodat het maar een keer gemaakt wordt. */
const cache = new Map()

/**
 * Silhouet van IJsland als PNG met doorzichtige zee, plus waar het op de kaart
 * hoort te staan.
 */
export async function ijslandSilhouet ({ landKleur, onProgress }) {
  if (cache.has(landKleur)) return cache.get(landKleur)

  const belofte = (async () => {
    // ruim genoeg voor een inzetkaartje van een paar centimeter op 600 dpi
    const dem = await fetchDem(IJSLAND, { metersPerPixel: 380, maxZoom: 9, onProgress })

    const [lr, lg, lb] = hexNaarRgb(landKleur)
    const rgba = Buffer.alloc(dem.width * dem.height * 4)

    for (let i = 0; i < dem.data.length; i++) {
      if (dem.data[i] >= 0) {
        rgba[i * 4] = lr
        rgba[i * 4 + 1] = lg
        rgba[i * 4 + 2] = lb
        rgba[i * 4 + 3] = 255
      }
      // zee blijft doorzichtig, zodat de achtergrond van het kaartje doorschijnt
    }

    const png = await sharp(rgba, { raw: { width: dem.width, height: dem.height, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toBuffer()

    // het gebied dat dit plaatje precies beslaat
    const linksboven = tileToLonLat(dem.originPx / TILE_SIZE, dem.originPy / TILE_SIZE, dem.z)
    const rechtsonder = tileToLonLat(
      (dem.originPx + dem.width) / TILE_SIZE,
      (dem.originPy + dem.height) / TILE_SIZE,
      dem.z
    )

    return {
      png,
      bounds: {
        west: linksboven.lon,
        north: linksboven.lat,
        east: rechtsonder.lon,
        south: rechtsonder.lat
      },
      breedte: dem.width,
      hoogte: dem.height
    }
  })()

  cache.set(landKleur, belofte)
  return belofte
}
