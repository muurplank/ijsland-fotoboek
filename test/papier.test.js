import test from 'node:test'
import assert from 'node:assert/strict'
import { standaardStijl } from '../src/style.js'
import { papierKnopen, zaadje } from '../src/render/papier.js'

const STIJL = standaardStijl()
const VEL = { breedteMm: 306, hoogteMm: 306, stijl: STIJL, zaad: 3 }

/** Alle knopen plat, ook die in een groep of in de defs zitten. */
function plat (knopen) {
  return knopen.flatMap(k => [k, ...plat(k.kind ?? [])])
}

test('dezelfde dag geeft exact hetzelfde vel', () => {
  // anders danst het papier weg zodra je aan een andere knop draait, en wijkt
  // de export af van wat je op het scherm goedkeurde
  assert.deepEqual(papierKnopen(VEL), papierKnopen(VEL))
})

test('een andere dag geeft een ander vel', () => {
  assert.notDeepEqual(papierKnopen(VEL), papierKnopen({ ...VEL, zaad: 4 }))
})

test('de vezels blijven binnen het vel', () => {
  const marge = STIJL['papier.vezelMm'] + 1
  for (const k of plat(papierKnopen(VEL))) {
    if (k.tag !== 'line') continue
    for (const [as, grens] of [['x', 306], ['y', 306]]) {
      for (const punt of ['1', '2']) {
        const v = Number(k.attr[`${as}${punt}`])
        assert.ok(v >= -marge && v <= grens + marge, `${as}${punt} = ${v}`)
      }
    }
  }
})

test('de vezels blijven haarlijnen', () => {
  const lijnen = plat(papierKnopen(VEL)).filter(k => k.tag === 'line' && k.attr['stroke-linecap'])
  assert.ok(lijnen.length > 100, `maar ${lijnen.length} vezels`)
  for (const l of lijnen) {
    assert.ok(Number(l.attr['stroke-width']) <= 0.16)
    assert.ok(Number(l.attr['stroke-opacity']) <= 0.13)
  }
})

test('geen vezels als je ze uitzet', () => {
  const kaal = papierKnopen({ ...VEL, stijl: { ...STIJL, 'papier.vezels': 0 } })
  assert.equal(plat(kaal).filter(k => k.tag === 'line' && k.attr['stroke-linecap']).length, 0)
})

test('het grondvlak dekt de hele pagina', () => {
  const vlak = papierKnopen(VEL).find(k => k.tag === 'rect' && k.attr.fill === STIJL['papier.kleur'])
  assert.equal(Number(vlak.attr.width), 306)
  assert.equal(Number(vlak.attr.height), 306)
})

test('zonder grondvlak blijft er alleen textuur over', () => {
  // zo gaat het over de kaart heen: de kaart moet eronder zichtbaar blijven
  const over = papierKnopen({ ...VEL, grondvlak: false })
  assert.equal(over.filter(k => k.tag === 'rect' && k.attr.fill === STIJL['papier.kleur']).length, 0)
})

test('elke verwijzing naar een verloop bestaat ook echt', () => {
  const knopen = papierKnopen(VEL)
  const namen = new Set(plat(knopen).map(k => k.attr?.id).filter(Boolean))

  for (const k of plat(knopen)) {
    const verwijzing = /^url\(#(.+)\)$/.exec(k.attr?.fill ?? '')
    if (verwijzing) assert.ok(namen.has(verwijzing[1]), `${verwijzing[1]} bestaat niet`)
  }
})

test('twee pagina´s op één blad botsen niet met hun defs', () => {
  const a = plat(papierKnopen({ ...VEL, id: 'stats' })).map(k => k.attr?.id).filter(Boolean)
  const b = plat(papierKnopen({ ...VEL, id: 'kaart' })).map(k => k.attr?.id).filter(Boolean)
  assert.equal(a.filter(id => b.includes(id)).length, 0)
})

test('de korrel staat standaard uit', () => {
  assert.equal(plat(papierKnopen(VEL)).filter(k => k.tag === 'filter').length, 0)
})

test('de korrel komt erbij als je hem aanzet', () => {
  const met = papierKnopen({ ...VEL, stijl: { ...STIJL, 'papier.korrelAan': true } })
  assert.equal(plat(met).filter(k => k.tag === 'feTurbulence').length, 1)
})

test('het zaadje geeft dezelfde reeks bij hetzelfde zaad', () => {
  const a = Array.from({ length: 20 }, zaadje(7))
  const b = Array.from({ length: 20 }, zaadje(7))
  assert.deepEqual(a, b)
  assert.ok(a.every(v => v >= 0 && v < 1))
})

test('het zaadje spreidt zich een beetje netjes', () => {
  const rnd = zaadje(11)
  const trekken = Array.from({ length: 4000 }, rnd)
  const gemiddeld = trekken.reduce((s, v) => s + v, 0) / trekken.length
  assert.ok(Math.abs(gemiddeld - 0.5) < 0.03, `gemiddelde ${gemiddeld}`)
})
