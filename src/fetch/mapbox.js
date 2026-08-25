/**
 * Kant-en-klare kaartstijlen van Mapbox als achtergrond.
 *
 * Mapbox Outdoors is de stijl waar hun cartografen jaren aan gewerkt hebben:
 * hoogtelijnen, paden, landcover en schaduwrelief in een zacht kleurenschema.
 * Dat namaken zou veel werk zijn voor een minder resultaat.
 *
 * Wat je ervoor inlevert: het komt binnen als rasterbeeld. Hun plaatsnamen en
 * hoogtelijnen zijn dus pixels, geen vectoren. Jouw routelijn, pijltjes, markers
 * en labels blijven wel vector, dus die blijven op elk formaat scherp.
 *
 * Printen mag met de vermelding "© Mapbox, © OpenStreetMap"; die staat onderaan
 * de kaart.
 */

import sharp from 'sharp'
import { cached, fetchWithRetry } from './cache.js'
import { haalGeheim } from './geheimen.js'
import { mapLimit } from './parallel.js'
import { metersPerPixel, tilesForBounds, TILE_SIZE, zoomBinnenBudget, zoomForResolution } from '../geo/tiles.js'

/** De stijlen die we aanbieden, met hun officiele naam bij Mapbox. */
export const MAPBOX_STIJLEN = {
  outdoors: { id: 'outdoors-v12', label: 'Outdoors' },
  'satelliet-straten': { id: 'satellite-streets-v12', label: 'Satelliet met straten' },
  licht: { id: 'light-v11', label: 'Licht' },
  straten: { id: 'streets-v12', label: 'Straten' },

  // Van Outdoors bestaat geen donkere versie bij Mapbox; deze twee zijn de
  // enige stijlen die af fabriek donker zijn. Ze missen de hoogtelijnen en de
  // landcover waar Outdoors het van moet hebben - dat is de ruil.
  donker: { id: 'dark-v11', label: 'Donker' },
  nacht: { id: 'navigation-night-v1', label: 'Nacht' }
}

/** Mapbox rendert tot dit niveau. */
const MAX_ZOOM = 20

/** Hoogstens dit aantal tegels per kaart. Ver binnen de gratis 200.000 per maand. */
const TEGELBUDGET = 900

/**
 * Bouwt de url voor een tegel.
 *
 * Bewust tegels van 256: dat is het raster waarop de rest van dit project ook
 * rekent. Mapbox kan ook 512-tegels leveren, maar die zitten op een raster met
 * een andere zoomtelling, en dan zou de achtergrond een niveau verschoven onder
 * je route liggen.
 */
export function mapboxUrl ({ stijl, z, x, y, token, retina = false }) {
  const gekozen = MAPBOX_STIJLEN[stijl]
  if (!gekozen) {
    throw new Error(
      `Onbekende Mapbox-stijl "${stijl}". Beschikbaar: ${Object.keys(MAPBOX_STIJLEN).join(', ')}`
    )
  }

  return `https://api.mapbox.com/styles/v1/mapbox/${gekozen.id}/tiles/256/${z}/${x}/${y}` +
    `${retina ? '@2x' : ''}?access_token=${token}`
}

/** Kijkt of de token bruikbaar is, met uitleg als dat niet zo is. */
export function controleerToken (token) {
  if (!token) {
    throw new Error(
      'Geen Mapbox-token gevonden. Maak een gratis account op mapbox.com, kopieer je ' +
      'publieke token (begint met pk.) en zet hem in data/secrets.json onder "mapboxToken".'
    )
  }
  if (token.startsWith('sk.')) {
    throw new Error(
      'Dit is een geheime token (sk.). Gebruik je publieke token (pk.): een geheime token ' +
      'geeft toegang tot je hele account.'
    )
  }
  return token
}

async function haalToken () {
  return haalGeheim({ sleutel: 'mapboxToken', env: ['MAPBOX_TOKEN'], controle: controleerToken })
}

async function fetchTile ({ x, y, z }, stijl, token, retina) {
  return cached('mapbox', [stijl, z, x, y, retina], async () => {
    const antwoord = await fetchWithRetry(mapboxUrl({ stijl, z, x, y, token, retina }))
    return Buffer.from(await antwoord.arrayBuffer())
  }, { extensie: 'png' })
}

/**
 * Haalt een aaneengesloten stuk kaart op en plakt het aan elkaar.
 *
 * Vraagt de tegels op dubbele resolutie op: dat verdubbelt de scherpte zonder
 * dat de kaart meer detail gaat tonen dan bij deze schaal hoort. Een niveau
 * hoger zoomen zou wel meer detail geven, maar dan komen er plaatsnamen en
 * weggetjes bij die op deze schaal niet thuishoren.
 */
export async function fetchMapboxKaart (bounds, { stijl = 'outdoors', metersPerPixel: doel = 30, onProgress } = {}) {
  const token = await haalToken()
  const middenLat = (bounds.north + bounds.south) / 2

  // met @2x zijn de pixels half zo groot als het zoomniveau suggereert
  const gewenst = zoomForResolution(doel * 2, middenLat, { maxZoom: MAX_ZOOM })
  const z = zoomBinnenBudget(bounds, gewenst, TEGELBUDGET)
  const tegels = tilesForBounds(bounds, z)

  if (z < gewenst) {
    onProgress?.(`Mapbox teruggeschaald van niveau ${gewenst} naar ${z} (${tegels.length} tegels)`)
  }

  const xs = tegels.map(t => t.x)
  const ys = tegels.map(t => t.y)
  const originTileX = Math.min(...xs)
  const originTileY = Math.min(...ys)

  const schaal = 2 // @2x
  const tegelPx = TILE_SIZE * schaal
  const breedte = (Math.max(...xs) - originTileX + 1) * tegelPx
  const hoogte = (Math.max(...ys) - originTileY + 1) * tegelPx

  let klaar = 0
  const stukken = await mapLimit(tegels, 6, async tegel => {
    const png = await fetchTile(tegel, stijl, token, true)
    onProgress?.(++klaar, tegels.length)
    return {
      input: png,
      left: (tegel.x - originTileX) * tegelPx,
      top: (tegel.y - originTileY) * tegelPx
    }
  })

  const { data, info } = await sharp({
    create: { width: breedte, height: hoogte, channels: 3, background: '#ffffff' }
  }).composite(stukken).raw().toBuffer({ resolveWithObject: true })

  return {
    data,
    channels: info.channels,
    width: breedte,
    height: hoogte,
    z,
    // het raster is twee keer zo fijn als het tegelraster, dus de oorsprong ook
    originPx: originTileX * TILE_SIZE,
    originPy: originTileY * TILE_SIZE,
    schaal,
    metersPerPixel: metersPerPixel(middenLat, z) / schaal
  }
}
