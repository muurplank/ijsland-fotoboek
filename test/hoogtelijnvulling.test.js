import test from 'node:test'
import assert from 'node:assert/strict'
import { zaadje } from '../src/render/papier.js'
import { hoogtelijnKnopen } from '../src/render/hoogtelijnvulling.js'

const VAK = { breedteMm: 180, hoogteMm: 7, kleur: '#9c5a3c' }
const vulling = (extra = {}) =>
  hoogtelijnKnopen({ ...VAK, rnd: zaadje(extra.zaad ?? 3), ...extra })

/** Alle punten uit een pad, als coördinaten. */
function punten (knoop) {
  return [...knoop.attr.d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)]
    .map(m => ({ x: Number(m[1]), y: Number(m[2]) }))
}

test('hetzelfde zaad geeft exact dezelfde vulling', () => {
  // anders danst de balk weg zodra je aan een andere knop draait
  assert.deepEqual(vulling(), vulling())
})

test('een ander zaad geeft een andere vulling', () => {
  assert.notDeepEqual(vulling({ zaad: 3 }), vulling({ zaad: 4 }))
})

test('er komen echt hoogtelijnen uit', () => {
  const knopen = vulling()
  assert.ok(knopen.length > 5, `maar ${knopen.length} lijnen`)
  assert.ok(knopen.every(k => k.tag === 'path'))
  assert.ok(knopen.every(k => k.attr.fill === 'none'))
})

test('de lijnen blijven binnen het vak', () => {
  // ze worden weliswaar afgeknipt op het kader, maar inkt buiten het vak
  // betekent dat de vulling van iets anders is dan waar hij ligt
  for (const knoop of vulling()) {
    for (const p of punten(knoop)) {
      assert.ok(p.x >= -0.01 && p.x <= 180.01, `x = ${p.x}`)
      assert.ok(p.y >= -0.01 && p.y <= 7.01, `y = ${p.y}`)
    }
  }
})

test('het vak staat waar je het neerzet', () => {
  for (const knoop of vulling({ x: 20, y: 100 })) {
    for (const p of punten(knoop)) {
      assert.ok(p.x >= 19.99 && p.x <= 200.01, `x = ${p.x}`)
      assert.ok(p.y >= 99.99 && p.y <= 107.01, `y = ${p.y}`)
    }
  }
})

test('meer lijnen gevraagd is meer inkt', () => {
  const weinig = vulling({ lijnen: 4 })
  const veel = vulling({ lijnen: 14 })
  assert.ok(veel.length > weinig.length)
})

test('de lijnen zijn haarlijnen en houden de kleur die je vraagt', () => {
  for (const knoop of vulling({ lijnMm: 0.2, dekking: 0.7 })) {
    assert.equal(knoop.attr.stroke, '#9c5a3c')
    assert.equal(Number(knoop.attr['stroke-width']), 0.2)
    assert.equal(Number(knoop.attr['stroke-opacity']), 0.7)
  }
})

test('een vak zonder maat geeft niets terug in plaats van een fout', () => {
  assert.deepEqual(hoogtelijnKnopen({ ...VAK, breedteMm: 0, rnd: zaadje(1) }), [])
  assert.deepEqual(hoogtelijnKnopen({ ...VAK, hoogteMm: 0, rnd: zaadje(1) }), [])
})

test('een klein vierkant vakje werkt ook', () => {
  const knopen = hoogtelijnKnopen({ breedteMm: 8, hoogteMm: 8, kleur: '#000', rnd: zaadje(2) })
  assert.ok(knopen.length > 0)
})

test('de lijnen zijn lijnen en geen losse streepjes', () => {
  // marching squares geeft per cel een streepje; die moeten aan elkaar geregen
  // worden, anders staan er duizenden paadjes met ronde kopjes in de PDF
  const langste = Math.max(...vulling().map(k => punten(k).length))
  assert.ok(langste > 20, `langste lijn is maar ${langste} punten`)
})
