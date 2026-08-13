/**
 * Tekent de kaartlaag: route, richtingspijltjes, markers en labels.
 *
 * Alles in millimeters, als vectoren. De SVG heeft een viewBox in millimeters,
 * dus een lijndikte van 1.1 hier is ook echt 1,1 mm op papier - bij elke
 * resolutie en elk paginaformaat.
 */

import { maakView, paginaMaat } from '../render/layout.js'
import { padData, pijltjesLangs, projecteer, vereenvoudig } from '../render/svg.js'

const SVG = 'http://www.w3.org/2000/svg'

const maak = (tag, eigenschappen = {}) => {
  const n = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(eigenschappen)) {
    if (v !== null && v !== undefined) n.setAttribute(k, String(v))
  }
  return n
}

const UITEINDEN = { rond: 'round', plat: 'butt', vierkant: 'square' }

/** Het pijltje als pad, wijzend naar rechts, met de punt in de oorsprong. */
function pijlPad (vorm, grootte) {
  const l = grootte
  if (vorm === 'chevron') {
    return `M ${-l * 0.9} ${-l * 0.55} L 0 0 L ${-l * 0.9} ${l * 0.55}`
  }
  return `M 0 0 L ${-l} ${-l * 0.5} L ${-l * 0.72} 0 L ${-l} ${l * 0.5} Z`
}

/** Een marker van de gevraagde vorm, gecentreerd op de oorsprong. */
function markerVorm (vorm, straal) {
  if (vorm === 'vierkant') {
    return maak('rect', { x: -straal, y: -straal, width: straal * 2, height: straal * 2 })
  }
  if (vorm === 'ruit') {
    return maak('path', { d: `M 0 ${-straal} L ${straal} 0 L 0 ${straal} L ${-straal} 0 Z` })
  }
  if (vorm === 'ster') {
    const punten = []
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? straal : straal * 0.45
      const hoek = (Math.PI / 5) * i - Math.PI / 2
      punten.push(`${(Math.cos(hoek) * r).toFixed(3)},${(Math.sin(hoek) * r).toFixed(3)}`)
    }
    return maak('polygon', { points: punten.join(' ') })
  }
  if (vorm === 'speld') {
    const h = straal * 2.4
    return maak('path', {
      d: `M 0 0 C ${-straal * 1.35} ${-h * 0.55} ${-straal} ${-h} 0 ${-h} ` +
         `C ${straal} ${-h} ${straal * 1.35} ${-h * 0.55} 0 0 Z`
    })
  }
  return maak('circle', { cx: 0, cy: 0, r: straal })
}

/**
 * Tekent alles opnieuw.
 *
 * @param {SVGElement} svg het tekenvlak
 * @param {HTMLElement} opschriften laag voor de labels (gewone tekst, geen svg)
 * @param {object} gegevens route en waypoints van de dag
 * @param {object} stijl alle instellingen
 */
