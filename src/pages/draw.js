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

/**
 * De stukken van de route die op een F-weg liggen, als losse puntenreeksen.
 *
 * De etappelengtes vertellen waar elke etappe begint en eindigt op de route.
 * Staat het waypoint aan het begin van een etappe als F-weg gemarkeerd, dan
 * hoort die hele etappe erbij.
 */
function fwegStukken (gegevens, punten) {
  const waypoints = gegevens.dag.waypoints
  const legs = gegevens.route.legs ?? []
  if (!waypoints.some(w => w.fweg)) return []

  // de afgelegde afstand op elk punt van de getekende lijn
  const langs = [0]
  for (let i = 1; i < punten.length; i++) {
    langs.push(langs[i - 1] + Math.hypot(punten[i].x - punten[i - 1].x, punten[i].y - punten[i - 1].y))
  }
  const totaalMm = langs.at(-1)
  const totaalKm = legs.reduce((s, l) => s + l.distanceKm, 0)
  if (!totaalKm || !totaalMm) return []

  const stukken = []
  let km = 0

  for (const [i, leg] of legs.entries()) {
    const vanKm = km
    km += leg.distanceKm

    if (!waypoints[i]?.fweg) continue

    const vanMm = (vanKm / totaalKm) * totaalMm
    const totMm = (km / totaalKm) * totaalMm

    const stuk = punten.filter((_, j) => langs[j] >= vanMm && langs[j] <= totMm)
    if (stuk.length > 1) stukken.push(stuk)
  }

  return stukken
}

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

  // Iconen voor waar je sliep. Bewust hoekig en zonder details: op vier
  // millimeter papier overleeft alleen de silhouetvorm, en juist die maakt in
  // een oogopslag duidelijk of het een tent of een dak was.
  if (vorm === 'tent') {
    const s = straal
    return maak('path', {
      // driehoek met een V-vormige opening onderin, zoals een tentflap
      d: `M ${-s * 1.05} ${s * 0.8} L 0 ${-s} L ${s * 1.05} ${s * 0.8} ` +
         `L ${s * 0.3} ${s * 0.8} L 0 ${s * 0.02} L ${-s * 0.3} ${s * 0.8} Z`,
      'stroke-linejoin': 'round'
    })
  }

  if (vorm === 'huisje') {
    const s = straal
    return maak('path', {
      // silhouet met een deuropening; evenodd maakt de deur een gat
      d: `M ${-s * 0.88} ${s * 0.85} L ${-s * 0.88} ${-s * 0.08} L 0 ${-s} ` +
         `L ${s * 0.88} ${-s * 0.08} L ${s * 0.88} ${s * 0.85} Z ` +
         `M ${-s * 0.24} ${s * 0.85} L ${-s * 0.24} ${s * 0.26} ` +
         `L ${s * 0.24} ${s * 0.26} L ${s * 0.24} ${s * 0.85} Z`,
      'fill-rule': 'evenodd',
      'stroke-linejoin': 'round'
    })
  }

  if (vorm === 'auto') {
    const s = straal
    return maak('path', {
      d: `M ${-s} ${s * 0.35} L ${-s * 0.82} ${-s * 0.12} L ${-s * 0.45} ${-s * 0.55} ` +
         `L ${s * 0.45} ${-s * 0.55} L ${s * 0.82} ${-s * 0.12} L ${s} ${s * 0.35} ` +
         `L ${s} ${s * 0.62} L ${s * 0.6} ${s * 0.62} L ${s * 0.6} ${s * 0.35} ` +
         `L ${-s * 0.6} ${s * 0.35} L ${-s * 0.6} ${s * 0.62} L ${-s} ${s * 0.62} Z`,
      'stroke-linejoin': 'round'
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

  // De hele routelijn komt in één groep, en de doorzichtigheid zit op die groep
  // in plaats van op de lijnen zelf.
  //
  // Dat is het verschil tussen "elke lijn half doorzichtig" en "de route als
  // geheel half doorzichtig". Reed je een weg heen én terug, dan liggen er twee
  // lijnen over elkaar; met doorzichtigheid per lijn wordt dat stuk donkerder,
  // alsof je er twee keer zo hard reed. Op de groep wordt alles eerst platgeslagen
  // en pas daarna doorzichtig gemaakt, dus dubbel rijden telt niet dubbel.
  const routeGroep = maak('g', { opacity: stijl['route.dekking'] })

  const buitenDikte = stijl['route.dikteMm'] + 2 * stijl['route.buitenExtraMm']
  if (stijl['route.buitenExtraMm'] > 0) {
    const buiten = maak('path', {
      d,
      fill: 'none',
      stroke: stijl['route.buitenKleur'],
      'stroke-width': buitenDikte,
      'stroke-opacity': stijl['route.buitenDekking'],
      'stroke-linecap': UITEINDEN[stijl['route.uiteinden']],
      'stroke-linejoin': 'round',
      'stroke-dasharray': streepjes
    })

    // Met de buitenlijn als omranding wordt het midden eruit gemaskeerd, zodat
    // de kaart door je route heen schijnt in plaats van dat je de buitenlijn ziet.
    if (stijl['route.buitenAlsRand']) {
      const maskerId = 'route-omranding'
      const defs = maak('defs')
      const masker = maak('mask', { id: maskerId, maskUnits: 'userSpaceOnUse' })

      masker.append(maak('path', {
        d, fill: 'none', stroke: '#ffffff', 'stroke-width': buitenDikte,
        'stroke-linecap': UITEINDEN[stijl['route.uiteinden']], 'stroke-linejoin': 'round',
        'stroke-dasharray': streepjes
      }))
      masker.append(maak('path', {
        d, fill: 'none', stroke: '#000000', 'stroke-width': stijl['route.dikteMm'],
        'stroke-linecap': UITEINDEN[stijl['route.uiteinden']], 'stroke-linejoin': 'round',
        'stroke-dasharray': streepjes
      }))

      defs.append(masker)
      routeGroep.append(defs)
      buiten.setAttribute('mask', `url(#${maskerId})`)
    }

    routeGroep.append(buiten)
  }

  routeGroep.append(maak('path', {
    d,
    fill: 'none',
    stroke: stijl['route.kleur'],
    'stroke-width': stijl['route.dikteMm'],
    'stroke-linecap': UITEINDEN[stijl['route.uiteinden']],
    'stroke-linejoin': 'round',
    'stroke-dasharray': streepjes
  }))

  // De F-wegen als stippellijn erbovenop.
  //
  // De routelijn is een doorlopend pad, dus we knippen hem niet op. In plaats
  // daarvan komt er een stippellijn overheen op de stukken waar je op een F-weg
  // reed - het onverharde hooglandwerk. Waar die stukken liggen volgt uit de
  // etappelengtes: elke etappe loopt van waypoint naar waypoint.
  if (stijl['route.fwegStippels']) {
    const stukken = fwegStukken(gegevens, punten)
    for (const stuk of stukken) {
      routeGroep.append(maak('path', {
        d: padData(stuk),
        fill: 'none',
        stroke: stijl['route.buitenKleur'],
        'stroke-width': stijl['route.dikteMm'] * 0.55,
        'stroke-dasharray': `${stijl['route.fwegStreepMm']} ${stijl['route.fwegGatMm']}`,
        'stroke-linecap': 'round'
      }))
    }
  }

  svg.append(routeGroep)

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

    // Waar je sliep bepaalt het icoon: een tent voor kamperen, een huis voor
    // een hotel, een auto voor de nacht op de parkeerplaats. Staat het niet in
    // het dagbestand, dan valt hij terug op de ingestelde vorm.
    const slaapVorm = { tent: 'tent', hotel: 'huisje', auto: 'auto' }[w.verblijf] ??
      stijl['markers.slaapVorm']

    const vorm = markerVorm(
      slaap ? slaapVorm : via ? 'cirkel' : stijl['markers.stopVorm'],
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
    // Dezelfde naam twee keer op één kaart is altijd fout: reed je heen en weer
    // langs het vliegveld, dan hoort er één keer "Keflavík Airport" te staan.
    const alGetoond = new Set()

    for (const [i, w] of gegevens.dag.waypoints.entries()) {
      if (w.type === 'via' && !w.label) continue
      if (w.toonLabel === false) continue
      if (!w.name) continue
      if (alGetoond.has(w.name)) continue
      alGetoond.add(w.name)

      const p = view.project(w.lon, w.lat)
      const verschuivingX = w.labelDxMm ?? 0
      const verschuivingY = w.labelDyMm ?? -(stijl['markers.stopGrootteMm'] / 2 + 1.6)

      const naam = document.createElement('div')
      naam.className = 'plaatsnaam'
      naam.setAttribute('data-plek', `label:${i}`)
      naam.setAttribute('data-tekst', `waypoint:${i}`)
      naam.textContent = w.name
      naam.style.left = `calc(${(p.x + verschuivingX)} * var(--mm))`
      naam.style.top = `calc(${(p.y + verschuivingY)} * var(--mm))`
      opschriften.append(naam)
    }
  }

  return view
}
