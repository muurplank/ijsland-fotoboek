import test from 'node:test'
import assert from 'node:assert/strict'
import { osrmUrl, parseOsrmRoute } from '../src/fetch/route.js'

const WAYPOINTS = [
  { name: 'Reykjavík', lat: 64.1466, lon: -21.9426, type: 'start' },
  { name: 'Vík í Mýrdal', lat: 63.4187, lon: -19.0060, type: 'stop' },
  { name: 'Jökulsárlón', lat: 64.0483, lon: -16.1795, type: 'overnight' }
]

test('zet de punten in de juiste volgorde en notatie in de url', () => {
  const url = osrmUrl(WAYPOINTS)
  // OSRM wil lengtegraad voor breedtegraad, punten gescheiden door puntkomma
  assert.ok(url.includes('-21.9426,64.1466;-19.006,63.4187;-16.1795,64.0483'),
    `verkeerde puntvolgorde in url: ${url}`)
  assert.ok(url.includes('geometries=geojson'), 'we willen geojson terug')
  assert.ok(url.includes('overview=full'), 'we willen de volledige route, niet een schets')
})

test('weigert een route met minder dan twee punten', () => {
  assert.throws(() => osrmUrl([WAYPOINTS[0]]), /minstens twee/i)
})

/** Antwoord zoals de echte OSRM-server het gaf voor de rit hierboven. */
const ANTWOORD = {
  code: 'Ok',
  routes: [{
    distance: 380620.5,
    duration: 20139.4,
    geometry: {
      type: 'LineString',
      coordinates: [[-21.9426, 64.1466], [-20.5, 63.8], [-19.006, 63.4187], [-17.5, 63.9], [-16.1795, 64.0483]]
    },
    legs: [
      { distance: 187500.2, duration: 10080.1 },
      { distance: 193120.3, duration: 10059.3 }
    ]
  }]
}

test('leest afstand en rijtijd uit het antwoord', () => {
  const r = parseOsrmRoute(ANTWOORD, WAYPOINTS)
  assert.ok(Math.abs(r.distanceKm - 380.6) < 0.1, `kreeg ${r.distanceKm} km`)
  assert.ok(Math.abs(r.durationHours - 5.594) < 0.01, `kreeg ${r.durationHours} uur`)
})

test('bewaart de routelijn als coordinatenreeks', () => {
  const r = parseOsrmRoute(ANTWOORD, WAYPOINTS)
  assert.equal(r.coordinates.length, 5)
  assert.deepEqual(r.coordinates[0], [-21.9426, 64.1466])
})

test('geeft per etappe terug hoe ver het was, voor de statistieken', () => {
  const r = parseOsrmRoute(ANTWOORD, WAYPOINTS)
  assert.equal(r.legs.length, 2)
  assert.ok(Math.abs(r.legs[0].distanceKm - 187.5) < 0.1)
  assert.equal(r.legs[0].from, 'Reykjavík')
  assert.equal(r.legs[0].to, 'Vík í Mýrdal')
  assert.equal(r.legs[1].to, 'Jökulsárlón')
})

test('meldt het duidelijk als de routeplanner geen route kon vinden', () => {
  assert.throws(
    () => parseOsrmRoute({ code: 'NoRoute', routes: [] }, WAYPOINTS),
    /geen route/i
  )
})

test('meldt het als er wel een antwoord is maar geen routes in zitten', () => {
  assert.throws(() => parseOsrmRoute({ code: 'Ok', routes: [] }, WAYPOINTS), /geen route/i)
})
