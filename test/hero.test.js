import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fotosPerDag, stempelNummer, veldnotitieConcept, dagNotitie, stempelPrompt, inktKleuren,
  versterkKleur, DAG_VERSCHUIVING
} from '../src/hero.js'

/** Precies de namen zoals ze nu in Hero/ staan, plus wat rommel ertussen. */
const NAMEN = [
  '.DS_Store',
  'Dag 1.jpg',
  'Dag 2-2.ARW',
  'Dag 2.ARW',
  'Dag 3-2.jpg',
  'Dag 3.ARW',
  'Dag 5-3.ARW',
  'Dag 5-2.jpg',
  'Dag 5.ARW',
  'Dag 6-2.JPG',
  'Dag 6.jpg',
  'aantekeningen.txt'
]

test('koppelt elke foto aan zijn dag, één verder dan de bestandsnaam', () => {
  // "Dag 1.jpg" in de map is de tweede dag van de reis: van dag 1, de aankomst
  // in Keflavík, is geen heropfoto.
  const perDag = fotosPerDag(NAMEN)

  assert.equal(DAG_VERSCHUIVING, 1)
  assert.deepEqual([...perDag.keys()], [2, 3, 4, 6, 7])
  assert.equal(perDag.get(2).length, 1)
  assert.equal(perDag.get(6).length, 3)
})

test('dag 1 krijgt nooit foto´s', () => {
  assert.equal(fotosPerDag(NAMEN).has(1), false)
})

test('zet de foto´s van een dag op volgorde, zonder streepje eerst', () => {
  const zes = fotosPerDag(NAMEN).get(6).map(f => f.naam)
  assert.deepEqual(zes, ['Dag 5.ARW', 'Dag 5-2.jpg', 'Dag 5-3.ARW'])
})

test('het cijfer achter het streepje is de volgorde, geen tweede dag', () => {
  // "Dag 5-3" hoort bij reisdag 6 en mag geen dag 3 en geen dag 53 worden
  const perDag = fotosPerDag(['Dag 5-3.ARW'])
  assert.deepEqual([...perDag.keys()], [6])
  assert.equal(perDag.get(6)[0].index, 3)
})

test('slaat over wat geen foto is', () => {
  assert.equal(fotosPerDag(['.DS_Store', 'notities.md', 'Dag.jpg']).size, 0)
})

test('herkent hoofdletters in de extensie', () => {
  const zeven = fotosPerDag(NAMEN).get(7)
  assert.equal(zeven[1].soort, 'jpg')   // "Dag 6-2.JPG"
})

test('nummert alleen door als er meer foto´s zijn', () => {
  assert.equal(stempelNummer(3, 1, 1), 'No. 03')
  assert.equal(stempelNummer(3, 2, 2), 'No. 03·2')
})

const DAG = {
  dag: 3,
  datum: '2026-08-08',
  titel: 'Gletsjerlagunes → Stuðlagil',
  waypoints: [
    { name: 'Kamperen', type: 'start' },
    { name: '', type: 'via' },
    { name: 'Fjallsárlón', type: 'stop' },
    { name: 'Diamond Beach', type: 'stop' },
    { name: 'Stuðlagil', type: 'stop' },
    { name: 'Hotel', type: 'overnight', fweg: true }
  ]
}

test('neemt de laatste stop als plaatsnaam en het jaar uit de datum', () => {
  const concept = veldnotitieConcept(DAG)
  assert.equal(concept.plaats, 'Stuðlagil')
  assert.equal(concept.jaar, '2026')
})

test('laat de trefwoorden leeg om zelf in te vullen', () => {
  // bewust: dit is precies waar een model iets aannemelijks en onwaars verzint
  assert.deepEqual(veldnotitieConcept(DAG).trefwoorden, [])
})

