/**
 * De statistiekpagina: hoogteprofiel, kerncijfers en je eigen tekst.
 *
 * Vormkeuzes bewust gemaakt en niet op gevoel:
 *   - het hoogteprofiel is een oppervlaktegrafiek over de afgelegde kilometers,
 *     want de vraag is "hoe liep de dag", niet "hoe hoog was punt X"
 *   - één verticale as, nooit twee: twee assen op één grafiek laat je van alles
 *     lezen wat er niet staat
 *   - kerncijfers zijn grote getallen, geen grafiekjes; een enkel getal is geen
 *     verdeling en verdient geen assenstelsel
 *   - alleen het hoogste punt krijgt een label, niet elk meetpunt
 *   - geen hover of donkere modus: dit gaat naar papier
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

/** Ronde stappen voor de hoogteas. */
function asStap (bereik, streefAantal = 4) {
  const ruw = bereik / streefAantal
  const macht = 10 ** Math.floor(Math.log10(ruw))
  for (const veelvoud of [1, 2, 2.5, 5, 10]) {
    if (ruw <= veelvoud * macht) return veelvoud * macht
  }
  return 10 * macht
}

function uurNotatie (uren) {
  const u = Math.floor(uren)
  const m = Math.round((uren - u) * 60)
  return u > 0 ? `${u}u ${String(m).padStart(2, '0')}` : `${m} min`
}

/** Waar elke stop ligt op de afgelegde afstand, uit de etappelengtes. */
function stopAfstanden (gegevens) {
  const uit = []
  let opgeteld = 0
  const punten = gegevens.dag.waypoints

  uit.push({ km: 0, naam: punten[0]?.name, type: punten[0]?.type })
  for (const [i, leg] of gegevens.route.legs.entries()) {
    opgeteld += leg.distanceKm
    const w = punten[i + 1]
    uit.push({ km: opgeteld, naam: w?.name, type: w?.type })
  }
  return uit
}

