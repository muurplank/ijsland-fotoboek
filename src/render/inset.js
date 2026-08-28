/**
 * Het inzetkaartje: heel IJsland in het klein, met een kadertje dat aangeeft
 * waar je op de grote kaart naar kijkt.
 *
 * De omtrek van het eiland komt uit hetzelfde hoogtemodel als het relief: alles
 * onder zeeniveau is zee, de rest is land. Geen aparte kaartbron nodig, en de
 * kustlijn sluit dus per definitie aan op die van de grote kaart.
 *
 * Langs die omtrek komt een donkerder randje. Een effen silhouet leest als een
 * vlek; een rand eromheen maakt er een kaart van. De rand ligt bewust bínnen het
 * land: naar buiten toe zou het eiland groeien en zou de kustkleur als halo in
 * de zee hangen.
 *
 * Hetzelfde hoogtemodel levert onderaan dit bestand ook de kustlijn als lijn in
 * plaats van als vlak - zie ijslandKust(). Het voorblad heeft die nodig om de
 * omtrek met een pen te kunnen trekken en om de kaart op het eiland uit te
 * knippen. Beide komen uit hetzelfde masker, dus ze sluiten per definitie aan.
 */

import sharp from 'sharp'
import { fetchDem } from '../fetch/elevation.js'
import { hexNaarRgb } from './colorize.js'
import { kustRingen } from './kustringen.js'
import { metersPerPixel, tileToLonLat, TILE_SIZE } from '../geo/tiles.js'

/** Ruim om het hele eiland heen, inclusief de Westfjorden en de oostkust. */
export const IJSLAND = { west: -24.65, east: -13.35, south: 63.3, north: 66.62 }

/**
 * Gewichten van de afstandsmeting: een stap opzij kost 3, een stap schuin 4.
 *
 * Met alleen stappen opzij zou de rand op de vele schiereilanden ruitvormig
 * worden, want dan is schuin net zo duur als recht. Drie-vier benadert de echte
 * afstand op een paar procent na, en blijft heel getal, dus snel.
 */
const RECHT = 3
const SCHUIN = 4

/** Verder dan dit hoeft niet geteld te worden; past met SCHUIN erbij in 16 bits. */
const VER = 0xfff0

/** Meer dan dit aantal beeldpunten kustrand slaat nergens meer op. */
const MAX_KUST_PX = 16

/**
 * Per landpunt de afstand tot de dichtstbijzijnde zee, in eenheden van RECHT
 * per beeldpunt. Zee zelf krijgt nul.
 *
 * Twee doorgangen: een van linksboven naar rechtsonder, en een terug. Elk punt
 * kijkt daarbij alleen naar buren die al af zijn, en dat is genoeg om overal de
 * kortste weg naar zee te vinden.
 *
 * Waarom een afstandsveld en niet een paar rondes wegschrapen: hiermee is elke
 * gewenste randdikte daarna nog maar een drempel. Aan de dikte draaien kost dus
 * niets, en het hoogtemodel hoeft maar een keer doorgerekend te worden.
 *
 * Buiten het raster wordt niets aangenomen. Dat mag: het raster loopt van
 * -25,31 tot -12,66 graden en IJsland raakt die rand nergens - de westelijkste
 * punt, Latrabjarg, ligt op -24,53.
 *
 * @param {Uint8Array} land 1 voor land, 0 voor zee
 * @returns {Uint16Array} afstand tot zee, RECHT per beeldpunt
 */
export function kustAfstand (land, breedte, hoogte) {
  const d = new Uint16Array(breedte * hoogte)
  for (let i = 0; i < d.length; i++) d[i] = land[i] ? VER : 0

  for (let y = 0; y < hoogte; y++) {
    for (let x = 0; x < breedte; x++) {
      const i = y * breedte + x
      if (d[i] === 0) continue
      let m = d[i]
      if (y > 0) {
        m = Math.min(m, d[i - breedte] + RECHT)
        if (x > 0) m = Math.min(m, d[i - breedte - 1] + SCHUIN)
        if (x < breedte - 1) m = Math.min(m, d[i - breedte + 1] + SCHUIN)
      }
      if (x > 0) m = Math.min(m, d[i - 1] + RECHT)
      // niet laten overlopen: VER plus een stap past anders niet meer in 16 bits
      d[i] = Math.min(m, VER)
    }
  }

  for (let y = hoogte - 1; y >= 0; y--) {
    for (let x = breedte - 1; x >= 0; x--) {
      const i = y * breedte + x
      if (d[i] === 0) continue
      let m = d[i]
      if (y < hoogte - 1) {
        m = Math.min(m, d[i + breedte] + RECHT)
        if (x > 0) m = Math.min(m, d[i + breedte - 1] + SCHUIN)
        if (x < breedte - 1) m = Math.min(m, d[i + breedte + 1] + SCHUIN)
      }
      if (x < breedte - 1) m = Math.min(m, d[i + 1] + RECHT)
      d[i] = Math.min(m, VER)
    }
  }

  return d
}

