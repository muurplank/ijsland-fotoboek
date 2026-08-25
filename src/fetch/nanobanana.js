/**
 * Verzonnen beeld laten maken door Nano Banana, het beeldmodel van Google.
 *
 * Bedoeld voor de plekken in het boek waar geen eigen foto van is: een
 * hoofdstukopener, een sfeerbeeld naast een dag waarvan alles mislukt is. Wat
 * hieruit komt is getekend door een model en geen herinnering, dus houd het
 * herkenbaar apart van de echte foto's.
 *
 * De sleutel haal je op aistudio.google.com/apikey en zet je in
 * data/secrets.json onder "googleApiKey", of in de omgeving als GOOGLE_API_KEY.
 *
 * Anders dan de rest van dit project kost dit geld per plaatje. Daarom gaat elk
 * resultaat door dezelfde schijfcache als de tegels: dezelfde prompt met
 * dezelfde instellingen wordt maar een keer gemaakt en daarna van schijf
 * geleverd. Wil je een tweede poging op dezelfde prompt, verhoog dan `variant`.
 */

import { createHash } from 'node:crypto'

import { cached, fetchWithRetry } from './cache.js'
import { haalGeheim } from './geheimen.js'

/**
 * Google praat sinds 2026 met de Interactions-API; de oude
 * `models/...:generateContent` werkt nog wel, maar de beeldmodellen worden
 * hier gedocumenteerd.
 */
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions'

/**
 * De modellen, met hun officiele naam bij Google en de grootste maat die ze
 * aankunnen. "Nano banana" is de bijnaam die bleef hangen; in de rekening heet
 * het gewoon Gemini.
 */
export const NANO_BANANA_MODELLEN = {
  'nano-banana-2': { id: 'gemini-3.1-flash-image', label: 'Nano Banana 2', maxFormaat: '4K' },
  'nano-banana-pro': { id: 'gemini-3-pro-image', label: 'Nano Banana Pro', maxFormaat: '4K' },
  'nano-banana-2-lite': { id: 'gemini-3.1-flash-lite-image', label: 'Nano Banana 2 Lite', maxFormaat: '1K' },
  'nano-banana': { id: 'gemini-2.5-flash-image', label: 'Nano Banana (de eerste)', maxFormaat: '1K' }
}

export const STANDAARD_MODEL = 'nano-banana-2'

/**
 * De lange zijde in pixels, bij benadering: Google rondt af op wat bij de
 * verhouding past. Genoeg om vooraf te weten hoe groot het op papier mag worden.
 */
export const FORMATEN = { '512px': 512, '1K': 1024, '2K': 2048, '4K': 4096 }

/** De verhoudingen die Google aanbiedt. */
export const VERHOUDINGEN = ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']

/**
 * Hoe breed dit formaat op papier mag worden voordat het onder de drukgrens
 * zakt. Dit project rekent in millimeters, dus je wilt dit weten voordat je een
 * plaatje over een halve pagina legt: 1K is op 600 dpi maar 43 mm.
 */
export function printbreedteMm (formaat, dpi = 600) {
  const px = FORMATEN[formaat]
  if (!px) throw new Error(`Onbekend formaat "${formaat}". Beschikbaar: ${Object.keys(FORMATEN).join(', ')}`)
  return (px / dpi) * 25.4
}

/** Kijkt of de sleutel bruikbaar is, met uitleg als dat niet zo is. */
export function controleerGoogleSleutel (sleutel) {
  if (!sleutel) {
    throw new Error(
      'Geen Google-sleutel gevonden. Maak er een op aistudio.google.com/apikey en zet hem ' +
      'in data/secrets.json onder "googleApiKey", of in de omgeving als GOOGLE_API_KEY.'
    )
  }
  if (sleutel.startsWith('pk.') || sleutel.startsWith('sk.')) {
    throw new Error('Dit is een Mapbox-token, geen Google-sleutel; die haal je op aistudio.google.com/apikey.')
  }
  if (/\s/.test(sleutel)) {
    throw new Error('Er zit witruimte in de Google-sleutel; waarschijnlijk is er iets misgegaan bij het plakken.')
  }
  return sleutel
}

export async function haalGoogleSleutel () {
  // GEMINI_API_KEY staat in Googles eigen voorbeelden, dus die accepteren we ook.
  return haalGeheim({
    sleutel: 'googleApiKey',
    env: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
    controle: controleerGoogleSleutel
  })
}

/**
 * Bouwt het verzoek. Apart gehouden van het versturen, zodat te testen is wat
 * we vragen zonder dat er een plaatje van een euro doorheen gaat.
 *
 * `beelden` is een rij `{ data: Buffer, mimeType }`. Geef je die mee, dan gaat
 * het van tekst-naar-beeld naar beeld-naar-beeld: het model kijkt naar wat je
 * meestuurt en maakt daar iets nieuws van. Zo worden de reisstempels gemaakt -
 * die zijn een bewerking van een echte foto en niet iets verzonnens.
 */
