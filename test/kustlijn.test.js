import test from 'node:test'
import assert from 'node:assert/strict'
import { kustAfstand, schilderSilhouet } from '../src/render/inset.js'
import { hexNaarRgb } from '../src/render/colorize.js'

const LAND = '#e2ddd4'
const KUST = '#b9b0a3'

/** Een rechthoekig eiland midden in de zee. */
function eiland (breedte, hoogte, x0, y0, b, h) {
  const land = new Uint8Array(breedte * hoogte)
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + b; x++) land[y * breedte + x] = 1
  }
  return land
}

/** De kleur van punt i uit de geschilderde uitkomst. */
function punt (rgba, i) {
  return [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]]
}

const alpha = (rgba, i) => rgba[i * 4 + 3]

test('zee heeft afstand nul', () => {
  const land = eiland(20, 20, 5, 5, 10, 10)
  const d = kustAfstand(land, 20, 20)

  for (let i = 0; i < land.length; i++) {
    if (!land[i]) assert.equal(d[i], 0, `punt ${i} is zee en hoort nul te zijn`)
  }
})

test('de buitenste landrand ligt een stap van de zee', () => {
  const land = eiland(20, 20, 5, 5, 10, 10)
  const d = kustAfstand(land, 20, 20)

  // linkerrand, halverwege: de buur links is zee
  assert.equal(d[10 * 20 + 5], 3)
  // rechterrand, bovenrand, onderrand net zo
  assert.equal(d[10 * 20 + 14], 3)
  assert.equal(d[5 * 20 + 10], 3)
  assert.equal(d[14 * 20 + 10], 3)
})

test('de afstand loopt op naar het binnenland toe', () => {
  const land = eiland(40, 40, 10, 10, 20, 20)
  const d = kustAfstand(land, 40, 40)

  const rij = 20 // ruim van de boven- en onderrand af
  let vorige = 0
  for (let k = 0; k < 9; k++) {
    const nu = d[rij * 40 + 10 + k]
    assert.equal(nu, 3 * (k + 1), `punt ${k} vanaf de kust`)
    assert.ok(nu > vorige, 'de afstand hoort op te lopen richting het midden')
    vorige = nu
  }
})

test('een stap schuin telt zwaarder dan een stap opzij', () => {
  // een veld vol land met een enkel gaatje zee erin
  const land = new Uint8Array(11 * 11).fill(1)
  land[5 * 11 + 5] = 0
  const d = kustAfstand(land, 11, 11)

  assert.equal(d[5 * 11 + 4], 3, 'naast het gat: een stap opzij')
  assert.equal(d[4 * 11 + 4], 4, 'schuin van het gat: duurder dan opzij')
  assert.equal(d[5 * 11 + 5], 0, 'het gat zelf is zee')
})

test('de kustrand wordt precies zo dik als gevraagd', () => {
  const breedte = 20
  const land = eiland(breedte, 20, 5, 5, 10, 10)
  const afstand = kustAfstand(land, breedte, 20)
  const rgba = schilderSilhouet({
    land, afstand, breedte, hoogte: 20, landKleur: LAND, kustKleur: KUST, kustPx: 2
  })

  const rij = 10 * breedte
  assert.deepEqual(punt(rgba, rij + 5), hexNaarRgb(KUST), 'buitenste ring')
  assert.deepEqual(punt(rgba, rij + 6), hexNaarRgb(KUST), 'een naar binnen')
  assert.deepEqual(punt(rgba, rij + 7), hexNaarRgb(LAND), 'derde ring is gewoon land')
})

test('een eilandje dat smaller is dan de rand wordt helemaal kust', () => {
  const land = eiland(9, 9, 3, 3, 3, 3)
  const afstand = kustAfstand(land, 9, 9)
  const rgba = schilderSilhouet({
    land, afstand, breedte: 9, hoogte: 9, landKleur: LAND, kustKleur: KUST, kustPx: 3
  })

  for (let i = 0; i < land.length; i++) {
    if (land[i]) assert.deepEqual(punt(rgba, i), hexNaarRgb(KUST), `punt ${i}`)
  }
})

test('de zee blijft doorzichtig, hoe dik de kustrand ook is', () => {
  const land = eiland(20, 20, 5, 5, 10, 10)
  const afstand = kustAfstand(land, 20, 20)

  for (const kustPx of [0, 2, 8]) {
    const rgba = schilderSilhouet({
      land, afstand, breedte: 20, hoogte: 20, landKleur: LAND, kustKleur: KUST, kustPx
    })
    for (let i = 0; i < land.length; i++) {
      assert.equal(alpha(rgba, i), land[i] ? 255 : 0, `punt ${i} bij dikte ${kustPx}`)
    }
  }
})

test('zonder kustrand komt er precies uit wat er eerst uitkwam', () => {
  const land = eiland(20, 20, 5, 5, 10, 10)
  const afstand = kustAfstand(land, 20, 20)
  const rgba = schilderSilhouet({
    land, afstand, breedte: 20, hoogte: 20, landKleur: LAND, kustKleur: KUST, kustPx: 0
  })

  for (let i = 0; i < land.length; i++) {
    if (land[i]) assert.deepEqual(punt(rgba, i), hexNaarRgb(LAND), `punt ${i}`)
  }
})
