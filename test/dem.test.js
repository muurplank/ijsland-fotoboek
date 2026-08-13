import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeTerrarium, DemGrid } from '../src/geo/dem.js'
import { lonLatToTile, TILE_SIZE } from '../src/geo/tiles.js'

test('decodeert de nullijn van het terrarium-formaat', () => {
  // het formaat legt zeeniveau op rood=128: (128 * 256) - 32768 = 0
  assert.equal(decodeTerrarium(128, 0, 0), 0)
})

test('decodeert hele en gebroken meters', () => {
  assert.equal(decodeTerrarium(136, 0, 0), 2048)
  assert.equal(decodeTerrarium(128, 100, 0), 100)
  assert.equal(decodeTerrarium(128, 0, 128), 0.5) // blauw is het gebroken deel
})

test('decodeert diepte onder zeeniveau als negatief', () => {
  assert.ok(decodeTerrarium(127, 0, 0) < 0)
  assert.equal(decodeTerrarium(127, 0, 0), -256)
})

test('decodeert de hoogste berg van IJsland uit echte tegelwaarden', () => {
  // Uit de gedownloade tegel over Vatnajokull kwam 2121 m als hoogste waarde.
  // 2121 + 32768 = 34889 = rood 136, groen 73
  assert.equal(decodeTerrarium(136, 73, 0), 2121)
})

/** Bouwt een nep-hoogteraster waarin de hoogte gelijk is aan de kolomindex. */
function testRaster (z = 12, tileX = 1858, tileY = 1091, tilesWide = 1, tilesHigh = 1) {
  const width = TILE_SIZE * tilesWide
  const height = TILE_SIZE * tilesHigh
  const data = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = x
  }
  return new DemGrid({ data, width, height, z, originTileX: tileX, originTileY: tileY })
}

test('leest de hoogte terug op de plek waar hij is neergezet', () => {
  const z = 12
  const tileX = 1858
  const tileY = 1091
  const grid = testRaster(z, tileX, tileY)

  // midden van pixel 10 in de bovenste rij van deze tegel
  const punt = { x: tileX + 10.5 / TILE_SIZE, y: tileY + 0.5 / TILE_SIZE }
  const { lon, lat } = tileToLonLatLocal(punt.x, punt.y, z)

  assert.ok(Math.abs(grid.elevationAt(lon, lat) - 10) < 0.01,
    `verwachtte 10, kreeg ${grid.elevationAt(lon, lat)}`)
})

test('interpoleert vloeiend tussen twee naburige meetpunten', () => {
  const z = 12
  const grid = testRaster(z)
  // precies tussen kolom 10 en 11 hoort 10,5 uit te komen
  const punt = { x: 1858 + 11 / TILE_SIZE, y: 1091 + 0.5 / TILE_SIZE }
  const { lon, lat } = tileToLonLatLocal(punt.x, punt.y, z)
  assert.ok(Math.abs(grid.elevationAt(lon, lat) - 10.5) < 0.01,
    `verwachtte 10,5, kreeg ${grid.elevationAt(lon, lat)}`)
})

test('geeft null buiten het gebied waar hoogtes voor opgehaald zijn', () => {
  const grid = testRaster()
  // Reykjavik ligt ver buiten een tegel boven Vatnajokull
  assert.equal(grid.elevationAt(-21.94, 64.146), null)
})

test('valt niet om op de allerlaatste pixel aan de rand', () => {
  const z = 12
  const grid = testRaster(z)
  const punt = { x: 1858 + 255.9 / TILE_SIZE, y: 1091 + 255.9 / TILE_SIZE }
  const { lon, lat } = tileToLonLatLocal(punt.x, punt.y, z)
  const h = grid.elevationAt(lon, lat)
  assert.ok(h !== null && Number.isFinite(h), `randpixel gaf ${h}`)
})

test('leest een hele reeks hoogtes langs een route uit', () => {
  const z = 12
  const grid = testRaster(z, 1858, 1091, 1, 1)
  const a = tileToLonLatLocal(1858 + 10.5 / TILE_SIZE, 1091 + 0.5 / TILE_SIZE, z)
  const b = tileToLonLatLocal(1858 + 20.5 / TILE_SIZE, 1091 + 0.5 / TILE_SIZE, z)

  const hoogtes = grid.profile([[a.lon, a.lat], [b.lon, b.lat]])
  assert.equal(hoogtes.length, 2)
  assert.ok(Math.abs(hoogtes[0] - 10) < 0.01)
  assert.ok(Math.abs(hoogtes[1] - 20) < 0.01)
})

// kleine hulpfunctie zodat de test niet afhangt van de volgorde van imports
function tileToLonLatLocal (x, y, z) {
  const n = 2 ** z
  return {
    lon: (x / n) * 360 - 180,
    lat: Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * (180 / Math.PI)
  }
}

test('de hulpfunctie in deze test komt overeen met de echte tegelwiskunde', () => {
  const t = lonLatToTile(-16.5, 64.0, 12)
  const terug = tileToLonLatLocal(t.x, t.y, 12)
  assert.ok(Math.abs(terug.lon - -16.5) < 1e-9)
  assert.ok(Math.abs(terug.lat - 64.0) < 1e-9)
})
