/**
 * Hoogtegegevens over een gebied.
 *
 * Levert zowel het hoogteprofiel van de dag als de basis voor het schaduwrelief
 * van de kaart. Bron zijn open hoogtetegels die IJsland wel dekken - de bekendere
 * SRTM-data stopt bij 60 graden noorderbreedte en houdt dus op net onder IJsland.
 */

import sharp from 'sharp'
import { cached, fetchWithRetry } from './cache.js'
import { DemGrid, decodeTerrarium } from '../geo/dem.js'
import { TILE_SIZE, tilesForBounds, zoomForResolution } from '../geo/tiles.js'
import { mapLimit } from './parallel.js'

const BRON = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'

/**
 * Boven dit aantal tegels waarschuwen we voordat we gaan downloaden. Elke tegel
 * is ongeveer 70 kB, dus dit is grofweg een halve gigabyte aan verkeer.
 */
const VEEL_TEGELS = 1500

async function fetchTile ({ x, y, z }) {
  return cached('dem', ['terrarium', z, x, y], async () => {
    const antwoord = await fetchWithRetry(`${BRON}/${z}/${x}/${y}.png`)
    return Buffer.from(await antwoord.arrayBuffer())
  }, { extensie: 'png' })
}

/**
 * Haalt een aaneengesloten lap hoogtegegevens op over dit gebied, fijn genoeg
 * voor de gevraagde scherpte.
 */
export async function fetchDem (bounds, { metersPerPixel = 60, maxZoom = 12, onProgress } = {}) {
  const middenLat = (bounds.north + bounds.south) / 2
  const z = zoomForResolution(metersPerPixel, middenLat, { maxZoom })
  const tegels = tilesForBounds(bounds, z)

  if (tegels.length > VEEL_TEGELS) {
    onProgress?.(
      `let op: ${tegels.length} hoogtetegels nodig (~${Math.round(tegels.length * 0.07)} MB). ` +
      'Zet het detailniveau van het reliëf lager als dit te lang duurt'
    )
  }

  const xs = tegels.map(t => t.x)
  const ys = tegels.map(t => t.y)
  const originTileX = Math.min(...xs)
  const originTileY = Math.min(...ys)
  const tegelsBreed = Math.max(...xs) - originTileX + 1
  const tegelsHoog = Math.max(...ys) - originTileY + 1

  const width = tegelsBreed * TILE_SIZE
  const height = tegelsHoog * TILE_SIZE
  const data = new Float32Array(width * height)

  let klaar = 0
  await mapLimit(tegels, 6, async tegel => {
    const png = await fetchTile(tegel)
    const { data: rgb, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })

    const offsetX = (tegel.x - originTileX) * TILE_SIZE
    const offsetY = (tegel.y - originTileY) * TILE_SIZE

    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels
        data[(offsetY + y) * width + offsetX + x] = decodeTerrarium(rgb[i], rgb[i + 1], rgb[i + 2])
      }
    }

    onProgress?.(++klaar, tegels.length)
  })

  return new DemGrid({ data, width, height, z, originTileX, originTileY })
}
