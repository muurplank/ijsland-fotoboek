import test from 'node:test'
import assert from 'node:assert/strict'
import { standaardStijl } from '../src/style.js'
import {
  VORMEN, VORM_INFO, hoogteTrap, kleurOpHoogte, bandGrenzen, profielVorm
} from '../src/render/profielvorm.js'

const STIJL = standaardStijl()

/** Een profiel dat van zeeniveau naar een pas klimt en weer zakt. */
function proefPunten (aantal = 200, top = 900) {
  return Array.from({ length: aantal }, (_, i) => {
    const t = i / (aantal - 1)
    return { km: t * 120, m: top * Math.sin(t * Math.PI) }
  })
}

function proefContext (extra = {}) {
  const punten = extra.punten ?? proefPunten()
  const bovenGrens = 1000
  const links = 20, rechts = 280, boven = 40, onder = 110
  return {
    punten,
    bovenGrens,
    links,
    rechts,
    boven,
    onder,
    xVan: km => links + (km / punten.at(-1).km) * (rechts - links),
    yVan: m => onder - (m / bovenGrens) * (onder - boven),
    stijl: STIJL,
    lijnMm: STIJL['profiel.lijnDikteMm'],
    id: 'proef',
    ...extra
  }
}

/** Alle knopen plat, inclusief wat er in defs zit. */
function alleKnopen (knopen) {
  return knopen.flatMap(k => [k, ...alleKnopen(k.kind ?? [])])
}

// ------------------------------------------------------------------ hoogtetrap

test('de hoogtetrap loopt op, ook als de schuifjes door elkaar staan', () => {
  const trap = hoogteTrap({
    ...STIJL,
    'profiel.laagM': 900,
    'profiel.middenM': 200,
    'profiel.hoogM': 400,
    'profiel.piekM': 100
  })

  assert.equal(trap.length, 5)
  for (let i = 1; i < trap.length; i++) {
    assert.ok(trap[i].m > trap[i - 1].m,
      `stap ${i} (${trap[i].m} m) hoort boven stap ${i - 1} (${trap[i - 1].m} m) te liggen`)
  }
})

test('op een trapstap zelf krijg je precies die kleur', () => {
  const trap = hoogteTrap(STIJL)
  assert.equal(kleurOpHoogte(trap, 0), STIJL['profiel.dal'])
  assert.equal(kleurOpHoogte(trap, STIJL['profiel.middenM']), STIJL['profiel.midden'])
})

test('onder en boven de trap blijft de kleur staan, geen zwart gat', () => {
  const trap = hoogteTrap(STIJL)
  assert.equal(kleurOpHoogte(trap, -50), STIJL['profiel.dal'])
  assert.equal(kleurOpHoogte(trap, 99999), STIJL['profiel.piek'])
})

test('tussen twee stappen wordt gemengd, niet gesprongen', () => {
  const trap = hoogteTrap(STIJL)
  const halverwege = kleurOpHoogte(trap, (trap[0].m + trap[1].m) / 2)

  assert.match(halverwege, /^#[0-9a-f]{6}$/, `verwachtte een hexkleur, kreeg ${halverwege}`)
  assert.notEqual(halverwege, trap[0].kleur)
  assert.notEqual(halverwege, trap[1].kleur)
})

// ------------------------------------------------------------------- banden

test('de banden dekken de hele grafiek, tot precies aan de bovengrens', () => {
  const grenzen = bandGrenzen(1000, 100)
  assert.equal(grenzen[0], 0)
  assert.equal(grenzen.at(-1), 1000)
  for (let i = 1; i < grenzen.length; i++) {
    assert.ok(grenzen[i] > grenzen[i - 1], 'grenzen horen op te lopen')
  }
})

test('een piepkleine bandstap levert geen duizend rechthoekjes op', () => {
  const grenzen = bandGrenzen(2000, 1)
  assert.ok(grenzen.length <= 65,
    `${grenzen.length} banden is te veel om nog te drukken`)
})

// -------------------------------------------------------------- alle vormen

test('elke vorm levert knopen op zonder NaN erin', () => {
  for (const vorm of VORMEN) {
    const knopen = profielVorm(vorm, proefContext())
    assert.ok(knopen.length > 0, `${vorm} tekende niets`)

    for (const knoop of alleKnopen(knopen)) {
      for (const [naam, waarde] of Object.entries(knoop.attr ?? {})) {
        assert.ok(!String(waarde).includes('NaN'),
          `${vorm}: ${knoop.tag}.${naam} werd ${waarde}`)
      }
    }
  }
})

test('elke vorm tekent de hoogtelijn zelf erover', () => {
  for (const vorm of VORMEN) {
    const knopen = profielVorm(vorm, proefContext())
    const lijnen = alleKnopen(knopen).filter(k => k.tag === 'polyline')
    assert.ok(lijnen.length >= 1, `${vorm} tekende geen profiellijn`)
  }
})

test('elke vorm geeft zijn defs een eigen naam, zodat twee grafieken elkaar niet stelen', () => {
  for (const vorm of VORMEN) {
    const eenId = alleKnopen(profielVorm(vorm, proefContext({ id: 'een' })))
      .map(k => k.attr?.id).filter(Boolean)
    const anderId = alleKnopen(profielVorm(vorm, proefContext({ id: 'ander' })))
      .map(k => k.attr?.id).filter(Boolean)

    for (const naam of eenId) {
      assert.ok(!anderId.includes(naam),
        `${vorm}: id "${naam}" komt in beide grafieken voor`)
    }
  }
})

test('een onbekende vorm valt terug op het silhouet in plaats van niets te tekenen', () => {
  const onzin = profielVorm('bananen', proefContext())
  const silhouet = profielVorm('silhouet', proefContext())
  assert.deepEqual(onzin, silhouet)
})

test('een profiel van één punt laat de boel niet omvallen', () => {
  for (const vorm of VORMEN) {
    assert.doesNotThrow(
      () => profielVorm(vorm, proefContext({ punten: [{ km: 0, m: 0 }] })),
      `${vorm} viel om op een profiel van één punt`)
  }
})

// ------------------------------------------------------------ per vorm

test('het silhouet sluit zijn vlak op de basislijn', () => {
  const ctx = proefContext()
  const vlak = profielVorm('silhouet', ctx).find(k => k.tag === 'polygon')

  const punten = vlak.attr.points.trim().split(/\s+/)
  assert.equal(punten[0], `${ctx.links},${ctx.onder}`, 'begint linksonder')
  assert.equal(punten.at(-1), `${ctx.rechts},${ctx.onder}`, 'eindigt rechtsonder')
})

test('de lagen blijven binnen de omtrek van het profiel', () => {
  const knopen = profielVorm('lagen', proefContext())
  const banden = knopen.filter(k => k.tag === 'rect')

  assert.ok(banden.length > 1, 'verwachtte meerdere banden')
  for (const band of banden) {
    assert.match(band.attr['clip-path'] ?? '', /^url\(#/,
      'een band zonder clip zou als blok over de hele grafiek liggen')
    assert.ok(band.attr.height > 0, 'een band met hoogte nul is een onzichtbare band')
  }
})

test('de lagen kleuren donkerder naarmate ze hoger liggen', () => {
  const knopen = profielVorm('lagen', proefContext())
  const banden = knopen.filter(k => k.tag === 'rect')

  const grijs = hex => [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16))
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)

  const onderste = grijs(banden[0].attr.fill)
  const bovenste = grijs(banden.at(-1).attr.fill)
  assert.ok(bovenste < onderste,
    `de bovenste band (${bovenste.toFixed(0)}) hoort donkerder te zijn dan de onderste (${onderste.toFixed(0)})`)
})

