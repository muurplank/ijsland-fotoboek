/**
 * De IJslandse vlag, gesneden en met de hand aangedrukt.
 *
 * Op het voorblad staat verder alleen inkt: de omtrek van het eiland en de ring
 * van de rit. De vlag is de enige plek waar echte kleur op het blad komt, en dan
 * moet het ook echt kleur zijn - een verbleekte vlag leest als een drukfout.
 *
 * Wat hem bij de rest laat horen is niet de kleur maar de máák. Dezelfde
 * gedachte als bij de reisstempels: elke inkt is een eigen aandruk, en die
 * vallen nooit precies op elkaar. Het rode kruis ligt daarom een fractie naast
 * het witte, en het witte een fractie naast het blauwe vlak. Precies dat
 * verschuiven is wat een gedrukte vlag onderscheidt van een vlag uit een
 * tekenprogramma, en het is dus geen slordigheid die je moet wegpoetsen.
 *
 * De rand is met de pen gesneden en niet met een liniaal, en alles wordt op die
 * rand afgeknipt. Daardoor blijft de vlag één vorm, hoe ver de kleuren onderling
 * ook verschoven zijn.
 *
 * Knopen als gewone objecten en geen SVG-elementen - zelfde reden als bij
 * papier.js en pen.js: zo is de meetkunde te controleren zonder browser, en de
 * pagina zet het met bouwSvg() om in echte elementen.
 */

import { padVan } from './pen.js'

/**
 * De officiële kleuren, uit de IJslandse vlaggenregeling.
 *
 * Ze staan hier als benoemde constanten en niet als losse hexcodes in de
 * tekencode, want een vlag met een net iets ander blauw is geen stijlkeuze maar
 * een fout - en dat is precies het soort ding dat niemand nakijkt.
 */
export const VLAGBLAUW = '#02529c'
export const VLAGROOD = '#dc1e35'
export const VLAGWIT = '#ffffff'

/**
 * De vlag zoals hij officieel getekend is, in zijn eigen eenheden.
 *
 * Dit is letterlijk de tekening uit Flag_of_Iceland.svg: een blauw veld van 25
 * bij 18, en daarop twee kruisen die als streek getekend zijn in plaats van als
 * losse balken - eerst wit op streekbreedte 4, daar bovenop rood op 2. Dat het
 * één streek is en geen vier rechthoeken is precies waarom het klopt: het
 * midden van het kruis komt zo vanzelf goed uit, zonder dat er ergens vier
 * hoeken op elkaar hoeven te passen.
 *
 * De banen die eruit volgen: van links naar rechts blauw 7, wit 1, rood 2, wit
 * 1, blauw 14; van boven naar beneden blauw 7, wit 1, rood 2, wit 1, blauw 7.
 * Het kruis staat dus links van het midden, en dat is geen benadering maar de
 * voorgeschreven maat.
 *
 * Hier stond eerder een eigen versie, met een gesneden rand en drie inkten die
 * naast elkaar vielen zoals bij de reisstempels. Die was niet mooi. De vlag is
 * geen stempel: hij hoort strak te zijn, en het karakter van het blad komt van
 * de zegel eromheen.
 */
export const HOOG = 18
export const BREED = 25

/** Afronden op duizendsten van een millimeter; fijner ziet geen enkele pers. */
const rond = n => Math.round(n * 1000) / 1000

/** De drie paden, in vlageenheden. Onaangeroerd uit de bron overgenomen. */
export const VLAGPADEN = [
  { d: 'M0 0H25V18H0Z', vulling: VLAGBLAUW },
  { d: 'M0 9H25M9 0V18', streek: VLAGWIT, breedte: 4 },
  { d: 'M0 9H25M9 0V18', streek: VLAGROOD, breedte: 2 }
]

/** De buitenmaat van een vlag van deze breedte. */
export function vlagMaat (breedteMm) {
  return { breedteMm, hoogteMm: (breedteMm * HOOG) / BREED }
}

/**
 * Het vak waarin een vlag een gebied helemaal bedekt, met behoud van vorm.
 *
 * Nodig als de vlag de vorm van het land moet vullen: IJsland is breder dan de
 * vlag hoog is, dus schalen naar de breedte laat hem boven en onder uitsteken.
 * Dat is precies goed - wat uitsteekt wordt door de kustlijn weggeknipt. Uitrekken
 * zou de vlag vervormen, en een vlag met een uitgerekt kruis is geen vlag meer.
 */
