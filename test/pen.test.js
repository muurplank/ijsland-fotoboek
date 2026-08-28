import test from 'node:test'
import assert from 'node:assert/strict'
import { zaadje } from '../src/render/papier.js'
import {
  penPunten, penKader, penCirkel, scheurPad, vakOmtrek, verdicht, padVan, padTot, yBij
} from '../src/render/pen.js'

const hand = (zaad = 3) => zaadje(zaad)

test('zonder wiebel is de lijn kaarsrecht', () => {
  // de knop moet ook echt terug kunnen naar de rechte lijn, anders is er geen
  // weg terug uit de veldnotitie-stijl
  const lijn = penPunten(10, 200, 50, { rnd: hand(), amplitudeMm: 0 })
  assert.ok(lijn.every(p => p.y === 50))
  assert.equal(lijn[0].x, 10)
  assert.equal(lijn.at(-1).x, 200)
})

test('hetzelfde zaad geeft dezelfde hand', () => {
  const opties = () => ({ rnd: hand(9), amplitudeMm: 0.8 })
  assert.deepEqual(penPunten(0, 100, 20, opties()), penPunten(0, 100, 20, opties()))
})

test('een ander zaad geeft een andere hand', () => {
  assert.notDeepEqual(
    penPunten(0, 100, 20, { rnd: hand(1), amplitudeMm: 0.8 }),
    penPunten(0, 100, 20, { rnd: hand(2), amplitudeMm: 0.8 })
  )
})

test('de lijn blijft binnen de afwijking die je toestaat', () => {
  // de golf en de helling komen bovenop elkaar; ruimer dan dat mag hij nooit
  // worden, want dan loopt hij het kader of de foto in
  const lijn = penPunten(0, 180, 12, { rnd: hand(5), amplitudeMm: 1 })
  for (const p of lijn) assert.ok(Math.abs(p.y - 12) < 1.2, `y = ${p.y}`)
})

test('de lijn loopt van begin tot eind door, zonder terug te lopen', () => {
  const lijn = penPunten(4, 190, 30, { rnd: hand(6), amplitudeMm: 0.9 })
  for (let i = 1; i < lijn.length; i++) {
    assert.ok(lijn[i].x >= lijn[i - 1].x, `stap terug bij ${i}`)
  }
})

test('een staande lijn loopt van boven naar beneden', () => {
  const lijn = penPunten(5, 25, 100, { rnd: hand(), amplitudeMm: 0.6, staand: true })
  assert.equal(lijn[0].y, 5)
  assert.equal(lijn.at(-1).y, 25)
  assert.ok(lijn.some(p => p.x !== 100))
})

test('padTot houdt precies bij de gevraagde x op', () => {
  const lijn = penPunten(0, 100, 10, { rnd: hand(), amplitudeMm: 0.5 })
  const stuk = padTot(lijn, 42)
  assert.ok(Math.abs(stuk.at(-1).x - 42) < 0.001)
  assert.ok(stuk.every(p => p.x <= 42.001))
})

test('yBij leest de hoogte van de lijn af, ook buiten de uiteinden', () => {
  const lijn = [{ x: 0, y: 0 }, { x: 10, y: 10 }]
  assert.equal(yBij(lijn, 5), 5)
  assert.equal(yBij(lijn, -3), 0)
  assert.equal(yBij(lijn, 99), 10)
})

test('padVan sluit alleen als je erom vraagt', () => {
  const punten = [{ x: 0, y: 0 }, { x: 1, y: 2 }]
  assert.equal(padVan(punten), 'M 0 0 L 1 2')
  assert.equal(padVan(punten, true), 'M 0 0 L 1 2 Z')
  assert.equal(padVan([]), '')
})

test('verdicht laat de uiteinden staan waar ze stonden', () => {
  const controle = [{ x: 0, y: 0 }, { x: 5, y: 3 }, { x: 10, y: 0 }]
  const fijn = verdicht(controle)
  assert.deepEqual(fijn[0], controle[0])
  assert.deepEqual(fijn.at(-1), controle.at(-1))
  assert.ok(fijn.length > controle.length * 5)
})

test('de omtrek van een vak blijft binnen zijn maten', () => {
  for (const p of vakOmtrek(10, 5, 100, 8, 1.5)) {
    assert.ok(p.x >= 10 - 0.001 && p.x <= 110.001, `x = ${p.x}`)
    assert.ok(p.y >= 5 - 0.001 && p.y <= 13.001, `y = ${p.y}`)
  }
})

test('de hoekafronding kan het vak nooit opvouwen', () => {
  // een hoek groter dan de helft van de kortste zijde zou de omtrek omklappen
  const punten = vakOmtrek(0, 0, 40, 4, 20)
  assert.ok(punten.every(p => p.y >= -0.001 && p.y <= 4.001))
})

test('het kader schiet voorbij zijn begin', () => {
  const { omtrek, haal } = penKader(0, 0, 80, 8, { rnd: hand(4), amplitudeMm: 0.3 })
  assert.ok(haal.length > omtrek.length, 'geen overschot')
  // en de gesloten omtrek waar de vulling op afgeknipt wordt houdt wél op
  assert.equal(omtrek.length, new Set(omtrek).size)
})

test('het kader blijft dicht bij het vak dat je vroeg', () => {
  const { omtrek } = penKader(20, 10, 120, 7, { rnd: hand(8), amplitudeMm: 0.4 })
  for (const p of omtrek) {
    assert.ok(p.x > 19 && p.x < 141, `x = ${p.x}`)
    assert.ok(p.y > 9 && p.y < 18, `y = ${p.y}`)
  }
})

test('de cirkel loopt meer dan rond', () => {
  // een cirkel die precies sluit is een ellips uit een tekenprogramma
  const punten = penCirkel(50, 50, 4, 3, { rnd: hand(2), wiebel: 0.5 })
  const hoek = p => Math.atan2(p.y - 50, p.x - 50)
  let gelopen = 0
  for (let i = 1; i < punten.length; i++) {
    let stap = hoek(punten[i]) - hoek(punten[i - 1])
    while (stap > Math.PI) stap -= Math.PI * 2
    while (stap < -Math.PI) stap += Math.PI * 2
    gelopen += stap
  }
  assert.ok(Math.abs(gelopen) > Math.PI * 2, `maar ${Math.abs(gelopen).toFixed(2)} radialen`)
})

test('de scheurrand blijft aan de kant waar hij hoort', () => {
  const punten = scheurPad(200, 4, 20, hand(7))
  const boven = punten.filter(p => p.y < 12)
  const onder = punten.filter(p => p.y >= 12)
  assert.ok(boven.length > 10 && onder.length > 10)
  // de scheur wijkt af, maar loopt de bladzijde niet in
  for (const p of boven) assert.ok(p.y > 3 && p.y < 6, `boven op ${p.y}`)
  for (const p of onder) assert.ok(p.y > 18 && p.y < 21, `onder op ${p.y}`)
})

test('de scheurrand loopt van rand tot rand', () => {
  const punten = scheurPad(150, 2, 10, hand())
  assert.equal(Math.min(...punten.map(p => p.x)), 0)
  assert.equal(Math.max(...punten.map(p => p.x)), 150)
})
