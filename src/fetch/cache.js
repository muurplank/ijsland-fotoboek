/**
 * Schijfcache voor alles wat we van internet halen.
 *
 * Met dit aantal instelknoppen ga je vaak opnieuw renderen. Alles wat een keer
 * opgehaald is, wordt bewaard: daarna is renderen offline en instant, en we
 * belasten de gratis servers niet onnodig.
 */

import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * De cache staat bewust BUITEN de projectmap.
 *
 * Dit project ligt in iCloud Drive, en een dagkaart kan honderden megabytes aan
 * tegels opleveren. Die horen niet je iCloud-opslag en -bandbreedte op te eten:
 * ze zijn altijd opnieuw op te halen. Op macOS is ~/Library/Caches daar de
 * aangewezen plek voor. Met IJSLAND_CACHE kun je het zelf ergens anders zetten.
 */
export const CACHE_DIR =
  process.env.IJSLAND_CACHE ??
  (process.platform === 'darwin'
    ? join(homedir(), 'Library', 'Caches', 'ijsland-fotoboek')
    : join(ROOT, 'cache'))

/** Korte, stabiele naam voor een verzoek. */
function key (parts) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16)
}

function pad (soort, sleutel, extensie) {
  return join(CACHE_DIR, soort, `${sleutel}.${extensie}`)
}

/**
 * Haalt iets op, of geeft de bewaarde versie terug als die er al is.
 * `laden` doet het echte werk en wordt alleen aangeroepen als het nodig is.
 */
export async function cached (soort, identiteit, laden, { extensie = 'json' } = {}) {
  const sleutel = key(identiteit)
  const bestand = pad(soort, sleutel, extensie)

  try {
    const rauw = await readFile(bestand)
    return extensie === 'json' ? JSON.parse(rauw.toString()) : rauw
  } catch {
    // nog niet in de cache, dus ophalen
  }

  const waarde = await laden()

  await mkdir(dirname(bestand), { recursive: true })
  await writeFile(bestand, extensie === 'json' ? JSON.stringify(waarde) : waarde)

  return waarde
}

/**
 * Haalt een url op met een fatsoenlijke identificatie en een paar nieuwe pogingen
 * bij tijdelijke fouten. De gratis servers die we gebruiken knijpen af bij drukte;
 * dan is even wachten het juiste antwoord, niet meteen opgeven.
 */
export async function fetchWithRetry (url, { pogingen = 4, timeoutMs = 45000, headers = {} } = {}) {
  let laatsteFout

  for (let poging = 1; poging <= pogingen; poging++) {
    try {
      const antwoord = await fetch(url, {
        headers: {
          'User-Agent': 'IJsland-fotoboek/0.1 (persoonlijk fotoboekproject)',
          ...headers
        },
        signal: AbortSignal.timeout(timeoutMs)
      })

      if (antwoord.ok) return antwoord

      // 429 en 5xx zijn tijdelijk; de rest heeft geen zin om te herhalen
      if (antwoord.status !== 429 && antwoord.status < 500) {
        throw new Error(`${url} gaf ${antwoord.status} ${antwoord.statusText}`)
      }
      laatsteFout = new Error(`${url} gaf ${antwoord.status}`)
    } catch (fout) {
      laatsteFout = fout
      if (fout.message?.includes('gaf 4')) throw fout
    }

    if (poging < pogingen) {
      const wachten = 1000 * 2 ** (poging - 1)
      await new Promise(r => setTimeout(r, wachten))
    }
  }

  throw new Error(`Ophalen mislukt na meerdere pogingen: ${laatsteFout?.message ?? url}`)
}
