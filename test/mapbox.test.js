import test from 'node:test'
import assert from 'node:assert/strict'
import { mapboxUrl, MAPBOX_STIJLEN, controleerToken } from '../src/fetch/mapbox.js'

const TOKEN = 'pk.testtoken'

test('bouwt een tegel-url volgens het standaard tegelraster', () => {
  const url = mapboxUrl({ stijl: 'outdoors', z: 11, x: 449, y: 272, token: TOKEN })

  assert.ok(url.includes('/styles/v1/mapbox/outdoors-v12/tiles/'), `verkeerde stijl: ${url}`)
  assert.ok(url.includes('/11/449/272'), `verkeerde tegelpositie: ${url}`)
  assert.ok(url.includes(`access_token=${TOKEN}`), 'token ontbreekt')
})

test('vraagt tegels van 256 op het raster dat wij al gebruiken', () => {
  // Wij rekenen overal met het standaard 256-raster. Mapbox kan ook 512-tegels
  // leveren, maar die zitten op een raster met een andere zoomtelling; dan zou
  // de achtergrond een niveau verschoven onder de route liggen.
  const url = mapboxUrl({ stijl: 'outdoors', z: 11, x: 449, y: 272, token: TOKEN })
  assert.ok(url.includes('/tiles/256/'), `verkeerde tegelgrootte: ${url}`)
})

test('vraagt dubbele resolutie aan als daarom gevraagd wordt', () => {
  const gewoon = mapboxUrl({ stijl: 'outdoors', z: 11, x: 449, y: 272, token: TOKEN })
  const dubbel = mapboxUrl({ stijl: 'outdoors', z: 11, x: 449, y: 272, token: TOKEN, retina: true })

  assert.ok(!gewoon.includes('@2x'))
  assert.ok(dubbel.includes('@2x'), `dubbele resolutie ontbreekt: ${dubbel}`)
  assert.ok(dubbel.includes('/11/449/272@2x?'), `@2x staat op de verkeerde plek: ${dubbel}`)
})

test('kent de vier stijlen die we aanbieden', () => {
  for (const naam of ['outdoors', 'satelliet-straten', 'licht', 'straten']) {
    assert.ok(MAPBOX_STIJLEN[naam], `stijl ${naam} ontbreekt`)
    assert.match(MAPBOX_STIJLEN[naam].id, /^[a-z-]+-v\d+$/, `${naam} heeft een rare stijl-id`)
  }
})

test('weigert een onbekende stijl in plaats van een kapotte url te maken', () => {
  assert.throws(
    () => mapboxUrl({ stijl: 'bestaatniet', z: 1, x: 1, y: 1, token: TOKEN }),
    /onbekende mapbox-stijl/i
  )
})

test('legt uit wat je moet doen als de token ontbreekt', () => {
  assert.throws(() => controleerToken(null), /mapbox.com/i)
  assert.throws(() => controleerToken(''), /token/i)
})

test('waarschuwt als je per ongeluk een geheime token gebruikt', () => {
  // sk-tokens horen niet in een project dat je deelt; pk-tokens zijn publiek bedoeld
  assert.throws(() => controleerToken('sk.eyJhbGci'), /publieke token/i)
})

test('laat een geldige publieke token door', () => {
  assert.equal(controleerToken('pk.eyJhbGciOiJIUzI1NiJ9'), 'pk.eyJhbGciOiJIUzI1NiJ9')
})