/**
 * Zee doorzichtig, land vlak, en de buitenste kustPx beeldpunten in de kustkleur.
 *
 * Eilandjes die smaller zijn dan tweemaal de randdikte worden helemaal rand.
 * Dat is precies goed: Vestmannaeyjar en Grimsey horen donkere stipjes te zijn
 * en geen lichte vlekjes.
 *
 * @returns {Buffer} vier waarden per punt, rood-groen-blauw-doorzichtigheid
 */
export function schilderSilhouet ({ land, afstand, breedte, hoogte, landKleur, kustKleur, kustPx = 0 }) {
  const [lr, lg, lb] = hexNaarRgb(landKleur)
  const [kr, kg, kb] = hexNaarRgb(kustKleur ?? landKleur)
  const grens = kustPx * RECHT
  const rgba = Buffer.alloc(breedte * hoogte * 4)

  for (let i = 0; i < land.length; i++) {
    if (!land[i]) continue // zee blijft doorzichtig, zodat de zeekleur doorschijnt
    const kust = kustPx > 0 && afstand[i] <= grens
    rgba[i * 4] = kust ? kr : lr
    rgba[i * 4 + 1] = kust ? kg : lg
    rgba[i * 4 + 2] = kust ? kb : lb
    rgba[i * 4 + 3] = 255
  }

  return rgba
}

/**
 * Het hoogtemodel en de kustafstanden: zwaar werk, en het hangt van geen enkele
 * kleur af. Dus een keer per serverleven, hoe vaak je daarna ook aan de knoppen
 * draait.
 */
let maskerBelofte = null

function ijslandMasker ({ onProgress } = {}) {
  maskerBelofte ??= (async () => {
    // ruim genoeg voor een inzetkaartje van een paar centimeter op 600 dpi
    const dem = await fetchDem(IJSLAND, { metersPerPixel: 380, maxZoom: 9, onProgress })

    const land = new Uint8Array(dem.width * dem.height)
    for (let i = 0; i < dem.data.length; i++) land[i] = dem.data[i] >= 0 ? 1 : 0

    // het gebied dat dit plaatje precies beslaat
    const linksboven = tileToLonLat(dem.originPx / TILE_SIZE, dem.originPy / TILE_SIZE, dem.z)
    const rechtsonder = tileToLonLat(
      (dem.originPx + dem.width) / TILE_SIZE,
      (dem.originPy + dem.height) / TILE_SIZE,
      dem.z
    )

    return {
      land,
      // De hoogtes zelf blijven bewaard, en dat is een bewuste kosten-afweging:
      // het is zestien megabyte die de hele serverdraai blijft staan, tegenover
      // een hoogtemodel dat op schijf al in de honderden megabytes loopt. Het
      // levert op dat ijslandKust() de kust tússen twee meetpunten door kan
      // interpoleren in plaats van langs de trapjes van een veld van enen en
      // nullen te lopen - en dat aan de detailknop draaien daarna gratis is.
      hoogtes: dem.data,
      z: dem.z,
      originPx: dem.originPx,
      originPy: dem.originPy,
      afstand: kustAfstand(land, dem.width, dem.height),
      breedte: dem.width,
      hoogte: dem.height,
      bounds: {
        west: linksboven.lon,
        north: linksboven.lat,
        east: rechtsonder.lon,
        south: rechtsonder.lat
      }
    }
  })()

  return maskerBelofte
}

/** Onthoudt het ingekleurde silhouet per kleurenpaar en randdikte. */
const cache = new Map()

/**
 * Silhouet van IJsland als PNG met doorzichtige zee, plus waar het op de kaart
 * hoort te staan.
 *
 * @param {string} opties.landKleur vulling van het eiland
 * @param {string} [opties.kustKleur] randje langs de kust; standaard geen randje
 * @param {number} [opties.kustMm] hoe dik dat randje op papier wordt
 * @param {number} [opties.breedteMm] hoe breed het kaartje op papier komt
 */
