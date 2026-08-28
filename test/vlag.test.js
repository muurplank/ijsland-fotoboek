import test from 'node:test'
import assert from 'node:assert/strict'
import {
  vlagKnopen, vlagVlakken, BREED, HOOG, VLAGBLAUW, VLAGROOD, VLAGWIT
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
  const v = vlagVlakken(50)
  assert.equal(v.breedteMm, 50)
  assert.equal(v.hoogteMm, 50 * HOOG / BREED)
  assert.equal(v.hoogteMm, 36)
})

test('het kruis staat links van het midden, niet in het midden', () => {
  const { vlakken, breedteMm } = vlagVlakken(25)

  // bij breedte 25 is één eenheid precies één millimeter
  const rood = vlakken.filter(v => v.kleur === VLAGROOD)
  const staand = rood.find(v => v.hoogte > v.breedte)

  assert.equal(staand.x, 8, 'het rode kruis begint op acht eenheden van links')
  assert.equal(staand.breedte, 2, 'en is twee eenheden breed')

  // links van het kruis 8, rechts ervan 15: dat is de hele grap van een
  // Scandinavisch kruis, en een vlag met het kruis in het midden is fout
  const rechts = breedteMm - (staand.x + staand.breedte)
  assert.equal(rechts, 15)
  assert.ok(rechts > staand.x)
})

test('het liggende kruis staat wél op het midden van de hoogte', () => {
  const { vlakken, hoogteMm } = vlagVlakken(25)
  const liggend = vlakken.filter(v => v.kleur === VLAGROOD).find(v => v.breedte > v.hoogte)

  const boven = liggend.y
  const onder = hoogteMm - (liggend.y + liggend.hoogte)
  assert.equal(boven, onder, 'boven en onder het kruis hoort evenveel blauw te zitten')
})

test('het witte kruis is aan elke kant één eenheid breder dan het rode', () => {
  const { vlakken } = vlagVlakken(25)
  const wit = vlakken.filter(v => v.kleur === VLAGWIT).find(v => v.hoogte > v.breedte)
  const rood = vlakken.filter(v => v.kleur === VLAGROOD).find(v => v.hoogte > v.breedte)

  assert.equal(rood.x - wit.x, 1)
  assert.equal((wit.x + wit.breedte) - (rood.x + rood.breedte), 1)
})

test('het blauwe veld ligt onderop en beslaat de hele vlag', () => {
  const { vlakken, breedteMm, hoogteMm } = vlagVlakken(40)
  const eerste = vlakken[0]

  assert.equal(eerste.kleur, VLAGBLAUW)
  assert.equal(eerste.breedte, breedteMm)
  assert.equal(eerste.hoogte, hoogteMm)
})

test('de inkten liggen naast elkaar, want elke aandruk is een eigen pas', () => {
  const knopen = vlagKnopen({ breedteMm: 40, rnd: zaadje(3), handMm: 0.5 })
  const rechten = plat(knopen).filter(k => k.tag === 'rect')

  const rood = rechten.filter(r => r.attr.fill === VLAGROOD)
  const wit = rechten.filter(r => r.attr.fill === VLAGWIT)

  // het staande rode en het staande witte kruis horen niet op dezelfde x te
  // beginnen plus de voorgeschreven eenheid: er zit een scheve aandruk tussen
  const roodX = Math.min(...rood.map(r => Number(r.attr.x)))
  const witX = Math.min(...wit.map(r => Number(r.attr.x)))
  assert.notEqual(roodX - witX, 1 * (40 / BREED))
})

test('zonder onvaste hand vallen de inkten wél precies op elkaar', () => {
  const knopen = vlagKnopen({ breedteMm: 25, rnd: zaadje(3), handMm: 0 })
  const rechten = plat(knopen).filter(k => k.tag === 'rect')

  const rood = rechten.filter(r => r.attr.fill === VLAGROOD)
    .find(r => Number(r.attr.height) > Number(r.attr.width))
  const wit = rechten.filter(r => r.attr.fill === VLAGWIT)
    .find(r => Number(r.attr.height) > Number(r.attr.width))

  assert.equal(Number(rood.attr.x) - Number(wit.attr.x), 1)
})

test('de scheve aandruk vreet de witte baan nooit op', () => {
  // Dit is de test die de fout vasthoudt die er echt in zat: met een vrije
  // verschuiving van een halve millimeter schoof het rode kruis een kwart van
  // de witte baan op en raakte het rood het blauw. Op een vlag hoort tussen
  // rood en blauw altijd wit te zitten.
  for (const breedte of [12, 25, 38, 90]) {
    for (const hand of [0, 0.35, 1.5]) {
      const knopen = vlagKnopen({ breedteMm: breedte, rnd: zaadje(4), handMm: hand })
      const rechten = plat(knopen).filter(k => k.tag === 'rect')
      const eenheid = breedte / BREED

      const staandRood = rechten.filter(r => r.attr.fill === VLAGROOD)
        .find(r => Number(r.attr.height) > Number(r.attr.width))
      const staandWit = rechten.filter(r => r.attr.fill === VLAGWIT)
        .find(r => Number(r.attr.height) > Number(r.attr.width))

      // links en rechts van het rode kruis moet wit overblijven
      const links = Number(staandRood.attr.x) - Number(staandWit.attr.x)
      const rechts = (Number(staandWit.attr.x) + Number(staandWit.attr.width)) -
        (Number(staandRood.attr.x) + Number(staandRood.attr.width))

      assert.ok(links > eenheid * 0.5,
        `breedte ${breedte}, hand ${hand}: links maar ${links.toFixed(3)} mm wit over`)
      assert.ok(rechts > eenheid * 0.5,
        `breedte ${breedte}, hand ${hand}: rechts maar ${rechts.toFixed(3)} mm wit over`)
    }
  }
})