export function dekkendVak ({ x, y, breedte, hoogte }) {
  const breed = Math.max(breedte, (hoogte * BREED) / HOOG)
  const hoog = (breed * HOOG) / BREED
  return {
    x: x + (breedte - breed) / 2,
    y: y + (hoogte - hoog) / 2,
    breedteMm: breed,
    hoogteMm: hoog
  }
}

/**
 * De vlag als knopen voor bouwSvg().
 *
 * De paden staan in vlageenheden en worden met één transform op maat gezet.
 * Daardoor schaalt de streekbreedte vanzelf mee en blijft de verhouding tussen
 * het witte en het rode kruis kloppen, wat bij losse rechthoeken elke keer
 * opnieuw uitgerekend zou moeten worden.
 *
 * @param {object} opties
 * @param {number} opties.x           linkerbovenhoek op de pagina
 * @param {number} opties.y
 * @param {number} opties.breedteMm
 * @param {number} [opties.dekking]   1 is vol, lager laat de ondergrond door
 * @returns {Array<{tag: string, attr?: object, kind?: Array}>}
 */
export function vlagKnopen ({ x = 0, y = 0, breedteMm, dekking = 1 }) {
  if (!(breedteMm > 0)) return []

  const schaal = breedteMm / BREED

  return [{
    tag: 'g',
    attr: {
      transform: `translate(${rond(x)} ${rond(y)}) scale(${rond(schaal)})`,
      opacity: rond(dekking)
    },
    kind: VLAGPADEN.map(pad => ({
      tag: 'path',
      attr: {
        d: pad.d,
        fill: pad.vulling ?? 'none',
        stroke: pad.streek ?? null,
        'stroke-width': pad.breedte ?? null
      }
    }))
  }]
}

/**
 * Een getande rand langs één zijde.
 *
 * Elke tand is een halve cirkel die naar binnen bijt - dat is wat een
 * perforatie is: gaatjes die uit het vel geponst zijn, en het papier ertussen
 * blijft staan. Naar buiten bollen zou een bloem opleveren.
 *
 * Het aantal tanden volgt uit de lengte, want tanden horen overal even groot te
 * zijn. Op een zijde die niet precies deelbaar is worden ze een fractie ruimer
 * in plaats van dat er een halve tand overblijft.
 *
 * @param {{x: number, y: number}} van
 * @param {{x: number, y: number}} tot
 * @param {number} tandMm  hart-op-hart afstand tussen de gaatjes
 */
export function getandeRand (van, tot, tandMm) {
  const dx = tot.x - van.x
  const dy = tot.y - van.y
  const lengte = Math.hypot(dx, dy)
  if (!(lengte > 0) || !(tandMm > 0)) return [van]

  const aantal = Math.max(1, Math.round(lengte / tandMm))
  const stap = lengte / aantal
  const ux = dx / lengte
  const uy = dy / lengte

  // de normaal die het vlak in wijst, bij een rondgang met de klok mee
  const nx = -uy
  const ny = ux
  const straal = stap / 2

  const punten = []
  // Een even aantal, en dat is geen detail: bij een oneven aantal valt er geen
  // meetpunt op het diepste punt van de boog en wordt elke tand een paar procent
  // ondieper dan de straal zegt. Op zeven stukjes was dat 1,393 in plaats van
  // 1,429 - onzichtbaar op papier, maar het maakt de maat een leugen.
  const stukjes = 8

  for (let i = 0; i < aantal; i++) {
    const mx = van.x + ux * (i + 0.5) * stap
    const my = van.y + uy * (i + 0.5) * stap

    for (let s = 0; s <= stukjes; s++) {
      const hoek = Math.PI - (s / stukjes) * Math.PI
      const langs = Math.cos(hoek) * straal
      const binnen = Math.sin(hoek) * straal
      punten.push({
        x: mx + ux * langs + nx * binnen,
        y: my + uy * langs + ny * binnen
      })
    }
  }

  return punten
}

/** De hele omtrek van een postzegel: vier getande randen achter elkaar. */
export function zegelOmtrek (x, y, breedte, hoogte, tandMm) {
  const hoeken = [
    { x, y },
    { x: x + breedte, y },
    { x: x + breedte, y: y + hoogte },
    { x, y: y + hoogte }
  ]

  const punten = []
  for (let i = 0; i < 4; i++) {
    punten.push(...getandeRand(hoeken[i], hoeken[(i + 1) % 4], tandMm))
  }
  return punten
}

/**
 * De afstempeling: een paar golfjes schuin over de zegel.
 *
 * Bleek en half naast het onderwerp, want een echte afstempeling is inkt over
 * inkt en geen sticker erbovenop. Dezelfde gedachte als bij het inzetkaartje in
 * furniture.js, maar dan als knopen zodat het zonder browser te maken is.
 */
