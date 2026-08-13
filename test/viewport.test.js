import test from 'node:test'
import assert from 'node:assert/strict'
import { boundsOf, expandBounds, MapView } from '../src/geo/viewport.js'

const VIK = [-19.0060, 63.4187]
const REYKJAVIK = [-21.9426, 64.1466]
const JOKULSARLON = [-16.1795, 64.0483]

test('bepaalt het omhullende vak van een reeks punten', () => {
  const b = boundsOf([REYKJAVIK, VIK, JOKULSARLON])
  assert.equal(b.west, -21.9426)
  assert.equal(b.east, -16.1795)
  assert.equal(b.south, 63.4187)
  assert.equal(b.north, 64.1466)
})

test('geeft een vak met inhoud terug voor een enkel punt', () => {
  const b = boundsOf([VIK])
  assert.ok(b.east > b.west, 'een punt mag geen vak van nul breed opleveren')
  assert.ok(b.north > b.south)
})

test('vergroot een vak met een marge in procenten', () => {
  const b = expandBounds({ west: -20, south: 63, east: -19, north: 64 }, 0.1)
  assert.ok(Math.abs(b.west - -20.1) < 1e-9)
  assert.ok(Math.abs(b.east - -18.9) < 1e-9)
  assert.ok(Math.abs(b.south - 62.9) < 1e-9)
  assert.ok(Math.abs(b.north - 64.1) < 1e-9)
})

test('legt het midden van de route op het midden van het kaartvlak', () => {
  const view = MapView.fit([REYKJAVIK, JOKULSARLON], { widthMm: 200, heightMm: 200, paddingMm: 10 })
  const midden = view.project(
    (REYKJAVIK[0] + JOKULSARLON[0]) / 2,
    (REYKJAVIK[1] + JOKULSARLON[1]) / 2
  )
  // in Mercator ligt het midden in hoogte niet exact op het gemiddelde van de
  // breedtegraden, dus horizontaal streng en verticaal wat ruimer
  assert.ok(Math.abs(midden.x - 100) < 0.5, `horizontaal midden liep weg: ${midden.x}`)
  assert.ok(Math.abs(midden.y - 100) < 3, `verticaal midden liep weg: ${midden.y}`)
})

test('laat de route precies binnen de marge vallen', () => {
  const punten = [REYKJAVIK, VIK, JOKULSARLON]
  const view = MapView.fit(punten, { widthMm: 200, heightMm: 150, paddingMm: 12 })

  for (const [lon, lat] of punten) {
    const p = view.project(lon, lat)
    assert.ok(p.x >= 12 - 0.01 && p.x <= 188 + 0.01, `punt valt buiten de marge: x=${p.x}`)
    assert.ok(p.y >= 12 - 0.01 && p.y <= 138 + 0.01, `punt valt buiten de marge: y=${p.y}`)
  }

  // en het moet ook echt passend zijn: in de ruimste richting raakt hij de marge
  const xs = punten.map(([lon, lat]) => view.project(lon, lat).x)
  const ys = punten.map(([lon, lat]) => view.project(lon, lat).y)
  const raaktBreedte = Math.abs(Math.min(...xs) - 12) < 0.01 && Math.abs(Math.max(...xs) - 188) < 0.01
  const raaktHoogte = Math.abs(Math.min(...ys) - 12) < 0.01 && Math.abs(Math.max(...ys) - 138) < 0.01
  assert.ok(raaktBreedte || raaktHoogte, 'de route hoort in een van beide richtingen de marge te raken')
})

test('houdt de vorm van het land intact in plaats van uit te rekken', () => {
  // Een vierkant vak in Mercator hoort een vierkant op papier te worden, ook als
  // het kaartvlak zelf niet vierkant is. Anders wordt IJsland platgedrukt.
  const view = MapView.fit([REYKJAVIK, VIK], { widthMm: 300, heightMm: 100, paddingMm: 0 })
  assert.ok(Math.abs(view.scaleX - view.scaleY) < 1e-9,
    'horizontale en verticale schaal moeten gelijk zijn')
})

test('zoomt in op het midden zonder het beeld te verschuiven', () => {
  const opties = { widthMm: 200, heightMm: 200, paddingMm: 10 }
  const normaal = MapView.fit([REYKJAVIK, JOKULSARLON], opties)
  const ingezoomd = MapView.fit([REYKJAVIK, JOKULSARLON], { ...opties, zoom: 2 })

  const midden = [(REYKJAVIK[0] + JOKULSARLON[0]) / 2, (REYKJAVIK[1] + JOKULSARLON[1]) / 2]
  const a = normaal.project(...midden)
  const b = ingezoomd.project(...midden)
  assert.ok(Math.abs(a.x - b.x) < 0.01, 'het middelpunt hoort te blijven staan bij inzoomen')
  assert.ok(Math.abs(a.y - b.y) < 0.01)

  // en de schaal moet verdubbeld zijn
  assert.ok(Math.abs(ingezoomd.scaleX / normaal.scaleX - 2) < 1e-9)
})

test('verschuift het beeld met de pan-instelling', () => {
  const opties = { widthMm: 200, heightMm: 200, paddingMm: 10 }
  const normaal = MapView.fit([REYKJAVIK, JOKULSARLON], opties)
  const verschoven = MapView.fit([REYKJAVIK, JOKULSARLON], { ...opties, panXMm: 15, panYMm: -8 })

  const a = normaal.project(...VIK)
  const b = verschoven.project(...VIK)
  assert.ok(Math.abs(b.x - a.x - 15) < 0.01, `verwachtte 15 mm naar rechts, kreeg ${b.x - a.x}`)
  assert.ok(Math.abs(b.y - a.y - -8) < 0.01)
})

test('rekent een punt op de kaart terug naar coordinaten', () => {
  const view = MapView.fit([REYKJAVIK, JOKULSARLON], { widthMm: 200, heightMm: 200, paddingMm: 10 })
  const p = view.project(...VIK)
  const terug = view.unproject(p.x, p.y)
  assert.ok(Math.abs(terug.lon - VIK[0]) < 1e-6, `lengtegraad liep weg: ${terug.lon}`)
  assert.ok(Math.abs(terug.lat - VIK[1]) < 1e-6, `breedtegraad liep weg: ${terug.lat}`)
})

test('vertelt welk gebied er in beeld staat, zodat we alleen die tegels ophalen', () => {
  const view = MapView.fit([REYKJAVIK, JOKULSARLON], { widthMm: 200, heightMm: 200, paddingMm: 10 })
  const zicht = view.visibleBounds()

  // alle routepunten horen binnen het zichtbare gebied te vallen
  for (const [lon, lat] of [REYKJAVIK, VIK, JOKULSARLON]) {
    assert.ok(lon >= zicht.west && lon <= zicht.east, `${lon} valt buiten beeld`)
    assert.ok(lat >= zicht.south && lat <= zicht.north, `${lat} valt buiten beeld`)
  }
  assert.ok(zicht.east > zicht.west && zicht.north > zicht.south)
})

test('weet hoeveel meter er in een millimeter papier gaat', () => {
  const view = MapView.fit([REYKJAVIK, JOKULSARLON], { widthMm: 200, heightMm: 200, paddingMm: 10 })
  const mpm = view.metersPerMm()

  // Reykjavik tot Jokulsarlon is hemelsbreed ongeveer 280 km, verdeeld over
  // hooguit 180 mm papier: dat is grofweg anderhalve kilometer per millimeter
  assert.ok(mpm > 800 && mpm < 3000, `verwachtte ~1500 m/mm, kreeg ${mpm.toFixed(0)}`)
})
