/**
 * Werken met de instellingen uit het schema.
 *
 * Instellingen komen in lagen: eerst de standaardwaarden uit het schema, daar
 * overheen wat voor het hele boek geldt, en daar overheen wat deze ene dag
 * afwijkt. Zo blijft het boek consistent zonder dat je vastzit als een dag om
 * een uitzondering vraagt.
 */

import { KNOPPEN } from './styleSchema.js'

const OP_KEY = new Map(KNOPPEN.map(k => [k.key, k]))

/** De definitie van een knop, of undefined als hij niet bestaat. */
export function knop (key) {
  return OP_KEY.get(key)
}

/** Alle standaardwaarden als plat object. */
export function standaardStijl () {
  const uit = {}
  for (const k of KNOPPEN) uit[k.key] = k.standaard
  return uit
}

/**
 * Houdt een waarde binnen het bereik dat zijn knop toestaat. Waarden zonder
 * bereik (kleuren, keuzes, tekst) blijven ongemoeid.
 */
export function klem (key, waarde) {
  const k = knop(key)
  if (!k || k.min === undefined || typeof waarde !== 'number') return waarde
  return Math.max(k.min, Math.min(k.max, waarde))
}

/**
 * Stapelt instellingenlagen op elkaar. Latere lagen winnen.
 *
 * Sleutels die het schema niet kent worden overgeslagen en apart teruggegeven,
 * zodat een oud instellingenbestand blijft werken nadat er een knop hernoemd is
 * in plaats van de hele boel om te gooien.
 */
export function mergeStijl (...lagen) {
  const stijl = standaardStijl()
  const genegeerd = []

  for (const laag of lagen) {
    if (!laag) continue
    for (const [key, waarde] of Object.entries(laag)) {
      if (OP_KEY.has(key)) stijl[key] = klem(key, waarde)
      else genegeerd.push(key)
    }
  }

  return { stijl, genegeerd }
}
