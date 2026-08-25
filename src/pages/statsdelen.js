/**
 * Wat de cijferpagina's delen.
 *
 * De dagpagina en de reiscijferpagina hadden allebei hun eigen maakSvg, hun
 * eigen asStap, hun eigen titelblok en hun eigen cijferrij - regel voor regel
 * hetzelfde, en dus twee plekken om dezelfde verandering te vergeten. Wat per
 * pagina echt verschilt blijft in de pagina zelf.
 *
 * De achtergrond hoorde ook bij de dagpagina alleen, terwijl het paneel de
 * groep "statistieken" al bij de reiscijferpagina liet zien. Die knoppen deden
 * daar dus niets; nu wel.
 */

import { bouwDraadmodel, kiesModel, MODEL_INFO } from '../render/draadmodellen.js'
import { draadmodelKnopen } from '../render/isometrie.js'
import { papierKnopen, zaadje } from '../render/papier.js'
import { bouwSvg } from '../render/profielvorm.js'
import { zetGlas } from './furniture.js'

const SVG = 'http://www.w3.org/2000/svg'

export const maakSvg = (tag, eigenschappen = {}) => {
  const n = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(eigenschappen)) {
    if (v !== null && v !== undefined) n.setAttribute(k, String(v))
  }
  return n
}

/** De maat op de pagina, in millimeters, voor de HTML-laag. */
export const mm = waarde => `calc(${waarde} * var(--mm))`

/** Ronde stappen voor een as: 1, 2, 2,5, 5 of 10 maal een macht van tien. */
export function asStap (bereik, streefAantal = 4) {
  const ruw = bereik / streefAantal
  const macht = 10 ** Math.floor(Math.log10(ruw))
  for (const veelvoud of [1, 2, 2.5, 5, 10]) {
    if (ruw <= veelvoud * macht) return veelvoud * macht
  }
  return 10 * macht
}

export function uurNotatie (uren) {
  const u = Math.floor(uren)
  const m = Math.round((uren - u) * 60)
  return u > 0 ? `${u}u ${String(m).padStart(2, '0')}` : `${m} min`
}

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december']

export function leesbareDatum (iso) {
  const [jaar, maand, dag] = iso.split('-').map(Number)
  return `${dag} ${MAANDEN[maand - 1]} ${jaar}`
}

export function korteDatum (iso) {
  const [, maand, dag] = iso.split('-').map(Number)
  return `${dag} ${MAANDEN[maand - 1].slice(0, 3)}`
}

/**
 * Het weertekentje bij de code die het weerarchief teruggeeft.
 *
 * De codes komen uit de WMO-tabel en lopen in groepen: 0-3 is bewolking, 45-48
 * mist, 51-57 motregen, 61-67 regen, 71-77 sneeuw, 80-86 buien, 95+ onweer.
 * Daarom op groep afgehandeld en niet per los nummer - dan valt er nooit een
 * code buiten de boot en staat er hooguit een tekentje dat iets te algemeen is.
 */
export function weerTeken (code) {
  if (code === null || code === undefined) return '·'
  if (code <= 0) return '☀️'
  if (code === 1) return '🌤️'
  if (code === 2) return '⛅'
  if (code === 3) return '☁️'
  if (code < 50) return '🌫️'          // mist
  if (code < 60) return '🌦️'          // motregen
  if (code < 70) return '🌧️'          // regen
  if (code < 80) return '❄️'          // sneeuw
  if (code < 86) return '🌧️'          // buien
  if (code < 90) return '🌨️'          // sneeuwbuien
  return '⛈️'                          // onweer
}

