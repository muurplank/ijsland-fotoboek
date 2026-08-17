/**
 * De cijferpagina van de hele reis.
 *
 * Eén hoogteprofiel over alle dagen achter elkaar, met de dagovergangen erin,
 * daaronder de totalen en een regel per dag.
 *
 * Waarom één doorlopend profiel en geen acht grafiekjes naast elkaar: de vraag
 * is hoe de reis als geheel liep. Acht losse assen met elk hun eigen schaal
 * maken een heuvel van 400 meter even hoog als een pas van 1000, en dan lees je
 * precies verkeerd wat je wilde weten.
 *
 * Wat deze pagina deelt met de dagpagina staat in statsdelen.js.
 */

import { paginaMaat } from '../render/layout.js'
import { bouwSvg, profielVorm, VORM_INFO } from '../render/profielvorm.js'
import {
  maakSvg, mm, asStap, korteDatum, uurNotatie, weerTeken,
  reisCijfers, tekenAchtergrond, tekenBron, tekenCijferrij, tekenTitelblok
} from './statsdelen.js'

/**
 * @param {SVGElement} svg
 * @param {HTMLElement} opschriften
 * @param {Array} dagen alle dagen met statistieken en profiel
 * @param {object} stijl
 */
export function tekenReisCijfers (svg, opschriften, dagen, stijl) {
  const maat = paginaMaat(stijl)
  const marge = maat.afloopMm + stijl['pagina.veiligeMargeMm']

  svg.setAttribute('viewBox', `0 0 ${maat.breedteMm} ${maat.hoogteMm}`)
  svg.replaceChildren()
  opschriften.replaceChildren()

  const { hoogste, cijfers } = reisCijfers(dagen)

  tekenAchtergrond(svg, stijl, maat, { zaad: dagen.length, id: 'reis' })

  // ------------------------------------------------------------- titelblok
  tekenTitelblok(opschriften, stijl, {
    marge,
    boven: `${korteDatum(dagen[0].datum)} – ${korteDatum(dagen.at(-1).datum)} ` +
      `${dagen.at(-1).datum.slice(0, 4)}`,
    titel: 'De reis in cijfers',
    tekstSleutel: 'reiscijfertitel'
  })

  // -------------------------------------------- profiel over de hele reis
  const punten = []
  const dagGrenzen = []
  let opgeteld = 0

  for (const dag of dagen) {
    dagGrenzen.push({ km: opgeteld, dag: dag.dag })
    for (const p of dag.profiel) {
      if (p.hoogteM === null) continue
      punten.push({ km: opgeteld + p.afstandKm, m: p.hoogteM })
    }
    opgeteld += dag.statistieken.afstandKm
  }

  const grafiekBoven = marge + stijl['typografie.titelMm'] + stijl['typografie.datumMm'] + 18
  const grafiekHoogte = stijl['profiel.hoogteMm'] * 0.85
  const grafiekLinks = marge + 12
  // de grafiek mag smaller dan de pagina; hij blijft links uitgelijnd, want
  // hij hoort onder de titel te beginnen en niet ergens in het midden te zweven
  const grafiekRechts = grafiekLinks +
    (maat.breedteMm - marge - grafiekLinks) * stijl['profiel.reisBreedte']
  const grafiekBreedte = grafiekRechts - grafiekLinks
  const grafiekOnder = grafiekBoven + grafiekHoogte

  if (punten.length > 1) {
    const maxKm = opgeteld
    const bovenGrens = Math.max(50, hoogste * 1.12)

    const xVan = km => grafiekLinks + (km / maxKm) * grafiekBreedte
    const yVan = m => grafiekOnder - (m / bovenGrens) * grafiekHoogte

    const vorm = stijl['profiel.vorm']
    const hoogteAs = VORM_INFO[vorm]?.hoogteAs ?? true

    // --- raster; weg bij een vorm die zijn eigen schaal gebruikt
    if (stijl['profiel.rasterAan'] && hoogteAs) {
      const stap = asStap(bovenGrens, Math.round(stijl['profiel.rasterFijnheid'] * 0.6))
      for (let h = 0; h <= bovenGrens; h += stap) {
        svg.append(maakSvg('line', {
          x1: grafiekLinks, x2: grafiekRechts, y1: yVan(h), y2: yVan(h),
          stroke: '#e0dcd5', 'stroke-width': h === 0 ? 0.25 : 0.12
        }))
        const t = maakSvg('text', {
          x: grafiekLinks - 2, y: yVan(h) + 0.9,
          'text-anchor': 'end', 'font-size': 2.4, fill: stijl['statistieken.labelKleur']
        })
        t.textContent = `${h}`
        svg.append(t)
      }
    }

    // --- dezelfde vorm en hetzelfde hoogteverloop als op de dagpagina's
    for (const knoop of profielVorm(vorm, {
      punten,
      xVan,
      yVan,
      links: grafiekLinks,
      rechts: grafiekRechts,
      boven: grafiekBoven,
      onder: grafiekOnder,
      bovenGrens,
      stijl,
      // over tweeduizend kilometer wordt een lijn van de dagdikte een muur
      lijnMm: stijl['profiel.lijnDikteMm'] * 0.8,
      id: 'reisprofiel'
    })) {
      svg.append(bouwSvg(knoop))
    }

    // --- de dagovergangen, met het dagnummer erboven
    //
    // Deze lijnen staan bewust duidelijker dan het raster: het raster is er om
    // waarden af te lezen, deze om de reis in dagen te verdelen. Twee soorten
    // hulplijnen met dezelfde zwaarte zouden allebei aan kracht verliezen.
    if (stijl['profiel.dagLijnenAan']) {
      for (const grens of dagGrenzen) {
        if (grens.km === 0) continue
        const x = xVan(grens.km)
        svg.append(maakSvg('line', {
          x1: x, x2: x, y1: grafiekBoven - 3.5, y2: grafiekOnder + 1.5,
          stroke: stijl['profiel.dagLijnKleur'],
          'stroke-width': stijl['profiel.dagLijnMm'],
          'stroke-dasharray': `${stijl['profiel.dagStreepMm']} ${stijl['profiel.dagStreepMm'] * 0.8}`,
          'stroke-linecap': 'round'
        }))
      }
    }

    for (const [i, grens] of dagGrenzen.entries()) {
      const volgende = dagGrenzen[i + 1]?.km ?? maxKm
      const midden = xVan((grens.km + volgende) / 2)

      const nr = document.createElement('div')
      nr.className = 'reisdag-nummer'
      nr.style.left = mm(midden)
      nr.style.top = mm(grafiekBoven - 5.5)
      nr.style.fontSize = mm(2.5)
      nr.style.color = stijl['statistieken.labelKleur']
      nr.textContent = String(grens.dag)
      opschriften.append(nr)
    }

    // --- kilometerschaal
    // verticale rasterlijnen op dezelfde plek als de kilometerschaal
    if (stijl['profiel.rasterAan'] && stijl['profiel.rasterVerticaal']) {
      const stap = asStap(maxKm, stijl['profiel.rasterFijnheid'])
      for (let km = stap; km < maxKm; km += stap) {
        svg.append(maakSvg('line', {
          x1: xVan(km), x2: xVan(km), y1: grafiekBoven, y2: grafiekOnder,
          stroke: '#e0dcd5', 'stroke-width': 0.1
        }))
      }
    }

    const kmStap = asStap(maxKm, 6)
    for (let km = 0; km <= maxKm; km += kmStap) {
      const t = maakSvg('text', {
        x: xVan(km), y: grafiekOnder + 4.5,
        'text-anchor': 'middle', 'font-size': 2.4, fill: stijl['statistieken.labelKleur']
      })
      t.textContent = km === 0 ? '0 km' : `${km}`
      svg.append(t)
    }
  }

  // ------------------------------------------------------------- totalen
  tekenCijferrij(opschriften, cijfers, stijl, {
    plek: 'reistotalen',
    links: marge,
    boven: grafiekOnder + 14,
    breedte: maat.breedteMm - 2 * marge,
    kolommen: Math.min(5, cijfers.length),
    getalDeel: 0.85,
    eenheidDeel: 0.38
  })

  // ---------------------------------------------------------- regel per dag
  const tabel = document.createElement('div')
  tabel.className = 'reistabel'
  tabel.setAttribute('data-plek', 'reistabel')
  tabel.setAttribute('data-schaalbaar', 'css')
  tabel.setAttribute('data-midden', '')
  tabel.setAttribute('data-knoppen', 'statistieken')
  tabel.style.left = mm(marge)
  tabel.style.top = mm(grafiekOnder + 14 + stijl['statistieken.getalMm'] + 16)
  tabel.style.width = mm((maat.breedteMm - 2 * marge) * stijl['statistieken.tabelBreedte'])
  tabel.style.fontSize = mm(stijl['typografie.tekstMm'] * 0.82)
  tabel.style.color = stijl['statistieken.getalKleur']
  tabel.style.setProperty('--labelkleur-tabel', stijl['statistieken.labelKleur'])

  // De kolommen in de volgorde waarin ze staan. De titel is de enige die
  // meegeeft: die krijgt wat er overblijft, zodat de getallenkolommen op hun
  // ingestelde maat blijven staan en niet gaan schuiven bij een lange dagtitel.
  tabel.style.setProperty('--tabelkolommen', [
    `${stijl['statistieken.kolomDagEm']}em`,
    `${stijl['statistieken.kolomDatumEm']}em`,
    'minmax(0, 1fr)',
    `${stijl['statistieken.kolomKmEm']}em`,
    `${stijl['statistieken.kolomTijdEm']}em`,
    `${stijl['statistieken.kolomKlimEm']}em`,
    `${stijl['statistieken.kolomWeerEm']}em`
  ].join(' '))

  const kop = document.createElement('div')
  kop.className = 'reistabel-rij reistabel-kop'
  for (const t of ['', 'Datum', '', 'Km', 'Tijd', 'Klim', 'Weer']) {
    kop.append(Object.assign(document.createElement('span'), { textContent: t }))
  }
  tabel.append(kop)

  for (const d of dagen) {
    const r = document.createElement('div')
    r.className = 'reistabel-rij'
    const s = d.statistieken
    const w = d.weer

    const velden = [
      `${d.dag}`,
      korteDatum(d.datum),
      d.titel,
      `${s.afstandKm.toFixed(0)} km`,
      uurNotatie(s.rijtijdUren),
      `${s.stijgingM.toFixed(0)} m`,
      w ? `${weerTeken(w.code)}  ${w.tempMin?.toFixed(0)}–${w.tempMax?.toFixed(0)}°` : '–'
    ]
    for (const v of velden) {
      r.append(Object.assign(document.createElement('span'), { textContent: v }))
    }
    tabel.append(r)
  }
  opschriften.append(tabel)

  tekenBron(opschriften, stijl, maat, marge)
}
