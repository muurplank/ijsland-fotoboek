/**
 * Toegangssleutels, op een plek.
 *
 * Elke sleutel kan op twee manieren binnenkomen: als omgevingsvariabele, of als
 * regel in data/secrets.json. De omgeving wint, zodat je voor een commando iets
 * anders kunt gebruiken zonder je bestand aan te passen:
 *
 *   GOOGLE_API_KEY=... node src/build.js 4
 *
 * data/secrets.json staat in .gitignore en hoort daar te blijven. Welke sleutels
 * er bestaan staat in data/secrets.voorbeeld.json, en die mag wel mee in git
 * omdat er alleen plaatshouders in staan.
 */

import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const GEHEIMENBESTAND = join(ROOT, 'data', 'secrets.json')

let bestandCache

/**
 * Leest data/secrets.json, een keer per proces.
 *
 * Geen bestand is geen fout: de sleutels kunnen ook uit de omgeving komen, en
 * wie hem mist krijgt zo dadelijk de uitleg van zijn eigen controlefunctie.
 * Kapotte JSON is wel een fout, want dan denk jij dat je sleutel er staat.
 */
export async function leesGeheimen () {
  if (bestandCache !== undefined) return bestandCache

  try {
    bestandCache = JSON.parse(await readFile(GEHEIMENBESTAND, 'utf8'))
  } catch (fout) {
    if (fout.code === 'ENOENT') bestandCache = {}
    else if (fout instanceof SyntaxError) {
      throw new Error(`data/secrets.json is geen geldige JSON: ${fout.message}`)
    } else throw fout
  }

  return bestandCache
}

/** Vergeet wat er gelezen is. Alleen nodig in tests. */
export function vergeetGeheimen () {
  bestandCache = undefined
}

/**
 * Haalt een sleutel op.
 *
 * `env` zijn de omgevingsvariabelen die voorgaan, in volgorde. `controle` is de
 * functie die de sleutel nakijkt en uitlegt wat je moet doen als hij ontbreekt
 * of niet klopt; die uitleg hoort bij de dienst zelf, niet hier.
 */
export async function haalGeheim ({ sleutel, env = [], controle = waarde => waarde }) {
  for (const naam of env) {
    const uitOmgeving = process.env[naam]?.trim()
    if (uitOmgeving) return controle(uitOmgeving)
  }

  const waarde = (await leesGeheimen())[sleutel]
  return controle(typeof waarde === 'string' ? waarde.trim() : waarde)
}
