import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dekkendVak, getandeRand, vlagKnopen, vlagMaat, zegelKnopen, zegelMaat,
  zegelOmtrek, BREED, HOOG, VLAGPADEN, VLAGBLAUW, VLAGROOD, VLAGWIT
} from '../src/render/vlag.js'
import { zaadje } from '../src/render/papier.js'

/** Alle knopen plat, zodat er in één keer op te zoeken is. */
function plat (knopen) {
  const uit = []
  const loop = rij => {
    for (const k of rij ?? []) { uit.push(k); loop(k.kind) }
  }
  loop(knopen)
  return uit
}

test('de vlag heeft de voorgeschreven verhouding 18 op 25', () => {
  assert.equal(vlagMaat(50).hoogteMm, 36)
  assert.equal(vlagMaat(25).hoogteMm, 18)
  assert.equal(BREED / HOOG, 25 / 18)
})

test('de tekening is die uit de bron en geen nagemaakte', () => {
  // Deze drie paden komen letterlijk uit Flag_of_Iceland.svg. Ze staan hier als
  // test omdat een nagetekende vlag er goed uitziet tot je hem naast de echte
  // legt - en dat is precies wat er eerder misging.
  assert.deepEqual(VLAGPADEN, [
    { d: 'M0 0H25V18H0Z', vulling: VLAGBLAUW },
    { d: 'M0 9H25M9 0V18', streek: VLAGWIT, breedte: 4 },
    { d: 'M0 9H25M9 0V18', streek: VLAGROOD, breedte: 2 }
  ])
})

test('het kruis is een streek en geen stapel rechthoeken', () => {
  // Waarom dat uitmaakt: bij vier losse balken moeten er in het midden vier
  // hoeken op elkaar passen, en daar ging het eerder mis. Als streek klopt het
  // kruispunt vanzelf.
  const knopen = vlagKnopen({ breedteMm: 25 })
  const paden = knopen[0].kind

  assert.equal(paden.length, 3)
  assert.equal(paden[0].attr.fill, VLAGBLAUW)
  assert.equal(paden[0].attr.stroke, null)

  for (const p of paden.slice(1)) {
    assert.equal(p.attr.fill, 'none', 'een kruis wordt gestreken, niet gevuld')
    assert.ok(p.attr['stroke-width'] > 0)
  }

  // het witte kruis is aan elke kant één eenheid breder dan het rode
  assert.equal(paden[1].attr['stroke-width'] - paden[2].attr['stroke-width'], 2)
})

test('het kruis staat links van het midden, niet in het midden', () => {
  // In de padtekst staat het als "9": negen eenheden van links op een breedte
  // van 25. Links ervan blijft 9, rechts ervan 16 - dat is de hele grap van een
  // Scandinavisch kruis.
  const [, wit] = VLAGPADEN
  assert.ok(wit.d.includes('M9 0V18'), 'het staande kruis hoort op x=9 te staan')
  assert.ok(9 < BREED - 9)
})

test('het liggende kruis staat wel op het midden van de hoogte', () => {
  const [, wit] = VLAGPADEN
  assert.ok(wit.d.startsWith('M0 9H25'))
  assert.equal(9, HOOG / 2)
})

test('de kleuren zijn de voorgeschreven kleuren en geen benadering', () => {
  assert.equal(VLAGBLAUW, '#02529c')
  assert.equal(VLAGROOD, '#dc1e35')
  assert.equal(VLAGWIT, '#ffffff')
})

test('op maat zetten gebeurt met een transform, zodat de streek meeschaalt', () => {
  // Zou de streekbreedte in millimeters uitgerekend worden, dan moest bij elke
  // maat opnieuw geklopt worden dat wit en rood zich als 4 op 2 verhouden.
  const knopen = vlagKnopen({ x: 100, y: 60, breedteMm: 50 })
  const g = knopen[0]

  assert.equal(g.attr.transform, 'translate(100 60) scale(2)')
  assert.equal(g.kind[1].attr['stroke-width'], 4, 'de breedte blijft in vlageenheden')
})

test('de dekking staat op de groep en niet op elk pad apart', () => {
  const g = vlagKnopen({ breedteMm: 30, dekking: 0.4 })[0]
  assert.equal(g.attr.opacity, 0.4)
  for (const p of g.kind) assert.ok(!('opacity' in p.attr))
})

test('een vlag zonder breedte levert niets in plaats van te klappen', () => {
  assert.deepEqual(vlagKnopen({ breedteMm: 0 }), [])
  assert.deepEqual(vlagKnopen({ breedteMm: -5 }), [])
})

test('dekkend schalen behoudt de verhouding en bedekt het hele vak', () => {
  // Dit is wat de vlag in de vorm van het land doet. IJsland is breder dan de
  // vlag hoog is, dus hij hoort boven en onder uit te steken - dat wordt door de
  // kustlijn weggeknipt. Uitrekken zou het kruis vervormen.
  const vak = { x: 10, y: 20, breedte: 200, hoogte: 120 }
  const uit = dekkendVak(vak)

  assert.equal(uit.breedteMm / uit.hoogteMm, BREED / HOOG, 'de verhouding blijft')
  assert.ok(uit.breedteMm >= vak.breedte - 1e-9, 'het vak wordt in de breedte gedekt')
  assert.ok(uit.hoogteMm >= vak.hoogte - 1e-9, 'en in de hoogte')

  // en hij zit gecentreerd, dus het overschot valt gelijk aan beide kanten
  assert.equal(uit.x + uit.breedteMm / 2, vak.x + vak.breedte / 2)
  assert.equal(uit.y + uit.hoogteMm / 2, vak.y + vak.hoogte / 2)
})

