/**
 * De voortgangsbalk: een strookje dat laat zien waar je die dag was.
 *
 * Bedoeld om onder een foto te zetten. De balk loopt van het begin van de dag
 * tot het eind, met een stip op elke stop, en is gevuld tot de stop waar de foto
 * hoort. Zo zie je in één oogopslag of dat ochtend of avond was.
 *
 * De stops staan op hun echte afstand, niet gelijk verdeeld. Vier stops vlak na
 * elkaar en dan tweehonderd kilometer niets is precies wat je wilt zien; ze
 * netjes uitsmeren zou dat wegpoetsen.
 */

import { paginaMaat } from '../render/layout.js'

const SVG = 'http://www.w3.org/2000/svg'

const maakSvg = (tag, eigenschappen = {}) => {
  const n = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(eigenschappen)) {
    if (v !== null && v !== undefined) n.setAttribute(k, String(v))
  }
  return n
}

const mm = waarde => `calc(${waarde} * var(--mm))`

/**
 * Het strookje is zo breed als de pagina maar veel lager: het hoort onder een
 * foto, niet op een eigen bladzijde.
 */
export function voortgangMaat (stijl) {
  const paginaBreed = paginaMaat(stijl)
  const afloop = stijl['pagina.afloopMm']
  return {
    breedteMm: paginaBreed.breedteMm,
    hoogteMm: stijl['voortgang.hoogteMm'] + 2 * afloop,
    afloopMm: afloop,
    snijBreedteMm: paginaBreed.snijBreedteMm,
    snijHoogteMm: stijl['voortgang.hoogteMm']
  }
}

/** De stops van een dag met de afstand waarop ze liggen. */
export function stopsMetAfstand (gegevens) {
  const waypoints = gegevens.dag.waypoints
  const legs = gegevens.route.legs ?? []

  const uit = []
  let opgeteld = 0

  const meetellen = w => w && w.type !== 'via'
  if (meetellen(waypoints[0])) {
    uit.push({ km: 0, naam: waypoints[0].name, type: waypoints[0].type, index: 0 })
  }

  for (const [i, leg] of legs.entries()) {
    opgeteld += leg.distanceKm
    const w = waypoints[i + 1]
    if (meetellen(w)) {
      uit.push({ km: opgeteld, naam: w.name, type: w.type, index: i + 1 })
    }
  }

  return { stops: uit, totaalKm: opgeteld }
}

/**
 * Tekent de balk.
 *
 * @param {number} totIndex tot welke stop de balk gevuld is; -1 is helemaal leeg
 */