test('de notitie noemt het land, de dag en de plaatsen', () => {
  const notitie = dagNotitie(DAG)
  assert.match(notitie, /Iceland/)
  assert.match(notitie, /Day 3/)
  assert.match(notitie, /Diamond Beach/)
  assert.match(notitie, /F-road/)
})

test('de notitie laat de naamloze doorrijpunten weg', () => {
  assert.doesNotMatch(dagNotitie(DAG), /, ,/)
})

test('de prompt verbiedt tekst, kaders en het gevulde blok', () => {
  // Het gevulde vierkant is de valkuil: zonder deze regels levert het model een
  // linosnede in een blok in plaats van een afdruk die vrij op het papier staat.
  const prompt = stempelPrompt(DAG)
  const verboden = [
    'No text', 'no letters', 'no numbers',
    'no border', 'no frame',
    'no square block of colour', 'no background fill',
    'no perforations', 'no circular seal', 'no drop shadow'
  ]
  for (const zin of verboden) {
    assert.ok(prompt.includes(zin), `mist "${zin}"`)
  }
})

test('de prompt vraagt om de dingen die deze stijl maken', () => {
  const prompt = stempelPrompt(DAG)
  const nodig = [
    'floats free on bare paper',    // geen gevuld veld
    'out of register',              // de kleurlagen schuiven
    'broken horizontal dashes',     // lucht en water als streepjes
    'Two or three flat spot colours',
    'never of large solid areas'    // gegraveerd, geen lino
  ]
  for (const zin of nodig) {
    assert.ok(prompt.includes(zin), `mist "${zin}"`)
  }
})

test('de prompt draagt de dag mee', () => {
  assert.ok(stempelPrompt(DAG).includes('Diamond Beach'))
})

test('lucht, water en verte krijgen niet dezelfde behandeling', () => {
  // Dit is de fout die de eerste ronde stempels maakte: één zin voor alle drie,
  // en dan loopt de lucht als een streepjesveld over de halve afdruk terwijl het
  // kerkje erin verdwijnt. Het water hóórt die streepjes te hebben.
  const prompt = stempelPrompt(DAG)
  assert.ok(prompt.includes('The sky is bare paper'), 'mist de lege lucht')
  assert.ok(prompt.includes('Water is where the dashes belong'), 'mist de streepjes in het water')
  assert.ok(prompt.includes('one thin contour line'), 'mist de dunne contour voor de verte')
  assert.doesNotMatch(prompt, /sky, water, distant hills and haze as rows/)
})

test('de prompt zegt dat het onderwerp wint van de achtergrond', () => {
  const prompt = stempelPrompt(DAG)
  assert.ok(prompt.includes('The subject carries the most ink'))
  assert.ok(prompt.includes('bare paper, or reduced to a single thin ridge line'))
})

test('de kleuren mogen niet meer ingehouden zijn', () => {
  // "keep them desaturated" leverde salie waar gras hoorde
  const prompt = stempelPrompt(DAG)
  assert.doesNotMatch(prompt, /keep them desaturated/)
  assert.ok(prompt.includes('a true grass or moss green'))
})

test('de nadruk voor één afdruk komt in de prompt, en anders niets', () => {
  const zonder = stempelPrompt(DAG)
  assert.doesNotMatch(zonder, /THIS PARTICULAR PRINT/)

  const met = stempelPrompt(DAG, '  The sand is orange.  ')
  assert.ok(met.includes('THIS PARTICULAR PRINT\nThe sand is orange.'))
  // en hij staat vóór de foto, want de foto blijft het laatste woord houden
  assert.ok(met.indexOf('THIS PARTICULAR PRINT') < met.indexOf('THIS PHOTOGRAPH'))
})

/** ------------------------------------------------------- versterkKleur */

test('laat de sleutelinkt met rust', () => {
  // Gemeten op de echte platen: de sleutelinkt is een warm bruinzwart rond
  // rgb(64,32,32), dus chroma 32. Een platte verzadigingsboost maakt juist die
  // roder, en dan is de tekening niet donker meer maar bruin.
  assert.deepEqual(versterkKleur(64, 32, 32, 1.35), [64, 32, 32])
  assert.deepEqual(versterkKleur(24, 22, 20, 2), [24, 22, 20])
})

