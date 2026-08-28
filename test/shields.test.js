import test from 'node:test'
import assert from 'node:assert/strict'
import { vindWitteVlakken, verwijderSchilden } from '../src/render/shields.js'

/** Maakt een egaal beeld met een achtergrondkleur. */
function beeld (w, h, kleur = 120) {
  return { data: Buffer.alloc(w * h * 3, kleur), width: w, height: h }
}

/** Tekent een wit blok. */
function blok (b, x0, y0, breedte, hoogte, waarde = 250) {
  for (let y = y0; y < y0 + hoogte; y++) {
    for (let x = x0; x < x0 + breedte; x++) {
      const i = (y * b.width + x) * 3
      b.data[i] = b.data[i + 1] = b.data[i + 2] = waarde
    }
  }
}

const pixel = (b, x, y) => b.data[(y * b.width + x) * 3]

test('vindt een wit blok in een egale achtergrond', () => {
  const b = beeld(100, 100)
  blok(b, 20, 30, 24, 16)

  const gevonden = vindWitteVlakken(b, { drempel: 235 })
  assert.equal(gevonden.length, 1)
  assert.equal(gevonden[0].x0, 20)
  assert.equal(gevonden[0].y0, 30)
  assert.equal(gevonden[0].breedte, 24)
  assert.equal(gevonden[0].hoogte, 16)
})

test('vindt meerdere blokken los van elkaar', () => {
  const b = beeld(120, 120)
  blok(b, 10, 10, 20, 14)
  blok(b, 70, 60, 22, 15)
  assert.equal(vindWitteVlakken(b, { drempel: 235 }).length, 2)
})

test('ziet een bijna-witte achtergrond niet als vlak', () => {
  const b = beeld(60, 60, 240)
  // alles is wit; dan is er geen los vlak, maar een veel te groot gebied
  const gevonden = vindWitteVlakken(b, { drempel: 235, maxOppervlak: 500 })
  assert.equal(gevonden.length, 0, 'een vlak zo groot als het beeld is geen badge')
})

test('negeert vlakken die te klein of te groot zijn voor een wegnummer', () => {
  const b = beeld(200, 200)
  blok(b, 10, 10, 3, 3)      // te klein: een stipje
  blok(b, 60, 60, 120, 110)  // te groot: een gletsjer
  blok(b, 20, 150, 26, 17)   // precies goed

  const gevonden = vindWitteVlakken(b, {
    drempel: 235, minOppervlak: 100, maxOppervlak: 4000
  })
  assert.equal(gevonden.length, 1)
  assert.equal(gevonden[0].y0, 150)
})

test('negeert lange dunne vlakken, want die zijn geen badge', () => {
  const b = beeld(200, 200)
  blok(b, 10, 10, 150, 4) // een witte streep, bijvoorbeeld een weg
  const gevonden = vindWitteVlakken(b, {
    drempel: 235, minOppervlak: 100, maxOppervlak: 4000, maxVerhouding: 3
  })
  assert.equal(gevonden.length, 0)
})

test('haalt alleen de badges weg die op de route liggen', () => {
  const b = beeld(200, 100)
  blok(b, 20, 40, 26, 17)   // op de route
  blok(b, 150, 10, 26, 17)  // ver van de route

  // route loopt horizontaal op y = 48
  const route = [{ x: 0, y: 48 }, { x: 200, y: 48 }]

  const aantal = verwijderSchilden(b, route, { lijnDikte: 6, drempel: 235 })

  assert.equal(aantal, 1, 'alleen de badge op de route hoort weg te gaan')
  assert.ok(pixel(b, 30, 45) < 200, 'de badge op de route is weggepoetst')
  assert.equal(pixel(b, 160, 18), 250, 'de badge ver weg staat er nog')
})

test('vult de weggehaalde badge met de kleur van de omgeving', () => {
  const b = beeld(200, 100, 90)
  blok(b, 20, 40, 26, 17)
  const route = [{ x: 0, y: 48 }, { x: 200, y: 48 }]

  verwijderSchilden(b, route, { lijnDikte: 6, drempel: 235 })

  // het gat moet de omgevingskleur benaderen, niet zwart of wit worden
  for (const [x, y] of [[25, 45], [32, 48], [40, 52]]) {
    const v = pixel(b, x, y)
    assert.ok(Math.abs(v - 90) < 25, `op ${x},${y} kwam ${v} uit in plaats van ongeveer 90`)
  }
})

test('doet niets als er geen route langs komt', () => {
  const b = beeld(200, 100)
  blok(b, 20, 40, 26, 17)
  assert.equal(verwijderSchilden(b, [], { lijnDikte: 6 }), 0)
  assert.equal(pixel(b, 30, 45), 250, 'zonder route blijft alles staan')
})

