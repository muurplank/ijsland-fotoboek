import test from 'node:test'
import assert from 'node:assert/strict'
import { hoogteKleur, kleurTerrein } from '../src/render/terrain.js'
import { hexNaarRgb } from '../src/render/colorize.js'

/** Een eenvoudige trap: groen op zeeniveau, wit op 1000 m. */
const TRAP = [
  { m: 0, kleur: '#8fa87c' },
  { m: 500, kleur: '#c9a86a' },
  { m: 1000, kleur: '#ffffff' }
]

test('geeft op een steunpunt exact die kleur terug', () => {
  assert.deepEqual(hoogteKleur(0, TRAP), hexNaarRgb('#8fa87c'))
  assert.deepEqual(hoogteKleur(500, TRAP), hexNaarRgb('#c9a86a'))
  assert.deepEqual(hoogteKleur(1000, TRAP), hexNaarRgb('#ffffff'))
})

test('mengt vloeiend tussen twee steunpunten', () => {
  const halverwege = hoogteKleur(250, TRAP)
  const [r0, g0, b0] = hexNaarRgb('#8fa87c')
  const [r1, g1, b1] = hexNaarRgb('#c9a86a')

  assert.ok(Math.abs(halverwege[0] - (r0 + r1) / 2) < 1, `rood: ${halverwege[0]}`)
  assert.ok(Math.abs(halverwege[1] - (g0 + g1) / 2) < 1, `groen: ${halverwege[1]}`)
  assert.ok(Math.abs(halverwege[2] - (b0 + b1) / 2) < 1, `blauw: ${halverwege[2]}`)
})

test('houdt de kleur vast onder het laagste en boven het hoogste steunpunt', () => {
  assert.deepEqual(hoogteKleur(-50, TRAP), hexNaarRgb('#8fa87c'))
  assert.deepEqual(hoogteKleur(4000, TRAP), hexNaarRgb('#ffffff'))
})

test('loopt van laag naar hoog steeds lichter, zoals een hoogtekaart hoort', () => {
  const helderheid = h => {
    const [r, g, b] = hoogteKleur(h, TRAP)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  let vorige = -Infinity
  for (let h = 0; h <= 1000; h += 50) {
    const nu = helderheid(h)
    assert.ok(nu >= vorige - 0.5, `op ${h} m werd het donkerder in plaats van lichter`)
    vorige = nu
  }
})

/** Leest de kleur van punt i. */
const pixel = (rgb, i) => [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]

const OPTIES = {
  zeeKleur: '#dce6ea',
  trap: TRAP,
  verbleking: 0,
  ontzadiging: 0,
  vlakkeHelderheid: 180 // wat het schaduwrelief op kaarsvlak land geeft
}

test('geeft kaarsvlak land precies de hoogtekleur, zonder schaduw', () => {
  const rgb = kleurTerrein(
    new Uint8ClampedArray([180]),
    new Float32Array([0]),
    OPTIES
  )
  const [r, g, b] = pixel(rgb, 0)
  const [vr, vg, vb] = hexNaarRgb('#8fa87c')
  assert.ok(Math.abs(r - vr) <= 1 && Math.abs(g - vg) <= 1 && Math.abs(b - vb) <= 1,
    `verwachtte de hoogtekleur, kreeg ${r},${g},${b}`)
})

test('maakt een naar de zon gekeerde helling lichter dan vlak land op dezelfde hoogte', () => {
  const rgb = kleurTerrein(
    new Uint8ClampedArray([180, 240]),
    new Float32Array([300, 300]),
    OPTIES
  )
  const vlak = pixel(rgb, 0)
  const zon = pixel(rgb, 1)
  assert.ok(zon[0] > vlak[0] && zon[1] > vlak[1], 'de belichte helling hoort lichter te zijn')
})

test('maakt een beschaduwde helling donkerder', () => {
  const rgb = kleurTerrein(
    new Uint8ClampedArray([180, 90]),
    new Float32Array([300, 300]),
    OPTIES
  )
  assert.ok(pixel(rgb, 1)[0] < pixel(rgb, 0)[0], 'de schaduwzijde hoort donkerder te zijn')
})

test('houdt de zee vlak, zonder hoogtekleur en zonder relief', () => {
  const rgb = kleurTerrein(
    new Uint8ClampedArray([40, 250]),
    new Float32Array([-20, -300]),
    OPTIES
  )
  assert.deepEqual(pixel(rgb, 0), hexNaarRgb('#dce6ea'))
  assert.deepEqual(pixel(rgb, 1), hexNaarRgb('#dce6ea'))
})

test('houdt alles binnen wat een pixel kan weergeven, ook bij fel licht', () => {
  const rgb = kleurTerrein(
    new Uint8ClampedArray([0, 255, 128]),
    new Float32Array([0, 900, 2000]),
    OPTIES
  )
  assert.ok([...rgb].every(v => v >= 0 && v <= 255))
})

test('verbleekt de hele kaart naar wit', () => {
  const normaal = pixel(kleurTerrein(new Uint8ClampedArray([180]), new Float32Array([0]), OPTIES), 0)
  const bleek = pixel(kleurTerrein(new Uint8ClampedArray([180]), new Float32Array([0]),
    { ...OPTIES, verbleking: 0.6 }), 0)
  assert.ok(bleek[0] > normaal[0] && bleek[1] > normaal[1] && bleek[2] > normaal[2])
})
