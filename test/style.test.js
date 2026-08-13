import test from 'node:test'
import assert from 'node:assert/strict'
import { standaardStijl, knop, mergeStijl, klem } from '../src/style.js'
import { KNOPPEN, GROEPEN } from '../src/styleSchema.js'

test('geeft voor elke knop uit het schema een standaardwaarde', () => {
  const s = standaardStijl()
  assert.equal(Object.keys(s).length, KNOPPEN.length)

  // niet tegen vaste waarden aanleggen: standaardwaarden mogen veranderen als
  // je het ontwerp bijstelt, en dan moet de test niet omvallen
  for (const k of KNOPPEN) {
    assert.equal(s[k.key], k.standaard, `${k.key} kwam niet uit het schema`)
  }
})

test('elke knop hoort bij een bestaande groep', () => {
  const groepen = new Set(GROEPEN.map(g => g.id))
  for (const k of KNOPPEN) {
    assert.ok(groepen.has(k.groep), `knop ${k.key} zit in onbekende groep ${k.groep}`)
  }
})

test('geen enkele knop komt twee keer voor', () => {
  const gezien = new Set()
  for (const k of KNOPPEN) {
    assert.ok(!gezien.has(k.key), `knop ${k.key} staat dubbel in het schema`)
    gezien.add(k.key)
  }
})

test('elke knop met een bereik heeft een standaardwaarde binnen dat bereik', () => {
  for (const k of KNOPPEN) {
    if (k.min === undefined) continue
    assert.ok(k.standaard >= k.min && k.standaard <= k.max,
      `standaardwaarde van ${k.key} (${k.standaard}) valt buiten ${k.min}..${k.max}`)
  }
})

test('elke keuzeknop heeft een standaardwaarde die in de lijst staat', () => {
  for (const k of KNOPPEN) {
    if (k.type !== 'keuze') continue
    assert.ok(k.opties.includes(k.standaard),
      `standaardwaarde van ${k.key} (${k.standaard}) staat niet in de keuzelijst`)
  }
})

test('elke kleurknop heeft een geldige hexkleur als standaard', () => {
  for (const k of KNOPPEN) {
    if (k.type !== 'kleur') continue
    assert.match(k.standaard, /^#[0-9a-f]{6}$/i, `${k.key} heeft geen geldige kleur`)
  }
})

test('zoekt de definitie van een knop op', () => {
  assert.equal(knop('route.dikteMm').label, 'Dikte binnenlijn')
  assert.equal(knop('bestaat.niet'), undefined)
})

test('legt eigen instellingen over de standaardwaarden heen', () => {
  const { stijl } = mergeStijl({ 'route.kleur': '#0000ff' })
  assert.equal(stijl['route.kleur'], '#0000ff')
  assert.equal(stijl['route.dikteMm'], knop('route.dikteMm').standaard,
    'wat je niet zelf zet, blijft de standaardwaarde')
})

test('laat een latere laag winnen van een eerdere', () => {
  const { stijl } = mergeStijl(
    { 'route.kleur': '#0000ff', 'route.dikteMm': 2 },
    { 'route.kleur': '#00ff00' }
  )
  assert.equal(stijl['route.kleur'], '#00ff00', 'de dag-instelling wint van de boek-instelling')
  assert.equal(stijl['route.dikteMm'], 2, 'wat de dag niet zegt, blijft van het boek')
})

test('negeert onbekende instellingen in plaats van te struikelen', () => {
  const { stijl, genegeerd } = mergeStijl({ 'oude.knop': 42, 'route.kleur': '#0000ff' })
  assert.deepEqual(genegeerd, ['oude.knop'])
  assert.equal(stijl['route.kleur'], '#0000ff', 'de rest moet gewoon werken')
})

test('gaat om met een ontbrekende laag', () => {
  const { stijl } = mergeStijl(null, undefined, { 'route.kleur': '#0000ff' })
  assert.equal(stijl['route.kleur'], '#0000ff')
})

test('klemt een waarde binnen het bereik van zijn knop', () => {
  assert.equal(klem('route.dikteMm', 99), 6, 'boven het maximum wordt het maximum')
  assert.equal(klem('route.dikteMm', -5), 0.1, 'onder het minimum wordt het minimum')
  assert.equal(klem('route.dikteMm', 2), 2, 'binnen het bereik blijft het staan')
})

test('laat waarden zonder bereik met rust', () => {
  assert.equal(klem('route.kleur', '#123456'), '#123456')
  assert.equal(klem('bestaat.niet', 'iets'), 'iets')
})
