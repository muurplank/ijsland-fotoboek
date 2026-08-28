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

import { padVan, penKader } from './pen.js'

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
 * De maatverhouding van de vlag: 18 hoog op 25 breed.
 *
 * De banen zijn in diezelfde eenheden gegeven. Van boven naar beneden is dat
 * blauw 7, wit 1, rood 2, wit 1, blauw 7; van links naar rechts blauw 7, wit 1,
 * rood 2, wit 1, blauw 14. Het kruis staat dus links van het midden, en dat is
 * geen benadering maar de voorgeschreven maat.
 */
export const HOOG = 18
export const BREED = 25

/** Afronden op duizendsten van een millimeter; fijner ziet geen enkele pers. */
const rond = n => Math.round(n * 1000) / 1000

/**
 * De vlakken waaruit de vlag bestaat, in millimeters.
 *
 * Apart gehouden van het tekenen zodat de maten te controleren zijn zonder dat
 * er een pen of een toevalsgenerator aan te pas komt.
 *
 * @param {number} breedteMm
 * @returns {{breedteMm: number, hoogteMm: number, vlakken: Array}}
 */
export function vlagVlakken (breedteMm) {
  const hoogteMm = (breedteMm * HOOG) / BREED
  const ex = breedteMm / BREED
  const ey = hoogteMm / HOOG

  return {
    breedteMm,
    hoogteMm,
    vlakken: [
      // het blauwe veld: de hele vlag
      { kleur: VLAGBLAUW, laag: 'veld', x: 0, y: 0, breedte: breedteMm, hoogte: hoogteMm },

      // het witte kruis, vier eenheden breed
      { kleur: VLAGWIT, laag: 'wit', x: 7 * ex, y: 0, breedte: 4 * ex, hoogte: hoogteMm },
      { kleur: VLAGWIT, laag: 'wit', x: 0, y: 7 * ey, breedte: breedteMm, hoogte: 4 * ey },

      // het rode kruis erbinnen, twee eenheden breed
      { kleur: VLAGROOD, laag: 'rood', x: 8 * ex, y: 0, breedte: 2 * ex, hoogte: hoogteMm },
      { kleur: VLAGROOD, laag: 'rood', x: 0, y: 8 * ey, breedte: breedteMm, hoogte: 2 * ey }
    ]
  }
}

/**
 * De vlag als knopen voor bouwSvg().
 *
 * @param {object} opties
 * @param {number} opties.x            linkerbovenhoek op de pagina
 * @param {number} opties.y
 * @param {number} opties.breedteMm
 * @param {Function} opties.rnd        gezaaid; zelfde zaad, zelfde aandruk
 * @param {number} [opties.handMm]     hoe onvast de snede en hoe ver de inkten uiteen
 * @param {number} [opties.dekking]    1 is volle inkt, lager laat het papier door
 * @param {string} [opties.inktKleur]  de sleutelinkt van de rand
 * @param {number} [opties.inktMm]     dikte van die rand; 0 laat hem weg
 * @param {string} [opties.id]         uniek voorvoegsel voor de clipPath
 * @returns {Array<{tag: string, attr?: object, kind?: Array}>}
 */
export function vlagKnopen ({
  x = 0, y = 0, breedteMm, rnd,
  handMm = 0.35, dekking = 1, inktKleur = '#3a352e', inktMm = 0.3, id = 'vlag'
}) {
  if (!(breedteMm > 0)) return []

  const { hoogteMm, vlakken } = vlagVlakken(breedteMm)

  // De gesneden rand.
  //
  // De afronding schaalt mee met de vlag, want een vaste maat maakt een klein
  // vlaggetje tot een ovaal en een groot tot een scherpe rechthoek. Maar hij
  // blijft klein: een mes dat door rubber gaat laat een hoek staan die je net
  // niet scherp krijgt, geen ronding waar je een munt langs kunt leggen. Stond
  // eerst op zes procent, en toen was het geen stempel meer maar een sticker.
  const hoekMm = Math.min(breedteMm, hoogteMm) * 0.012
  const { omtrek, haal } = penKader(x, y, breedteMm, hoogteMm, {
    rnd, amplitudeMm: handMm, hoekMm, overschot: 0.04
  })

  const clipId = `${id}-snede`
  const knopen = [{
    tag: 'defs',
    kind: [{
      tag: 'clipPath',
      attr: { id: clipId, clipPathUnits: 'userSpaceOnUse' },
      kind: [{ tag: 'path', attr: { d: padVan(omtrek, true) } }]
    }]
  }]

  const laag = {
    tag: 'g',
    attr: { 'clip-path': `url(#${clipId})`, opacity: rond(dekking) },
    kind: []
  }

  // Hoe ver een inkt naast de vorige valt.
  //
  // Dit is níét gewoon handMm, en dat is het hele punt. De witte baan is maar
  // één eenheid breed - op een vlag van veertig millimeter nog geen anderhalve
  // millimeter - dus een verschuiving van een halve millimeter eet er de helft
  // van op. Dan raakt het rood het blauw, en dat leest niet als drukwerk maar
  // als een fout. Vandaar de bovengrens op een achtste eenheid: genoeg om te
  // zien dat het drie aandrukken zijn, te weinig om de baan te verliezen.
  //
  // Zo blijft het ook kloppen als je aan de breedte sleept: de scheefheid
  // schaalt mee met de vlag in plaats van bij een klein vlaggetje het kruis op
  // te eten.
  const eenheid = breedteMm / BREED
  const misdruk = Math.min(handMm, eenheid * 0.125)
  const scheef = () => (rnd() - 0.5) * 2 * misdruk

  // Het blauwe veld blijft staan: dat is de vorm zelf, en zou hij meeschuiven
  // dan kwam er papier langs de snede vandaan.
  const verschuiving = new Map([
    ['veld', { dx: 0, dy: 0 }],
    ['wit', { dx: scheef(), dy: scheef() }],
    ['rood', { dx: scheef(), dy: scheef() }]
  ])

  for (const vlak of vlakken) {
    const v = verschuiving.get(vlak.laag)
    laag.kind.push({
      tag: 'rect',
      attr: {
        x: rond(x + vlak.x + v.dx),
        y: rond(y + vlak.y + v.dy),
        width: rond(vlak.breedte),
        height: rond(vlak.hoogte),
        fill: vlak.kleur
      }
    })
  }

  knopen.push(laag)

  // De sleutelinkt eromheen, als laatste aandruk. Met overschot getekend, zoals
  // een hand die de hoek voorbijschiet, en daarom niet op de snede geclipt.
  if (inktMm > 0) {
    knopen.push({
      tag: 'path',
      attr: {
        d: padVan(haal, true),
        fill: 'none',
        stroke: inktKleur,
        'stroke-width': rond(inktMm),
        'stroke-opacity': rond(dekking),
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round'
      }
    })
  }

  return knopen
}