test('een smal en hoog vak wordt in de breedte gedekt in plaats van in de hoogte', () => {
  const uit = dekkendVak({ x: 0, y: 0, breedte: 50, hoogte: 200 })
  assert.equal(uit.breedteMm / uit.hoogteMm, BREED / HOOG)
  assert.ok(uit.breedteMm > 50, 'hij steekt links en rechts uit')
  assert.ok(Math.abs(uit.hoogteMm - 200) < 1e-9)
})

/** ------------------------------------------------------------ de postzegel */

test('de tanden bijten naar binnen en bollen niet naar buiten', () => {
  // Dit is wat een perforatie ís: gaatjes die uit het vel geponst zijn, met het
  // papier ertussen. Klapt dit om, dan wordt het een bloem, en dat is precies
  // het soort fout dat er in een plaatje goed uitziet tot je hem naast een
  // echte zegel legt.
  const punten = getandeRand({ x: 0, y: 0 }, { x: 20, y: 0 }, 2)

  // deze rand loopt naar rechts, dus "binnen" is naar beneden: positieve y
  const diepste = Math.max(...punten.map(p => p.y))
  const ondiepste = Math.min(...punten.map(p => p.y))

  assert.ok(diepste > 0, 'de tanden horen het vel in te bijten')
  assert.ok(Math.abs(ondiepste) < 1e-9, 'en niet buiten de rand uit te steken')
})

test('de tanden zijn overal even groot, ook op een rand die niet opgaat', () => {
  // 20 millimeter op een tand van 3 gaat niet op. Liever zeven tanden die een
  // fractie ruimer staan dan zes tanden plus een halve.
  const punten = getandeRand({ x: 0, y: 0 }, { x: 20, y: 0 }, 3)
  const diepten = punten.map(p => p.y).filter(y => y > 1e-9)

  const diepste = Math.max(...diepten)
  // elke bocht hoort even diep te zijn: de straal volgt uit de stap
  const aantal = Math.round(20 / 3)
  assert.equal(Math.round(diepste * 1000) / 1000, Math.round((20 / aantal / 2) * 1000) / 1000)
})

test('de omtrek van een zegel loopt rond en blijft binnen zijn maat', () => {
  const punten = zegelOmtrek(10, 20, 40, 30, 1.7)

  const xen = punten.map(p => p.x)
  const yen = punten.map(p => p.y)

  assert.ok(Math.min(...xen) >= 10 - 1e-9, 'niets steekt links uit')
  assert.ok(Math.max(...xen) <= 50 + 1e-9, 'niets steekt rechts uit')
  assert.ok(Math.min(...yen) >= 20 - 1e-9)
  assert.ok(Math.max(...yen) <= 50 + 1e-9)

  // en hij haalt zijn volle maat wel: anders krimpt de zegel bij elke tand
  assert.ok(Math.max(...xen) - Math.min(...xen) > 39.9)
})

test('een zegel is hoger dan de vlag erop, want er zit een bies omheen', () => {
  const zonder = vlagMaat(40)
  const met = zegelMaat(40, 1.7)

  assert.equal(met.breedteMm, 40)
  assert.ok(met.hoogteMm > zonder.hoogteMm, 'de bies telt aan boven- en onderkant mee')
})

test('de zegel is een eigen vel en dus dekkend, ook op een doorzichtig blad', () => {
  // Een zegel is een voorwerp dat je erop plakt. Zonder papier eronder zou de
  // vlag op het voorblad zweven en was de kartelrand nergens aan te zien.
  const knopen = zegelKnopen({ breedteMm: 40, rnd: zaadje(2), papierKleur: '#f2ebdc' })
  const vel = knopen.find(k => k.tag === 'path' && k.attr?.fill === '#f2ebdc')

  assert.ok(vel, 'er hoort een vel onder de vlag te liggen')
  assert.ok(vel.attr.d.endsWith('Z'), 'en dat vel is een gesloten vorm')
})

test('de afstempeling wordt op de tanden afgeknipt', () => {
  // Anders lopen de golfjes naast de zegel door, en dan is het geen stempel op
  // een zegel maar een krabbel op het papier.
  const knopen = zegelKnopen({ breedteMm: 40, rnd: zaadje(2), afstempeling: 0.6, id: 'proef' })
  const groepen = knopen.filter(k => k.tag === 'g' && k.attr?.['clip-path'])

  assert.ok(groepen.some(g => g.attr['clip-path'] === 'url(#proef-tanden)'))
})

test('de afstempeling kun je uitzetten', () => {
  const met = zegelKnopen({ breedteMm: 40, rnd: zaadje(2), afstempeling: 0.6, id: 'a' })
  const zonder = zegelKnopen({ breedteMm: 40, rnd: zaadje(2), afstempeling: 0, id: 'a' })

  assert.ok(met.length > zonder.length)
  assert.equal(zonder.filter(k => k.attr?.['clip-path'] === 'url(#a-tanden)').length, 0)
})

test('een zegel zonder breedte levert niets in plaats van te klappen', () => {
  assert.deepEqual(zegelKnopen({ breedteMm: 0, rnd: zaadje(1) }), [])
})