export function tekenStatistieken (svg, opschriften, gegevens, stijl) {
  const maat = paginaMaat(stijl)
  const marge = maat.afloopMm + stijl['pagina.veiligeMargeMm']

  svg.setAttribute('viewBox', `0 0 ${maat.breedteMm} ${maat.hoogteMm}`)
  svg.replaceChildren()
  opschriften.replaceChildren()

  // ------------------------------------------------------------- titelblok
  const blok = document.createElement('div')
  blok.className = 'titelblok'
  blok.setAttribute('data-plek', 'titelblok')
  blok.style.position = 'absolute'
  blok.style.left = mm(marge)
  blok.style.top = mm(marge)
  blok.style.color = stijl['titelblok.kleur']

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
  opschriften.append(blok)

  // ---------------------------------------------------------- hoogteprofiel
  const profiel = (gegevens.profiel ?? []).filter(p => p.hoogteM !== null)
  const grafiekBoven = marge + stijl['typografie.titelMm'] + stijl['typografie.datumMm'] + 18
  const grafiekHoogte = stijl['profiel.hoogteMm']
  const grafiekLinks = marge + 12       // ruimte voor de hoogtes langs de as
  const grafiekRechts = maat.breedteMm - marge
  const grafiekBreedte = grafiekRechts - grafiekLinks
  const grafiekOnder = grafiekBoven + grafiekHoogte

  const naamBandMm = 22

  if (profiel.length > 1) {
    const maxKm = profiel.at(-1).afstandKm
    const hoogtes = profiel.map(p => p.hoogteM)
    const hoogste = Math.max(...hoogtes)

    // altijd vanaf zeeniveau: anders lijkt elke dag een bergetappe
    const bovenGrens = Math.max(50, hoogste * 1.12 * stijl['profiel.overdrijving'])

    const xVan = km => grafiekLinks + (km / maxKm) * grafiekBreedte
    const yVan = m => grafiekOnder - (m / bovenGrens) * grafiekHoogte

    // --- raster: terughoudend, alleen horizontaal
    if (stijl['profiel.rasterAan']) {
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
      const eenheid = maakSvg('text', {
        x: grafiekLinks - 2, y: yVan(bovenGrens) - 3,
        'text-anchor': 'end', 'font-size': 2.2, fill: stijl['statistieken.labelKleur']
      })
      eenheid.textContent = 'meter'
      svg.append(eenheid)
    }

    // --- het vlak onder de lijn
    //
    // Met het hoogteverloop aan volgt de kleur de hoogte: een staand verloop
    // waarvan de stops op de echte hoogtes liggen. Zo blijft het dal rustig en
    // springt een klim er meteen uit.
    //
    // De tinten zijn zo gekozen dat de helderheid bij elke stap daalt. Een
    // gewone regenboog heeft in het midden juist het lichtste punt, en dan leest
    // het verloop niet als "hoger" - zeker niet in grijstinten of voor wie
    // kleuren slecht onderscheidt.
    const punten = profiel.map(p => `${xVan(p.afstandKm).toFixed(2)},${yVan(p.hoogteM).toFixed(2)}`)

    let vulling = stijl['profiel.vulKleur']

    if (stijl['profiel.verloopAan']) {
      const trap = [
        { m: 0, kleur: stijl['profiel.dal'] },
        { m: stijl['profiel.laagM'], kleur: stijl['profiel.laag'] },
        { m: stijl['profiel.middenM'], kleur: stijl['profiel.midden'] },
        { m: stijl['profiel.hoogM'], kleur: stijl['profiel.hoog'] },
        { m: stijl['profiel.piekM'], kleur: stijl['profiel.piek'] }
      ]

      const defs = maakSvg('defs')
      const verloop = maakSvg('linearGradient', {
        id: 'hoogteverloop',
        gradientUnits: 'userSpaceOnUse',
        x1: 0, y1: yVan(0), x2: 0, y2: yVan(bovenGrens)
      })

      let vorige = -1
      for (const stap of trap) {
        // stops moeten oplopen, ook als je de schuifjes door elkaar zet
        const m = Math.max(stap.m, vorige + 1)
        vorige = m
        verloop.append(maakSvg('stop', {
          offset: `${Math.min(100, (m / bovenGrens) * 100).toFixed(2)}%`,
          'stop-color': stap.kleur
        }))
      }

      defs.append(verloop)
      svg.append(defs)
      vulling = 'url(#hoogteverloop)'
    }

    svg.append(maakSvg('polygon', {
      points: `${grafiekLinks},${grafiekOnder} ${punten.join(' ')} ${grafiekRechts},${grafiekOnder}`,
      fill: vulling,
      'fill-opacity': stijl['profiel.verloopAan'] ? stijl['profiel.verloopDekking'] : 1
    }))

    // --- de lijn zelf
    svg.append(maakSvg('polyline', {
      points: punten.join(' '),
      fill: 'none',
      stroke: stijl['profiel.lijnKleur'],
      'stroke-width': stijl['profiel.lijnDikteMm'],
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round'
    }))

    // --- stops als merktekens langs de onderkant
    //
    // De namen staan rechtop in een eigen band onder de grafiek. Namen die te
    // dicht op elkaar zouden vallen krijgen alleen een streepje: twee namen over
    // elkaar heen is onleesbaarder dan een naam missen, en welke stop het was
    // staat toch op de kaartpagina.
    if (stijl['profiel.stopsAan']) {
      let vorigeNaamX = -Infinity

      for (const stop of stopAfstanden(gegevens)) {
        if (stop.type === 'via') continue
        const x = xVan(stop.km)

        svg.append(maakSvg('line', {
          x1: x, x2: x, y1: grafiekOnder, y2: grafiekOnder + 1.8,
          stroke: stijl['route.kleur'], 'stroke-width': 0.3
        }))

        if (!stop.naam) continue
        if (x - vorigeNaamX < 3.2) continue
        vorigeNaamX = x

        const naam = document.createElement('div')
        naam.className = 'profiel-stop'
        naam.setAttribute('data-plek', `profielstop:${stop.naam}`)
        naam.style.left = mm(x)
        naam.style.top = mm(grafiekOnder + 2.6)
        naam.style.maxHeight = mm(naamBandMm)
        naam.style.fontSize = mm(2.3)
        naam.style.color = stijl['statistieken.labelKleur']
        naam.textContent = stop.naam
        opschriften.append(naam)
      }
    }

    // --- alleen het hoogste punt krijgt een label
    if (stijl['profiel.topLabelAan']) {
      const i = hoogtes.indexOf(hoogste)
      const x = xVan(profiel[i].afstandKm)
      const y = yVan(hoogste)

      svg.append(maakSvg('circle', {
        cx: x, cy: y, r: 0.8,
        fill: stijl['route.kleur'], stroke: '#ffffff', 'stroke-width': 0.3
      }))

      const label = document.createElement('div')
      label.className = 'profiel-top'
      label.style.left = mm(x)
      label.style.top = mm(y - 6)
      label.style.fontSize = mm(2.8)
      label.style.color = stijl['statistieken.getalKleur']
      label.textContent = `${hoogste.toFixed(0)} m`
      opschriften.append(label)
    }

    // --- kilometerschaal, onder de namenband door zodat er niets overlapt
    const kmY = grafiekOnder + naamBandMm + 4
    svg.append(maakSvg('line', {
      x1: grafiekLinks, x2: grafiekRechts, y1: kmY - 2.6, y2: kmY - 2.6,
      stroke: '#e0dcd5', 'stroke-width': 0.15
    }))

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

    const kmStap = asStap(maxKm, 5)
    for (let km = 0; km <= maxKm; km += kmStap) {
      svg.append(maakSvg('line', {
        x1: xVan(km), x2: xVan(km), y1: kmY - 2.6, y2: kmY - 1.4,
        stroke: '#cfc9c0', 'stroke-width': 0.15
      }))
      const t = maakSvg('text', {
        x: xVan(km), y: kmY,
        'text-anchor': 'middle', 'font-size': 2.4, fill: stijl['statistieken.labelKleur']
      })
      t.textContent = km === 0 ? '0 km' : `${km}`
      svg.append(t)
    }
  }

  // ------------------------------------------------------------ kerncijfers
  const s = gegevens.statistieken
  const w = gegevens.weer

  const cijfers = [
    { waarde: s.afstandKm.toFixed(0), eenheid: 'km', label: 'gereden' },
    { waarde: uurNotatie(s.rijtijdUren), eenheid: '', label: 'onderweg' },
    { waarde: s.hoogstePuntM?.toFixed(0) ?? '–', eenheid: 'm', label: 'hoogste punt' },
    { waarde: s.stijgingM.toFixed(0), eenheid: 'm', label: 'geklommen' }
  ]
  if (w) {
    cijfers.push({
      waarde: `${w.tempMin?.toFixed(0)}–${w.tempMax?.toFixed(0)}`,
      eenheid: '°C',
      label: w.omschrijving ?? 'weer'
    })
  }

  const rij = document.createElement('div')
  rij.className = 'cijferrij'
  rij.setAttribute('data-plek', 'cijferrij')
  rij.style.left = mm(marge)
  rij.style.top = mm(grafiekOnder + naamBandMm + 16)
  rij.style.width = mm(maat.breedteMm - 2 * marge)
  rij.style.gridTemplateColumns = `repeat(${stijl['statistieken.kolommen']}, 1fr)`
  rij.style.columnGap = mm(6)
  rij.style.rowGap = mm(9)

  for (const c of cijfers) {
    const cel = document.createElement('div')
    cel.className = 'cijfer'
    if (stijl['statistieken.lijntjes']) cel.classList.add('metlijn')

    const groot = document.createElement('div')
    groot.className = 'cijfer-groot'
    groot.style.fontSize = mm(stijl['statistieken.getalMm'])
    groot.style.color = stijl['statistieken.getalKleur']
    groot.textContent = c.waarde
    if (c.eenheid) {
      const e = document.createElement('span')
      e.className = 'cijfer-eenheid'
      e.style.fontSize = mm(stijl['statistieken.getalMm'] * 0.45)
      e.textContent = c.eenheid
      groot.append(e)
    }

    const klein = document.createElement('div')
    klein.className = 'cijfer-label'
    klein.style.fontSize = mm(stijl['statistieken.labelMm'])
    klein.style.color = stijl['statistieken.labelKleur']
    klein.textContent = c.label

    cel.append(groot, klein)
    rij.append(cel)
  }
  opschriften.append(rij)

  // ------------------------------------------------------------- eigen tekst
  if (gegevens.dag.tekst) {
    const tekst = document.createElement('div')
    tekst.className = 'dagtekst'
    tekst.setAttribute('data-plek', 'dagtekst')
    tekst.setAttribute('data-tekst', 'tekst')
    tekst.style.left = mm(marge)
    tekst.style.top = mm(grafiekOnder + naamBandMm + 16 + 34)
    tekst.style.width = mm(Math.min(180, maat.breedteMm - 2 * marge))
    tekst.style.fontSize = mm(stijl['typografie.tekstMm'])
    tekst.style.lineHeight = String(stijl['typografie.regelafstand'])
    tekst.style.color = stijl['titelblok.kleur']
    tekst.textContent = gegevens.dag.tekst
    opschriften.append(tekst)
  }

  // ---------------------------------------------------------- bronvermelding
  if (stijl['bron.aan']) {
    const bron = document.createElement('div')
    bron.style.position = 'absolute'
    bron.style.right = mm(marge)
    bron.style.bottom = mm(maat.afloopMm + 1.5)
    bron.style.fontSize = mm(stijl['bron.grootteMm'])
    bron.style.color = stijl['bron.kleur']
    bron.textContent = 'Hoogtegegevens: Terrain Tiles · Weer: Open-Meteo · Route: OSRM/OpenStreetMap'
    opschriften.append(bron)
  }
}

function leesbareDatum (iso) {
  const maanden = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december']
  const [jaar, maand, dag] = iso.split('-').map(Number)
  return `${dag} ${maanden[maand - 1]} ${jaar}`
}
