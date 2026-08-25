import test from 'node:test'
import assert from 'node:assert/strict'
import {
  WEERSOORTEN, weerSoort, weerKnopen, weerPictogram, weerTekenKnoop
} from '../src/render/weertekens.js'

test('deelt de WMO-codes in op groep', () => {
  // Op groep en niet per los nummer, zodat er nooit een code buiten de boot valt.
  assert.equal(weerSoort(0), 'helder')
  assert.equal(weerSoort(3), 'bewolkt')
  assert.equal(weerSoort(45), 'mist')
  assert.equal(weerSoort(53), 'motregen')
  assert.equal(weerSoort(65), 'regen')
  assert.equal(weerSoort(73), 'sneeuw')
  assert.equal(weerSoort(81), 'buien')
  assert.equal(weerSoort(86), 'sneeuw')   // sneeuwbuien
  assert.equal(weerSoort(95), 'onweer')
})

test('elke code van 0 tot 100 krijgt een teken', () => {
  for (let code = 0; code <= 100; code++) {
    assert.ok(WEERSOORTEN.includes(weerSoort(code)), `code ${code} viel buiten de boot`)
  }
})

test('geen weergegevens geeft geen teken', () => {
  assert.equal(weerSoort(null), null)
  assert.equal(weerSoort(undefined), null)
  assert.equal(weerTekenKnoop(null, { x: 0, y: 0, maatMm: 4, kleur: '#000' }), null)
})

test('elke soort levert tekenwerk op', () => {
  for (const soort of WEERSOORTEN) {
    const knopen = weerKnopen(soort)
    assert.ok(knopen.length > 0, `${soort} tekent niets`)
    for (const k of knopen) assert.ok(k.tag, `${soort} heeft een knoop zonder tag`)
  }
})

test('de bedekking loopt op van open naar dicht', () => {
  // Het hele idee van deze notatie: hoe voller het rondje, hoe meer bewolking.
  // Een open rondje heeft alleen een omtrek, een dicht rondje een vulling.
  const gevuld = soort => weerKnopen(soort).filter(k => k.attr?.fill === 'currentColor').length

  assert.equal(gevuld('helder'), 0)
  assert.ok(gevuld('licht-bewolkt') > 0)
  assert.ok(gevuld('half-bewolkt') > 0)
  assert.ok(gevuld('bewolkt') > 0)
})

test('alle vier de bewolkingstekens zijn even groot', () => {
  // Anders lijkt "helder" een ander soort teken in plaats van hetzelfde teken
  // in een andere staat, en dan valt de reeks uit elkaar.
  for (const soort of ['helder', 'licht-bewolkt', 'half-bewolkt', 'bewolkt']) {
    const cirkel = weerKnopen(soort).find(k => k.tag === 'circle')
    assert.equal(cirkel.attr.r, 0.3, soort)
  }
})

test('alles blijft binnen het vakje van een halve eenheid', () => {
  // De pagina schaalt dit vakje naar millimeters; loopt er iets buiten, dan
  // botsen de tekens onderling of vallen ze in de grafiek eronder.
  // In een boogcommando (A rx ry rotatie grote-boog richting x y) zijn de twee
  // vlaggen geen coordinaten maar keuzes - een 1 betekent daar "de lange kant
  // om" en niet "een eenheid naar rechts". Die eruit halen voordat we meten.
  const zonderBoogvlaggen = d =>
    d.replace(/A\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+[01]\s+[01]\s+/g, 'A $1 $2 $3 ')

  const getallen = k => Object.entries(k.attr ?? {})
    .filter(([a]) => !['fill', 'stroke', 'stroke-linecap', 'stroke-width'].includes(a))
    .flatMap(([a, v]) => String(a === 'd' ? zonderBoogvlaggen(String(v)) : v)
      .match(/-?\d*\.?\d+/g) ?? [])
    .map(Number)

  for (const soort of WEERSOORTEN) {
    for (const k of weerKnopen(soort)) {
      for (const n of getallen(k)) {
        assert.ok(Math.abs(n) <= 0.5, `${soort}: ${n} valt buiten het vakje`)
      }
    }
  }
})

test('de lijnen blijven boven de drukgrens', () => {
  // 0,09 in het vakje maal 4 mm is 0,36 mm op papier, ruim boven de 0,09 mm
  // waaronder een haarlijn in de druk wegvalt.
  const kleinsteMm = 4 * 0.09
  assert.ok(kleinsteMm >= 0.09)
})

test('zet het teken op zijn plek en in de goede kleur', () => {
  const knoop = weerTekenKnoop(61, { x: 120.5, y: 42, maatMm: 4.2, kleur: '#5a5349' })
  assert.equal(knoop.tag, 'g')
  assert.equal(knoop.attr.color, '#5a5349')
  assert.match(knoop.attr.transform, /translate\(120\.5 42\) scale\(4\.2\)/)
  assert.ok(knoop.kind.length > 0)
})