test('de hoeken blijven hoeken en worden geen sticker', () => {
  // De afronding stond ooit op zes procent van de korte zijde en toen leek het
  // een badge. Een gesneden stempel heeft een hoek die je net niet scherp krijgt.
  const knopen = vlagKnopen({ breedteMm: 40, rnd: zaadje(6), handMm: 0 })
  const omtrek = plat(knopen).find(k => k.tag === 'clipPath').kind[0].attr.d

  const punten = [...omtrek.matchAll(/-?\d+\.?\d*/g)].map(Number)
  const xen = punten.filter((_, i) => i % 2 === 0)
  const yen = punten.filter((_, i) => i % 2 === 1)

  // de omtrek hoort de volle maat te halen: bij een flinke afronding zou de
  // vorm merkbaar krimpen
  assert.ok(Math.max(...xen) - Math.min(...xen) > 40 * 0.985)
  assert.ok(Math.max(...yen) - Math.min(...yen) > 40 * (HOOG / BREED) * 0.98)
})

test('alles wordt op de gesneden rand afgeknipt', () => {
  const knopen = vlagKnopen({ breedteMm: 40, rnd: zaadje(1), id: 'proef' })
  const alles = plat(knopen)

  const clip = alles.find(k => k.tag === 'clipPath')
  assert.ok(clip, 'er hoort een clipPath te zijn')
  assert.equal(clip.attr.id, 'proef-snede')
  assert.equal(clip.attr.clipPathUnits, 'userSpaceOnUse')

  const groep = knopen.find(k => k.tag === 'g')
  assert.equal(groep.attr['clip-path'], 'url(#proef-snede)')

  // en elke kleurvlek zit in die groep, niet erbuiten
  for (const r of plat([groep]).filter(k => k.tag === 'rect')) {
    assert.ok(r.attr.fill, 'een vlak zonder kleur hoort er niet te zijn')
  }
})

test('de rand is niet geclipt, want een hand schiet de hoek voorbij', () => {
  const knopen = vlagKnopen({ breedteMm: 40, rnd: zaadje(1), inktMm: 0.4 })
  const rand = knopen.find(k => k.tag === 'path')

  assert.ok(rand, 'er hoort een randlijn te zijn')
  assert.equal(rand.attr['stroke-width'], 0.4)
  assert.equal(rand.attr.fill, 'none')
  assert.ok(!rand.attr['clip-path'])
})

test('de rand kun je weglaten', () => {
  const knopen = vlagKnopen({ breedteMm: 40, rnd: zaadje(1), inktMm: 0 })
  assert.equal(knopen.filter(k => k.tag === 'path').length, 0)
})

test('de vlag staat waar je hem neerzet', () => {
  const knopen = vlagKnopen({ x: 100, y: 60, breedteMm: 25, rnd: zaadje(9), handMm: 0 })
  const veld = plat(knopen).find(k => k.tag === 'rect' && k.attr.fill === VLAGBLAUW)

  assert.equal(Number(veld.attr.x), 100)
  assert.equal(Number(veld.attr.y), 60)
})

test('hetzelfde zaad geeft dezelfde aandruk', () => {
  const a = vlagKnopen({ breedteMm: 40, rnd: zaadje(12) })
  const b = vlagKnopen({ breedteMm: 40, rnd: zaadje(12) })
  assert.deepEqual(a, b)
})

test('een ander zaad geeft een andere aandruk', () => {
  const a = vlagKnopen({ breedteMm: 40, rnd: zaadje(12) })
  const b = vlagKnopen({ breedteMm: 40, rnd: zaadje(13) })
  assert.notDeepEqual(a, b)
})

test('een vlag zonder breedte levert niets in plaats van te klappen', () => {
  assert.deepEqual(vlagKnopen({ breedteMm: 0, rnd: zaadje(1) }), [])
  assert.deepEqual(vlagKnopen({ breedteMm: -5, rnd: zaadje(1) }), [])
})

test('de kleuren zijn de voorgeschreven kleuren en geen benadering', () => {
  // Een vlag met een net iets ander blauw is geen stijlkeuze maar een fout, en
  // juist dat kijkt niemand na. Vandaar deze test.
  assert.equal(VLAGBLAUW, '#02529c')
  assert.equal(VLAGROOD, '#dc1e35')
  assert.equal(VLAGWIT, '#ffffff')

  const gebruikt = new Set(
    plat(vlagKnopen({ breedteMm: 30, rnd: zaadje(2) }))
      .filter(k => k.tag === 'rect')
      .map(k => k.attr.fill)
  )
  assert.deepEqual([...gebruikt].sort(), [VLAGBLAUW, VLAGROOD, VLAGWIT].sort())
})
