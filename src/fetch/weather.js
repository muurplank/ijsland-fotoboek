/**
 * Het weer van die dag, achteraf opgehaald uit een weerarchief.
 *
 * Gratis en zonder account. Je kunt het altijd overschrijven in het dagbestand
 * als je zelf nog weet hoe het echt was.
 */

import { cached, fetchWithRetry } from './cache.js'

const ARCHIEF = 'https://archive-api.open-meteo.com/v1/archive'

/** Omschrijving bij de weercode die het archief teruggeeft. */
const OMSCHRIJVING = {
  0: 'helder',
  1: 'overwegend helder',
  2: 'half bewolkt',
  3: 'bewolkt',
  45: 'mist',
  48: 'aanvriezende mist',
  51: 'lichte motregen',
  53: 'motregen',
  55: 'dichte motregen',
  61: 'lichte regen',
  63: 'regen',
  65: 'zware regen',
  71: 'lichte sneeuw',
  73: 'sneeuw',
  75: 'zware sneeuw',
  80: 'buien',
  81: 'stevige buien',
  82: 'hevige buien',
  85: 'sneeuwbuien',
  86: 'zware sneeuwbuien',
  95: 'onweer'
}

/**
 * Het temperatuurverloop over de dag, uur voor uur.
 *
 * Het archief geeft de uren als "2026-08-08T13:00" terug in de tijdzone van de
 * plek zelf, dus het uur staat gewoon in de tekst en hoeft niet omgerekend.
 */
function parseUren (antwoord) {
  const u = antwoord.hourly
  if (!u?.time?.length) return []

  const uit = []
  for (const [i, tijd] of u.time.entries()) {
    const graden = u.temperature_2m?.[i]
    if (graden === null || graden === undefined) continue
    uit.push({
      uur: Number(tijd.slice(11, 13)),
      tempC: graden,
      // per uur ook wát voor weer het was, niet alleen hoe warm; daarmee kan
      // de grafiek laten zien dat het 's ochtends droog was en 's middags niet
      code: u.weather_code?.[i] ?? null
    })
  }
  return uit
}

export function parseWeather (antwoord) {
  const d = antwoord.daily
  if (!d?.time?.length) return null

  const code = d.weather_code?.[0]
  return {
    tempMax: d.temperature_2m_max?.[0] ?? null,
    tempMin: d.temperature_2m_min?.[0] ?? null,
    neerslagMm: d.precipitation_sum?.[0] ?? null,
    windMaxKmh: d.wind_speed_10m_max?.[0] ?? null,
    code: code ?? null,
    omschrijving: OMSCHRIJVING[code] ?? null,
    uren: parseUren(antwoord)
  }
}

/**
 * Het weer op een datum en plek. Neem het midden van de dagroute als plek;
 * op IJsland kan het aan de andere kant van het land heel anders zijn geweest.
 */
export async function fetchWeather (lat, lon, datum) {
  // Het cijfer in de sleutel loopt op zodra er meer in het antwoord komt te
  // staan; zonder dat zou een oude bewaarde dag zonder uurgegevens terug
  // blijven komen. u2 bracht het temperatuurverloop, u3 de weercodes per uur.
  return cached('weer', ['open-meteo', 'u3', lat.toFixed(3), lon.toFixed(3), datum], async () => {
    const url = `${ARCHIEF}?latitude=${lat}&longitude=${lon}` +
      `&start_date=${datum}&end_date=${datum}` +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code' +
      '&hourly=temperature_2m,weather_code' +
      '&timezone=auto'

    const antwoord = await fetchWithRetry(url)
    return parseWeather(await antwoord.json())
  })
}
