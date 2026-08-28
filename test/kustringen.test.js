import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isGesloten, kustRingen, ringOppervlak, verzachtRing
} from '../src/render/kustringen.js'

/**
 * Een hoogteveld met rechthoekige eilanden erin.
 *
 * Buiten de eilanden staat -1, dus zee; erbinnen +1. Dat is genoeg voor
 * marching squares op niveau nul, en het is precies wat het echte hoogtemodel
 * ook doet, alleen dan zonder de duizend rotsjes.
 */
function veldMet (breedte, hoogte, eilanden) {
  const veld = new Float64Array(breedte * hoogte).fill(-1)
  for (const { x, y, b, h } of eilanden) {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + b; i++) veld[j * breedte + i] = 1
    }
  }
  return veld
}

const vierkant = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }
]

test('de oppervlakte van een vierkant is zijde maal zijde', () => {
  assert.equal(Math.abs(ringOppervlak(vierkant)), 100)
})

test('het teken volgt de omloop, dus een gat telt andersom', () => {
  const andersom = [...vierkant].reverse()
  assert.equal(Math.sign(ringOppervlak(vierkant)), -Math.sign(ringOppervlak(andersom)))
  assert.equal(ringOppervlak(vierkant), -ringOppervlak(andersom))
})

test('een lijn zonder oppervlak telt als nul', () => {
  assert.equal(ringOppervlak([{ x: 0, y: 0 }, { x: 5, y: 5 }]), 0)
  assert.equal(ringOppervlak([]), 0)
  assert.equal(ringOppervlak(null), 0)
})

test('een gesloten ring wordt herkend en een open lijn niet', () => {
  assert.ok(isGesloten(vierkant))
  assert.ok(!isGesloten(vierkant.slice(0, -1)))
})

test('verzachten houdt de ring gesloten en laat geen knik op de naad staan', () => {
  const zacht = verzachtRing(vierkant, 2)
  assert.ok(isGesloten(zacht), 'de ring is opengebroken')

  // Het beginpunt is een hoek van het vierkant. Rondgaand middelen hoort die
  // net zo goed af te ronden als de andere drie; hield hij hem vast, dan bleef
  // hij precies op (0,0) staan.
  assert.notDeepEqual(
    { x: zacht[0].x, y: zacht[0].y },
    { x: 0, y: 0 }
  )
})

test('verzachten snijdt de hoeken af en laat de vorm verder staan', () => {
  // Op een echte kustlijn zitten honderden punten, en dan haalt het middelen
  // alleen de trapjes eraf. Tweehonderd punten is daar het eerlijke model voor;
  // het vierkant hierboven bestaat uit vier punten en die zijn állemaal hoek,
  // dus daar eet middelen wel driekwart van de oppervlakte op.
  //
  // Hoeveel het scheelt is uit te rekenen: middelen schaalt een ronde vorm met
  // (1 + cos(2π/n)) / 2 per ronde. Bij n = 200 is dat 0,99975, dus na twee
  // rondes blijft er 99,9 procent van de oppervlakte over. Bij n = 60 was het
  // al bijna anderhalf procent, en dat is waarom dit getal in de test staat.
  const punten = 200
  const cirkel = []
  for (let i = 0; i < punten; i++) {
    const hoek = (i / punten) * Math.PI * 2
    cirkel.push({ x: 50 + Math.cos(hoek) * 20, y: 50 + Math.sin(hoek) * 20 })
  }
  cirkel.push({ ...cirkel[0] })

  const voor = ringOppervlak(cirkel)
  const na = ringOppervlak(verzachtRing(cirkel, 2))

  assert.equal(Math.sign(na), Math.sign(voor), 'de ring is omgeklapt')
  assert.ok(Math.abs(na) < Math.abs(voor), 'middelen hoort de hoeken af te snijden')
  assert.ok(Math.abs(na) > Math.abs(voor) * 0.995, 'maar de vorm hoort te blijven staan')
})

test('één eiland levert één gesloten ring op', () => {
  const veld = veldMet(40, 40, [{ x: 10, y: 10, b: 20, h: 20 }])
  const ringen = kustRingen({ veld, kolommen: 40, rijen: 40, rondes: 0 })

  assert.equal(ringen.length, 1)
  assert.ok(isGesloten(ringen[0]))

  // de kust ligt een halve cel buiten het land, want daar kruist de hoogte nul
  const xen = ringen[0].map(p => p.x)
  const yen = ringen[0].map(p => p.y)
  assert.ok(Math.min(...xen) >= 9 && Math.max(...xen) <= 30)
  assert.ok(Math.min(...yen) >= 9 && Math.max(...yen) <= 30)
})

