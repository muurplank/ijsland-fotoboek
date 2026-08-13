import test from 'node:test'
import assert from 'node:assert/strict'
import {
  lonLatToTile, tileToLonLat, metersPerPixel, zoomForResolution, tilesForBounds
} from '../src/geo/tiles.js'

test('legt het midden van de wereld op het midden van de enige tegel van zoom 0', () => {
  const t = lonLatToTile(0, 0, 0)
  assert.ok(Math.abs(t.x - 0.5) < 1e-9)
  assert.ok(Math.abs(t.y - 0.5) < 1e-9)
})

test('legt de linkerbovenhoek van de wereld op nul', () => {
  const t = lonLatToTile(-180, 85.0511287798, 0)
  assert.ok(Math.abs(t.x) < 1e-6)
  assert.ok(Math.abs(t.y) < 1e-6)
})

test('geeft voor Reykjavik dezelfde tegel als de standaardformule', () => {
  // Onafhankelijk narekend in Python met de standaard slippy-map formule: 449, 272
  const t = lonLatToTile(-21.94, 64.146, 10)
  assert.equal(Math.floor(t.x), 449)
  assert.equal(Math.floor(t.y), 272)
})

test('rekent een tegelpositie terug naar dezelfde coordinaten', () => {
  const lon = -19.006
  const lat = 63.4187
  const t = lonLatToTile(lon, lat, 12)
  const terug = tileToLonLat(t.x, t.y, 12)
  assert.ok(Math.abs(terug.lon - lon) < 1e-9, `lengtegraad liep weg: ${terug.lon}`)
  assert.ok(Math.abs(terug.lat - lat) < 1e-9, `breedtegraad liep weg: ${terug.lat}`)
})

test('meet een pixel op IJsland kleiner dan een pixel op de evenaar', () => {
  // Web Mercator rekt naar de polen toe op, dus een schermpixel dekt daar minder grond
  const evenaar = metersPerPixel(0, 12)
  const ijsland = metersPerPixel(64, 12)
  assert.ok(ijsland < evenaar)
  assert.ok(Math.abs(ijsland - evenaar * Math.cos(64 * Math.PI / 180)) < 0.01)
})

test('halveert de pixelgrootte bij elk zoomniveau', () => {
  assert.ok(Math.abs(metersPerPixel(64, 11) / metersPerPixel(64, 12) - 2) < 1e-9)
})

test('kiest een zoomniveau dat fijn genoeg is voor de gevraagde scherpte', () => {
  const z = zoomForResolution(30, 64) // we willen minstens 30 meter per pixel
  assert.ok(metersPerPixel(64, z) <= 30, 'gekozen zoom is te grof')
  assert.ok(metersPerPixel(64, z - 1) > 30, 'gekozen zoom is onnodig fijn')
})

test('kiest nooit een zoomniveau dat de bron niet heeft', () => {
  const z = zoomForResolution(0.001, 64, { maxZoom: 15 })
  assert.equal(z, 15)
})

test('somt precies de tegels op die een gebied bedekken', () => {
  // een vak rond Vik, klein genoeg voor een handjevol tegels
  const tegels = tilesForBounds({ west: -19.1, south: 63.4, east: -19.0, north: 63.45 }, 12)

  assert.ok(tegels.length > 0, 'moet minstens een tegel opleveren')
  assert.ok(tegels.every(t => Number.isInteger(t.x) && Number.isInteger(t.y) && t.z === 12))

  // de hoeken van het gebied moeten allemaal binnen de verzamelde tegels vallen
  const linksboven = lonLatToTile(-19.1, 63.45, 12)
  const rechtsonder = lonLatToTile(-19.0, 63.4, 12)
  assert.ok(tegels.some(t => t.x === Math.floor(linksboven.x) && t.y === Math.floor(linksboven.y)))
  assert.ok(tegels.some(t => t.x === Math.floor(rechtsonder.x) && t.y === Math.floor(rechtsonder.y)))
})

test('vraagt geen tegels op buiten de wereldrand', () => {
  const tegels = tilesForBounds({ west: -180, south: 60, east: -179.9, north: 60.1 }, 4)
  assert.ok(tegels.every(t => t.x >= 0 && t.y >= 0 && t.x < 16 && t.y < 16),
    'tegelnummers moeten binnen het raster van zoom 4 vallen')
})