test('volgt een schuine route bij het bepalen wat eronder ligt', () => {
  const b = beeld(200, 200)
  blok(b, 100, 100, 24, 16)             // ligt op de diagonaal
  blok(b, 20, 160, 24, 16)              // ligt er niet op

  const route = [{ x: 0, y: 0 }, { x: 200, y: 200 }]
  assert.equal(verwijderSchilden(b, route, { lijnDikte: 8, drempel: 235 }), 1)
  assert.equal(pixel(b, 25, 165), 250, 'het vlak naast de route blijft')
})

test('leest ook een raster met een alfakanaal goed uit', () => {
  // De kaarttegels komen als rgba binnen. Rekende de detectie op drie kanalen,
  // dan las hij de pixels verschoven uit en vond hij niets.
  const w = 100; const h = 60
  const b = { data: Buffer.alloc(w * h * 4), width: w, height: h, kanalen: 4 }
  for (let i = 0; i < w * h; i++) {
    b.data[i * 4] = b.data[i * 4 + 1] = b.data[i * 4 + 2] = 120
    b.data[i * 4 + 3] = 255
  }
  for (let y = 20; y < 36; y++) {
    for (let x = 30; x < 56; x++) {
      const p = (y * w + x) * 4
      b.data[p] = b.data[p + 1] = b.data[p + 2] = 250
    }
  }

  const gevonden = vindWitteVlakken(b, { drempel: 235 })
  assert.equal(gevonden.length, 1, 'met vier kanalen hoort hij hetzelfde blok te vinden')
  assert.equal(gevonden[0].breedte, 26)
  assert.equal(gevonden[0].hoogte, 16)
})

// ---------------------------------------------------------------- tekstlabels

import { vindTekstVlakken, tilTekstOp, wisTekst } from '../src/render/shields.js'

/** Bootst een plaatsnaam na: donkere letters met een witte rand eromheen. */
function tekst (b, x0, y0, letters = 5) {
  for (let l = 0; l < letters; l++) {
    const lx = x0 + l * 12
    // witte rand
    for (let y = y0 - 2; y < y0 + 16; y++) {
      for (let x = lx - 2; x < lx + 10; x++) {
        const i = (y * b.width + x) * 3
        b.data[i] = b.data[i + 1] = b.data[i + 2] = 252
      }
    }
    // donkere letter
    for (let y = y0; y < y0 + 14; y++) {
      for (let x = lx + 2; x < lx + 6; x++) {
        const i = (y * b.width + x) * 3
        b.data[i] = b.data[i + 1] = b.data[i + 2] = 45
      }
    }
  }
}

test('herkent een plaatsnaam aan donkere letters met een lichte rand', () => {
  const b = beeld(300, 120, 150)
  tekst(b, 40, 50)

  const gevonden = vindTekstVlakken(b, {})
  assert.equal(gevonden.length, 1, `verwachtte een tekstvlak, kreeg ${gevonden.length}`)
  assert.ok(gevonden[0].breedte > 40, `te smal gevonden: ${gevonden[0].breedte}`)
})

test('ziet vlak terrein niet aan voor tekst', () => {
  const b = beeld(300, 120, 150)
  blok(b, 40, 40, 60, 40)   // een egaal wit vlak, geen tekst
  assert.equal(vindTekstVlakken(b, {}).length, 0)
})

test('ziet een egale donkere vlek niet aan voor tekst', () => {
  const b = beeld(300, 120, 150)
  blok(b, 40, 40, 60, 40, 30)
  assert.equal(vindTekstVlakken(b, {}).length, 0)
})

test('tilt alleen de tekst op die de route raakt', () => {
  const b = beeld(400, 200, 150)
  tekst(b, 40, 90)     // op de route
  tekst(b, 250, 20)    // ver weg

  const route = [{ x: 0, y: 100 }, { x: 400, y: 100 }]
  const { aantal, laag } = tilTekstOp(b, route, { lijnDikte: 8 })

  assert.equal(aantal, 1, 'alleen de tekst op de route hoort opgetild te worden')
  assert.ok(laag, 'er hoort een losse laag terug te komen')

  // in de opgetilde laag staat de tekst wel, en de rest is doorzichtig
  const bijTekst = (95 * 400 + 60) * 4
  const verWeg = (25 * 400 + 260) * 4
  assert.equal(laag[bijTekst + 3], 255, 'de tekst op de route zit in de laag')
  assert.equal(laag[verWeg + 3], 0, 'de tekst elders zit er niet in')
})

test('laat de achtergrond ongemoeid bij optillen', () => {
  const b = beeld(400, 200, 150)
  tekst(b, 40, 90)
  const voor = Buffer.from(b.data)

  tilTekstOp(b, [{ x: 0, y: 100 }, { x: 400, y: 100 }], { lijnDikte: 8 })
  assert.ok(b.data.equals(voor), 'optillen kopieert, het wist niets')
})

