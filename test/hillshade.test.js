import test from 'node:test'
import assert from 'node:assert/strict'
import { hillshade } from '../src/render/hillshade.js'

/** Maakt een hoogteraster waarin de hoogte per pixel door een functie bepaald wordt. */
function raster (width, height, fn) {
  const data = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = fn(x, y)
  }
  return { data, width, height }
}

const OPTIES = { metersPerPixel: 30, azimuth: 315, altitude: 45, exaggeration: 1, contrast: 1 }

test('geeft vlak land overal dezelfde helderheid', () => {
  const uit = hillshade(raster(16, 16, () => 100), OPTIES)
  const eerste = uit[0]
  assert.ok(uit.every(v => v === eerste), 'vlak land hoort geen schaduwpatroon te hebben')
})

test('verlicht vlak land volgens de hoogte van de zon', () => {
  // een vlakke vlakte vangt licht naar rato van de sinus van de zonshoogte
  const laag = hillshade(raster(16, 16, () => 0), { ...OPTIES, altitude: 30 })[0]
  const hoog = hillshade(raster(16, 16, () => 0), { ...OPTIES, altitude: 80 })[0]
  assert.ok(hoog > laag, 'een hogere zon maakt het vlakke land lichter')
  assert.ok(Math.abs(laag / 255 - Math.sin(30 * Math.PI / 180)) < 0.05,
    `verwachtte ~${(Math.sin(30 * Math.PI / 180) * 255).toFixed(0)}, kreeg ${laag}`)
})

test('maakt een helling naar de zon toe lichter dan een helling ervan af', () => {
  // De zon staat in het noordwesten (315 graden).
  //
  // Een raster dat oploopt naar het oosten is een helling die naar het WESTEN
  // kijkt - de afdaling wijst naar het westen. Die vangt dus het licht.
  // Een raster dat afloopt naar het oosten kijkt naar het oosten, van de zon af,
  // en ligt in de schaduw.
  const kijktNaarWesten = hillshade(raster(16, 16, x => x * 10), OPTIES)
  const kijktNaarOosten = hillshade(raster(16, 16, x => -x * 10), OPTIES)

  const midden = 8 * 16 + 8
  assert.ok(kijktNaarWesten[midden] > kijktNaarOosten[midden],
    `de naar de zon gekeerde helling hoort lichter te zijn ` +
    `(${kijktNaarWesten[midden]} vs ${kijktNaarOosten[midden]})`)

  // en de vlakke vlakte hoort er precies tussenin te liggen
  const vlak = hillshade(raster(16, 16, () => 0), OPTIES)[midden]
  assert.ok(kijktNaarOosten[midden] < vlak && vlak < kijktNaarWesten[midden],
    'vlak land hoort tussen de belichte en de beschaduwde helling te liggen')
})

test('vergroot het hoogteverschil als je de overdrijving opvoert', () => {
  const zacht = hillshade(raster(16, 16, x => x * 2), { ...OPTIES, exaggeration: 1 })
  const sterk = hillshade(raster(16, 16, x => x * 2), { ...OPTIES, exaggeration: 4 })

  const midden = 8 * 16 + 8
  const vlak = hillshade(raster(16, 16, () => 0), OPTIES)[midden]
  assert.ok(Math.abs(sterk[midden] - vlak) > Math.abs(zacht[midden] - vlak),
    'meer overdrijving hoort verder van het vlakke grijs af te wijken')
})

test('draait het schaduwpatroon mee als de zon van kant wisselt', () => {
  const helling = raster(16, 16, x => x * 10)
  const vanuitWesten = hillshade(helling, { ...OPTIES, azimuth: 270 })
  const vanuitOosten = hillshade(helling, { ...OPTIES, azimuth: 90 })

  const midden = 8 * 16 + 8
  assert.ok(vanuitWesten[midden] !== vanuitOosten[midden],
    'de kant waar de zon vandaan komt hoort uit te maken')
})

test('houdt de uitkomst binnen wat een pixel kan weergeven', () => {
  const steil = hillshade(raster(16, 16, (x, y) => x * 500 + y * 500), { ...OPTIES, exaggeration: 6 })
  assert.ok(steil.every(v => v >= 0 && v <= 255), 'waarden moeten binnen 0..255 blijven')
  assert.ok(steil.every(Number.isFinite), 'geen NaN in de uitkomst')
})

test('houdt rekening met de werkelijke grootte van een pixel op de grond', () => {
  const helling = raster(16, 16, x => x * 10)
  // dezelfde hoogtestap over een kleiner stukje grond is een steilere helling
  const grof = hillshade(helling, { ...OPTIES, metersPerPixel: 100 })
  const fijn = hillshade(helling, { ...OPTIES, metersPerPixel: 10 })

  const midden = 8 * 16 + 8
  const vlak = hillshade(raster(16, 16, () => 0), OPTIES)[midden]
  assert.ok(Math.abs(fijn[midden] - vlak) > Math.abs(grof[midden] - vlak),
    'dezelfde hoogtestap over minder grond hoort steiler te ogen')
})

test('valt niet om op de randen van het raster', () => {
  const uit = hillshade(raster(8, 8, (x, y) => x * y), OPTIES)
  assert.equal(uit.length, 64)
  assert.ok(uit.every(Number.isFinite), 'ook de randpixels moeten een waarde hebben')
})

test('geeft bij nul contrast overal hetzelfde vlakke grijs', () => {
  const uit = hillshade(raster(16, 16, (x, y) => x * 50 + y * 20), { ...OPTIES, contrast: 0 })
  const eerste = uit[0]
  assert.ok(uit.every(v => Math.abs(v - eerste) <= 1), 'zonder contrast hoort er geen relief te zijn')
})
