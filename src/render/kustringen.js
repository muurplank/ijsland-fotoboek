/**
 * De kustlijn van een hoogteveld als gesloten ringen.
 *
 * Het inzetkaartje heeft het silhouet van IJsland al, maar als raster: een PNG
 * met doorzichtige zee. Voor het voorblad moet diezelfde omtrek een lijn worden
 * die je met een pen kunt trekken en die in de PDF vector blijft. Dat is
 * dezelfde bewerking als een hoogtelijn, alleen dan op niveau nul - zeeniveau
 * ís de hoogtelijn die land van water scheidt.
 *
 * Puur rekenwerk: geen netwerk, geen schijf, geen sharp. Zelfde reden als bij
 * hero.js - zo is het te testen met een verzonnen eilandje in plaats van met een
 * hoogtemodel van zeshonderd megabyte.
 *
 * Alles rekent hier in roostercellen, niet in millimeters of graden. Wie de
 * ringen op een kaart wil zetten rekent ze zelf om; dat kan deze code niet
 * weten, want het rooster weet niet waar het ligt.
 *
 * ## Waarom er gefilterd wordt
 *
 * IJsland op tweehonderddertig meter per punt levert niet één omtrek op maar
 * duizenden: elke rots voor de kust, elke zandbank, elk meertje in het
 * binnenland dat onder zeeniveau ligt. Alles tekenen geeft een omtrek die van
 * een afstand als vuil op het papier leest, en een PDF van tientallen megabytes.
 * Het voorblad wil juist het tegenovergestelde. Vandaar dat de oppervlakte de
 * knop is: onder een bepaalde maat doet een eiland niet meer mee.
 */

import { vereenvoudig } from './svg.js'
import { isoStreepjes, rijg } from './isolijn.js'

/**
 * De oppervlakte binnen een ring, met de schoenveterformule.
 *
 * Waar dit voor gebruikt wordt is het filteren op grootte, en daar gaat de
 * absolute waarde in. Het teken staat er wel, maar reken er niets op: `rijg`
 * begint bij het eerste streepje dat het tegenkomt en groeit naar twee kanten,
 * dus of een ring met de klok mee of tegen de klok in terugkomt hangt af van
 * waar hij toevallig in het rooster ligt. Een meer loopt niet gegarandeerd
 * andersom dan de kust eromheen.
 *
 * Daarom moet een vlak dat uit deze ringen gevuld wordt `fill-rule: evenodd`
 * gebruiken en nooit `nonzero`: evenodd telt alleen hoe vaak je een rand
 * kruist en heeft geen mening over de richting. Met nonzero zou een meer de
 * ene keer een gat zijn en de andere keer niet.
 *
 * @param {Array<{x: number, y: number}>} punten
 * @returns {number} oppervlakte in roostercellen; het teken is willekeurig
 */
export function ringOppervlak (punten) {
  if (!punten || punten.length < 3) return 0

  let som = 0
  for (let i = 0; i < punten.length; i++) {
    const a = punten[i]
    const b = punten[(i + 1) % punten.length]
    som += a.x * b.y - b.x * a.y
  }
  return som / 2
}

/**
 * Is dit een gesloten ring, of een lijn die tegen de rand van het rooster aan
 * loopt en daar ophoudt?
 *
 * Marching squares sluit een omtrek vanzelf zodra hij helemaal binnen het
 * rooster ligt: de laatste streep komt dan uit op het punt waar de eerste
 * begon. Loopt het land door tot buiten het raster, dan blijft er een open
 * uiteinde over. Voor IJsland komt dat niet voor - het raster loopt van -25,31
 * tot -12,66 graden en Latrabjarg, de westelijkste punt, ligt op -24,53 - maar
 * een open lijn mag geen vlak worden, dus wordt hij herkend en niet geraden.
 */
export function isGesloten (punten, tolerantie = 1e-6) {
  if (!punten || punten.length < 4) return false
  const eerste = punten[0]
  const laatste = punten.at(-1)
  return Math.hypot(eerste.x - laatste.x, eerste.y - laatste.y) <= tolerantie
}

