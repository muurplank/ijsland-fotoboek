import test from 'node:test'
import assert from 'node:assert/strict'
import {
  distance, cumulative, totalDistance, pointAtDistance, pointsEvery, climb
} from '../src/geo/measure.js'

// Coordinaten zijn overal [lengtegraad, breedtegraad], net als in GeoJSON.

test('meet nul meter tussen een punt en zichzelf', () => {
  assert.equal(distance([-21.94, 64.15], [-21.94, 64.15]), 0)
})

test('meet een graad breedte als ongeveer 111,2 km', () => {
  const m = distance([0, 0], [0, 1])
  assert.ok(Math.abs(m - 111195) < 5, `verwachtte ~111195 m, kreeg ${m}`)
})

test('meet een graad lengte op 64 graden noorderbreedte korter dan op de evenaar', () => {
  const opEvenaar = distance([0, 0], [1, 0])
  const opIJsland = distance([0, 64], [1, 64])
  // een lengtegraad krimpt met de cosinus van de breedte: cos(64) = 0,438
  assert.ok(Math.abs(opIJsland - opEvenaar * Math.cos(64 * Math.PI / 180)) < 20)
})

test('meet een echte IJslandse afstand: Reykjavik naar Vik hemelsbreed', () => {
  const m = distance([-21.9426, 64.1466], [-19.0060, 63.4187])

  // Met de hand nagerekend: 0,728 graad breedte = 81,0 km, en 2,937 graad lengte
  // op gemiddeld 63,8 graden noorderbreedte = 144,5 km. Samen wortel(81^2 + 144,5^2)
  // = 165,6 km hemelsbreed.
  assert.ok(Math.abs(m - 165600) < 2000, `verwachtte ~165,6 km, kreeg ${(m / 1000).toFixed(1)} km`)

  // En de tegenproef: over de weg mat OSRM 187,5 km. Hemelsbreed hoort altijd
  // korter te zijn dan over de weg - anders klopt er iets niet aan de meting.
  assert.ok(m < 187500, 'hemelsbrede afstand moet korter zijn dan de route over de weg')
})

test('telt de afstanden langs een lijn op tot een oplopende reeks', () => {
  const lijn = [[0, 0], [0, 1], [0, 2]]
  const c = cumulative(lijn)
  assert.equal(c.length, 3)
  assert.equal(c[0], 0)
  assert.ok(Math.abs(c[2] - 2 * c[1]) < 1, 'twee gelijke stappen horen te verdubbelen')
  assert.equal(totalDistance(lijn), c[2])
})

test('vindt het punt halverwege een rechte lijn', () => {
  const lijn = [[0, 0], [0, 2]]
  const halverwege = pointAtDistance(lijn, totalDistance(lijn) / 2)
  assert.ok(Math.abs(halverwege.lat - 1) < 0.01, `verwachtte breedte 1, kreeg ${halverwege.lat}`)
  assert.ok(Math.abs(halverwege.lon) < 0.001)
})

test('geeft de rijrichting in graden vanaf het noorden', () => {
  const naarNoorden = pointAtDistance([[0, 0], [0, 2]], 1000)
  assert.ok(Math.abs(naarNoorden.heading - 0) < 1, `noord = 0 graden, kreeg ${naarNoorden.heading}`)

  const naarOosten = pointAtDistance([[0, 0], [2, 0]], 1000)
  assert.ok(Math.abs(naarOosten.heading - 90) < 1, `oost = 90 graden, kreeg ${naarOosten.heading}`)
})

test('blijft binnen de lijn als er verder gevraagd wordt dan de lijn lang is', () => {
  const lijn = [[0, 0], [0, 1]]
  const eind = pointAtDistance(lijn, 999999999)
  assert.ok(Math.abs(eind.lat - 1) < 0.001, 'moet op het eindpunt blijven staan')
})

test('verdeelt pijltjes met vaste tussenafstand over de route', () => {
  const lijn = [[0, 0], [0, 1]] // ongeveer 111 km
  const pijltjes = pointsEvery(lijn, 10000) // elke 10 km

  assert.ok(pijltjes.length >= 10 && pijltjes.length <= 12,
    `verwachtte ~11 pijltjes op 111 km, kreeg ${pijltjes.length}`)

  // ze horen netjes oplopend te staan, niet op een hoop
  for (let i = 1; i < pijltjes.length; i++) {
    assert.ok(pijltjes[i].lat > pijltjes[i - 1].lat, 'pijltjes moeten oplopen langs de route')
  }
  // en allemaal een richting hebben om naar te draaien
  assert.ok(pijltjes.every(p => typeof p.heading === 'number'))
})

test('zet geen pijltjes op een route die korter is dan de tussenafstand', () => {
  assert.equal(pointsEvery([[0, 0], [0, 0.01]], 100000).length, 0)
})

test('telt alleen de stijging op, niet de daling', () => {
  // omhoog 100, omlaag 60, omhoog 40 = 140 meter stijging
  assert.equal(climb([0, 100, 40, 80]), 140)
  assert.equal(climb([500, 400, 300]), 0, 'alleen dalen is nul stijging')
  assert.equal(climb([]), 0)
})

test('negeert kleine hoogtetrillingen bij het optellen van de stijging', () => {
  // een vlakke weg met meetruis van een halve meter mag geen stijging opleveren
  const ruis = [10, 10.4, 9.7, 10.2, 9.8, 10.1]
  assert.equal(climb(ruis), 0, 'meetruis mag niet als klim tellen')
})
