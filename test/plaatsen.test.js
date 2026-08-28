import test from 'node:test'
import assert from 'node:assert/strict'
import {
  afgerondeUitsnede, belangVan, ontdubbel, overpassVraag, uitOverpass
} from '../src/fetch/plaatsen.js'

const UITSNEDE = { west: -22.4590, east: -17.5241, south: 64.3314, north: 66.3879 }

test('rondt de uitsnede naar buiten af, nooit naar binnen', () => {
  const vak = afgerondeUitsnede(UITSNEDE)

  assert.ok(vak.west <= UITSNEDE.west, 'de westrand hoort ruimer te worden')
  assert.ok(vak.east >= UITSNEDE.east, 'de oostrand ook')
  assert.ok(vak.south <= UITSNEDE.south)
  assert.ok(vak.north >= UITSNEDE.north)
})

test('geeft twee bijna gelijke uitsnedes dezelfde vraag', () => {
  // Zo levert een millimeter pannen dezelfde vraag op, en dus het antwoord dat
  // al op schijf staat in plaats van een nieuw verzoek aan Overpass.
  const a = afgerondeUitsnede({ ...UITSNEDE, west: -22.4590 })
  const b = afgerondeUitsnede({ ...UITSNEDE, west: -22.4581 })
  assert.deepEqual(a, b)
})

test('de vraag noemt de uitsnede in de volgorde die Overpass wil', () => {
  const vraag = overpassVraag({ west: -22, east: -17, south: 64, north: 66 })

  assert.match(vraag, /\(64,-22,66,-17\)/, 'zuid, west, noord, oost')
  assert.match(vraag, /place.*city\|town\|village\|hamlet/)
  assert.match(vraag, /\["name"\]/, 'een plaats zonder naam heeft geen zin')
})

test('de soort geeft de grondtoon van het belang', () => {
  assert.ok(belangVan('city') < belangVan('town'))
  assert.ok(belangVan('town') < belangVan('village'))
  assert.ok(belangVan('village') < belangVan('hamlet'))
  assert.ok(belangVan('gehucht-dat-niet-bestaat') > belangVan('hamlet'))
})

test('het inwonertal schuift binnen de soort', () => {
  assert.ok(belangVan('town', 20000) < belangVan('town', 500),
    'een grote stad hoort belangrijker te zijn dan een klein plaatsje van dezelfde soort')

  // Reykjavík hoort bovenaan te staan, een gehucht onderaan de schaal
  assert.ok(belangVan('city', 135000) <= 4)
  assert.ok(belangVan('hamlet', 20) >= 16)
})

test('leest naam, plek en soort uit het antwoord', () => {
  const uit = uitOverpass({
    elements: [
      { lat: 65.68, lon: -18.09, tags: { name: 'Akureyri', place: 'city', population: '20067' } },
      { lat: 65.97, lon: -18.53, tags: { name: 'Dalvík', place: 'town', population: '1385' } }
    ]
  })

  assert.equal(uit.length, 2)
  assert.equal(uit[0].naam, 'Akureyri')
  assert.equal(uit[0].soort, 'city')
  assert.ok(uit[0].belang < uit[1].belang, 'Akureyri hoort belangrijker dan Dalvík')
})

test('slaat over wat geen bruikbare plaats is', () => {
  const uit = uitOverpass({
    elements: [
      { lat: 65, lon: -18, tags: { place: 'town' } },                 // geen naam
      { lat: 65, tags: { name: 'Zonder plek', place: 'town' } },      // geen lengtegraad
      { lat: 65, lon: -18, tags: { name: 'Goed', place: 'village' } }
    ]
  })

  assert.deepEqual(uit.map(p => p.naam), ['Goed'])
})

test('voegt dezelfde plaats uit twee hoeken samen', () => {
  const uit = ontdubbel([
    { naam: 'Dalvík', lat: 65.971, lon: -18.530, soort: 'town', belang: 11 },
    { naam: 'Dalvík', lat: 65.9712, lon: -18.5305, soort: 'town', belang: 9 }
  ])

  assert.equal(uit.length, 1)
  assert.equal(uit[0].belang, 9, 'het laagste belang wint, dus de belangrijkste lezing')
})

test('houdt twee plaatsen die toevallig hetzelfde heten uit elkaar', () => {
  const uit = ontdubbel([
    { naam: 'Reykholt', lat: 64.66, lon: -21.29, soort: 'village', belang: 13 },
    { naam: 'Reykholt', lat: 64.15, lon: -20.38, soort: 'village', belang: 13 }
  ])

  assert.equal(uit.length, 2, 'ze liggen honderd kilometer uit elkaar')
})

test('zet de belangrijkste vooraan', () => {
  const uit = ontdubbel([
    { naam: 'Grenivík', lat: 65.9, lon: -18.1, soort: 'village', belang: 13 },
    { naam: 'Akureyri', lat: 65.6, lon: -18.0, soort: 'city', belang: 4 },
    { naam: 'Dalvík', lat: 65.9, lon: -18.5, soort: 'town', belang: 10 }
  ])

  assert.deepEqual(uit.map(p => p.naam), ['Akureyri', 'Dalvík', 'Grenivík'])
})
