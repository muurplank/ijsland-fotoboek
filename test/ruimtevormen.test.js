import test from 'node:test'
import assert from 'node:assert/strict'

import {
  leegModel, voegSamen, verplaats, schaal, draai, spiegel,
  ring, afgerondeRechthoek, loft, prisma, draaiLichaam, hoogteVeld, pad
} from '../src/render/ruimtevormen.js'

/** De controle die elke hernummerfout vangt: wijst elke ketting naar bestaande punten? */
function kettingenKloppen (model, naam) {
  for (const lijn of model.lijnen) {
    for (const i of lijn.ketting) {
      assert.ok(Number.isInteger(i) && i >= 0 && i < model.punten.length,
        `${naam}: ketting wijst naar punt ${i} van de ${model.punten.length}`)
    }
  }
}

test('een leeg model heeft geen punten en geen lijnen', () => {
  const leeg = leegModel()
  assert.equal(leeg.punten.length, 0)
  assert.equal(leeg.lijnen.length, 0)
})

test('een ring van acht zijden levert acht punten op een cirkel', () => {
  const acht = ring(2, 8)
  assert.equal(acht.length, 8)
  for (const p of acht) {
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - 2) < 1e-9,
      `punt lag op ${Math.hypot(p.x, p.y)} in plaats van op straal 2`)
  }
})

test('een ring van minder dan drie zijden is geen vorm en wordt er alsnog een', () => {
  assert.equal(ring(1, 1).length, 3)
})

test('een afgeronde rechthoek zonder ronding is gewoon een rechthoek', () => {
  assert.equal(afgerondeRechthoek(4, 2, 0).length, 4)
})

test('een afgeronde rechthoek blijft binnen zijn eigen breedte en diepte', () => {
  for (const p of afgerondeRechthoek(4, 2, 0.5, 3)) {
    assert.ok(Math.abs(p.x) <= 2 + 1e-9, `x liep uit tot ${p.x}`)
    assert.ok(Math.abs(p.y) <= 1 + 1e-9, `y liep uit tot ${p.y}`)
  }
})

test('een draailichaam sluit zijn ringen', () => {
  const kegel = draaiLichaam([{ r: 1, z: 0 }, { r: 0.5, z: 2 }], 6)
  const ringen = kegel.lijnen.filter(l => l.ketting.length === 7)

  assert.equal(ringen.length, 2, 'verwachtte een gesloten ring per doorsnede')
  for (const r of ringen) {
    assert.equal(r.ketting[0], r.ketting.at(-1), 'de ring liep niet rond')
  }
})

test('een draailichaam trekt zijn meridianen als één lijn door alle doorsneden', () => {
  const zuil = draaiLichaam([{ r: 1, z: 0 }, { r: 1, z: 1 }, { r: 1, z: 2 }], 6)
  const meridianen = zuil.lijnen.filter(l => l.ketting.length === 3)

  assert.equal(meridianen.length, 6,
    `verwachtte zes meridianen, kreeg er ${meridianen.length}`)
})

test('een doorsnede die tot niets krimpt wordt de top van een spits', () => {
  const spits = loft([
    { omtrek: ring(1, 4), z: 0 },
    { omtrek: ring(1, 4), z: 3, schaal: 0 }
  ])

  assert.equal(spits.punten.length, 5, 'de top hoort één punt te zijn')
  kettingenKloppen(spits, 'spits')

  const top = spits.punten.at(-1)
  assert.ok(Math.abs(top.x) < 1e-9 && Math.abs(top.y) < 1e-9, 'de top stond niet op de as')
})

test('een prisma zet dezelfde omtrek op twee hoogtes', () => {
  const doos = prisma(afgerondeRechthoek(2, 2, 0), 0, 1)
  assert.equal(doos.punten.length, 8)
  assert.ok(doos.punten.every(p => p.z === 0 || p.z === 1))
})

test('samenvoegen laat de kettingen naar de goede punten wijzen', () => {
  const een = prisma(ring(1, 4), 0, 1)
  const twee = prisma(ring(1, 4), 2, 3)
  const samen = voegSamen(een, twee)

  assert.equal(samen.punten.length, een.punten.length + twee.punten.length)
  assert.equal(samen.lijnen.length, een.lijnen.length + twee.lijnen.length)
  kettingenKloppen(samen, 'samengevoegd')

  const laatste = samen.lijnen.at(-1)
  assert.ok(Math.max(...laatste.ketting) >= een.punten.length,
    'het tweede model wijst nog naar de punten van het eerste')
})

