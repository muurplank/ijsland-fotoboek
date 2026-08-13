/**
 * Tegelwiskunde voor Web Mercator.
 *
 * Zowel het hoogtemodel als het satellietbeeld komt binnen als vierkante tegels
 * van 256 pixels, genummerd per zoomniveau. Dit bestand rekent tussen
 * coordinaten en tegelnummers.
 */

export const TILE_SIZE = 256

/** Omtrek van de aarde op de evenaar, de basis van elke Mercator-schaal. */
const AARDOMTREK_M = 40075016.686

const rad = deg => (deg * Math.PI) / 180

/**
 * Tegelpositie van een coordinaat, als kommagetal. Het hele deel is het
 * tegelnummer, het decimale deel is waar je in die tegel zit.
 */
export function lonLatToTile (lon, lat, z) {
  const n = 2 ** z
  const x = ((lon + 180) / 360) * n
  const y = ((1 - Math.asinh(Math.tan(rad(lat))) / Math.PI) / 2) * n
  return { x, y, z }
}

/** De omgekeerde weg: van tegelpositie terug naar coordinaat. */
export function tileToLonLat (x, y, z) {
  const n = 2 ** z
  return {
    lon: (x / n) * 360 - 180,
    lat: Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * (180 / Math.PI)
  }
}

/** Hoeveel meter grond een pixel bedekt op deze breedtegraad en zoom. */
export function metersPerPixel (lat, z) {
  return (AARDOMTREK_M * Math.cos(rad(lat))) / (TILE_SIZE * 2 ** z)
}

/**
 * Het laagste zoomniveau dat nog fijn genoeg is voor de gevraagde scherpte.
 * Hoger zoomen dan de bron heeft, heeft geen zin: dat vergroot alleen de
 * download zonder dat er detail bij komt.
 */
export function zoomForResolution (targetMetersPerPixel, lat, { maxZoom = 22, minZoom = 0 } = {}) {
  for (let z = minZoom; z <= maxZoom; z++) {
    if (metersPerPixel(lat, z) <= targetMetersPerPixel) return z
  }
  return maxZoom
}

/**
 * Het hoogste zoomniveau waarvoor dit gebied binnen het tegelbudget blijft.
 *
 * Nodig omdat de schaal van een dag enorm verschilt: een dag rond het vliegveld
 * is vijf kilometer breed, een dag door de oostfjorden vierhonderd. Zonder deze
 * grens vraagt zo'n lange dag duizenden tegels aan, en dat kost minuten
 * downloaden voor detail dat op papier toch niet te zien is.
 */
export function zoomBinnenBudget (bounds, gevraagdeZoom, maxTegels, minZoom = 3) {
  for (let z = gevraagdeZoom; z > minZoom; z--) {
    if (tilesForBounds(bounds, z).length <= maxTegels) return z
  }
  return minZoom
}

/** Alle tegels die nodig zijn om dit gebied te bedekken. */
export function tilesForBounds (bounds, z) {
  const n = 2 ** z
  const linksboven = lonLatToTile(bounds.west, bounds.north, z)
  const rechtsonder = lonLatToTile(bounds.east, bounds.south, z)

  const klem = v => Math.max(0, Math.min(n - 1, v))
  const x0 = klem(Math.floor(linksboven.x))
  const x1 = klem(Math.floor(rechtsonder.x))
  const y0 = klem(Math.floor(linksboven.y))
  const y1 = klem(Math.floor(rechtsonder.y))

  const tegels = []
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) tegels.push({ x, y, z })
  }
  return tegels
}
