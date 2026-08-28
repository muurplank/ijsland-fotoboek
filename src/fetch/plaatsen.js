/**
 * Plaatsnamen als gegevens, niet als pixels.
 *
 * De kaartachtergrond komt als plaatje binnen, dus de namen die Mapbox erin
 * tekent zijn onherroepelijk rasterletters: in hun letter, in hun kleur, en op
 * 600 dpi zacht opgeblazen. Ze worden daarom uit de plaat gepoetst, en hier
 * halen we dezelfde namen op als gegevens - dan zet het boek ze zelf, als
 * vector, in zijn eigen letter.
 *
 * De bron is OpenStreetMap, via Overpass. Dat is dezelfde bron waar Mapbox zijn
 * plaatsnamen uit haalt, dus je krijgt dezelfde spelling op dezelfde plek. Geen
 * account nodig, net als bij de routeplanner.
 *
 * Overpass is de enige bron hier die een echte gebiedsvraag aankan. Mapbox' eigen
 * Tilequery leek geschikter - dezelfde kaartgegevens, en het geeft GeoJSON terug
 * zonder dat er een vectortegel-ontleder bij hoeft - maar die kijkt alleen in de
 * tegel onder het opgegeven punt. De straal die je meegeeft reikt niet daarbuiten,
 * dus een kaartuitsnede uitvragen zou duizenden verzoeken kosten.
 */

import { cached, fetchWithRetry } from './cache.js'

const OVERPASS = 'https://overpass-api.de/api/interpreter'

/** Wat we een plaats noemen, van groot naar klein. */
const SOORTEN = ['city', 'town', 'village', 'hamlet']

/**
 * De rang die bij een soort hoort, op dezelfde schaal van 1 tot 19 waarop ook
 * Mapbox zijn labels ordent: laag is belangrijk. Zo betekent de knop in het
 * paneel iets herkenbaars - elf laat steden en dorpen door, geen gehuchten.
 */
const RANG = { city: 6, town: 10, village: 13, hamlet: 16 }
const ONBEKENDE_RANG = 17

/** Binnen hoeveel graden twee treffers dezelfde plaats zijn: ongeveer een kilometer. */
const ZELFDE_PLAATS_GRADEN = 0.01

/**
 * De uitsnede naar buiten afgerond op een twintigste graad.
 *
 * Twee vliegen: er komt een randje omheen zodat een dorp net buiten beeld ook
 * meekomt als je straks een millimeter pant, en de vraag wordt stabiel - een
 * kleine verschuiving levert dezelfde vraag op en dus de bewaarde uitkomst.
 */
export function afgerondeUitsnede (bounds, stap = 0.05) {
  const omlaag = v => Math.floor(v / stap) * stap
  const omhoog = v => Math.ceil(v / stap) * stap

  return {
    west: Number(omlaag(bounds.west).toFixed(4)),
    east: Number(omhoog(bounds.east).toFixed(4)),
    south: Number(omlaag(bounds.south).toFixed(4)),
    north: Number(omhoog(bounds.north).toFixed(4))
  }
}

/** De vraag aan Overpass: alle plaatsen met een naam binnen deze uitsnede. */
export function overpassVraag (bounds, { soorten = SOORTEN } = {}) {
  const vak = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
  return `[out:json][timeout:90];\n` +
    `node["place"~"^(${soorten.join('|')})$"]["name"](${vak});\n` +
    'out body;'
}

/**
 * Hoe belangrijk deze plaats is, van 1 (Reykjavík) tot 19 (een gehucht).
 *
 * De soort geeft de grondtoon, het inwonertal schuift daarbinnen. Elke
 * vertienvoudiging telt als één stap belangrijker, want dat is hoe je een reeks
 * plaatsen ervaart: het verschil tussen honderd en duizend inwoners weegt net zo
 * zwaar als dat tussen duizend en tienduizend.
 */
export function belangVan (soort, inwoners) {
  const basis = RANG[soort] ?? ONBEKENDE_RANG
  if (!Number.isFinite(inwoners) || inwoners <= 0) return basis

  return Math.max(1, Math.min(19, Math.round(basis - Math.log10(inwoners / 500))))
}

/** Vertaalt het antwoord van Overpass naar wat de tekencode gebruikt. */
export function uitOverpass (antwoord) {
  const uit = []

  for (const el of antwoord?.elements ?? []) {
    const naam = el.tags?.name
    if (!naam || !Number.isFinite(el.lat) || !Number.isFinite(el.lon)) continue

    const soort = el.tags.place
    uit.push({
      naam,
      lon: el.lon,
      lat: el.lat,
      soort,
      belang: belangVan(soort, Number.parseInt(el.tags.population, 10))
    })
  }

  return uit
}

/**
 * Ontdubbelt en zet de belangrijkste vooraan.
 *
 * Op naam én plek ontdubbelen, niet op naam alleen: twee dorpen die toevallig
 * hetzelfde heten horen er allebei te blijven staan.
 */
export function ontdubbel (plaatsen) {
  const uit = []

  for (const p of plaatsen) {
    const al = uit.find(q =>
      q.naam === p.naam &&
      Math.abs(q.lat - p.lat) <= ZELFDE_PLAATS_GRADEN &&
      Math.abs(q.lon - p.lon) <= ZELFDE_PLAATS_GRADEN)

    if (!al) {
      uit.push({ ...p })
    } else if (p.belang < al.belang) {
      al.belang = p.belang
    }
  }

  return uit.sort((a, b) => a.belang - b.belang || a.naam.localeCompare(b.naam, 'is'))
}

/** De plaatsnamen binnen deze kaartuitsnede, belangrijkste eerst. */
export async function haalPlaatsen (bounds, { onProgress } = {}) {
  const vak = afgerondeUitsnede(bounds)

  return cached('plaatsen', ['overpass', vak], async () => {
    onProgress?.('plaatsnamen ophalen bij Overpass')

    const antwoord = await fetchWithRetry(OVERPASS, {
      method: 'POST',
      body: new URLSearchParams({ data: overpassVraag(vak) })
    })

    const gevonden = ontdubbel(uitOverpass(await antwoord.json()))
    onProgress?.(`${gevonden.length} plaatsnamen gevonden`)
    return gevonden
  })
}