/** Waar elke stop ligt op de afgelegde afstand, uit de etappelengtes. */
export function stopAfstanden (gegevens) {
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

/**
 * De kerncijfers van één dag.
 *
 * Geen weer erbij: het temperatuurbereik en de weertekens staan uur voor uur in
 * de grafiek, op de plek waar ze bij een tijdstip horen in plaats van
 * platgeslagen tot één getal per dag.
 */
export function dagCijfers (gegevens) {
  const s = gegevens.statistieken

  return [
    { waarde: s.afstandKm.toFixed(0), eenheid: 'km', label: 'gereden' },
    { waarde: uurNotatie(s.rijtijdUren), eenheid: '', label: 'onderweg' },
    { waarde: s.hoogstePuntM?.toFixed(0) ?? '–', eenheid: 'm', label: 'hoogste punt' },
    { waarde: s.stijgingM.toFixed(0), eenheid: 'm', label: 'geklommen' }
  ]
}

/** De totalen van de hele reis. */
export function reisCijfers (dagen) {
  const totaalKm = dagen.reduce((s, d) => s + d.statistieken.afstandKm, 0)
  const totaalUur = dagen.reduce((s, d) => s + d.statistieken.rijtijdUren, 0)
  const totaalKlim = dagen.reduce((s, d) => s + d.statistieken.stijgingM, 0)
  const hoogste = Math.max(...dagen.map(d => d.statistieken.hoogstePuntM ?? 0))

  return {
    hoogste,
    cijfers: [
      { waarde: dagen.length, eenheid: '', label: 'dagen' },
      { waarde: totaalKm.toFixed(0), eenheid: 'km', label: 'gereden' },
      { waarde: uurNotatie(totaalUur), eenheid: '', label: 'onderweg' },
      { waarde: totaalKlim.toFixed(0), eenheid: 'm', label: 'geklommen' },
      { waarde: hoogste.toFixed(0), eenheid: 'm', label: 'hoogste punt' }
    ]
  }
}

/** Het titelblok linksboven, met het glasplaatje erachter. */
export function tekenTitelblok (opschriften, stijl, { marge, boven, titel, tekstSleutel }) {
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
  zetGlas(blok, stijl)

  const regel = document.createElement('div')
  regel.className = 'titel-datum'
  regel.style.fontSize = mm(stijl['typografie.datumMm'])
  regel.textContent = boven

  const kop = document.createElement('div')
  kop.className = 'titel-hoofd'
  kop.setAttribute('data-tekst', tekstSleutel)
  kop.style.fontSize = mm(stijl['typografie.titelMm'])
  kop.textContent = titel

  blok.append(regel, kop)
  opschriften.append(blok)
  return blok
}

/** De rij grote getallen met hun labels eronder. */
export function tekenCijferrij (opschriften, cijfers, stijl, opties) {
  const {
    plek, links, boven, breedte, kolommen,
    getalDeel = 1, eenheidDeel = 0.45, lijntjes = false
  } = opties

  const rij = document.createElement('div')
  rij.className = 'cijferrij'
  rij.setAttribute('data-plek', plek)
  rij.setAttribute('data-schaalbaar', 'css')
  rij.setAttribute('data-midden', '')
  rij.setAttribute('data-knoppen', 'statistieken')
  rij.style.left = mm(links)
  rij.style.top = mm(boven)
  rij.style.width = mm(breedte)
  rij.style.gridTemplateColumns = `repeat(${kolommen}, 1fr)`
  rij.style.columnGap = mm(6)
  rij.style.rowGap = mm(9)

  for (const c of cijfers) {
    const cel = document.createElement('div')
    cel.className = 'cijfer'
    if (lijntjes) cel.classList.add('metlijn')

    const groot = document.createElement('div')
    groot.className = 'cijfer-groot'
    groot.style.fontSize = mm(stijl['statistieken.getalMm'] * getalDeel)
    groot.style.color = stijl['statistieken.getalKleur']
    groot.textContent = c.waarde
    if (c.eenheid) {
      const e = document.createElement('span')
      e.className = 'cijfer-eenheid'
      e.style.fontSize = mm(stijl['statistieken.getalMm'] * eenheidDeel)
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
  return rij
}

/** ---------------------------------------------------- de veldnotitie */

/**
 * Eén getypte regel, letter voor letter iets uit het lood.
 *
 * Een typemachine slaat niet elke letter even hard of even recht aan, en juist
 * dat verschil maakt het verschil tussen een getypte regel en een gezette regel.
 * Dus krijgt elke letter zijn eigen spanje met een minieme verschuiving en
 * draaiing - gezaaid, zodat dezelfde dag altijd dezelfde onvolkomenheden heeft
 * en de export niet afwijkt van wat je op het scherm zag.
 *
 * Spaties blijven met rust: een span om een spatie heen laat de regel afbreken
 * op plekken waar dat niet hoort.
 */
export function typRegel (tekst, { jitter, rnd }) {
  const regel = document.createElement('div')
  regel.className = 'veldnotitie-regel'

  if (jitter <= 0) {
    regel.textContent = tekst
    return regel
  }

  for (const teken of tekst) {
    if (teken === ' ') {
      regel.append(' ')
      continue
    }
    const letter = document.createElement('span')
    letter.textContent = teken
    // klein houden: 0,22 mm en 1,4 graden is op leesafstand precies genoeg om
    // "met de hand" te lezen, en groter wordt het een grapje
    const dy = (rnd() - 0.5) * jitter * 0.22
    const hoek = (rnd() - 0.5) * jitter * 1.4
    letter.style.display = 'inline-block'
    letter.style.transform = `translateY(calc(${dy.toFixed(3)} * var(--mm))) rotate(${hoek.toFixed(2)}deg)`
    regel.append(letter)
  }
  return regel
}

/**
 * Het onderschrift onder een stempel: plaatsnaam, nummer en jaar, trefwoorden.
 *
 * Wat er staat komt uit data/hero/dag-NN.json. Lege regels vallen weg, zodat een
 * dag waarvan de trefwoorden nog niet ingevuld zijn gewoon een regel minder
 * heeft in plaats van een lege plek of een streepje naar niets.
 */
export function tekenVeldnotitie (ouder, { plaats, nummer, jaar, trefwoorden }, stijl, zaad = 1) {
  if (!stijl['veldnotitie.aan']) return null

  const woorden = (trefwoorden ?? []).filter(w => w && w.trim())

  // Vier regels onder elkaar, elk met zijn eigen kast. Niet samengevoegd tot
  // "No. 03 · 2026": het jaartal is een eigen gegeven en hoort op zijn eigen
  // regel, net als in een echt notitieboek waar je het er later bij zet.
  //
  // De trefwoorden staan bewust in kleine letters. Alles in kapitalen maakt van
  // een aantekening een opschrift, en juist het verschil tussen de plaatsnaam in
  // kapitalen en de woorden eronder in onderkast laat het als notitie lezen.
  const regels = [
    { tekst: plaats, sterk: true, kast: stijl['veldnotitie.hoofdletters'] ? 'uppercase' : 'none' },
    { tekst: nummer, sterk: false, kast: 'none' },
    { tekst: woorden.join(stijl['veldnotitie.trefwoordScheiding']), sterk: false, kast: 'lowercase' },
    { tekst: jaar, sterk: false, kast: 'none' }
  ].filter(r => r.tekst)

  if (!regels.length) return null

  const blok = document.createElement('div')
  blok.className = 'veldnotitie'
  blok.style.fontSize = mm(stijl['veldnotitie.grootteMm'])
  blok.style.lineHeight = String(stijl['veldnotitie.regelafstand'])
  blok.style.letterSpacing = `${stijl['veldnotitie.letterafstand']}em`

  const rnd = zaadje(zaad * 97 + 13)
  const jitter = stijl['veldnotitie.jitter']

  for (const regel of regels) {
    const el = typRegel(regel.tekst, { jitter, rnd })
    el.style.color = regel.sterk ? stijl['veldnotitie.kleur'] : stijl['veldnotitie.zwakKleur']
    el.style.textTransform = regel.kast
    blok.append(el)
  }

  ouder.append(blok)
  return blok
}

export function tekenBron (opschriften, stijl, maat, marge) {
  if (!stijl['bron.aan']) return null

  const bron = document.createElement('div')
  bron.className = 'bronvermelding'
  bron.style.position = 'absolute'
  bron.style.right = mm(marge)
  bron.style.bottom = mm(maat.afloopMm + 1.5)
  bron.style.fontSize = mm(stijl['bron.grootteMm'])
  bron.style.color = stijl['bron.kleur']
  bron.textContent = 'Hoogtegegevens: Terrain Tiles · Weer: Open-Meteo · Route: OSRM/OpenStreetMap'
  opschriften.append(bron)
  return bron
}

/**
 * De achtergrond van een cijferpagina.
 *
 * Een pagina met cijfers en één grafiek is snel kaal, maar een achtergrond mag
 * de cijfers niet in de weg zitten. Vandaar dat elke keuze hier iets is dat je
 * pas ziet als je ernaar kijkt: een verloop, het silhouet van je eigen
 * hoogteprofiel, of ruitjespapier. Wie het strak wil houdt 'geen'.
 *
 * Wordt als eerste getekend, dus alles komt er vanzelf overheen.
 *
 * @param {SVGElement} svg
 * @param {object} stijl
 * @param {object} maat uit paginaMaat()
 * @param {object} opties
 * @param {Array} [opties.profiel] meetpunten voor het hoogtesilhouet
 * @param {number} [opties.zaad] dagnummer, voor de keuze van het draadmodel
 * @param {string} [opties.id] voorvoegsel voor de defs, uniek per pagina
 */
export function tekenAchtergrond (svg, stijl, maat, opties = {}) {
  const soort = stijl['statistieken.achtergrond']
  if (soort === 'geen' || soort === 'kaart') return   // 'kaart' regelt de pagina zelf

  const { profiel = [], zaad = 1, id = 'stats' } = opties
  const kleur = stijl['statistieken.achtergrondKleur']
  const kleur2 = stijl['statistieken.achtergrondKleur2']
  const dekking = stijl['statistieken.achtergrondDekking']

  if (soort === 'papier') {
    // Het vel waar de hele veldnotitie-stijl op ligt. Gaat als eerste op de
    // pagina, dus alles komt er vanzelf overheen te staan.
    for (const knoop of papierKnopen({
      breedteMm: maat.breedteMm, hoogteMm: maat.hoogteMm, stijl, zaad, id
    })) {
      svg.append(bouwSvg(knoop))
    }
    return
  }

  if (soort === 'draadmodel') {
    // Een doorzichtig isometrisch draadmodel van het onderwerp van deze dag,
    // paginavullend en zo bleek dat de cijfers er zonder moeite overheen te
    // lezen zijn.
    //
    // Waarom doorzichtig en niet met de verborgen lijnen eruit: dat vraagt om
    // vlakken, een dieptesortering en een hoop uitzonderingen, terwijl juist
    // die doorkijk er een tekening van maakt in plaats van een plaatje. Dat de
    // achterkant niet met de voorkant vervloeit regelt de dieptevervaging.
    const naam = kiesModel(stijl['statistieken.draadmodel'], zaad)
    const model = bouwDraadmodel(naam, {
      dichtheid: stijl['statistieken.draadmodelDichtheid']
    })

    const groep = maakSvg('g')
    for (const knoop of draadmodelKnopen(model, { info: MODEL_INFO[naam], maat, stijl })) {
      groep.append(bouwSvg(knoop))
    }
    svg.append(groep)
    return
  }

  if (soort === 'verloop') {
    const richting = {
      verticaal: { x1: 0, y1: 0, x2: 0, y2: 1 },
      horizontaal: { x1: 0, y1: 0, x2: 1, y2: 0 },
      diagonaal: { x1: 0, y1: 0, x2: 1, y2: 1 }
    }[stijl['statistieken.achtergrondRichting']] ?? { x1: 0, y1: 0, x2: 0, y2: 1 }

    const defs = maakSvg('defs')
    const verloop = maakSvg('linearGradient', { id: `${id}-verloop`, ...richting })
    verloop.append(maakSvg('stop', { offset: '0', 'stop-color': kleur, 'stop-opacity': dekking }))
    verloop.append(maakSvg('stop', { offset: '1', 'stop-color': kleur2, 'stop-opacity': dekking }))
    defs.append(verloop)
    svg.append(defs)

    svg.append(maakSvg('rect', {
      x: 0, y: 0, width: maat.breedteMm, height: maat.hoogteMm, fill: `url(#${id}-verloop)`
    }))
    return
  }

  if (soort === 'raster') {
    // ruitjespapier: fijne lijnen met om de vijf een iets steviger lijn, zoals
    // millimeterpapier. Rustig genoeg om cijfers overheen te zetten.
    const stap = stijl['statistieken.rasterStapMm']
    const groep = maakSvg('g', { opacity: dekking })

    for (let x = 0, n = 0; x <= maat.breedteMm; x += stap, n++) {
      groep.append(maakSvg('line', {
        x1: x, y1: 0, x2: x, y2: maat.hoogteMm,
        stroke: kleur, 'stroke-width': n % 5 === 0 ? 0.28 : 0.12
      }))
    }
    for (let y = 0, n = 0; y <= maat.hoogteMm; y += stap, n++) {
      groep.append(maakSvg('line', {
        x1: 0, y1: y, x2: maat.breedteMm, y2: y,
        stroke: kleur, 'stroke-width': n % 5 === 0 ? 0.28 : 0.12
      }))
    }
    svg.append(groep)
    return
  }

  if (soort === 'hoogtesilhouet') {
    // Het hoogteprofiel van deze dag, paginabreed en bleek, als een berglijn
    // onderaan de bladzijde. Geen versiering van elders: het is dezelfde dag,
    // alleen groot en zacht.
    const punten0 = profiel.filter(p => p.hoogteM !== null)
    if (punten0.length < 2) return

    const maxKm = punten0.at(-1).afstandKm
    const hoogste = Math.max(...punten0.map(p => p.hoogteM), 1)
    const hoogte = maat.hoogteMm * stijl['statistieken.silhouetHoogte']
    const onder = maat.hoogteMm

    const punten = punten0.map(p => ({
      x: (p.afstandKm / maxKm) * maat.breedteMm,
      y: onder - (p.hoogteM / hoogste) * hoogte
    }))

    const lijn = punten
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')

    svg.append(maakSvg('path', {
      d: `${lijn} L ${maat.breedteMm} ${onder} L 0 ${onder} Z`,
      fill: kleur,
      'fill-opacity': dekking
    }))

    // een iets steviger lijn op de bergkam, anders wordt het een vlek
    svg.append(maakSvg('path', {
      d: lijn,
      fill: 'none',
      stroke: kleur2,
      'stroke-opacity': Math.min(1, dekking * 1.6),
      'stroke-width': 0.4,
      'stroke-linejoin': 'round'
    }))
  }
}
