import test from 'node:test'
import assert from 'node:assert/strict'
import {
  controleerGoogleSleutel,
  fotoVerzoek,
  haalGoogleSleutel,
  leesFoto,
  NANO_BANANA_MODELLEN,
  printbreedteMm
} from '../src/fetch/nanobanana.js'

const SLEUTEL = 'AIzaTestsleutel'

test('stuurt de prompt naar het beeldmodel van dit moment', () => {
  const verzoek = fotoVerzoek({ prompt: 'de Skogafoss in de mist', sleutel: SLEUTEL })

  assert.equal(verzoek.url, 'https://generativelanguage.googleapis.com/v1beta/interactions')
  assert.equal(verzoek.body.model, 'gemini-3.1-flash-image')
  assert.deepEqual(verzoek.body.input, [{ type: 'text', text: 'de Skogafoss in de mist' }])
})

test('zet de sleutel in de header en niet in de url', () => {
  const verzoek = fotoVerzoek({ prompt: 'iets', sleutel: SLEUTEL })

  assert.equal(verzoek.headers['x-goog-api-key'], SLEUTEL)
  assert.ok(!verzoek.url.includes(SLEUTEL), 'sleutel hoort niet in de url')
})

test('vraagt jpeg, want dat is het enige dat Google levert', () => {
  const verzoek = fotoVerzoek({ prompt: 'iets', sleutel: SLEUTEL, verhouding: '16:9', formaat: '4K' })

  assert.deepEqual(verzoek.body.response_format, {
    type: 'image',
    mime_type: 'image/jpeg',
    aspect_ratio: '16:9',
    image_size: '4K'
  })
})

test('weigert een onbekend model, een rare verhouding en een lege prompt', () => {
  assert.throws(() => fotoVerzoek({ prompt: 'iets', sleutel: SLEUTEL, model: 'bestaatniet' }), /onbekend nano banana-model/i)
  assert.throws(() => fotoVerzoek({ prompt: 'iets', sleutel: SLEUTEL, verhouding: '7:3' }), /onbekende verhouding/i)
  assert.throws(() => fotoVerzoek({ prompt: '   ', sleutel: SLEUTEL }), /lege prompt/i)
})

test('zegt het als het gekozen model die maat niet aankan', () => {
  // De lichte modellen leveren hoogstens 1K; dat merk je liever hier dan na het betalen
  assert.throws(
    () => fotoVerzoek({ prompt: 'iets', sleutel: SLEUTEL, model: 'nano-banana-2-lite', formaat: '4K' }),
    /niets groter dan 1K/i
  )
})

test('kent van elk model de grootste maat', () => {
  for (const [naam, model] of Object.entries(NANO_BANANA_MODELLEN)) {
    assert.match(model.id, /^gemini-[\d.]+-(flash|pro)/, `${naam} heeft een rare model-id`)
    assert.ok(['512px', '1K', '2K', '4K'].includes(model.maxFormaat), `${naam} mist een maat`)
  }
})

test('rekent een formaat om naar millimeters op papier', () => {
  // 4096 pixels op 600 dpi is 173 mm; 1K haalt niet eens een half A5'je
  assert.ok(Math.abs(printbreedteMm('4K') - 173.4) < 0.5, printbreedteMm('4K'))
  assert.ok(Math.abs(printbreedteMm('1K') - 43.3) < 0.5, printbreedteMm('1K'))
  assert.ok(printbreedteMm('2K', 300) > printbreedteMm('2K', 600))
})

test('vist het beeld uit de tijdlijn die terugkomt', () => {
  const beeld = Buffer.from('doetalsofditeenjpegis')
  const foto = leesFoto({
    steps: [
      { type: 'user_input', content: [{ type: 'text', text: 'de Skogafoss' }] },
      { type: 'thought', signature: 'Ev...' },
      { type: 'model_output', content: [{ type: 'image', mime_type: 'image/jpeg', data: beeld.toString('base64') }] }
    ]
  })

  assert.deepEqual(foto, beeld)
})

test('geeft de uitleg van het model door als er geen beeld komt', () => {
  assert.throws(
    () => leesFoto({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'Dat wil ik niet tekenen.' }] }] }),
    /dat wil ik niet tekenen/i
  )
  assert.throws(() => leesFoto({ steps: [] }), /geen beeld/i)
})

test('legt uit waar je een sleutel haalt als hij ontbreekt', () => {
  assert.throws(() => controleerGoogleSleutel(null), /aistudio\.google\.com/i)
  assert.throws(() => controleerGoogleSleutel(''), /sleutel/i)
})

test('herkent een verdwaalde Mapbox-token en geplakte witruimte', () => {
  assert.throws(() => controleerGoogleSleutel('pk.eyJhbGci'), /mapbox/i)
  assert.throws(() => controleerGoogleSleutel('AIza met een spatie'), /witruimte/i)
})

test('laat de omgeving voorgaan op het bestand', async (t) => {
  t.after(() => { delete process.env.GOOGLE_API_KEY; delete process.env.GEMINI_API_KEY })

  process.env.GOOGLE_API_KEY = 'AIzaUitDeOmgeving'
  assert.equal(await haalGoogleSleutel(), 'AIzaUitDeOmgeving')

  // Googles eigen voorbeelden gebruiken deze naam, dus die accepteren we ook
  delete process.env.GOOGLE_API_KEY
  process.env.GEMINI_API_KEY = '  AIzaMetSpatiesEromheen  '
  assert.equal(await haalGoogleSleutel(), 'AIzaMetSpatiesEromheen')
})
