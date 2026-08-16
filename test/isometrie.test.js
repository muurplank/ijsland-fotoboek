import test from 'node:test'
import assert from 'node:assert/strict'

import { ISO_KANTEL_GRADEN, isoProjectie, pasInVak, draadmodelKnopen } from '../src/render/isometrie.js'
import { prisma, afgerondeRechthoek } from '../src/render/ruimtevormen.js'

const MAAT = { breedteMm: 306, hoogteMm: 306, afloopMm: 3 }

/** Een kubus van twee eenheden, met zijn voeten op de vloer. */
const kubus = () => prisma(afgerondeRechthoek(2, 2, 0), 0, 2)

function proefStijl (extra = {}) {
  return {
    'statistieken.draadmodelKleur': '#8b847c',
    'statistieken.draadmodelLijnMm': 0.14,
    'statistieken.draadmodelDekking': 0.22,
    'statistieken.draadmodelDiepte': 0.55,
    'statistieken.draadmodelDraaiGraden': 45,
    'statistieken.draadmodelKantelGraden': 35,
    'statistieken.draadmodelVulling': 0.95,
    'statistieken.draadmodelVerschuifMm': 0,
    ...extra
  }
}

/** Alle knopen onder elkaar, ook de kinderen. */
function alleKnopen (knopen) {
  const uit = []
  const loop = lijst => {
    for (const k of lijst ?? []) {
      uit.push(k)
      loop(k.kind)
    }
  }
  loop(knopen)
  return uit
}

/** De punten uit een polylijn, terug als getallen. */
const puntenVan = knoop => knoop.attr.points
  .split(' ')
  .map(stuk => stuk.split(',').map(Number))
  .map(([x, y]) => ({ x, y }))

const polylijnen = knopen => alleKnopen(knopen).filter(k => k.tag === 'polyline')

// ------------------------------------------------------------- de projectie

test('de isometrische stand laat de drie assen even hard krimpen', () => {
  const p = isoProjectie()
  const lengtes = [
    { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }
  ].map(as => {
    const v = p.punt(as)
    return Math.hypot(v.x, v.y)
  })

  for (const l of lengtes) {
    assert.ok(Math.abs(l - 0.816497) < 1e-6, `een as kromp naar ${l} in plaats van 0,8165`)
  }
})

test('de x-as en de y-as maken allebei dertig graden met de horizon', () => {
  const p = isoProjectie()
  const hoek = as => (Math.atan2(p.punt(as).y, p.punt(as).x) * 180) / Math.PI

  assert.ok(Math.abs(hoek({ x: 1, y: 0, z: 0 }) - 30) < 1e-6)
  assert.ok(Math.abs(hoek({ x: 0, y: 1, z: 0 }) - 150) < 1e-6)
})

test('de isometrische kanteling is ruim vijfendertig graden', () => {
  assert.ok(Math.abs(ISO_KANTEL_GRADEN - 35.264389) < 1e-5,
    `kreeg ${ISO_KANTEL_GRADEN}`)
})

test('hoger in de wereld is hoger op de bladzijde', () => {
  const p = isoProjectie()
  assert.ok(p.punt({ x: 0, y: 0, z: 1 }).y < p.punt({ x: 0, y: 0, z: 0 }).y,
    'een punt hoger in de wereld kwam lager op de bladzijde terecht')
})

test('wat verder van de kijker af ligt krijgt een grotere diepte', () => {
  const p = isoProjectie()
  const dichtbij = p.punt({ x: 0, y: -5, z: 0 }).diepte
  const verweg = p.punt({ x: 0, y: 5, z: 0 }).diepte
  assert.ok(verweg > dichtbij, `${verweg} lag niet verder dan ${dichtbij}`)
})

// ---------------------------------------------------------- inpassen in het vak

test('een ingepast model raakt precies de rand van zijn vak', () => {
  const p = isoProjectie()
  const vlak = kubus().punten.map(punt => p.punt(punt))
  const plaatsing = pasInVak(vlak, { breedteMm: 200, hoogteMm: 100 }, 1)

  const opVlak = vlak.map(v => ({
    x: v.x * plaatsing.schaal + plaatsing.dx,
    y: v.y * plaatsing.schaal + plaatsing.dy
  }))
  const xs = opVlak.map(v => v.x)
  const ys = opVlak.map(v => v.y)

  assert.ok(Math.min(...xs) > -1e-6 && Math.max(...xs) < 200 + 1e-6, 'liep buiten de breedte')
  assert.ok(Math.min(...ys) > -1e-6 && Math.max(...ys) < 100 + 1e-6, 'liep buiten de hoogte')

  const raakt = Math.abs(Math.min(...ys)) < 1e-6 || Math.abs(Math.min(...xs)) < 1e-6
  assert.ok(raakt, 'het model raakte geen enkele rand en vult het vak dus niet')
})