export function tekenVoortgang (svg, opschriften, gegevens, stijl, totIndex) {
  const maat = voortgangMaat(stijl)
  const marge = maat.afloopMm + stijl['pagina.veiligeMargeMm']

  svg.setAttribute('viewBox', `0 0 ${maat.breedteMm} ${maat.hoogteMm}`)
  svg.replaceChildren()
  opschriften.replaceChildren()

  const { stops, totaalKm } = stopsMetAfstand(gegevens)
  if (!stops.length || !totaalKm) return

  const links = marge
  const rechts = maat.breedteMm - marge
  const breedte = rechts - links
  const midden = maat.hoogteMm / 2

  const dikte = stijl['voortgang.dikteMm']
  const xVan = km => links + (km / totaalKm) * breedte

  const huidige = stops.find(s => s.index === totIndex) ?? stops.at(-1)

  // ------------------------------------------------------------- de baan
  svg.append(maakSvg('line', {
    x1: links, x2: rechts, y1: midden, y2: midden,
    stroke: stijl['voortgang.baanKleur'],
    'stroke-width': dikte,
    'stroke-linecap': 'round'
  }))

  // ------------------------------------------------------ het gevulde deel
  //
  // Zelfde opbouw als de routelijn op de kaart: een dekkende rand met een
  // doorschijnende kern. Zo hoort de balk zichtbaar bij de route en niet bij
  // een willekeurig ander grafiekje.
  if (huidige.km > 0) {
    const eind = xVan(huidige.km)
    const buitenDikte = dikte + 2 * stijl['voortgang.buitenExtraMm']
    const d = `M ${links} ${midden} L ${eind} ${midden}`

    if (stijl['voortgang.buitenExtraMm'] > 0) {
      // de brede lijn met het midden eruit gemaskeerd, zodat er een echte rand
      // overblijft en de kern erdoorheen laat zien wat eronder ligt
      const defs = maakSvg('defs')
      const masker = maakSvg('mask', { id: 'voortgang-rand', maskUnits: 'userSpaceOnUse' })
      masker.append(maakSvg('path', {
        d, fill: 'none', stroke: '#ffffff', 'stroke-width': buitenDikte, 'stroke-linecap': 'round'
      }))
      masker.append(maakSvg('path', {
        d, fill: 'none', stroke: '#000000', 'stroke-width': dikte, 'stroke-linecap': 'round'
      }))
      defs.append(masker)
      svg.append(defs)

      svg.append(maakSvg('path', {
        d,
        fill: 'none',
        stroke: stijl['route.kleur'],
        'stroke-width': buitenDikte,
        'stroke-linecap': 'round',
        mask: 'url(#voortgang-rand)'
      }))
    }

    svg.append(maakSvg('path', {
      d,
      fill: 'none',
      stroke: stijl['route.kleur'],
      'stroke-opacity': stijl['voortgang.kernDekking'],
      'stroke-width': dikte,
      'stroke-linecap': 'round'
    }))
  }

  // ------------------------------------------------------------- de stops
  //
  // Drie maten: waar je nu bent het grootst, waar je al geweest bent iets
  // groter dan gemiddeld, en wat nog komt het kleinst. Zo lees je de voortgang
  // ook zonder de kleuren te vergelijken.
  for (const stop of stops) {
    const x = xVan(stop.km)
    const gehad = stop.km <= huidige.km + 0.01
    const isHuidige = stop.index === huidige.index

    const straal = stijl['voortgang.stipMm'] * (
      isHuidige ? 0.8 : gehad ? stijl['voortgang.gehadFactor'] : 0.42
    )

    svg.append(maakSvg('circle', {
      cx: x, cy: midden, r: straal,
      fill: gehad ? stijl['route.kleur'] : stijl['voortgang.baanKleur'],
      stroke: stijl['voortgang.stipRand'],
      'stroke-width': isHuidige ? stijl['voortgang.stipMm'] * 0.26 : 0
    }))
  }

  // ------------------------------------------------- naam en afstand eronder
  if (stijl['voortgang.naamAan'] && huidige.naam) {
    const naam = document.createElement('div')
    naam.className = 'voortgang-naam'
    naam.setAttribute('data-plek', 'voortgangnaam')
    naam.style.left = mm(Math.min(rechts - 2, Math.max(links + 2, xVan(huidige.km))))
    naam.style.top = mm(midden + dikte / 2 + 2.5)
    naam.style.fontSize = mm(stijl['voortgang.naamMm'])
    naam.style.color = stijl['statistieken.getalKleur']
    naam.textContent = huidige.naam
    opschriften.append(naam)
  }

  if (stijl['voortgang.kmAan']) {
    const kmTekst = document.createElement('div')
    kmTekst.className = 'voortgang-km'
    kmTekst.setAttribute('data-plek', 'voortgangkm')
    kmTekst.style.left = mm(rechts)
    kmTekst.style.top = mm(midden - dikte / 2 - 2.5 - stijl['voortgang.naamMm'] * 0.8)
    kmTekst.style.fontSize = mm(stijl['voortgang.naamMm'] * 0.85)
    kmTekst.style.color = stijl['statistieken.labelKleur']
    kmTekst.textContent = `${huidige.km.toFixed(0)} van ${totaalKm.toFixed(0)} km`
    opschriften.append(kmTekst)
  }

  if (stijl['voortgang.dagAan']) {
    const dagTekst = document.createElement('div')
    dagTekst.className = 'voortgang-dag'
    dagTekst.setAttribute('data-plek', 'voortgangdag')
    dagTekst.style.left = mm(links)
    dagTekst.style.top = mm(midden - dikte / 2 - 2.5 - stijl['voortgang.naamMm'] * 0.8)
    dagTekst.style.fontSize = mm(stijl['voortgang.naamMm'] * 0.85)
    dagTekst.style.color = stijl['statistieken.labelKleur']
    dagTekst.textContent = `Dag ${gegevens.dag.dag} · ${gegevens.dag.titel}`
    opschriften.append(dagTekst)
  }
}
