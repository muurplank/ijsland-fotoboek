/**
 * De overzichtskaart: de hele reis op één kaart.
 *
 * De dagen krijgen een oplopend kleurverloop van licht naar donker in plaats
 * van elk een eigen kleur. Dagen hebben namelijk een volgorde, en dan is een
 * verloop de juiste vorm: je ziet in één oogopslag hoe de reis zich ontvouwde.
 * Acht losse kleuren zouden suggereren dat de dagen los van elkaar staan, en
 * acht kleuren die je uit elkaar kunt houden bestaan sowieso niet.
 */

import { maakView, paginaMaat } from '../render/layout.js'
import { boundsOf } from '../geo/viewport.js'
import { padData, projecteer, vereenvoudig } from '../render/svg.js'
import { Bezetting, langsElkaar } from '../render/parallel.js'
import { kompasroos } from './compass.js'

const SVG = 'http://www.w3.org/2000/svg'

const maakSvg = (tag, eigenschappen = {}) => {
  const n = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(eigenschappen)) {
    if (v !== null && v !== undefined) n.setAttribute(k, String(v))
  }
  return n
}

const mm = waarde => `calc(${waarde} * var(--mm))`

/** '#aabbcc' naar [r,g,b]. */
function hexNaarRgb (hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

const naarHex = ([r, g, b]) =>
  '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')

/**
 * Een verloop van licht naar donker in de kleur van de route.
 *
 * De lichtste stap blijft donker genoeg om op wit papier te zien te zijn, en de
 * donkerste stap blijft licht genoeg om niet in zwart te verdwijnen.
 */
/**
 * Acht kleuren die zo goed mogelijk uit elkaar te houden zijn.
 *
 * Eerlijk gezegd: acht kleuren die je állemaal onderling kunt onderscheiden
 * bestaan niet. Deze reeks haalt de helderheidsband, de kleurkracht en het
 * contrast met het papier, maar het zwakste paar blijft lastig bij
 * kleurenblindheid. Op deze kaart is dat opgevangen doordat de dagnummers op de
 * route staan en gedeelde wegen naast elkaar liggen: twee signalen naast kleur.
 */
export const DAGKLEUREN = [
  '#b86580', '#b96c49', '#9d8026', '#66924c',
  '#049886', '#1990b5', '#697fc5', '#9c6eb0'
]

export function dagKleuren (aantal, basis) {
  const [r, g, b] = hexNaarRgb(basis)
  const uit = []

  for (let i = 0; i < aantal; i++) {
    const deel = aantal === 1 ? 0.5 : i / (aantal - 1)
    // van 55% naar wit toe, tot 30% naar zwart toe
    const naarWit = 0.55 * (1 - deel)
    const naarZwart = 0.30 * deel
    const kleur = [r, g, b]
      .map(v => v + (255 - v) * naarWit)
      .map(v => v * (1 - naarZwart))
    uit.push(naarHex(kleur))
  }
  return uit
}

/**
 * Tekent de hele reis.
 *
 * @param {SVGElement} svg
 * @param {HTMLElement} opschriften
 * @param {Array} reis alle dagen met hun routes
 * @param {object} stijl
 */
