import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MODELLEN, MODEL_INFO, MODEL_PER_DAG, bouwDraadmodel, kiesModel
} from '../src/render/draadmodellen.js'
import { isoProjectie } from '../src/render/isometrie.js'
import { KNOPPEN } from '../src/styleSchema.js'

/** Hoeveel losse streepjes een model uiteindelijk op de bladzijde zet. */
const segmenten = model =>
  model.lijnen.reduce((totaal, l) => totaal + Math.max(0, l.ketting.length - 1), 0)

function omhullende (punten, van = p => p) {
  const assen = ['x', 'y', 'z']
  const uit = {}
  for (const as of assen) {
    const waarden = punten.map(p => van(p)[as]).filter(Number.isFinite)
    uit[as] = { min: Math.min(...waarden), max: Math.max(...waarden) }
  }
  return uit
}

test('elk onderwerp levert punten en lijnen op', () => {
  for (const naam of MODELLEN) {
    const model = bouwDraadmodel(naam)
    assert.ok(model.punten.length > 0, `${naam} leverde geen punten op`)
    assert.ok(model.lijnen.length > 0, `${naam} leverde geen lijnen op`)
  }
})

test('elke ketting van elk onderwerp wijst naar een bestaand punt', () => {
  for (const naam of MODELLEN) {
    const model = bouwDraadmodel(naam)
    for (const lijn of model.lijnen) {
      for (const i of lijn.ketting) {
        assert.ok(Number.isInteger(i) && i >= 0 && i < model.punten.length,
          `${naam}: ketting wijst naar punt ${i} van de ${model.punten.length}`)
      }
    }
  }
})

test('geen enkel onderwerp levert een punt op dat geen getal is', () => {
  for (const naam of MODELLEN) {
    for (const p of bouwDraadmodel(naam).punten) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
        `${naam} leverde een punt op dat geen getal is`)
    }
  }
})

test('elk onderwerp blijft onder het segmentbudget', () => {
  for (const naam of MODELLEN) {
    const aantal = segmenten(bouwDraadmodel(naam))
    assert.ok(aantal <= 3000, `${naam} tekent ${aantal} streepjes; dat is te druk voor een achtergrond`)
  }
})

test('ook op de hoogste fijnheid blijft het aantal streepjes te drukken', () => {
  for (const naam of MODELLEN) {
    const aantal = segmenten(bouwDraadmodel(naam, { dichtheid: 56 }))
    assert.ok(aantal <= 14000, `${naam} tekent er ${aantal} op de hoogste stand`)
  }
})

test('niets zweeft: elk onderwerp staat met zijn voeten op de vloer', () => {
  for (const naam of MODELLEN) {
    const doos = omhullende(bouwDraadmodel(naam).punten)
    assert.ok(doos.z.min <= 0.001,
      `${naam} zweeft: het laagste punt ligt op ${doos.z.min.toFixed(3)}`)
    assert.ok(doos.z.max > 0, `${naam} heeft geen hoogte`)
  }
})

test('elk onderwerp past in een kubus van twaalf eenheden', () => {
  for (const naam of MODELLEN) {
    const doos = omhullende(bouwDraadmodel(naam).punten)
    for (const as of ['x', 'y', 'z']) {
      const maat = doos[as].max - doos[as].min
      assert.ok(maat <= 12, `${naam} is ${maat.toFixed(1)} eenheden over ${as}`)
    }
  }
})

test('geen onderwerp is een naald of een streep op de bladzijde', () => {
  for (const naam of MODELLEN) {
    const projectie = isoProjectie({ draaiGraden: 45 + (MODEL_INFO[naam].draaiGraden ?? 0) })
    const vlak = bouwDraadmodel(naam).punten.map(p => projectie.punt(p))
    const doos = omhullende(vlak)
    const verhouding = (doos.x.max - doos.x.min) / (doos.y.max - doos.y.min)

    assert.ok(verhouding > 0.4 && verhouding < 2.5,
      `${naam} staat als ${verhouding.toFixed(2)} op de bladzijde; dat vult geen vierkante pagina`)
  }
})

test('elk onderwerp heeft een naam en een eigen stand in MODEL_INFO', () => {
  for (const naam of MODELLEN) {
    const info = MODEL_INFO[naam]
    assert.ok(info, `${naam} mist zijn info`)
    assert.ok(typeof info.label === 'string' && info.label.length > 0)
    assert.ok(Number.isFinite(info.draaiGraden) && Number.isFinite(info.vulling))
  }
})

test('meer fijnheid levert meer lijnen op', () => {
  for (const naam of MODELLEN) {
    const grof = segmenten(bouwDraadmodel(naam, { dichtheid: 6 }))
    const fijn = segmenten(bouwDraadmodel(naam, { dichtheid: 40 }))
    assert.ok(fijn > grof, `${naam} bleef op ${grof} streepjes staan`)
  }
})

test('twee keer hetzelfde onderwerp levert exact hetzelfde model op', () => {
  for (const naam of MODELLEN) {
    assert.deepEqual(bouwDraadmodel(naam), bouwDraadmodel(naam),
      `${naam} is niet twee keer hetzelfde; daar zit toeval in`)
  }
})

// ------------------------------------------------------------- de dagkeuze

test('elke dag van de reis krijgt een onderwerp dat ook echt bestaat', () => {
  for (let dag = 1; dag <= 8; dag++) {
    const naam = kiesModel('automatisch', dag)
    assert.ok(MODELLEN.includes(naam), `dag ${dag} kreeg "${naam}"`)
    assert.equal(naam, MODEL_PER_DAG[dag])
  }
})

test('een dag die het lijstje niet kent krijgt alsnog iets te zien', () => {
  const naam = kiesModel('automatisch', 99)
  assert.ok(MODELLEN.includes(naam), `dag 99 kreeg "${naam}"`)
})

test('een dag zonder nummer laat de keuze niet omvallen', () => {
  assert.ok(MODELLEN.includes(kiesModel('automatisch', undefined)))
})

test('een eigen keuze wint van de dagtabel', () => {
  assert.equal(kiesModel('geiser', 1), 'geiser')
})

test('een onbekende naam valt terug op een onderwerp in plaats van niets', () => {
  const naam = kiesModel('bananen', 3)
  assert.equal(naam, 'gletsjer', 'een onzinnige keuze hoort de dag zelf terug te geven')
})

test('elk onderwerp in de keuzelijst van het schema bestaat ook echt', () => {
  const knop = KNOPPEN.find(k => k.key === 'statistieken.draadmodel')
  assert.ok(knop, 'de knop staat niet in het schema')

  const toegestaan = new Set(['automatisch', ...MODELLEN])
  for (const optie of knop.opties) {
    assert.ok(toegestaan.has(optie), `het schema biedt "${optie}" aan, maar dat bestaat niet`)
  }
  for (const naam of MODELLEN) {
    assert.ok(knop.opties.includes(naam), `${naam} is niet te kiezen in het paneel`)
  }
})

test('de achtergrondkeuze kent het draadmodel', () => {
  const knop = KNOPPEN.find(k => k.key === 'statistieken.achtergrond')
  assert.ok(knop.opties.includes('draadmodel'))
})
