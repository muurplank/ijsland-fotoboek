/**
 * Onthoudt de opgebouwde daggegevens voor de previewserver.
 *
 * Een dag opbouwen is duur - route, hoogtemodel, weer - en dat wil je niet
 * overdoen bij elke draai aan een knop. Dus blijft het antwoord hangen.
 *
 * Maar het mag niet blijven hangen als de bron verandert. Daarom hoort bij elke
 * bewaarde dag een stempel van de bestanden waar hij uit komt. Verandert het
 * dagbestand of book.json, hoe dan ook - je editor, git, een ander programma -
 * dan klopt het stempel niet meer en wordt de dag opnieuw opgebouwd.
 *
 * Zonder dat stempel bleef de preview de stijl tonen waarmee de server ooit
 * gestart was: je paste een dagbestand aan, herlaadde de pagina, en zag je
 * wijziging niet. Pas na een herstart klopte het weer.
 *
 * Opnieuw opbouwen is goedkoop: alles wat van internet komt ligt in de
 * schijfcache uit fetch/cache.js, dus er wordt niets opnieuw gedownload.
 */

import { stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildDay } from './dayData.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Het bestand met de gegevens van een dag. */
export function dagBestand (nummer) {
  return join(ROOT, 'data', 'days', `day-${String(nummer).padStart(2, '0')}.json`)
}

/** Het bestand met de instellingen voor het hele boek. */
export const BOEK_BESTAND = join(ROOT, 'data', 'book.json')

/**
 * Hoe een bestand er nu bij staat. Tijdstip en grootte samen, want twee
 * schrijfacties in dezelfde milliseconde zijn zeldzaam maar niet onmogelijk.
 */
async function stempelVan (pad) {
  try {
    const s = await stat(pad)
    return `${s.mtimeMs}:${s.size}`
  } catch {
    return 'weg'
  }
}

/** Het stempel van de bestanden waar een dag uit opgebouwd wordt. */
export async function bronStempel (nummer) {
  const delen = await Promise.all([
    stempelVan(dagBestand(nummer)),
    stempelVan(BOEK_BESTAND)
  ])
  return delen.join('|')
}

/**
 * Maakt een cache voor daggegevens.
 *
 * @param {Function} bouw doet het echte werk; in tests hang je hier iets
 *   goedkopers in dan het ophalen van een heel hoogtemodel
 */
export function maakDagCache (bouw = buildDay) {
  const bewaard = new Map()

  return {
    /**
     * De gegevens van een dag. Opnieuw opgebouwd zodra de bron veranderd is,
     * anders gewoon wat er al lag.
     */
    async dag (nummer, { stijlOverschrijving, onProgress } = {}) {
      const naam = `${nummer}:${JSON.stringify(stijlOverschrijving ?? {})}`
      const stempel = await bronStempel(nummer)

      const staat = bewaard.get(naam)
      if (staat && staat.stempel === stempel) return staat.gegevens

      // set() en niet een tweede sleutel erbij: de achterhaalde versie moet weg,
      // anders blijft elk hoogtemodel dat je ooit opvroeg in het geheugen staan
      const gegevens = bouw(nummer, { stijlOverschrijving, onProgress })
      bewaard.set(naam, { stempel, gegevens })
      return gegevens
    },

    /** Alles vergeten. */
    leeg () { bewaard.clear() },

    /** Hoeveel dagen er nu bewaard zijn. */
    get aantal () { return bewaard.size }
  }
}