export function teken (svg, opschriften, gegevens, stijl) {
  const maat = paginaMaat(stijl)
  const view = maakView(gegevens.route.coordinates, stijl)

  svg.setAttribute('viewBox', `0 0 ${maat.breedteMm} ${maat.hoogteMm}`)
  svg.replaceChildren()
  opschriften.replaceChildren()

  // ------------------------------------------------------------------ route
  const ruw = projecteer(gegevens.route.coordinates, view)

  // een tiende millimeter is al fijner dan een drukpers kan zetten
  const punten = vereenvoudig(ruw, 0.05)

  const streepjes = stijl['route.streepjes']
    ? `${stijl['route.streepMm']} ${stijl['route.gatMm']}`
    : null

  const d = padData(punten)

  // buitenlijn eronder: die maakt de route los van de achtergrond
  const buitenDikte = stijl['route.dikteMm'] + 2 * stijl['route.buitenExtraMm']
  if (stijl['route.buitenExtraMm'] > 0) {
    svg.append(maak('path', {
      d,
      fill: 'none',
      stroke: stijl['route.buitenKleur'],
      'stroke-width': buitenDikte,
      'stroke-opacity': stijl['route.buitenDekking'],
      'stroke-linecap': UITEINDEN[stijl['route.uiteinden']],
      'stroke-linejoin': 'round',
      'stroke-dasharray': streepjes
    }))
  }

  svg.append(maak('path', {
    d,
    fill: 'none',
    stroke: stijl['route.kleur'],
    'stroke-width': stijl['route.dikteMm'],
    'stroke-opacity': stijl['route.dekking'],
    'stroke-linecap': UITEINDEN[stijl['route.uiteinden']],
    'stroke-linejoin': 'round',
    'stroke-dasharray': streepjes
  }))

  // -------------------------------------------------------------- pijltjes
  if (stijl['pijltjes.aan']) {
    const groep = maak('g')
    for (const p of pijltjesLangs(punten, stijl['pijltjes.afstandCm'] * 10)) {
      groep.append(maak('path', {
        d: pijlPad(stijl['pijltjes.vorm'], stijl['pijltjes.grootteMm']),
        transform: `translate(${p.x.toFixed(3)} ${p.y.toFixed(3)}) rotate(${p.hoek.toFixed(2)})`,
        fill: stijl['pijltjes.vorm'] === 'chevron' ? 'none' : stijl['pijltjes.kleur'],
        stroke: stijl['pijltjes.vorm'] === 'chevron'
          ? stijl['pijltjes.kleur']
          : (stijl['pijltjes.randMm'] > 0 ? stijl['pijltjes.randKleur'] : 'none'),
        'stroke-width': stijl['pijltjes.vorm'] === 'chevron'
          ? stijl['pijltjes.grootteMm'] * 0.28
          : stijl['pijltjes.randMm'],
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }))
    }
    svg.append(groep)
  }

  // --------------------------------------------------------------- markers
  const markers = maak('g')
  let stopNummer = 0

  for (const w of gegevens.dag.waypoints) {
    const p = view.project(w.lon, w.lat)
    const slaap = w.type === 'overnight'
    const via = w.type === 'via'

    const straal = (slaap
      ? stijl['markers.slaapGrootteMm']
      : via ? stijl['markers.viaGrootteMm'] : stijl['markers.stopGrootteMm']) / 2

    if (straal <= 0) continue

    const vorm = markerVorm(
      slaap ? stijl['markers.slaapVorm'] : via ? 'cirkel' : stijl['markers.stopVorm'],
      straal
    )

    vorm.setAttribute('transform', `translate(${p.x.toFixed(3)} ${p.y.toFixed(3)})`)
    vorm.setAttribute('fill', slaap
      ? stijl['markers.slaapVulling']
      : via ? stijl['markers.viaVulling'] : stijl['markers.stopVulling'])

    if (!via) {
      vorm.setAttribute('stroke', slaap ? stijl['markers.slaapRand'] : stijl['markers.stopRand'])
      vorm.setAttribute('stroke-width', stijl['markers.stopRandMm'])
    }

    markers.append(vorm)

    if (stijl['markers.nummers'] && !via) {
      stopNummer++
      const nr = maak('text', {
        x: p.x, y: p.y + straal * 0.36,
        'text-anchor': 'middle',
        'font-size': straal * 1.05,
        'font-weight': 650,
        fill: slaap ? '#ffffff' : stijl['markers.stopRand']
      })
      nr.textContent = String(stopNummer)
      markers.append(nr)
    }
  }
  svg.append(markers)

  // ---------------------------------------------------------------- labels
  if (stijl['labels.aan']) {
    for (const w of gegevens.dag.waypoints) {
      if (w.type === 'via' && !w.label) continue
      if (w.toonLabel === false) continue

      const p = view.project(w.lon, w.lat)
      const verschuivingX = w.labelDxMm ?? 0
      const verschuivingY = w.labelDyMm ?? -(stijl['markers.stopGrootteMm'] / 2 + 1.6)

      const naam = document.createElement('div')
      naam.className = 'plaatsnaam'
      naam.textContent = w.name
      naam.style.left = `calc(${(p.x + verschuivingX)} * var(--mm))`
      naam.style.top = `calc(${(p.y + verschuivingY)} * var(--mm))`
      opschriften.append(naam)
    }
  }

  return view
}
