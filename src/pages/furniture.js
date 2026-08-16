/**
 * Het bijwerk op de kaartpagina: titelblok, inzetkaartje, schaalbalk,
 * noordpijl en bronvermelding.
 *
 * Alles in millimeters op de pagina, net als de rest.
 */

import { MapView } from '../geo/viewport.js'
import { paginaMaat } from '../render/layout.js'
import { padData, projecteer, vereenvoudig } from '../render/svg.js'
import { kompasGlas, kompasroos } from './compass.js'
import { schaalVan } from './editable.js'

const SVG = 'http://www.w3.org/2000/svg'

const maakSvg = (tag, eigenschappen = {}) => {
  const n = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(eigenschappen)) {
    if (v !== null && v !== undefined) n.setAttribute(k, String(v))
  }
  return n
}

const mm = waarde => `calc(${waarde} * var(--mm))`

/** Een hexkleur met een doorzichtigheid erop, als rgb()-notatie. */
function metDekking (hex, dekking) {
  const h = hex.replace('#', '')
  const n = parseInt(h.slice(0, 6), 16)
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${dekking})`
}

/**
 * Legt het glasplaatje achter een titelblok.
 *
 * Alle vier de paginatypes tekenen hun eigen titelblok, dus dit staat hier
 * apart: zo ziet de titel er op de statistiekpagina hetzelfde uit als op de
 * kaart, en hoeft de vormgeving maar op één plek bijgesteld te worden.
 *
 * Geeft terug of er een plaatje kwam, zodat de aanroeper weet of hij het oude
 * platte vlak nog moet zetten.
 */
export function zetGlas (blok, stijl) {
  if (!stijl['titelblok.glasAan']) return false

  blok.classList.add('glas')
  blok.style.setProperty('--glasvul',
    metDekking(stijl['titelblok.glasKleur'], stijl['titelblok.glasDekking']))
  blok.style.setProperty('--glasblur', stijl['titelblok.glasBlurMm'])
  blok.style.setProperty('--glasronding', stijl['titelblok.glasRondingMm'])
  blok.style.setProperty('--glaspad', stijl['titelblok.glasPadMm'])
  blok.style.setProperty('--glasschaduw', stijl['titelblok.glasSchaduw']
    ? `0 ${mm(0.5)} ${mm(1.7)} rgb(0 0 0 / .13), 0 ${mm(0.1)} ${mm(0.35)} rgb(0 0 0 / .08)`
    : 'none')

  return true
}

/** Zet een element in een van de vier hoeken van de pagina. */
function inHoek (node, hoek, margeMm, maat) {
  node.style.position = 'absolute'
  if (hoek.includes('links')) node.style.left = mm(margeMm)
  else node.style.right = mm(margeMm)
  if (hoek.includes('boven')) node.style.top = mm(margeMm)
  else node.style.bottom = mm(margeMm)
  return node
}

/** Een rond getal dat lekker leest op een schaalbalk. */
function netteAfstand (ruwKm) {
  const stappen = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500]
  for (const s of stappen) if (ruwKm <= s) return s
  return Math.round(ruwKm / 100) * 100
}

/**
 * Tekent al het bijwerk in de opschriftenlaag.
 *
 * @param {HTMLElement} laag
 * @param {object} gegevens dag, route, statistieken
 * @param {object} stijl
 * @param {MapView} view de uitsnede van de grote kaart
 * @param {object} bronnen
 * @param {object|null} bronnen.silhouet {url, bounds} van het inzetkaartje
 * @param {object[]|null} bronnen.reis alle dagen, voor de vage lijn op het inzetkaartje
 * @param {SVGElement|null} bronnen.svgLaag de tekenlaag, waar het kompas in komt
 * @param {object} bronnen.plaatsing de bewaarde verschuivingen en schalen van deze pagina
 */
export function tekenBijwerk (laag, gegevens, stijl, view, {
  silhouet = null,
  reis = null,
  svgLaag = null,
  plaatsing = {}
} = {}) {
  const maat = paginaMaat(stijl)
  const marge = maat.afloopMm + stijl['pagina.veiligeMargeMm']

  // ------------------------------------------------------------- titelblok
  if (stijl['titelblok.aan']) {
    const blok = document.createElement('div')
    blok.className = 'titelblok'
    blok.setAttribute('data-plek', 'titelblok')
    blok.setAttribute('data-schaalbaar', 'css')
    blok.setAttribute('data-midden', '')
    blok.setAttribute('data-knoppen', 'titelblok')
    inHoek(blok, stijl['titelblok.positie'], marge, maat)

    blok.style.textAlign = stijl['titelblok.uitlijning']
    blok.style.color = stijl['titelblok.kleur']

    const glas = zetGlas(blok, stijl)
    if (!glas && stijl['titelblok.vlakAan']) {
      blok.style.background = stijl['titelblok.vlakKleur']
      blok.style.opacity = '1'
      blok.style.padding = mm(3)
      blok.style.borderRadius = mm(1.5)
      blok.style.setProperty('--vlakdekking', stijl['titelblok.vlakDekking'])
    }

    const datum = document.createElement('div')
    datum.className = 'titel-datum'
    datum.style.fontSize = mm(stijl['typografie.datumMm'])
    datum.textContent = `Dag ${gegevens.dag.dag} · ${leesbareDatum(gegevens.dag.datum)}`

    const titel = document.createElement('div')
    titel.className = 'titel-hoofd'
    titel.setAttribute('data-tekst', 'titel')
    titel.style.fontSize = mm(stijl['typografie.titelMm'])
    titel.textContent = gegevens.dag.titel

    blok.append(datum, titel)
    laag.append(blok)
  }

  // ---------------------------------------------------------- inzetkaartje
  //
  // Een klein kaartje verdient dezelfde aandacht als een groot. Vandaar de
  // ruimte rondom het eiland, de afgeronde hoeken, de zachte schaduw die het
  // van de kaart tilt, en een kadertje met een lichte vulling in plaats van
  // een harde rode doos.
  if (stijl['inzet.aan'] && silhouet) {
    const b = silhouet.bounds
    const buitenBreedte = stijl['inzet.breedteMm']
    const pad = stijl['inzet.padMm']
    const breedte = Math.max(4, buitenBreedte - 2 * pad)

    const hulp = MapView.fit(
      [[b.west, b.south], [b.east, b.north]],
      { widthMm: breedte, heightMm: breedte, paddingMm: 0 }
    )
    const hoek0 = hulp.project(b.west, b.north)
    const hoek1 = hulp.project(b.east, b.south)
    const hoogte = Math.abs(hoek1.y - hoek0.y)

    const doos = document.createElement('div')
    doos.className = 'inzet'
    doos.setAttribute('data-plek', 'inzet')
    doos.setAttribute('data-schaalbaar', 'hertekenen')
    doos.setAttribute('data-midden', '')
    doos.setAttribute('data-knoppen', 'inzet')
    // hoger zetten dan de bronvermelding, anders lopen ze in elkaar
    inHoek(doos, stijl['inzet.hoek'], marge, maat)
    if (!stijl['inzet.hoek'].includes('boven') && stijl['bron.aan']) {
      doos.style.bottom = mm(marge + stijl['bron.grootteMm'] + 2)
    }

    doos.style.width = mm(buitenBreedte)
    doos.style.height = mm(hoogte + 2 * pad)
    doos.style.padding = mm(pad)
    doos.style.borderRadius = mm(stijl['inzet.afrondingMm'])
    doos.style.borderWidth = mm(stijl['inzet.randMm'])
    doos.style.borderColor = stijl['inzet.randKleur']
    doos.style.background = stijl['inzet.achtergrond']
    if (stijl['inzet.schaduw']) {
      doos.style.boxShadow =
        `0 calc(0.3 * var(--mm)) calc(1.2 * var(--mm)) #00000018, ` +
        `0 calc(0.08 * var(--mm)) calc(0.25 * var(--mm)) #0000000f`
    }

    const binnen = document.createElement('div')
    binnen.className = 'inzet-binnen'
    binnen.style.width = mm(breedte)
    binnen.style.height = mm(hoogte)

    // Het eiland vult het binnenvak precies.
    //
    // Eerder werd het geplaatst via een hulp-uitsnede die in een vierkant
    // centreerde, terwijl de route in een vak van breedte bij hoogte werd
    // getekend. Die twee centreren verschillend, dus stond het eiland een halve
    // vakhoogte te laag ten opzichte van het kadertje. Nu delen ze dezelfde
    // uitsnede: de bounds passen zonder marge, dus het eiland vult het vak.
    const eiland = document.createElement('img')
    eiland.src = silhouet.url
    eiland.style.left = '0'
    eiland.style.top = '0'
    eiland.style.width = mm(breedte)
    eiland.style.height = mm(hoogte)
    binnen.append(eiland)

    const svg = document.createElementNS(SVG, 'svg')
    svg.setAttribute('viewBox', `0 0 ${breedte} ${hoogte}`)

    const view2 = MapView.fit(
      [[b.west, b.south], [b.east, b.north]],
      { widthMm: breedte, heightMm: hoogte, paddingMm: 0 }
    )

    svg.append(maakSvg('path', {
      d: padData(vereenvoudig(projecteer(gegevens.route.coordinates, view2), 0.04)),
      fill: 'none',
      stroke: stijl['inzet.routeKleur'],
      'stroke-width': Math.max(0.18, breedte / 85),
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round'
    }))

    // het kadertje: afgerond, met een lichte vulling erbinnen
    const zicht = view.visibleBounds()
    const a = view2.project(zicht.west, zicht.north)
    const c = view2.project(zicht.east, zicht.south)
    const kx = Math.min(a.x, c.x)
    const ky = Math.min(a.y, c.y)
    const kb = Math.abs(c.x - a.x)
    const kh = Math.abs(c.y - a.y)

    svg.append(maakSvg('rect', {
      x: kx, y: ky, width: kb, height: kh,
      rx: Math.min(kb, kh) * 0.09,
      fill: stijl['inzet.kaderKleur'],
      'fill-opacity': stijl['inzet.kaderVulling'],
      stroke: stijl['inzet.kaderKleur'],
      'stroke-width': stijl['inzet.kaderMm'],
      'stroke-linejoin': 'round'
    }))

    binnen.append(svg)
    doos.append(binnen)
    laag.append(doos)
  }

  // ------------------------------------------------------------ schaalbalk
  if (stijl['schaal.balkAan']) {
    const mPerMm = view.metersPerMm()
    const streefBreedteMm = maat.breedteMm * 0.16
    const km = netteAfstand((streefBreedteMm * mPerMm) / 1000)
    const balkMm = (km * 1000) / mPerMm

    const balk = document.createElement('div')
    balk.className = 'schaalbalk'
    balk.setAttribute('data-plek', 'schaalbalk')
    balk.setAttribute('data-schaalbaar', 'hertekenen')
    balk.setAttribute('data-midden', '')
    balk.setAttribute('data-knoppen', 'schaal')
    inHoek(balk, stijl['schaal.positie'], marge, maat)
    balk.style.color = stijl['schaal.kleur']
    balk.style.fontSize = mm(2.2)

    const streep = document.createElement('div')
    streep.className = 'schaal-streep'
    streep.style.width = mm(balkMm)
    streep.style.borderColor = stijl['schaal.kleur']
    streep.style.borderWidth = mm(0.35)

    const tekst = document.createElement('div')
    tekst.textContent = `${km} km`

    balk.append(streep, tekst)
    laag.append(balk)
  }

  // -------------------------------------------------------------- kompasroos
  if (stijl['schaal.noordpijlAan']) {
    const straal = stijl['schaal.kompasMm'] / 2
    const rand = marge + straal + (stijl['schaal.kompasLetters'] ? stijl['schaal.kompasLetterMm'] * 1.4 : 1)

    const hoek = stijl['schaal.kompasHoek']
    const x = hoek.includes('links') ? rand : maat.breedteMm - rand
    const y = hoek.includes('boven') ? rand : maat.hoogteMm - rand

    const roos = kompasroos({
      straal,
      vorm: stijl['schaal.kompasVorm'],
      donker: stijl['schaal.kompasDonker'],
      licht: stijl['schaal.kompasLicht'],
      ring: stijl['schaal.kompasRing'],
      ringDikteMm: stijl['schaal.kompasLijnMm'],
      letters: stijl['schaal.kompasLetters'],
      letterMm: stijl['schaal.kompasLetterMm']
    })
    // Zelfde opzet als bij de markers: een buitenste groep die de plek bepaalt
    // en een binnenste die jouw verschuiving en schaal opvangt, zodat schalen om
    // het hart van de roos draait en niet om de hoek van de pagina.
    const anker = maakSvg('g', { transform: `translate(${x} ${y})` })
    const beweegbaar = maakSvg('g', {
      'data-plek': 'kompas',
      'data-schaalbaar': 'css',
      'data-knoppen': 'schaal'
    })

    // het glasplaatje eerst, zodat de roos erbovenop komt
    if (stijl['schaal.kompasGlas']) {
      beweegbaar.append(kompasGlas(straal * stijl['schaal.kompasGlasFactor'], {
        kleur: stijl['titelblok.glasKleur'],
        dekking: stijl['titelblok.glasDekking'],
        schaduw: stijl['titelblok.glasSchaduw']
      }))
    }

    beweegbaar.append(roos)
    anker.append(beweegbaar)
    svgLaag?.append(anker)
  }

  // ---------------------------------------------------------- bronvermelding
  if (stijl['bron.aan']) {
    const bron = document.createElement('div')
    bron.className = 'bronvermelding'
    bron.setAttribute('data-plek', 'bron')
    bron.setAttribute('data-tekst', 'bron')
    bron.setAttribute('data-schaalbaar', 'css')
    bron.setAttribute('data-midden', '')
    bron.setAttribute('data-knoppen', 'bron')
    bron.style.position = 'absolute'
    bron.style.right = mm(marge)
    bron.style.bottom = mm(maat.afloopMm + 1.5)
    bron.style.fontSize = mm(stijl['bron.grootteMm'])
    bron.style.color = stijl['bron.kleur']
    bron.textContent = 'Hoogtegegevens: Terrain Tiles · Route: OSRM/OpenStreetMap'
    laag.append(bron)
  }
}

function leesbareDatum (iso) {
  const maanden = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december']
  const [jaar, maand, dag] = iso.split('-').map(Number)
  return `${dag} ${maanden[maand - 1]} ${jaar}`
}