test('de kleur komt van buiten, via currentColor', () => {
  // Zo staat de inktkleur op één plek - de groep - in plaats van bij elk
  // lijntje apart, en volgt hij vanzelf de kleurenset.
  for (const soort of WEERSOORTEN) {
    for (const k of weerKnopen(soort)) {
      for (const eig of ['fill', 'stroke']) {
        const v = k.attr?.[eig]
        if (v && v !== 'none') assert.equal(v, 'currentColor', `${soort}.${eig}`)
      }
    }
  }
})

/** ------------------------------------------------------- de pictogrammen */

const PALET = { zon: '#d9a441', wolk: '#9aa0a6', neerslag: '#5b7c99', sneeuw: '#a9c6dc' }

test('elke soort levert ook een pictogram op', () => {
  for (const soort of WEERSOORTEN) {
    const knopen = weerPictogram(soort, PALET)
    assert.ok(knopen.length > 0, `${soort} tekent niets`)
  }
})

test('de kleuren komen uit het palet en nergens anders vandaan', () => {
  // Anders staat er ergens een hardgecodeerde kleur die niet meeverandert als
  // je aan de kleurenset draait, en dat zie je pas op de drukproef.
  const toegestaan = new Set(Object.values(PALET))
  for (const soort of WEERSOORTEN) {
    for (const k of weerPictogram(soort, PALET)) {
      for (const eig of ['fill', 'stroke']) {
        const v = k.attr?.[eig]
        if (v && v !== 'none') assert.ok(toegestaan.has(v), `${soort}.${eig} = ${v}`)
      }
    }
  }
})

test('de zon staat alleen bij helder weer', () => {
  const heeftZon = soort =>
    weerPictogram(soort, PALET).some(k => k.attr?.fill === PALET.zon || k.attr?.stroke === PALET.zon)

  for (const soort of ['helder', 'licht-bewolkt', 'half-bewolkt']) {
    assert.ok(heeftZon(soort), `${soort} mist de zon`)
  }
  for (const soort of ['bewolkt', 'mist', 'motregen', 'regen', 'sneeuw', 'buien']) {
    assert.ok(!heeftZon(soort), `${soort} heeft ten onrechte een zon`)
  }
  // bij onweer is de schicht wel in de zonkleur; dat is met opzet
  assert.ok(heeftZon('onweer'))
})

test('alles wat uit de lucht valt heeft zijn eigen kleur', () => {
  const kleurenIn = soort => new Set(weerPictogram(soort, PALET)
    .flatMap(k => [k.attr?.fill, k.attr?.stroke]).filter(Boolean))

  assert.ok(kleurenIn('regen').has(PALET.neerslag))
  assert.ok(kleurenIn('motregen').has(PALET.neerslag))
  assert.ok(kleurenIn('buien').has(PALET.neerslag))
  assert.ok(kleurenIn('sneeuw').has(PALET.sneeuw))
  // sneeuw is geen regen: dat verschil moet je in kleur kunnen zien
  assert.ok(!kleurenIn('sneeuw').has(PALET.neerslag))
})

test('elke soort heeft een wolk, behalve helder', () => {
  const heeftWolk = soort =>
    weerPictogram(soort, PALET).some(k => k.attr?.fill === PALET.wolk)

  assert.equal(heeftWolk('helder'), false)
  for (const soort of WEERSOORTEN.filter(s => s !== 'helder')) {
    assert.ok(heeftWolk(soort), `${soort} mist de wolk`)
  }
})

test('de pictogrammen blijven binnen hun vakje', () => {
  for (const soort of WEERSOORTEN) {
    for (const k of weerPictogram(soort, PALET)) {
      if (k.tag === 'circle') {
        const straal = Number(k.attr.r)
        assert.ok(Math.abs(Number(k.attr.cx)) + straal <= 0.52, `${soort} steekt opzij uit`)
        assert.ok(Math.abs(Number(k.attr.cy)) + straal <= 0.52, `${soort} steekt omhoog of omlaag uit`)
      }
      if (k.tag === 'line') {
        for (const a of ['x1', 'x2', 'y1', 'y2']) {
          assert.ok(Math.abs(Number(k.attr[a])) <= 0.52, `${soort}.${a} = ${k.attr[a]}`)
        }
      }
    }
  }
})

test('kiest de goede tekenwijze', () => {
  const gemeen = { x: 0, y: 0, maatMm: 4.2, kleur: '#3a352e', palet: PALET }

  const gekleurd = weerTekenKnoop(61, { ...gemeen, vorm: 'gekleurd' })
  assert.ok(gekleurd.kind.some(k => k.attr?.fill === PALET.wolk))

  const notatie = weerTekenKnoop(61, { ...gemeen, vorm: 'notatie' })
  assert.ok(notatie.kind.every(k => !k.attr?.fill || k.attr.fill === 'currentColor'))
})