export function afstempelKnopen ({
  x, y, breedte, hoogte, kleur = '#3a352e', kracht = 0.55, lijnMm
}) {
  if (!(kracht > 0)) return []

  const dikte = lijnMm ?? Math.max(0.09, hoogte * 0.02)
  const knopen = []

  for (let i = 0; i < 4; i++) {
    const basis = y + hoogte * 0.14 + i * hoogte * 0.075
    const stukken = []

    for (let t = -0.06; t <= 1.08; t += 0.035) {
      const px = x + breedte * t
      // een trage golf, en de hele bundel loopt schuin omhoog naar rechts
      const golf = Math.sin(t * 19) * hoogte * 0.022
      const py = basis + golf - t * hoogte * 0.16
      stukken.push(`${stukken.length ? 'L' : 'M'} ${rond(px)} ${rond(py)}`)
    }

    knopen.push({
      tag: 'path',
      attr: {
        d: stukken.join(' '),
        fill: 'none',
        stroke: kleur,
        'stroke-width': rond(dikte),
        'stroke-linecap': 'round',
        'stroke-opacity': rond(kracht * 0.55)
      }
    })
  }

  return knopen
}

/**
 * De vlag als gefrankeerde postzegel.
 *
 * Waarom dit een betere plek is dan een hoek: een vlag die in de hoek geparkeerd
 * staat is een logo, en een boek met een logo erop is een brochure. Als zegel
 * krijgt hij een reden om er te zijn - rechtsboven, waar op een envelop een
 * zegel hoort - en leest het omslag als post uit IJsland in plaats van als een
 * kaart met een vlaggetje erbij.
 *
 * De zegel is een eigen vel papier en dus dekkend, ook als het blad verder
 * doorzichtig is. Dat hoort zo: een zegel is een voorwerp dat je erop plakt.
 *
 * @param {object} opties
 * @param {number} opties.breedteMm   de buitenmaat van de zegel, tanden meegeteld
 * @param {number} [opties.tandMm]    hart-op-hart tussen de gaatjes
 * @param {number} [opties.biesMm]    witrand tussen de tanden en de vlag
 * @param {string} [opties.papierKleur] het vel waar de vlag op gedrukt staat
 * @param {number} [opties.afstempeling] 0 laat de golfjes weg
 */
export function zegelKnopen ({
  x = 0, y = 0, breedteMm, rnd,
  tandMm = 1.7, biesMm, papierKleur = '#f2ebdc', inktKleur = '#3a352e',
  afstempeling = 0.55, dekking = 1, id = 'zegel'
}) {
  if (!(breedteMm > 0)) return []

  const bies = biesMm ?? tandMm * 1.6
  const vlagBreed = Math.max(0.1, breedteMm - 2 * bies)
  const hoogteMm = vlagMaat(vlagBreed).hoogteMm + 2 * bies

  const omtrek = zegelOmtrek(x, y, breedteMm, hoogteMm, tandMm)
  const clipId = `${id}-tanden`

  const knopen = [{
    tag: 'defs',
    kind: [{
      tag: 'clipPath',
      attr: { id: clipId, clipPathUnits: 'userSpaceOnUse' },
      kind: [{ tag: 'path', attr: { d: padVan(omtrek, true) } }]
    }]
  }]

  // het vel zelf
  knopen.push({
    tag: 'path',
    attr: { d: padVan(omtrek, true), fill: papierKleur, 'fill-opacity': rond(dekking) }
  })

  // de vlag erop
  knopen.push(...vlagKnopen({ x: x + bies, y: y + bies, breedteMm: vlagBreed, dekking }))

  // en de afstempeling eroverheen, afgeknipt op de tanden zodat de golfjes niet
  // naast de zegel doorlopen
  const stempel = afstempelKnopen({
    x, y, breedte: breedteMm, hoogte: hoogteMm, kleur: inktKleur, kracht: afstempeling
  })

  if (stempel.length) {
    knopen.push({ tag: 'g', attr: { 'clip-path': `url(#${clipId})` }, kind: stempel })
  }

  return knopen
}

/** De buitenmaat van een zegel van deze breedte; de pagina moet hem kunnen plaatsen. */
export function zegelMaat (breedteMm, tandMm = 1.7, biesMm) {
  const bies = biesMm ?? tandMm * 1.6
  const vlagBreed = Math.max(0.1, breedteMm - 2 * bies)
  return { breedteMm, hoogteMm: vlagMaat(vlagBreed).hoogteMm + 2 * bies }
}