test('tilt alleen de letters op, niet het hele rechthoek eromheen', () => {
  const b = beeld(400, 200, 150)
  tekst(b, 60, 90)

  const route = [{ x: 0, y: 100 }, { x: 400, y: 100 }]
  const { laag } = tilTekstOp(b, route, { lijnDikte: 8 })

  // midden op een letter: hoort mee omhoog
  const opLetter = (97 * 400 + 63) * 4
  assert.equal(laag[opLetter + 3], 255, 'de letter zelf hoort in de laag te zitten')

  // ver boven de tekst, binnen hetzelfde rechthoek: hoort doorzichtig te blijven,
  // anders valt er een blok uit je routelijn
  const bovenTekst = (60 * 400 + 63) * 4
  assert.equal(laag[bovenTekst + 3], 0,
    'ruimte boven de tekst hoort niet mee opgetild te worden')
})

/* ========================================================================
 * Kaarttekst wegpoetsen
 * ===================================================================== */

/** Een wegnummer-schildje: een gevuld wit blok met een paar cijferstreepjes. */
function schildje (b, x0, y0, breedte = 40, hoogte = 26) {
  blok(b, x0, y0, breedte, hoogte, 250)
  for (let n = 0; n < 3; n++) blok(b, x0 + 8 + n * 9, y0 + 6, 4, 14, 40)
}

/** Een grillige donkere slinger met licht ernaast, zoals een kustlijn. */
function kustlijn (b, van, tot) {
  for (let s = van; s <= tot; s++) {
    for (let d = 0; d < 3; d++) {
      const i = ((s + d) * b.width + s) * 3
      b.data[i] = b.data[i + 1] = b.data[i + 2] = 45
      const j = ((s + d + 5) * b.width + s) * 3
      b.data[j] = b.data[j + 1] = b.data[j + 2] = 250
    }
  }
}

test('poetst een plaatsnaam uit de kaart', () => {
  const b = beeld(300, 200, 150)
  tekst(b, 60, 90)

  // midden op de derde letter, voor en na
  const opLetter = [88, 97]
  assert.equal(pixel(b, ...opLetter), 45, 'de letter hoort er eerst te staan')

  const { aantal } = wisTekst(b)
  assert.equal(aantal, 1, 'één naam gevonden')
  assert.ok(pixel(b, ...opLetter) > 120, 'de letter hoort weg te zijn')
})

test('laat het landschap buiten de naam met rust', () => {
  const b = beeld(300, 200, 150)
  tekst(b, 60, 90)
  blok(b, 220, 30, 40, 40, 90)   // een donkere plek ver van de tekst

  wisTekst(b)
  assert.equal(pixel(b, 240, 50), 90, 'de plek ver weg hoort onaangeraakt te blijven')
})

test('laat een kustlijn staan: die is te grillig voor een woord', () => {
  const b = beeld(220, 220, 150)
  kustlijn(b, 10, 190)
  const voor = Buffer.from(b.data)

  const { aantal } = wisTekst(b)
  assert.equal(aantal, 0, 'een slinger is geen tekst')
  assert.ok(b.data.equals(voor), 'er hoort niets veranderd te zijn')
})

test('laat een wegnummer staan, ook naast een naam', () => {
  const b = beeld(360, 200, 150)
  schildje(b, 40, 40)
  tekst(b, 40, 90)

  wisTekst(b)

  assert.equal(pixel(b, 44, 44), 250, 'het witte vlak van het schildje hoort te blijven')
  assert.equal(pixel(b, 50, 52), 40, 'het cijfer erin ook')
  assert.ok(pixel(b, 68, 97) > 120, 'de naam eronder hoort wel weg te zijn')
})

test('plakt losse letters tot één woord', () => {
  const b = beeld(300, 200, 150)
  tekst(b, 60, 90, 5)

  const vlakken = vindTekstVlakken(b)
  assert.equal(vlakken.length, 1, 'vijf letters horen één vlak te worden, geen vijf')
  assert.ok(vlakken[0].breedte > 50, `het vlak hoort het hele woord te beslaan (${vlakken[0].breedte})`)
})

test('vult een naam over een kustlijn van de goede kant op', () => {
  // links donkerder land, rechts lichte zee, met de naam er dwars overheen
  const b = beeld(300, 200, 120)
  blok(b, 150, 0, 150, 200, 230)
  tekst(b, 110, 90, 6)

  wisTekst(b)

  // Beide kanten houden hun eigen kleur: het gat groeit dicht vanaf de
  // dichtstbijzijnde bron, en niet als een veeg van links naar rechts.
  assert.ok(Math.abs(pixel(b, 118, 97) - 120) < 25,
    `links hoort de landkleur te krijgen, kreeg ${pixel(b, 118, 97)}`)
  assert.ok(Math.abs(pixel(b, 178, 97) - 230) < 25,
    `rechts hoort de zeekleur te krijgen, kreeg ${pixel(b, 178, 97)}`)
})