test('de oppervlaktegrens haalt de rotsjes voor de kust weg', () => {
  const veld = veldMet(60, 60, [
    { x: 10, y: 10, b: 30, h: 30 }, // het eiland
    { x: 46, y: 12, b: 2, h: 2 }, // drie stipjes ernaast
    { x: 46, y: 20, b: 2, h: 2 },
    { x: 46, y: 28, b: 1, h: 1 }
  ])

  const alles = kustRingen({ veld, kolommen: 60, rijen: 60, rondes: 0 })
  assert.equal(alles.length, 4, 'zonder grens doen de stipjes gewoon mee')

  const groot = kustRingen({ veld, kolommen: 60, rijen: 60, rondes: 0, minCellen: 50 })
  assert.equal(groot.length, 1, 'met de grens blijft alleen het eiland over')
  assert.ok(Math.abs(ringOppervlak(groot[0])) > 800)
})

test('de grootste ring komt eerst, hoe het rooster ook geordend is', () => {
  const veld = veldMet(60, 60, [
    { x: 4, y: 4, b: 4, h: 4 }, // dit kleintje ligt linksboven, dus wordt eerst gevonden
    { x: 20, y: 20, b: 25, h: 25 }
  ])

  const ringen = kustRingen({ veld, kolommen: 60, rijen: 60, rondes: 0 })
  const maten = ringen.map(r => Math.abs(ringOppervlak(r)))
  assert.deepEqual(maten, [...maten].sort((a, b) => b - a))
})

test('een meer onder zeeniveau komt als tweede ring terug, binnen de eerste', () => {
  const veld = veldMet(60, 60, [{ x: 10, y: 10, b: 40, h: 40 }])
  // een gat midden in het land
  for (let j = 25; j < 35; j++) {
    for (let i = 25; i < 35; i++) veld[j * 60 + i] = -1
  }

  const ringen = kustRingen({ veld, kolommen: 60, rijen: 60, rondes: 0 })
  assert.equal(ringen.length, 2)

  const [kust, meer] = ringen
  assert.ok(Math.abs(ringOppervlak(meer)) < Math.abs(ringOppervlak(kust)))

  // het meer ligt helemaal binnen de kust
  assert.ok(Math.min(...meer.map(p => p.x)) > Math.min(...kust.map(p => p.x)))
  assert.ok(Math.max(...meer.map(p => p.x)) < Math.max(...kust.map(p => p.x)))
})

test('de omloopsrichting ligt niet vast, dus het vlak moet evenodd zijn', () => {
  // Dit is geen wens maar een waarschuwing in testvorm. `rijg` begint bij het
  // eerste streepje dat het tegenkomt, dus de richting waarin een ring
  // terugkomt hangt af van waar hij in het rooster ligt. Wie deze ringen met
  // fill-rule nonzero vult krijgt de ene keer een gat en de andere keer niet.
  const linksboven = veldMet(60, 60, [{ x: 5, y: 5, b: 20, h: 20 }])
  const rechtsonder = veldMet(60, 60, [{ x: 35, y: 35, b: 20, h: 20 }])

  const a = kustRingen({ veld: linksboven, kolommen: 60, rijen: 60, rondes: 0 })[0]
  const b = kustRingen({ veld: rechtsonder, kolommen: 60, rijen: 60, rondes: 0 })[0]

  assert.equal(Math.abs(ringOppervlak(a)), Math.abs(ringOppervlak(b)),
    'twee even grote eilanden horen even groot terug te komen')
})

test('vereenvoudigen laat de ring heel en houdt hem gesloten', () => {
  const veld = veldMet(60, 60, [{ x: 10, y: 10, b: 40, h: 40 }])
  const ruw = kustRingen({ veld, kolommen: 60, rijen: 60, rondes: 2 })[0]
  const dun = kustRingen({ veld, kolommen: 60, rijen: 60, rondes: 2, tolerantie: 0.5 })[0]

  assert.ok(dun.length < ruw.length, 'er hoort iets weg te vallen')
  assert.ok(isGesloten(dun), 'en de ring hoort dicht te blijven')
  assert.equal(Math.sign(ringOppervlak(dun)), Math.sign(ringOppervlak(ruw)))
  assert.ok(
    Math.abs(Math.abs(ringOppervlak(dun)) - Math.abs(ringOppervlak(ruw))) < Math.abs(ringOppervlak(ruw)) * 0.05,
    'de vorm mag er niet noemenswaardig van veranderen'
  )
})

test('een gat in de metingen wordt zee en geen eiland', () => {
  const veld = veldMet(40, 40, [{ x: 10, y: 10, b: 20, h: 20 }])
  const metGat = Float64Array.from(veld)
  metGat[5 * 40 + 5] = NaN

  const ringen = kustRingen({ veld: metGat, kolommen: 40, rijen: 40, rondes: 0 })
  assert.equal(ringen.length, 1, 'NaN hoort bij de zee te vallen, niet een rotsje te worden')
})

test('een leeg of ontaard rooster geeft niets terug in plaats van te klappen', () => {
  assert.deepEqual(kustRingen({ veld: new Float64Array(0), kolommen: 0, rijen: 0 }), [])
  assert.deepEqual(kustRingen({ veld: new Float64Array(1), kolommen: 1, rijen: 1 }), [])

  // alles zee: geen enkele kust
  const zee = new Float64Array(400).fill(-1)
  assert.deepEqual(kustRingen({ veld: zee, kolommen: 20, rijen: 20 }), [])
})
