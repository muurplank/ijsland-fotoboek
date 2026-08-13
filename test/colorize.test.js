import test from 'node:test'
import assert from 'node:assert/strict'
import { hexNaarRgb, kleurKaart } from '../src/render/colorize.js'

const STIJL = {
  zeeKleur: '#eef2f4',
  schaduwKleur: '#6b6459',
  verbleking: 0,
  ontzadiging: 0,
  gletsjerKleur: '#ffffff'
}

/** Leest de kleur van punt i uit de uitkomst. */
function pixel (rgb, i) {
  return [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]
}

test('leest een hexkleur uit', () => {
  assert.deepEqual(hexNaarRgb('#ffffff'), [255, 255, 255])
  assert.deepEqual(hexNaarRgb('#000000'), [0, 0, 0])
  assert.deepEqual(hexNaarRgb('#6b6459'), [107, 100, 89])
})

test('geeft de zee overal exact dezelfde kleur, ongeacht het relief eronder', () => {
  // twee zeepunten met heel verschillende bodemvorm eronder
  const grijs = new Uint8ClampedArray([10, 250])
  const hoogtes = new Float32Array([-50, -120])

  const rgb = kleurKaart(grijs, hoogtes, STIJL)
  assert.deepEqual(pixel(rgb, 0), hexNaarRgb('#eef2f4'))
  assert.deepEqual(pixel(rgb, 1), hexNaarRgb('#eef2f4'),
    'de zeebodem mag niet doorschemeren als relief')
})

test('behandelt de waterlijn zelf als land', () => {
  const rgb = kleurKaart(new Uint8ClampedArray([180]), new Float32Array([0]), STIJL)
  assert.notDeepEqual(pixel(rgb, 0), hexNaarRgb('#eef2f4'), 'nul meter is nog net land')
})

test('maakt beschaduwd land donkerder dan belicht land', () => {
  const grijs = new Uint8ClampedArray([40, 220])
  const hoogtes = new Float32Array([300, 300])

  const rgb = kleurKaart(grijs, hoogtes, STIJL)
  const schaduw = pixel(rgb, 0)
  const zon = pixel(rgb, 1)
  assert.ok(schaduw[0] < zon[0] && schaduw[1] < zon[1] && schaduw[2] < zon[2],
    'de beschaduwde helling hoort donkerder te zijn')
})

test('trekt de hele kaart naar wit toe als je hem laat verbleken', () => {
  const grijs = new Uint8ClampedArray([40])
  const hoogtes = new Float32Array([300])

  const normaal = pixel(kleurKaart(grijs, hoogtes, STIJL), 0)
  const verbleekt = pixel(kleurKaart(grijs, hoogtes, { ...STIJL, verbleking: 0.7 }), 0)

  assert.ok(verbleekt[0] > normaal[0], 'verbleken hoort lichter te maken')
  assert.ok(verbleekt.every(v => v <= 255))
})

test('verbleekt ook de zee mee, zodat de kaart een geheel blijft', () => {
  const grijs = new Uint8ClampedArray([100])
  const hoogtes = new Float32Array([-30])

  const normaal = pixel(kleurKaart(grijs, hoogtes, STIJL), 0)
  const verbleekt = pixel(kleurKaart(grijs, hoogtes, { ...STIJL, verbleking: 0.7 }), 0)
  assert.ok(verbleekt[0] >= normaal[0])
})

test('haalt kleur uit de schaduw als je ontzadigt', () => {
  const grijs = new Uint8ClampedArray([20])
  const hoogtes = new Float32Array([300])

  // een uitgesproken warme schaduwkleur moet naar grijs toe trekken
  const warm = { ...STIJL, schaduwKleur: '#a0522d' }
  const kleurig = pixel(kleurKaart(grijs, hoogtes, warm), 0)
  const grijzig = pixel(kleurKaart(grijs, hoogtes, { ...warm, ontzadiging: 1 }), 0)

  const spreidingKleurig = Math.max(...kleurig) - Math.min(...kleurig)
  const spreidingGrijzig = Math.max(...grijzig) - Math.min(...grijzig)
  assert.ok(spreidingGrijzig < spreidingKleurig, 'ontzadigen hoort de kleurspreiding te verkleinen')
})

test('geeft evenveel kleurwaarden terug als er punten zijn', () => {
  const n = 25
  const rgb = kleurKaart(new Uint8ClampedArray(n), new Float32Array(n), STIJL)
  assert.equal(rgb.length, n * 3)
})

test('houdt alle kleurwaarden binnen wat een pixel kan weergeven', () => {
  const grijs = new Uint8ClampedArray([0, 255, 128])
  const hoogtes = new Float32Array([-100, 2000, 0])
  const rgb = kleurKaart(grijs, hoogtes, { ...STIJL, verbleking: 1 })
  assert.ok([...rgb].every(v => v >= 0 && v <= 255))
})
