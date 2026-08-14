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

function korteDatum (iso) {
  const maanden = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
    'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const [, maand, dag] = iso.split('-').map(Number)
  return `${dag} ${maanden[maand - 1]}`
}

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

  // ------------------------------------------------------------- titelblok
  const blok = document.createElement('div')
  blok.className = 'titelblok'
  blok.setAttribute('data-plek', 'titelblok')
  blok.style.position = 'absolute'
  blok.style.left = mm(marge)
  blok.style.top = mm(marge)
  blok.style.color = stijl['titelblok.kleur']

  const totaalKm = dagen.reduce((s, d) => s + d.statistieken.afstandKm, 0)
  const totaalUur = dagen.reduce((s, d) => s + d.statistieken.rijtijdUren, 0)
  const totaalKlim = dagen.reduce((s, d) => s + d.statistieken.stijgingM, 0)
  const hoogste = Math.max(...dagen.map(d => d.statistieken.hoogstePuntM ?? 0))

  const boven = document.createElement('div')
  boven.className = 'titel-datum'
  boven.style.fontSize = mm(stijl['typografie.datumMm'])
  boven.textContent = `${korteDatum(dagen[0].datum)} – ${korteDatum(dagen.at(-1).datum)} ` +
    `${dagen.at(-1).datum.slice(0, 4)}`

  const titel = document.createElement('div')
  titel.className = 'titel-hoofd'
  titel.setAttribute('data-tekst', 'reiscijfertitel')
  titel.style.fontSize = mm(stijl['typografie.titelMm'])
  titel.textContent = 'De reis in cijfers'

  blok.append(boven, titel)
  opschriften.append(blok)

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
  const grafiekRechts = maat.breedteMm - marge
  const grafiekBreedte = grafiekRechts - grafiekLinks
  const grafiekOnder = grafiekBoven + grafiekHoogte

  if (punten.length > 1) {
    const maxKm = opgeteld
    const bovenGrens = Math.max(50, hoogste * 1.12)

    const xVan = km => grafiekLinks + (km / maxKm) * grafiekBreedte
    const yVan = m => grafiekOnder - (m / bovenGrens) * grafiekHoogte

    // --- raster
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
    }

    // --- hetzelfde hoogteverloop als op de dagpagina's
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
        id: 'reisverloop',
        gradientUnits: 'userSpaceOnUse',
        x1: 0, y1: yVan(0), x2: 0, y2: yVan(bovenGrens)
      })

      let vorige = -1
      for (const stap of trap) {
        const m = Math.max(stap.m, vorige + 1)
        vorige = m
        verloop.append(maakSvg('stop', {
          offset: `${Math.min(100, (m / bovenGrens) * 100).toFixed(2)}%`,
          'stop-color': stap.kleur
        }))
      }

      defs.append(verloop)
      svg.append(defs)
      vulling = 'url(#reisverloop)'
    }

    const reeks = punten.map(p => `${xVan(p.km).toFixed(2)},${yVan(p.m).toFixed(2)}`)

    svg.append(maakSvg('polygon', {
      points: `${grafiekLinks},${grafiekOnder} ${reeks.join(' ')} ${grafiekRechts},${grafiekOnder}`,
      fill: vulling,
      'fill-opacity': stijl['profiel.verloopAan'] ? stijl['profiel.verloopDekking'] : 1
    }))

    svg.append(maakSvg('polyline', {
      points: reeks.join(' '),
      fill: 'none',
      stroke: stijl['profiel.lijnKleur'],
      'stroke-width': stijl['profiel.lijnDikteMm'] * 0.8,
      'stroke-linejoin': 'round'
    }))

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
  const cijfers = [
    { waarde: dagen.length, eenheid: '', label: 'dagen' },
    { waarde: totaalKm.toFixed(0), eenheid: 'km', label: 'gereden' },
    { waarde: uurNotatie(totaalUur), eenheid: '', label: 'onderweg' },
    { waarde: totaalKlim.toFixed(0), eenheid: 'm', label: 'geklommen' },
    { waarde: hoogste.toFixed(0), eenheid: 'm', label: 'hoogste punt' }
  ]

  const rij = document.createElement('div')
  rij.className = 'cijferrij'
  rij.setAttribute('data-plek', 'reistotalen')
  rij.style.left = mm(marge)
  rij.style.top = mm(grafiekOnder + 14)
  rij.style.width = mm(maat.breedteMm - 2 * marge)
  rij.style.gridTemplateColumns = `repeat(${Math.min(5, cijfers.length)}, 1fr)`
  rij.style.columnGap = mm(5)
  rij.style.rowGap = mm(8)

  for (const c of cijfers) {
    const cel = document.createElement('div')
    cel.className = 'cijfer'

    const groot = document.createElement('div')
    groot.className = 'cijfer-groot'
    groot.style.fontSize = mm(stijl['statistieken.getalMm'] * 0.85)
    groot.style.color = stijl['statistieken.getalKleur']
    groot.textContent = c.waarde
    if (c.eenheid) {
      const e = document.createElement('span')
      e.className = 'cijfer-eenheid'
      e.style.fontSize = mm(stijl['statistieken.getalMm'] * 0.38)
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

  // ---------------------------------------------------------- regel per dag
  const tabel = document.createElement('div')
  tabel.className = 'reistabel'
  tabel.setAttribute('data-plek', 'reistabel')
  tabel.style.left = mm(marge)
  tabel.style.top = mm(grafiekOnder + 14 + stijl['statistieken.getalMm'] + 16)
  tabel.style.width = mm(maat.breedteMm - 2 * marge)
  tabel.style.fontSize = mm(stijl['typografie.tekstMm'] * 0.82)
  tabel.style.color = stijl['statistieken.getalKleur']
  tabel.style.setProperty('--labelkleur-tabel', stijl['statistieken.labelKleur'])

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
      w ? `${w.tempMin?.toFixed(0)}–${w.tempMax?.toFixed(0)}°, ${w.omschrijving ?? ''}` : '–'
    ]
    for (const v of velden) {
      r.append(Object.assign(document.createElement('span'), { textContent: v }))
    }
    tabel.append(r)
  }
  opschriften.append(tabel)

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