test('trekt een salieachtig groen voller', () => {
  const [r, g, b] = versterkKleur(96, 128, 96, 1.35)
  assert.ok(g > 128, 'het groen moet groener worden')
  assert.ok(r < 96 && b < 96, 'de andere kanalen moeten wijken')
})

test('houdt de helderheid gelijk, alleen de kleur verandert', () => {
  const licht = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114
  const voor = [160, 160, 128]
  const na = versterkKleur(...voor, 1.5)
  assert.ok(Math.abs(licht(...na) - licht(...voor)) < 2)
})

test('doet niets bij kracht 1, en houdt in onder de 1', () => {
  assert.deepEqual(versterkKleur(200, 150, 90, 1), [200, 150, 90])

  const [r, g, b] = versterkKleur(200, 150, 90, 0.5)
  assert.ok(r < 200 && b > 90, 'onder de 1 moeten de kanalen naar elkaar toe')
})

test('een onzinnige kracht laat de pixel met rust', () => {
  // node src/stempel.js --kleur=veel geeft NaN; dan liever niets doen dan een
  // hele reeks platen met zwarte gaten erin wegschrijven
  assert.deepEqual(versterkKleur(200, 150, 90, NaN), [200, 150, 90])
})

test('loopt nergens buiten 0 tot 255', () => {
  for (const kracht of [1.35, 3, 10]) {
    for (const kleur of [[255, 200, 40], [250, 246, 236], [10, 200, 10], [0, 0, 0]]) {
      for (const kanaal of versterkKleur(...kleur, kracht)) {
        assert.ok(Number.isInteger(kanaal) && kanaal >= 0 && kanaal <= 255,
          `${kanaal} uit ${kleur} bij ${kracht}`)
      }
    }
  }
})

/** Een verzonnen afdruk: drie inkten op doorzichtig papier. */
function proefAfdruk (kleuren, perKleur = 40) {
  const uit = []
  for (const [r, g, b] of kleuren) {
    for (let i = 0; i < perKleur; i++) {
      // een beetje ruis erop, zoals ongelijke druk dat ook doet
      uit.push(r + (i % 7) - 3, g + (i % 5) - 2, b + (i % 3) - 1, 255)
    }
  }
  // en een hoop papier eromheen
  for (let i = 0; i < 400; i++) uit.push(250, 246, 236, 0)
  return Uint8Array.from(uit.map(v => Math.max(0, Math.min(255, v))))
}

test('vindt de inkten terug uit een afdruk', () => {
  const inkten = inktKleuren(proefAfdruk([[24, 22, 20], [156, 90, 60], [90, 110, 92]]))
  assert.equal(inkten.length, 3)
  assert.match(inkten[0], /^#[0-9a-f]{6}$/)
})

test('telt doorzichtige pixels niet mee', () => {
  // alleen papier: geen enkele inkt
  const alleenPapier = Uint8Array.from(
    Array.from({ length: 100 }, () => [250, 246, 236, 0]).flat())
  assert.deepEqual(inktKleuren(alleenPapier), [])
})

test('geeft niet vier keer bijna hetzelfde zwart terug', () => {
  const bijnaGelijk = proefAfdruk([[20, 20, 20], [26, 25, 24], [30, 29, 28], [22, 23, 21]])
  assert.equal(inktKleuren(bijnaGelijk).length, 1)
})

test('houdt zich aan het gevraagde aantal', () => {
  const veel = proefAfdruk([[10, 10, 10], [200, 60, 40], [40, 90, 160], [200, 190, 60], [90, 160, 90]])
  assert.equal(inktKleuren(veel, { hoeveel: 2 }).length, 2)
})