test('samenvoegen slaat ontbrekende modellen over in plaats van om te vallen', () => {
  const samen = voegSamen(prisma(ring(1, 4), 0, 1), null, undefined)
  kettingenKloppen(samen, 'met gaten')
})

test('verplaatsen en schalen laten het aantal punten met rust', () => {
  const bron = draaiLichaam([{ r: 1, z: 0 }, { r: 1, z: 1 }], 8)
  const verzet = schaal(verplaats(bron, { x: 3, z: 2 }), 2)

  assert.equal(verzet.punten.length, bron.punten.length)
  assert.equal(verzet.lijnen.length, bron.lijnen.length)
  kettingenKloppen(verzet, 'verzet')
})

test('verplaatsen laat het model waar het stond niet achter', () => {
  const bron = pad([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }])
  verplaats(bron, { x: 5 })
  assert.equal(bron.punten[0].x, 0, 'de bron zelf werd verschoven')
})

test('een kwartslag om de staande as zet x op y', () => {
  const gedraaid = draai(pad([{ x: 1, y: 0, z: 0 }]), 90, 'z')
  assert.ok(Math.abs(gedraaid.punten[0].x) < 1e-9)
  assert.ok(Math.abs(gedraaid.punten[0].y - 1) < 1e-9)
})

test('een kwartslag om de x-as zet een liggend wiel rechtop', () => {
  const gedraaid = draai(pad([{ x: 0, y: 0, z: 1 }]), 90, 'x')
  assert.ok(Math.abs(gedraaid.punten[0].y + 1) < 1e-9,
    `verwachtte y = -1, kreeg ${gedraaid.punten[0].y}`)
})

test('spiegelen verdubbelt het model in plaats van het te verplaatsen', () => {
  const vleugel = prisma(afgerondeRechthoek(2, 1, 0), 0, 0.2)
  const beide = spiegel(vleugel, 'y')

  assert.equal(beide.punten.length, vleugel.punten.length * 2)
  kettingenKloppen(beide, 'gespiegeld')
  assert.ok(beide.punten.some(p => p.y > 0) && beide.punten.some(p => p.y < 0))
})

test('een hoogteveld levert even veel rijen als kolommen aan lijnen op', () => {
  const veld = hoogteVeld(() => 0, { nx: 7, ny: 7 })
  assert.equal(veld.punten.length, 49)
  assert.equal(veld.lijnen.length, 14)
  kettingenKloppen(veld, 'hoogteveld')
})

test('een hoogteveld legt de hoogtefunctie op het hele vlak neer', () => {
  const veld = hoogteVeld((u, v) => u + v, { nx: 3, ny: 3, van: { x: 0, y: 0 }, tot: { x: 1, y: 1 } })
  assert.equal(veld.punten[0].z, 0, 'de hoek bij nul lag niet op nul')
  assert.equal(veld.punten.at(-1).z, 2, 'de verste hoek kreeg niet de hoogste waarde')
})

test('een hoogteveld van één punt breed is geen veld en wordt er alsnog een', () => {
  const veld = hoogteVeld(() => 0, { nx: 1, ny: 1 })
  assert.equal(veld.punten.length, 4)
  kettingenKloppen(veld, 'ontaard hoogteveld')
})

test('een pad is één ketting door alle punten', () => {
  const streep = pad([{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, { x: 2, y: 0, z: 0 }], 2)
  assert.equal(streep.lijnen.length, 1)
  assert.deepEqual(streep.lijnen[0].ketting, [0, 1, 2])
  assert.equal(streep.lijnen[0].nadruk, 2)
})

test('elke bouwsteen levert kettingen op die naar bestaande punten wijzen', () => {
  const alles = {
    draailichaam: draaiLichaam([{ r: 1, z: 0 }, { r: 0.4, z: 2 }, { r: 0, z: 3 }], 8),
    prisma: prisma(afgerondeRechthoek(3, 2, 0.4, 2), 0, 1),
    hoogteveld: hoogteVeld((u, v) => Math.sin(u * 3) * v, { nx: 9, ny: 9 }),
    loft: loft([
      { omtrek: ring(1, 6), z: 0 },
      { omtrek: ring(1, 6), z: 1, schaal: 1.4, verschuif: { x: 0.5 } }
    ]),
    pad: pad([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 2 }])
  }

  for (const [naam, model] of Object.entries(alles)) {
    assert.ok(model.punten.length > 0, `${naam} leverde geen punten op`)
    assert.ok(model.lijnen.length > 0, `${naam} leverde geen lijnen op`)
    kettingenKloppen(model, naam)

    for (const p of model.punten) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
        `${naam} leverde een punt op dat geen getal is`)
    }
  }
})