export function tekenOverzicht (svg, opschriften, reis, stijl) {
  const maat = paginaMaat(stijl)
  const marge = maat.afloopMm + stijl['pagina.veiligeMargeMm']

  const alles = reis.flatMap(d => d.coordinates)
  const view = maakView(alles, stijl)

  svg.setAttribute('viewBox', `0 0 ${maat.breedteMm} ${maat.hoogteMm}`)
  svg.replaceChildren()
  opschriften.replaceChildren()

  const kleuren = stijl['overzicht.dagkleuren']
    ? reis.map((_, i) => DAGKLEUREN[i % DAGKLEUREN.length])
    : dagKleuren(reis.length, stijl['route.kleur'])

  // Waar twee dagen dezelfde weg deelden verdwijnt de ene lijn onder de andere.
  // Ze worden daarom naast elkaar gelegd, met de weg zelf als middellijn.
  const bezetting = new Bezetting(stijl['overzicht.tussenruimteMm'] * 1.6)

  const paden = reis.map(dag => {
    const punten = vereenvoudig(projecteer(dag.coordinates, view), 0.05)
    return stijl['overzicht.langsElkaar']
      ? langsElkaar(punten, bezetting, { afstandMm: stijl['overzicht.tussenruimteMm'] })
      : punten
  })

  // buitenlijnen eerst, allemaal onder de routes door: anders snijdt de
  // buitenlijn van dag 5 door de route van dag 4 heen
  const dikte = stijl['overzicht.dikteMm']
  const buiten = stijl['overzicht.buitenMm']

  if (buiten > 0) {
    for (const punten of paden) {
      svg.append(maakSvg('path', {
        d: padData(punten),
        fill: 'none',
        stroke: stijl['route.buitenKleur'],
        'stroke-width': dikte + 2 * buiten,
        'stroke-opacity': stijl['route.buitenDekking'],
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }))
    }
  }

  for (const [i, punten] of paden.entries()) {
    svg.append(maakSvg('path', {
      d: padData(punten),
      fill: 'none',
      stroke: kleuren[i],
      'stroke-width': dikte,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }))
  }

  // overnachtingen: dat zijn de scharnierpunten van de reis
  for (const [i, dag] of reis.entries()) {
    for (const w of dag.waypoints) {
      if (w.type !== 'overnight' && w.type !== 'end') continue
      const p = view.project(w.lon, w.lat)

      svg.append(maakSvg('circle', {
        cx: p.x, cy: p.y, r: stijl['markers.slaapGrootteMm'] / 2,
        fill: kleuren[i],
        stroke: stijl['markers.slaapRand'],
        'stroke-width': stijl['markers.stopRandMm']
      }))

      const nr = document.createElement('div')
      nr.className = 'dagnummer'
      nr.setAttribute('data-plek', `dagnummer:${dag.dag}`)
      nr.setAttribute('data-knoppen', 'eerdere')
      nr.style.left = mm(p.x)
      nr.style.top = mm(p.y)
      nr.style.fontSize = mm(stijl['markers.slaapGrootteMm'] * 0.62)
      nr.textContent = String(dag.dag)
      opschriften.append(nr)
    }
  }

  // ------------------------------------------------------------- titelblok
  const blok = document.createElement('div')
  blok.className = 'titelblok'
  blok.setAttribute('data-plek', 'titelblok')
  blok.setAttribute('data-schaalbaar', 'css')
  blok.setAttribute('data-midden', '')
  blok.setAttribute('data-knoppen', 'titelblok')
  blok.style.position = 'absolute'
  blok.style.left = mm(marge)
  blok.style.top = mm(marge)
  blok.style.color = stijl['titelblok.kleur']

  const totaal = reis.reduce((s, d) => s + d.afstandKm, 0)
  const boven = document.createElement('div')
  boven.className = 'titel-datum'
  boven.style.fontSize = mm(stijl['typografie.datumMm'])
  boven.textContent = `${reis.length} dagen · ${totaal.toFixed(0)} km`

  const titel = document.createElement('div')
  titel.className = 'titel-hoofd'
  titel.setAttribute('data-tekst', 'overzichtstitel')
  titel.style.fontSize = mm(stijl['typografie.titelMm'])
  titel.textContent = 'De hele reis'

  blok.append(boven, titel)
  opschriften.append(blok)

  // -------------------------------------------------------------- legenda
  // Bij een verloop hoef je niet elke dag te benoemen: de eerste, de laatste en
  // de richting ertussen is genoeg om het te lezen.
  const legenda = document.createElement('div')
  legenda.className = 'legenda'
  legenda.setAttribute('data-plek', 'legenda')
  legenda.setAttribute('data-schaalbaar', 'css')
  legenda.setAttribute('data-midden', '')
  legenda.setAttribute('data-knoppen', 'eerdere')
  legenda.style.left = mm(marge)
  legenda.style.bottom = mm(marge)
  legenda.style.fontSize = mm(2.4)
  legenda.style.color = stijl['statistieken.labelKleur']

  if (stijl['overzicht.dagkleuren']) {
    // losse kleuren: een blokje met dagnummer per dag, want een verloopbalk
    // suggereert een reeks die er dan niet is
    for (const [i, dag] of reis.entries()) {
      const vak = document.createElement('span')
      vak.className = 'legenda-dag'
      vak.style.background = kleuren[i]
      vak.style.width = mm(3.4)
      vak.style.height = mm(3.4)
      legenda.append(vak)

      const nr = document.createElement('span')
      nr.className = 'legenda-nr'
      nr.textContent = `Dag ${dag.dag}`
      legenda.append(nr)
    }
  } else {
    const balk = document.createElement('div')
    balk.className = 'legenda-balk'
    balk.style.height = mm(2.2)
    balk.style.width = mm(38)
    balk.style.background = `linear-gradient(to right, ${kleuren.join(', ')})`

    const van = document.createElement('span')
    van.textContent = 'dag 1'
    const tot = document.createElement('span')
    tot.textContent = `dag ${reis.length}`

    legenda.append(van, balk, tot)
  }
  opschriften.append(legenda)

  // ------------------------------------------------------------ kompasroos
  if (stijl['schaal.noordpijlAan']) {
    const straal = stijl['schaal.kompasMm'] / 2
    const rand = marge + straal + (stijl['schaal.kompasLetters'] ? stijl['schaal.kompasLetterMm'] * 1.4 : 1)
    const hoek = stijl['schaal.kompasHoek']

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
    roos.setAttribute('transform',
      `translate(${hoek.includes('links') ? rand : maat.breedteMm - rand} ` +
      `${hoek.includes('boven') ? rand : maat.hoogteMm - rand})`)
    svg.append(roos)
  }

  if (stijl['bron.aan']) {
    const bron = document.createElement('div')
    bron.style.position = 'absolute'
    bron.style.right = mm(marge)
    bron.style.bottom = mm(maat.afloopMm + 1.5)
    bron.style.fontSize = mm(stijl['bron.grootteMm'])
    bron.style.color = stijl['bron.kleur']
    bron.textContent = 'Hoogtegegevens: Terrain Tiles · Route: OSRM/OpenStreetMap'
    opschriften.append(bron)
  }

  return view
}