export function fotoVerzoek ({
  prompt, sleutel, model = STANDAARD_MODEL, verhouding = '3:2', formaat = '2K', beelden = []
}) {
  const gekozen = NANO_BANANA_MODELLEN[model]
  if (!gekozen) {
    throw new Error(
      `Onbekend Nano Banana-model "${model}". Beschikbaar: ${Object.keys(NANO_BANANA_MODELLEN).join(', ')}`
    )
  }
  if (!prompt?.trim()) throw new Error('Een lege prompt levert geen foto op.')
  if (!VERHOUDINGEN.includes(verhouding)) {
    throw new Error(`Onbekende verhouding "${verhouding}". Beschikbaar: ${VERHOUDINGEN.join(', ')}`)
  }
  if (!FORMATEN[formaat]) {
    throw new Error(`Onbekend formaat "${formaat}". Beschikbaar: ${Object.keys(FORMATEN).join(', ')}`)
  }
  if (FORMATEN[formaat] > FORMATEN[gekozen.maxFormaat]) {
    throw new Error(
      `${gekozen.label} maakt niets groter dan ${gekozen.maxFormaat}; vraag je om ${formaat}, ` +
      'kies dan een van de grote modellen.'
    )
  }

  for (const beeld of beelden) {
    if (!Buffer.isBuffer(beeld?.data)) {
      throw new Error('Een meegegeven beeld heeft geen data; verwacht een Buffer.')
    }
  }

  return {
    url: ENDPOINT,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': sleutel
    },
    body: {
      model: gekozen.id,
      // De tekst eerst, dan de beelden. Andersom vat het model de opdracht op
      // als bijschrift bij het plaatje in plaats van als instructie erover.
      input: [
        { type: 'text', text: prompt.trim() },
        ...beelden.map(b => ({
          type: 'image',
          mime_type: b.mimeType ?? 'image/jpeg',
          data: b.data.toString('base64')
        }))
      ],
      // Google levert alleen jpeg; png weigert hij met een 400. Vandaar de ruime
      // maten hieronder: bij 4K zijn de jpeg-artefacten op papier niet te zien.
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: verhouding, image_size: formaat }
    }
  }
}

/**
 * Vist het beeld uit het antwoord.
 *
 * Het antwoord is een tijdlijn van stappen; de bytes zitten base64 in een blok
 * van het type "image". Komt er geen beeld, dan heeft het model meestal in
 * tekst uitgelegd waarom het niets wilde maken, en dat is het echte bericht.
 */
export function leesFoto (antwoord) {
  const blokken = (antwoord?.steps ?? []).flatMap(stap => stap.content ?? [])

  for (const blok of blokken) {
    if (blok.type === 'image' && blok.data) {
      return Buffer.from(blok.data, 'base64')
    }
  }

  const tekst = blokken
    .filter(blok => blok.type === 'text' && blok.text)
    .map(blok => blok.text)
    .join(' ')
    .trim()

  throw new Error(
    tekst
      ? `Nano Banana leverde geen beeld maar tekst: ${tekst.slice(0, 300)}`
      : 'Nano Banana leverde geen beeld terug.'
  )
}

/**
 * Maakt de foto, of geeft de eerder gemaakte terug.
 *
 * Een plaatje duurt tientallen seconden, dus de timeout staat ruimer dan bij
 * een tegel. De sleutel zit bewust niet in de cachesleutel: hetzelfde plaatje
 * blijft hetzelfde plaatje als je morgen een nieuwe sleutel maakt.
 */
export async function genereerFoto ({
  prompt, model = STANDAARD_MODEL, verhouding = '3:2', formaat = '2K', variant = 1, beelden = []
}) {
  const sleutel = await haalGoogleSleutel()

  // De meegestuurde beelden horen in de cachesleutel.
  //
  // Zonder dit leveren twee foto's van dezelfde dag hetzelfde plaatje op: de
  // prompt is dan immers woord voor woord gelijk, en de cache zou de eerste
  // afdruk voor de tweede foto teruggeven. Een korte hash is genoeg en houdt de
  // sleutel leesbaar.
  const beeldMerk = beelden.length
    ? createHash('sha256').update(Buffer.concat(beelden.map(b => b.data))).digest('hex').slice(0, 16)
    : ''

  return cached('nanobanana', [model, prompt.trim(), verhouding, formaat, variant, beeldMerk], async () => {
    const verzoek = fotoVerzoek({ prompt, sleutel, model, verhouding, formaat, beelden })

    const antwoord = await fetchWithRetry(verzoek.url, {
      method: 'POST',
      headers: verzoek.headers,
      body: JSON.stringify(verzoek.body),
      timeoutMs: 180000
    })

    return leesFoto(await antwoord.json())
  }, { extensie: 'jpg' })
}