/**
 * Een ring rondgaand verzachten.
 *
 * `verzacht` uit isolijn.js houdt de uiteinden vast, want bij een hoogtelijn in
 * een vakje horen die op hun plek te blijven. Bij een ring is dat juist fout:
 * begin en eind zijn hetzelfde punt, en dat ene punt blijft dan als enige hoek
 * staan - een knik in de kust op een willekeurige plek, precies daar waar het
 * rijgen toevallig begon. Dus loopt dit rond.
 */
export function verzachtRing (punten, rondes = 2) {
  let rij = punten
  for (let r = 0; r < rondes; r++) {
    if (rij.length < 4) return rij

    // het slotpunt is een kopie van het beginpunt; middelen doen we over de
    // echte punten en daarna sluiten we weer
    const kern = isGesloten(rij) ? rij.slice(0, -1) : rij
    const n = kern.length
    const uit = []

    for (let i = 0; i < n; i++) {
      const vorige = kern[(i - 1 + n) % n]
      const deze = kern[i]
      const volgende = kern[(i + 1) % n]
      uit.push({
        x: (vorige.x + 2 * deze.x + volgende.x) / 4,
        y: (vorige.y + 2 * deze.y + volgende.y) / 4
      })
    }

    uit.push({ ...uit[0] })
    rij = uit
  }
  return rij
}

/**
 * De kustlijnen uit een hoogteveld.
 *
 * Het veld is het hoogtemodel zelf en niet het land-of-zee-masker, en dat is
 * een bewuste keuze: met echte hoogtes weet marching squares waar tússen twee
 * punten de kust ligt, en dat scheelt de trapjes die je bij een veld van enen
 * en nullen altijd houdt. Punten zonder meting tellen als zee.
 *
 * @param {object} opties
 * @param {ArrayLike<number>} opties.veld    hoogtes, rij voor rij
 * @param {number} opties.kolommen
 * @param {number} opties.rijen
 * @param {number} [opties.niveau]           welke hoogte de kust is; nul is zeeniveau
 * @param {number} [opties.minCellen]        eilanden kleiner dan dit vallen af
 * @param {number} [opties.tolerantie]       hoe grof de lijn vereenvoudigd mag worden
 * @param {number} [opties.rondes]           hoe vaak de trapjes gemiddeld worden
 * @returns {Array<Array<{x: number, y: number}>>} ringen, de grootste eerst
 */
export function kustRingen ({
  veld, kolommen, rijen, niveau = 0, minCellen = 0, tolerantie = 0, rondes = 2
}) {
  if (!(kolommen > 1) || !(rijen > 1)) return []

  // een ontbrekende meting is geen berg van nul meter maar onbekend gebied, en
  // dat hoort bij de zee te vallen in plaats van een eiland te worden
  const schoon = new Float64Array(kolommen * rijen)
  for (let i = 0; i < schoon.length; i++) {
    const h = veld[i]
    schoon[i] = Number.isFinite(h) ? h : niveau - 1
  }

  const lijnen = rijg(isoStreepjes(schoon, kolommen, rijen, 1, niveau))
  const uit = []

  for (const lijn of lijnen) {
    if (lijn.length < 4 || !isGesloten(lijn)) continue
    if (Math.abs(ringOppervlak(lijn)) < minCellen) continue

    // eerst verzachten, dan pas vereenvoudigen: andersom haalt Douglas-Peucker
    // de punten weg die het middelen nodig heeft en houd je de trapjes alsnog
    const zacht = verzachtRing(lijn, rondes)
    const dun = tolerantie > 0 ? vereenvoudig(zacht, tolerantie) : zacht

    // vereenvoudigen kan een ring die net boven de grens zat alsnog tot een
    // driehoekje terugbrengen; dan is het geen kust meer maar een vlekje
    if (dun.length < 4) continue

    uit.push(isGesloten(dun) ? dun : [...dun, { ...dun[0] }])
  }

  return uit.sort((a, b) => Math.abs(ringOppervlak(b)) - Math.abs(ringOppervlak(a)))
}
