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

  const kleuren = dagKleuren(reis.length, stijl['route.kleur'])

  // buitenlijnen eerst, allemaal onder de routes door: anders snijdt de
  // buitenlijn van dag 5 door de route van dag 4 heen
  if (stijl['route.buitenExtraMm'] > 0) {
    for (const dag of reis) {
      svg.append(maakSvg('path', {
        d: padData(vereenvoudig(projecteer(dag.coordinates, view), 0.05)),
        fill: 'none',
        stroke: stijl['route.buitenKleur'],
        'stroke-width': stijl['route.dikteMm'] + 2 * stijl['route.buitenExtraMm'],
        'stroke-opacity': stijl['route.buitenDekking'],
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }))
    }
  }

  for (const [i, dag] of reis.entries()) {
    svg.append(maakSvg('path', {
      d: padData(vereenvoudig(projecteer(dag.coordinates, view), 0.05)),
      fill: 'none',
      stroke: kleuren[i],
      'stroke-width': stijl['route.dikteMm'],
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
  legenda.style.left = mm(marge)
  legenda.style.bottom = mm(marge)
  legenda.style.fontSize = mm(2.4)
  legenda.style.color = stijl['statistieken.labelKleur']

  const balk = document.createElement('div')
  balk.className = 'legenda-balk'
  balk.style.height = mm(2.2)
  balk.style.width = mm(38)
  balk.style.background = `linear-gradient(to right, ${kleuren.join(', ')})`

  const van = document.createElement('span')
  van.textContent = `dag 1`
  const tot = document.createElement('span')
  tot.textContent = `dag ${reis.length}`

  legenda.append(van, balk, tot)
  opschriften.append(legenda)

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
