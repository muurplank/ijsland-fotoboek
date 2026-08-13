/**
 * Satellietbeeld als achtergrond.
 *
 * Nodig zodra een dag zo klein is dat het hoogtemodel geen detail meer heeft:
 * een dag rond het vliegveld beslaat een paar kilometer, en daar is een
 * hoogteraster van 30 meter per punt volstrekt te grof voor. Luchtfoto's gaan
 * op zulke plekken tot tientallen centimeters per pixel.
 *
 * Bron is Esri World Imagery, vrij te gebruiken voor niet-commercieel werk met
 * bronvermelding - die staat onderaan de kaart.
 */

import sharp from 'sharp'
import { cached, fetchWithRetry } from './cache.js'
import { mapLimit } from './parallel.js'
import { metersPerPixel, tilesForBounds, TILE_SIZE, zoomBinnenBudget, zoomForResolution } from '../geo/tiles.js'

const BRON = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile'

/** Fijnste niveau dat deze bron voor IJsland heeft. */
const MAX_ZOOM = 18

/** Hoogstens dit aantal tegels per kaart; daarboven gaat het zoomniveau omlaag. */
const TEGELBUDGET = 1200

async function fetchTile ({ x, y, z }) {
  return cached('satelliet', ['esri', z, x, y], async () => {
    // let op: deze bron zet de rij voor de kolom in het pad
    const antwoord = await fetchWithRetry(`${BRON}/${z}/${y}/${x}`)
    return Buffer.from(await antwoord.arrayBuffer())
  }, { extensie: 'jpg' })
}

/**
 * Haalt satellietbeeld op over dit gebied en plakt het aan elkaar.
 *
 * Geeft naast het beeld terug welk gebied het precies beslaat, zodat de opmaak
 * het op de millimeter nauwkeurig kan plaatsen.
 */
export async function fetchImagery (bounds, { metersPerPixel: doel = 5, onProgress } = {}) {
  const middenLat = (bounds.north + bounds.south) / 2
  const gewenst = zoomForResolution(doel, middenLat, { maxZoom: MAX_ZOOM })
  const z = zoomBinnenBudget(bounds, gewenst, TEGELBUDGET)
  const tegels = tilesForBounds(bounds, z)

  if (z < gewenst) {
    onProgress?.(`satelliet teruggeschaald van niveau ${gewenst} naar ${z} (${tegels.length} tegels)`)
  }

  const xs = tegels.map(t => t.x)
  const ys = tegels.map(t => t.y)
  const originTileX = Math.min(...xs)
  const originTileY = Math.min(...ys)
  const breedte = (Math.max(...xs) - originTileX + 1) * TILE_SIZE
  const hoogte = (Math.max(...ys) - originTileY + 1) * TILE_SIZE

  let klaar = 0
  const stukken = await mapLimit(tegels, 6, async tegel => {
    const jpg = await fetchTile(tegel)
    onProgress?.(++klaar, tegels.length)
    return {
      input: jpg,
      left: (tegel.x - originTileX) * TILE_SIZE,
      top: (tegel.y - originTileY) * TILE_SIZE
    }
  })

  // Let op: sharp voegt bij het samenstellen een alfakanaal toe, dus het aantal
  // kanalen staat niet vast. Geef het mee in plaats van het te veronderstellen -
  // een verkeerd aantal laat sharp de afmetingen verkeerd uitrekenen.
  const { data, info } = await sharp({
    create: { width: breedte, height: hoogte, channels: 3, background: '#ffffff' }
  }).composite(stukken).raw().toBuffer({ resolveWithObject: true })

  return {
    data,
    channels: info.channels,
    width: breedte,
    height: hoogte,
    z,
    originPx: originTileX * TILE_SIZE,
    originPy: originTileY * TILE_SIZE,
    metersPerPixel: metersPerPixel(middenLat, z)
  }
}