test('de kam zet zijn streepjes op de afgesproken afstand', () => {
  const afstand = 1.5
  const ctx = proefContext({ stijl: { ...STIJL, 'profiel.kamAfstandMm': afstand } })
  const strepen = profielVorm('kam', ctx).filter(k => k.tag === 'line')

  assert.ok(strepen.length > 5, 'verwachtte een reeks streepjes')
  for (let i = 1; i < strepen.length; i++) {
    const gat = strepen[i].attr.x1 - strepen[i - 1].attr.x1
    assert.ok(gat >= afstand * 0.9,
      `streepje ${i} staat ${gat.toFixed(2)} mm van de vorige, afgesproken was ${afstand}`)
  }
})

test('elk kamstreepje staat op de basislijn en reikt tot het profiel', () => {
  const ctx = proefContext()
  const strepen = profielVorm('kam', ctx).filter(k => k.tag === 'line')

  for (const streep of strepen) {
    assert.equal(streep.attr.y1, ctx.onder, 'een streepje hoort op de basislijn te staan')
    assert.ok(streep.attr.y2 <= ctx.onder, 'en omhoog te lopen, niet omlaag')
    assert.ok(streep.attr.y2 >= ctx.boven, 'en niet boven de grafiek uit te steken')
  }
})

test('de arcering wordt fijner naarmate het hoger wordt', () => {
  const knopen = profielVorm('arcering', proefContext())
  const patronen = alleKnopen(knopen).filter(k => k.tag === 'pattern')

  assert.ok(patronen.length > 1, 'verwachtte een patroon per band')
  const eerste = Number(patronen[0].attr.width)
  const laatste = Number(patronen.at(-1).attr.width)
  assert.ok(laatste < eerste,
    `bovenin hoort de arcering dichter te staan: ${laatste} vs ${eerste}`)
})

test('het terras trekt zijn hoogtelijnen binnen het vlak', () => {
  const knopen = profielVorm('terras', proefContext())
  const lijnen = knopen.filter(k => k.tag === 'line')

  assert.ok(lijnen.length > 1, 'verwachtte meerdere hoogtelijnen')
  for (const lijn of lijnen) {
    assert.match(lijn.attr['clip-path'] ?? '', /^url\(#/,
      'een hoogtelijn zonder clip loopt dwars over de hele pagina')
    assert.equal(lijn.attr.y1, lijn.attr.y2, 'een hoogtelijn hoort waterpas te liggen')
  }
})

test('de spiegel blijft binnen het vak dat hij krijgt', () => {
  const ctx = proefContext()
  const knopen = profielVorm('spiegel', ctx)

  const ys = alleKnopen(knopen).flatMap(k => {
    const p = k.attr?.points
    if (p) return p.trim().split(/\s+/).map(paar => Number(paar.split(',')[1]))
    return [k.attr?.y1, k.attr?.y2].filter(v => typeof v === 'number')
  })

  assert.ok(ys.length > 0, 'verwachtte punten om te controleren')
  for (const y of ys) {
    assert.ok(y >= ctx.boven - 0.01 && y <= ctx.onder + 0.01,
      `${y} valt buiten het vak ${ctx.boven}–${ctx.onder}`)
  }
})

test('de spiegel weet dat zijn hoogteas niet meer klopt', () => {
  assert.equal(VORM_INFO.spiegel.hoogteAs, false,
    'een gespiegelde grafiek met een gewone hoogteas laat je verkeerd aflezen')
  for (const vorm of VORMEN.filter(v => v !== 'spiegel')) {
    assert.equal(VORM_INFO[vorm].hoogteAs, true, `${vorm} hoort een gewone hoogteas te hebben`)
  }
})