test('een breder vak rekt het model niet uit', () => {
  const p = isoProjectie()
  const vlak = kubus().punten.map(punt => p.punt(punt))

  const verhouding = vak => {
    const plaatsing = pasInVak(vlak, vak, 1)
    const xs = vlak.map(v => v.x * plaatsing.schaal)
    const ys = vlak.map(v => v.y * plaatsing.schaal)
    return (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys))
  }

  const smal = verhouding({ breedteMm: 100, hoogteMm: 100 })
  const breed = verhouding({ breedteMm: 200, hoogteMm: 100 })
  assert.ok(Math.abs(smal - breed) < 1e-9, `${smal} tegen ${breed}: het model werd vervormd`)
})

test('een model zonder punten laat het inpassen niet omvallen', () => {
  const plaatsing = pasInVak([], { breedteMm: 306, hoogteMm: 306 })
  assert.equal(plaatsing.schaal, 1)
  assert.ok(Number.isFinite(plaatsing.dx) && Number.isFinite(plaatsing.dy))
})

test('een model dat tot één punt inklapt krijgt gewoon ware grootte', () => {
  const plaatsing = pasInVak([{ x: 5, y: 5 }], { breedteMm: 306, hoogteMm: 306 })
  assert.equal(plaatsing.schaal, 1)
  assert.ok(Number.isFinite(plaatsing.dx))
})

// -------------------------------------------------------------- de knopen

test('twee keer hetzelfde model levert exact dezelfde tekening op', () => {
  const een = draadmodelKnopen(kubus(), { maat: MAAT, stijl: proefStijl() })
  const ander = draadmodelKnopen(kubus(), { maat: MAAT, stijl: proefStijl() })
  assert.deepEqual(een, ander)
})

test('geen enkel attribuut bevat NaN', () => {
  for (const kantel of [10, 35, 80]) {
    for (const draai of [0, 45, 137, 360]) {
      const knopen = draadmodelKnopen(kubus(), {
        maat: MAAT,
        stijl: proefStijl({
          'statistieken.draadmodelKantelGraden': kantel,
          'statistieken.draadmodelDraaiGraden': draai
        })
      })

      for (const knoop of alleKnopen(knopen)) {
        for (const [naam, waarde] of Object.entries(knoop.attr ?? {})) {
          assert.ok(!String(waarde).includes('NaN'),
            `bij ${draai}/${kantel}: ${knoop.tag}.${naam} werd ${waarde}`)
        }
      }
    }
  }
})

test('elke lijn blijft boven de drukondergrens van 0,09 mm', () => {
  const knopen = draadmodelKnopen(kubus(), {
    maat: MAAT,
    stijl: proefStijl({ 'statistieken.draadmodelLijnMm': 0.09 })
  })

  for (const knoop of alleKnopen(knopen)) {
    const dikte = knoop.attr?.['stroke-width']
    if (dikte === null || dikte === undefined) continue
    assert.ok(Number(dikte) >= 0.09,
      `${knoop.tag} kreeg een lijn van ${dikte} mm`)
  }
})

test('een extreme kanteling laat de tekening niet ontsporen', () => {
  for (const kantel of [10, 80]) {
    const knopen = draadmodelKnopen(kubus(), {
      maat: MAAT,
      stijl: proefStijl({ 'statistieken.draadmodelKantelGraden': kantel })
    })
    const lijnen = polylijnen(knopen)

    assert.ok(lijnen.length > 0 && lijnen.length < 500,
      `bij ${kantel}° kwamen er ${lijnen.length} lijnen uit`)
    for (const p of lijnen.flatMap(puntenVan)) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `bij ${kantel}° liep een punt weg`)
    }
  }
})

test('lijnen verder weg worden bleker dan lijnen dichtbij', () => {
  const knopen = draadmodelKnopen(kubus(), { maat: MAAT, stijl: proefStijl() })
  const dekkingen = polylijnen(knopen).map(k => Number(k.attr['stroke-opacity']))

  assert.ok(Math.max(...dekkingen) > Math.min(...dekkingen),
    'alle lijnen kregen dezelfde dekking; de dieptevervaging deed niets')
  assert.ok(Math.min(...dekkingen) > 0, 'een lijn verdween helemaal')
})

test('de dieptevervaging uitzetten geeft elke lijn dezelfde dekking', () => {
  const knopen = draadmodelKnopen(kubus(), {
    maat: MAAT,
    stijl: proefStijl({ 'statistieken.draadmodelDiepte': 0 })
  })
  const dekkingen = new Set(polylijnen(knopen).map(k => k.attr['stroke-opacity']))

  assert.equal(dekkingen.size, 1, `kreeg ${dekkingen.size} verschillende dekkingen`)
})

test('het onderwerp mag zijn eigen draaiing en vulling meebrengen', () => {
  const recht = draadmodelKnopen(kubus(), { maat: MAAT, stijl: proefStijl() })
  const eigen = draadmodelKnopen(kubus(), {
    maat: MAAT,
    info: { draaiGraden: 20, vulling: 0.5 },
    stijl: proefStijl()
  })

  assert.notDeepEqual(recht, eigen, 'de eigen hoek van het onderwerp deed niets')
})
