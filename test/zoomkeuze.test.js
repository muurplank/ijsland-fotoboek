import test from 'node:test'
import assert from 'node:assert/strict'
import { zoomBinnenBudget } from '../src/geo/tiles.js'
import { tilesForBounds } from '../src/geo/tiles.js'

// Dag 3 van de reis: van Kirkjubaejarklaustur tot voorbij Egilsstadir, ruim 400 km breed
const DAG3 = { west: -18.1, south: 63.7, east: -14.2, north: 65.5 }

// Dag 1: rond het vliegveld van Keflavik, nog geen 5 km breed
const DAG1 = { west: -22.65, south: 63.99, east: -22.55, north: 64.02 }

test('kiest het gevraagde zoomniveau als dat binnen het budget past', () => {
  const z = zoomBinnenBudget(DAG1, 12, 1200)
  assert.equal(z, 12, 'een klein gebied hoeft niet teruggeschaald te worden')
})

test('schaalt terug als het gevraagde niveau te veel tegels kost', () => {
  const gevraagd = 12
  const budget = 1200

  assert.ok(tilesForBounds(DAG3, gevraagd).length > budget,
    'deze test heeft alleen zin als het gevraagde niveau echt te duur is')

  const z = zoomBinnenBudget(DAG3, gevraagd, budget)
  assert.ok(z < gevraagd, `verwachtte een lager niveau dan ${gevraagd}, kreeg ${z}`)
  assert.ok(tilesForBounds(DAG3, z).length <= budget,
    `${tilesForBounds(DAG3, z).length} tegels past nog niet in het budget van ${budget}`)
})

test('kiest het hoogste niveau dat nog past, niet zomaar een laag niveau', () => {
  const z = zoomBinnenBudget(DAG3, 12, 1200)
  assert.ok(tilesForBounds(DAG3, z + 1).length > 1200,
    'een niveau hoger had ook nog gepast, dus dit is onnodig grof')
})

test('gaat nooit onder het laagste zinnige niveau', () => {
  const heelDeWereld = { west: -180, south: -85, east: 180, north: 85 }
  const z = zoomBinnenBudget(heelDeWereld, 12, 4)
  assert.ok(z >= 3, `${z} is onbruikbaar grof`)
})
