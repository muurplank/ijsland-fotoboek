import test from 'node:test'
import assert from 'node:assert/strict'
import { projecteer, padData, pijltjesLangs, vereenvoudig, lengteMm } from '../src/render/svg.js'
import { MapView } from '../src/geo/viewport.js'

const VIEW = MapView.fit(
  [[-21.9426, 64.1466], [-19.0060, 63.4187]],
  { widthMm: 200, heightMm: 200, paddingMm: 10 }
)

test('zet coordinaten om in punten op de pagina', () => {
  const punten = projecteer([[-21.9426, 64.1466], [-19.0060, 63.4187]], VIEW)
  assert.equal(punten.length, 2)
  assert.ok(punten.every(p => typeof p.x === 'number' && typeof p.y === 'number'))
  assert.ok(punten[0].x < punten[1].x, 'oostelijker hoort verder naar rechts te liggen')
  assert.ok(punten[0].y < punten[1].y, 'zuidelijker hoort lager op de pagina te liggen')
})

test('schrijft een pad dat begint met verplaatsen en daarna lijnen trekt', () => {
  const d = padData([{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }])
  assert.match(d, /^M 1(\.0+)? 2/, `pad hoort met M te beginnen: ${d}`)
  assert.equal((d.match(/L/g) ?? []).length, 2, 'twee lijnstukken na het beginpunt')
})

test('geeft een leeg pad terug voor een lege reeks', () => {
  assert.equal(padData([]), '')
})

test('rondt af op een precisie die het papier niet kan zien', () => {
  const d = padData([{ x: 1.23456789, y: 2.3456789 }])
  // duizendsten van een millimeter is al ver voorbij wat een drukpers haalt
  assert.ok(!/\d\.\d{4}/.test(d), `onnodig lange getallen in het pad: ${d}`)
})

test('meet de lengte van een pad in millimeters', () => {
  assert.equal(lengteMm([{ x: 0, y: 0 }, { x: 3, y: 4 }]), 5)
  assert.equal(lengteMm([{ x: 0, y: 0 }]), 0)
})

test('zet pijltjes op vaste afstand van elkaar, gemeten op papier', () => {
  const rechteLijn = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
  const pijltjes = pijltjesLangs(rechteLijn, 25)

  assert.equal(pijltjes.length, 4, '100 mm met 25 mm ertussen geeft vier pijltjes')
  // ze horen een halve tussenafstand na het begin te starten, niet op de marker zelf
  assert.ok(Math.abs(pijltjes[0].x - 12.5) < 0.01, `eerste pijltje op ${pijltjes[0].x}`)
  assert.ok(Math.abs(pijltjes[1].x - 37.5) < 0.01)
})

test('draait elk pijltje de kant op waar de route heen gaat', () => {
  const naarRechts = pijltjesLangs([{ x: 0, y: 0 }, { x: 100, y: 0 }], 40)
  assert.ok(Math.abs(naarRechts[0].hoek - 0) < 0.01, `naar rechts is 0 graden, kreeg ${naarRechts[0].hoek}`)

  const naarBeneden = pijltjesLangs([{ x: 0, y: 0 }, { x: 0, y: 100 }], 40)
  assert.ok(Math.abs(naarBeneden[0].hoek - 90) < 0.01, `naar beneden is 90 graden, kreeg ${naarBeneden[0].hoek}`)
})

test('zet geen pijltjes op een route korter dan de tussenafstand', () => {
  assert.equal(pijltjesLangs([{ x: 0, y: 0 }, { x: 5, y: 0 }], 25).length, 0)
})

test('volgt de bocht bij het plaatsen van pijltjes', () => {
  const hoek = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }]
  const pijltjes = pijltjesLangs(hoek, 50)
  assert.equal(pijltjes.length, 2)
  assert.ok(Math.abs(pijltjes[0].hoek - 0) < 0.01, 'eerste zit nog op het horizontale stuk')
  assert.ok(Math.abs(pijltjes[1].hoek - 90) < 0.01, 'tweede zit al op het verticale stuk')
})

test('gooit punten weg die op papier toch niet te zien zijn', () => {
  // een bijna rechte lijn met veel tussenpunten
  const veel = Array.from({ length: 200 }, (_, i) => ({ x: i * 0.5, y: Math.sin(i) * 0.001 }))
  const weinig = vereenvoudig(veel, 0.05)

  assert.ok(weinig.length < 20, `verwachtte een flinke reductie, kreeg ${weinig.length} van ${veel.length}`)
  assert.deepEqual(weinig[0], veel[0], 'het beginpunt blijft staan')
  assert.deepEqual(weinig.at(-1), veel.at(-1), 'het eindpunt blijft staan')
})

test('houdt echte bochten intact bij het vereenvoudigen', () => {
  const bocht = [{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 20, y: 0 }]
  assert.equal(vereenvoudig(bocht, 0.05).length, 3, 'een duidelijke knik mag niet verdwijnen')
})

test('laat korte reeksen met rust', () => {
  assert.equal(vereenvoudig([{ x: 0, y: 0 }, { x: 1, y: 1 }], 1).length, 2)
  assert.equal(vereenvoudig([], 1).length, 0)
})