export async function ijslandSilhouet ({
  landKleur,
  kustKleur = landKleur,
  kustMm = 0,
  breedteMm = 46,
  onProgress
}) {
  const masker = await ijslandMasker({ onProgress })

  // Hoe dik de kustrand in beeldpunten moet zijn hangt af van hoe groot het
  // kaartje straks staat: het plaatje is masker.breedte punten breed en belandt
  // op breedteMm millimeter. Afronden op hele punten houdt het aantal varianten
  // klein, zodat slepen aan de breedte niet elke keer een nieuwe render kost.
  const kustPx = Math.max(0, Math.min(MAX_KUST_PX,
    Math.round((kustMm * masker.breedte) / Math.max(1, breedteMm))))

  const sleutel = `${landKleur}|${kustKleur}|${kustPx}`
  if (cache.has(sleutel)) return cache.get(sleutel)

  const belofte = (async () => {
    const rgba = schilderSilhouet({ ...masker, landKleur, kustKleur, kustPx })

    const png = await sharp(rgba, {
      raw: { width: masker.breedte, height: masker.hoogte, channels: 4 }
    })
      .png({ compressionLevel: 9 })
      .toBuffer()

    return {
      png,
      bounds: masker.bounds,
      breedte: masker.breedte,
      hoogte: masker.hoogte,
      kustPx
    }
  })()

  cache.set(sleutel, belofte)
  return belofte
}

/** Onthoudt de kustlijn per detailstand; het masker eronder is toch al gedeeld. */
const kustCache = new Map()

/**
 * De kustlijn van IJsland als gesloten ringen in lengte- en breedtegraden.
 *
 * Waarom niet gewoon de silhouet-PNG met een randje: een raster kun je niet met
 * een pen trekken. Het voorblad wil een lijn die in de PDF een lijn blijft, die
 * je dunner of dikker kunt zetten, en waar je de kaart op kunt uitknippen.
 *
 * De twee knoppen zijn er allebei omdat IJsland op tweehonderddertig meter per
 * punt véél meer kust heeft dan je op een voorblad wilt zien:
 *
 * - `minKm2` gooit alles weg dat kleiner is dan zoveel vierkante kilometer. Op
 *   nul komen er negenenveertig ringen terug en zijn tweeendertig daarvan
 *   kleiner dan een vierkante kilometer: rotsen voor de kust, zandbanken,
 *   meertjes onder zeeniveau. Die lezen op een voorblad als vuil op het papier.
 *   Op vijf blijven er vijf over - het vasteland, Heimaey, Hrisey, Grimsey en
 *   een eilandje in Faxafloi - en dat zijn precies de vier die je op een kaart
 *   van IJsland verwacht. Vandaar die standaard.
 *
 *   Ter controle van het geheel: het vasteland komt er op 104.815 vierkante
 *   kilometer uit en IJsland is er 103.000. Dat verschil is de kustrand van een
 *   halve cel die marching squares er per definitie omheen legt.
 * - `tolerantieM` bepaalt hoe grof de lijn zelf mag worden. Vijfhonderd meter is
 *   op een voorblad van dertig centimeter ruim een kwart millimeter, dus onder
 *   de lijndikte, en het scheelt een orde van grootte in het aantal punten.
 *
 * De omrekening naar graden gaat per punt door tileToLonLat en niet lineair over
 * de bounds. Dat moet ook: het raster staat in Mercator, en daarin is de afstand
 * tussen twee breedtegraden bovenin het plaatje kleiner dan onderin. Lineair
 * rekenen zou de Westfjorden een halve tegel omhoog schuiven.
 *
 * @param {object} [opties]
 * @param {number} [opties.minKm2]      eilanden kleiner dan dit vallen af
 * @param {number} [opties.tolerantieM] hoe grof de lijn vereenvoudigd mag worden
 * @returns {Promise<{ringen: Array<Array<[number, number]>>, bounds: object, punten: number}>}
 */
export async function ijslandKust ({ minKm2 = 5, tolerantieM = 500, onProgress } = {}) {
  const sleutel = `${minKm2}|${tolerantieM}`
  if (kustCache.has(sleutel)) return kustCache.get(sleutel)

  const belofte = (async () => {
    const masker = await ijslandMasker({ onProgress })

    // Hoe groot een roostercel op de grond is, gemeten op het midden van het
    // plaatje. IJsland loopt van 63 tot 67 graden en in Mercator scheelt dat
    // een procent of acht in schaal; voor een ondergrens die je met een
    // schuifje zet is dat ruim binnen de marge.
    const middenLat = (masker.bounds.north + masker.bounds.south) / 2
    const celM = metersPerPixel(middenLat, masker.z)

    const ringen = kustRingen({
      veld: masker.hoogtes,
      kolommen: masker.breedte,
      rijen: masker.hoogte,
      niveau: 0,
      minCellen: (minKm2 * 1e6) / (celM * celM),
      tolerantie: tolerantieM / celM,
      rondes: 2
    })

    let punten = 0
    const uit = ringen.map(ring => {
      punten += ring.length
      return ring.map(p => {
        const { lon, lat } = tileToLonLat(
          (masker.originPx + p.x) / TILE_SIZE,
          (masker.originPy + p.y) / TILE_SIZE,
          masker.z
        )
        // afronden op vijf decimalen: ruim een meter, en het halveert de JSON
        return [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5]
      })
    })

    return { ringen: uit, bounds: masker.bounds, punten }
  })()

  kustCache.set(sleutel, belofte)
  return belofte
}
