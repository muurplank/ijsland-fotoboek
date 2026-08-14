import test from 'node:test'
import assert from 'node:assert/strict'
import { Bezetting, langsElkaar } from '../src/render/parallel.js'

test('een enkele route wordt niet verschoven', () => {
  const bezet = new Bezetting(1)
  const lijn = [{ x: 0, y: 10 }, { x: 100, y: 10 }]

  const uit = langsElkaar(lijn, bezet, { afstandMm: 1.2 })
  for (const [i, p] of uit.entries()) {
    assert.ok(Math.abs(p.y - lijn[Math.min(i, lijn.length - 1)].y) < 0.01,
      'zonder gezelschap hoort de lijn te blijven liggen')
  }
})

test('een tweede route over dezelfde weg schuift ernaast', () => {
  const bezet = new Bezetting(1)
  const lijn = [{ x: 0, y: 10 }, { x: 100, y: 10 }]

  langsElkaar(lijn, bezet, { afstandMm: 1.2 })          // dag 1 legt beslag
  const tweede = langsElkaar(lijn, bezet, { afstandMm: 1.2 })  // dag 2 komt erbij

  const midden = tweede[Math.floor(tweede.length / 2)]
  assert.ok(Math.abs(Math.abs(midden.y - 10) - 1.2) < 0.3,
    `verwachtte ongeveer 1,2 mm ernaast, kreeg ${(midden.y - 10).toFixed(2)}`)
})

test('een derde route schuift naar de andere kant', () => {
  const bezet = new Bezetting(1)
  const lijn = [{ x: 0, y: 10 }, { x: 100, y: 10 }]

  langsElkaar(lijn, bezet, { afstandMm: 1.2 })
  const b = langsElkaar(lijn, bezet, { afstandMm: 1.2 })
  const c = langsElkaar(lijn, bezet, { afstandMm: 1.2 })

  const yB = b[Math.floor(b.length / 2)].y
  const yC = c[Math.floor(c.length / 2)].y
  assert.ok((yB - 10) * (yC - 10) < 0, 'de derde hoort aan de andere kant te liggen')
})

test('routes die elkaar niet raken blijven allebei liggen', () => {
  const bezet = new Bezetting(1)
  const eerste = [{ x: 0, y: 10 }, { x: 100, y: 10 }]
  const tweede = [{ x: 0, y: 60 }, { x: 100, y: 60 }]

  langsElkaar(eerste, bezet, { afstandMm: 1.2 })
  const uit = langsElkaar(tweede, bezet, { afstandMm: 1.2 })

  const midden = uit[Math.floor(uit.length / 2)]
  assert.ok(Math.abs(midden.y - 60) < 0.05, 'ver van de eerste hoort er niets te schuiven')
})

/** Een lijn met een punt per millimeter, zoals een echte route die ook heeft. */
function lijn (x0, x1, y) {
  const uit = []
  for (let x = x0; x <= x1; x++) uit.push({ x, y })
  return uit
}

test('schuift alleen op het stuk dat samenvalt', () => {
  const bezet = new Bezetting(1)
  // dag 1 loopt van 0 tot 50
  langsElkaar(lijn(0, 50, 10), bezet, { afstandMm: 1.2 })

  // dag 2 loopt van 0 tot 100 over hetzelfde begin
  const uit = langsElkaar(lijn(0, 100, 10), bezet, { afstandMm: 1.2 })

  const opGedeeld = uit.find(p => Math.abs(p.x - 25) < 3)
  const opEigen = uit.find(p => Math.abs(p.x - 90) < 3)

  assert.ok(Math.abs(opGedeeld.y - 10) > 0.5, 'op het gedeelde stuk hoort hij ernaast te liggen')
  assert.ok(Math.abs(opEigen.y - 10) < 0.4, 'op zijn eigen stuk hoort hij gewoon op de weg te liggen')
})

test('gaat vloeiend van verschoven naar niet verschoven', () => {
  const bezet = new Bezetting(1)
  langsElkaar(lijn(0, 50, 10), bezet, { afstandMm: 2 })
  const uit = langsElkaar(lijn(0, 100, 10), bezet, { afstandMm: 2 })

  // nergens mag de lijn ineens een sprong maken
  for (let i = 1; i < uit.length; i++) {
    const sprong = Math.abs(uit[i].y - uit[i - 1].y)
    assert.ok(sprong < 0.6, `sprong van ${sprong.toFixed(2)} mm bij punt ${i}`)
  }
})

test('verschuift haaks op de rijrichting, niet altijd verticaal', () => {
  const bezet = new Bezetting(1)
  const omhoog = [{ x: 10, y: 0 }, { x: 10, y: 100 }]

  langsElkaar(omhoog, bezet, { afstandMm: 1.2 })
  const tweede = langsElkaar(omhoog, bezet, { afstandMm: 1.2 })

  const midden = tweede[Math.floor(tweede.length / 2)]
  assert.ok(Math.abs(Math.abs(midden.x - 10) - 1.2) < 0.3,
    `bij een verticale weg hoort hij zijwaarts te schuiven, kreeg x=${midden.x.toFixed(2)}`)
})
