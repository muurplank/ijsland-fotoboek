/**
 * Het weer als getekende notatie in plaats van als emoji.
 *
 * Boven de temperatuurgrafiek stond een rij gekleurde emoji. Die doen het prima
 * op een scherm, maar op deze bladzijde zijn het de enige felle, glanzende
 * dingen tussen allemaal gedempte inkt - en ze komen uit de lettertypemap van je
 * besturingssysteem, dus op een andere machine zien ze er anders uit en in de
 * PDF worden het plaatjes.
 *
 * Dit tekent ze zelf, in één inktkleur, als vectoren. Maar niet verzonnen: dit
 * is de notatie waarmee weerwaarnemers het al anderhalve eeuw op hun kaarten
 * zetten. Een open rondje is een heldere hemel en een dichtgemaakt rondje een
 * gesloten wolkendek; de bedekking lees je dus letterlijk af aan hoe vol het
 * rondje staat. Drie liggende streepjes is mist, twee stippen is regen, een
 * sterretje is sneeuw, een driehoekje is een bui.
 *
 * Precies het soort teken dat iemand met een verrekijker en een schrift zou
 * zetten - en daarmee hoort het bij deze pagina op een manier waarop een
 * zonnetje met een lachend gezicht dat nooit zou doen.
 *
 * Knopen als gewone objecten en geen SVG-elementen, net als in profielvorm.js:
 * zo is het zonder browser te testen.
 *
 * Alles wordt getekend in een vakje van -0,5 tot 0,5 in allebei de richtingen.
 * De pagina schaalt dat naar de maat die in het paneel staat.
 */

/** Afronden op duizendsten; fijner ziet geen enkele pers. */
const r = n => Math.round(n * 1000) / 1000

/** De codes komen uit de WMO-tabel; zie weerTeken() in pages/statsdelen.js. */
export const WEERSOORTEN = [
  'helder', 'licht-bewolkt', 'half-bewolkt', 'bewolkt',
  'mist', 'motregen', 'regen', 'sneeuw', 'buien', 'onweer'
]

/**
 * Welke soort er bij een code hoort.
 *
 * Op groep afgehandeld en niet per los nummer, om dezelfde reden als bij de
 * emoji: dan valt er nooit een code buiten de boot.
 */
export function weerSoort (code) {
  if (code === null || code === undefined) return null
  if (code <= 0) return 'helder'
  if (code === 1) return 'licht-bewolkt'
  if (code === 2) return 'half-bewolkt'
  if (code === 3) return 'bewolkt'
  if (code < 50) return 'mist'
  if (code < 60) return 'motregen'
  if (code < 70) return 'regen'
  if (code < 80) return 'sneeuw'
  if (code < 86) return 'buien'
  if (code < 90) return 'sneeuw'
  return 'onweer'
}

/** Een rondje waarvan een deel dichtgemaakt is: de bedekking van de hemel. */
function bedekking (deel, lijn) {
  const straal = 0.3
  const knopen = [{
    tag: 'circle',
    attr: { cx: 0, cy: 0, r: straal, fill: 'none', stroke: 'currentColor', 'stroke-width': lijn }
  }]

  if (deel >= 1) {
    knopen.push({ tag: 'circle', attr: { cx: 0, cy: 0, r: straal, fill: 'currentColor' } })
    return knopen
  }
  if (deel <= 0) return knopen

  // Een taartpunt vanaf de bovenkant met de klok mee, zoals op een weerkaart.
  const hoek = deel * Math.PI * 2
  const x = r(Math.sin(hoek) * straal)
  const y = r(-Math.cos(hoek) * straal)
  const groot = deel > 0.5 ? 1 : 0

  knopen.push({
    tag: 'path',
    attr: {
      d: `M 0 0 L 0 ${-straal} A ${straal} ${straal} 0 ${groot} 1 ${x} ${y} Z`,
      fill: 'currentColor'
    }
  })
  return knopen
}

/** Een stip: regen. */
const stip = (x, y, straal) => ({
  tag: 'circle', attr: { cx: r(x), cy: r(y), r: r(straal), fill: 'currentColor' }
})

/** Een kommaatje: motregen. */
const komma = (x, y, maat) => ({
  tag: 'path',
  attr: {
    d: `M ${r(x)} ${r(y - maat)} q ${r(maat * 0.9)} ${r(maat * 0.8)} ${r(-maat * 0.2)} ${r(maat * 2)}`,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': r(maat * 0.55),
    'stroke-linecap': 'round'
  }
})

/**
 * De tekens per soort.
 *
 * @param {string} soort  uit WEERSOORTEN
 * @param {object} opties
 * @param {number} opties.lijnMm  lijndikte, in dezelfde eenheid als het vakje
 * @returns {Array} knopen voor bouwSvg()
 */
export function weerKnopen (soort, { lijn = 0.09 } = {}) {
  switch (soort) {
    case 'helder':
      return bedekking(0, lijn)
    case 'licht-bewolkt':
      return bedekking(0.25, lijn)
    case 'half-bewolkt':
      return bedekking(0.5, lijn)
    case 'bewolkt':
      return bedekking(1, lijn)

    case 'mist':
      // drie liggende streepjes, de middelste het langst
      return [-0.16, 0, 0.16].map((y, i) => ({
        tag: 'line',
        attr: {
          x1: i === 1 ? -0.34 : -0.28, x2: i === 1 ? 0.34 : 0.28,
          y1: y, y2: y,
          stroke: 'currentColor', 'stroke-width': lijn, 'stroke-linecap': 'round'
        }
      }))

    case 'motregen':
      return [komma(-0.12, 0, 0.11), komma(0.14, 0, 0.11)]

    case 'regen':
      return [stip(-0.14, -0.1, 0.085), stip(0.14, -0.1, 0.085), stip(0, 0.14, 0.085)]

    case 'sneeuw':
      // een zespuntige ster: drie lijnen door het midden
      return [0, 60, 120].map(graden => {
        const rad = (graden * Math.PI) / 180
        return {
          tag: 'line',
          attr: {
            x1: r(Math.cos(rad) * -0.3), y1: r(Math.sin(rad) * -0.3),
            x2: r(Math.cos(rad) * 0.3), y2: r(Math.sin(rad) * 0.3),
            stroke: 'currentColor', 'stroke-width': lijn, 'stroke-linecap': 'round'
          }
        }
      })

    case 'buien':
      // Het driehoekje van de bui, met de stip erbovenop.
      //
      // Op de weerkaart staat die stip op de punt van de driehoek en niet
      // erbinnen: de driehoek zegt "bui" en de stip zegt waarvan - een stip is
      // regen, een sterretje sneeuw. Binnenin verdwijnt hij in de inkt.
      return [
        { tag: 'path', attr: { d: 'M 0 -0.1 L 0.26 0.34 L -0.26 0.34 Z', fill: 'currentColor' } },
        stip(0, -0.26, 0.085)
      ]

    case 'onweer':
      // de bliksemschicht
      return [{
        tag: 'path',
        attr: {
          d: 'M 0.1 -0.34 L -0.16 0.02 L 0.02 0.02 L -0.12 0.34 L 0.2 -0.06 L 0.01 -0.06 Z',
          fill: 'currentColor'
        }
      }]

    default:
      return [stip(0, 0, 0.05)]
  }
}

/** ------------------------------------------------------- de pictogrammen */

/**
 * Dezelfde tien soorten, maar als herkenbaar plaatje in plaats van als notatie.
 *
 * De notatie hierboven is mooi maar je moet hem kennen; een rondje dat voor
 * kwart bewolkt staat leest niemand zomaar af. Emoji uit het systeemlettertype
 * lezen wél meteen, maar zijn bont, glanzend, op elke machine anders, en in de
 * PDF worden het plaatjes.
 *
 * Dus tekenen we ze zelf: de vorm van een emoji, de kleuren van dit boek. En
 * die kleuren zijn niet willekeurig maar logisch - de zon is oker, de wolk
 * leisteengrijs, regen blauw, sneeuw ijsblauw. Daardoor weet je wat er staat
 * nog voordat je de vorm hebt herkend, en dat is bij een teken van vier
 * millimeter het halve werk.
 *
 * Elke soort gebruikt hooguit twee kleuren: de wolk, en het spul dat eruit komt.
 */

/** De wolk, opgebouwd uit rondjes met een balkje eronder. */
function wolk (kleur, { x = 0, y = 0, maat = 1 } = {}) {
  const v = (cx, cy, straal) => ({
    tag: 'circle',
    attr: { cx: r(x + cx * maat), cy: r(y + cy * maat), r: r(straal * maat), fill: kleur }
  })

  return [
    v(-0.16, 0.02, 0.115),
    v(0.02, -0.05, 0.16),
    v(0.19, 0.02, 0.12),
    {
      tag: 'rect',
      attr: {
        x: r(x - 0.28 * maat), y: r(y - 0.01 * maat),
        width: r(0.56 * maat), height: r(0.15 * maat),
        rx: r(0.07 * maat), fill: kleur
      }
    }
  ]
}

/** De zon: een schijf met stralen eromheen. */
function zon (kleur, { x = 0, y = 0, maat = 1, stralen = true } = {}) {
  const knopen = [{
    tag: 'circle',
    attr: { cx: r(x), cy: r(y), r: r(0.155 * maat), fill: kleur }
  }]

  if (!stralen) return knopen

  for (let i = 0; i < 8; i++) {
    const hoek = (i * Math.PI) / 4
    knopen.push({
      tag: 'line',
      attr: {
        x1: r(x + Math.cos(hoek) * 0.22 * maat), y1: r(y + Math.sin(hoek) * 0.22 * maat),
        x2: r(x + Math.cos(hoek) * 0.32 * maat), y2: r(y + Math.sin(hoek) * 0.32 * maat),
        stroke: kleur, 'stroke-width': r(0.055 * maat), 'stroke-linecap': 'round'
      }
    })
  }
  return knopen
}

/** Schuine streepjes onder de wolk: regen. */
function druppels (kleur, aantal, { lang = 0.17, dikte = 0.055 } = {}) {
  const plekken = aantal === 2 ? [-0.11, 0.11] : [-0.19, 0, 0.19]
  return plekken.map(dx => ({
    tag: 'line',
    attr: {
      x1: r(dx + 0.05), y1: 0.2,
      x2: r(dx - 0.03), y2: r(0.2 + lang),
      stroke: kleur, 'stroke-width': dikte, 'stroke-linecap': 'round'
    }
  }))
}

/** Sterretjes onder de wolk: sneeuw. */
function vlokken (kleur, plekken) {
  return plekken.flatMap(dx =>
    [0, 60, 120].map(graden => {
      const rad = (graden * Math.PI) / 180
      const straal = 0.07
      return {
        tag: 'line',
        attr: {
          x1: r(dx + Math.cos(rad) * -straal), y1: r(0.29 + Math.sin(rad) * -straal),
          x2: r(dx + Math.cos(rad) * straal), y2: r(0.29 + Math.sin(rad) * straal),
          stroke: kleur, 'stroke-width': 0.045, 'stroke-linecap': 'round'
        }
      }
    }))
}

/** De bliksemschicht. */
const schicht = (kleur, { x = 0, y = 0.28, maat = 1 } = {}) => ({
  tag: 'path',
  attr: {
    d: `M ${r(x + 0.07 * maat)} ${r(y - 0.16 * maat)} ` +
       `L ${r(x - 0.09 * maat)} ${r(y + 0.03 * maat)} ` +
       `L ${r(x + 0.01 * maat)} ${r(y + 0.03 * maat)} ` +
       `L ${r(x - 0.06 * maat)} ${r(y + 0.2 * maat)} ` +
       `L ${r(x + 0.11 * maat)} ${r(y - 0.02 * maat)} ` +
       `L ${r(x)} ${r(y - 0.02 * maat)} Z`,
    fill: kleur
  }
})

/**
 * Het pictogram van een weersoort.
 *
 * @param {string} soort  uit WEERSOORTEN
 * @param {object} palet  { zon, wolk, neerslag, sneeuw }
 */
export function weerPictogram (soort, palet) {
  const { zon: zonKleur, wolk: wolkKleur, neerslag, sneeuw: sneeuwKleur } = palet

  switch (soort) {
    case 'helder':
      return zon(zonKleur, { y: -0.02, maat: 1.15 })

    case 'licht-bewolkt':
      // een grote zon met een klein wolkje ervoor
      return [
        ...zon(zonKleur, { x: -0.05, y: -0.1, maat: 0.95 }),
        ...wolk(wolkKleur, { x: 0.09, y: 0.14, maat: 0.72 })
      ]

    case 'half-bewolkt':
      // de zon komt er nog net achter vandaan
      return [
        ...zon(zonKleur, { x: -0.19, y: -0.17, maat: 0.72 }),
        ...wolk(wolkKleur, { x: 0.04, y: 0.06, maat: 0.95 })
      ]

    case 'bewolkt':
      return wolk(wolkKleur, { y: 0.03, maat: 1.12 })

    case 'mist':
      // een bleke wolk met de mistlijnen eronder
      return [
        ...wolk(wolkKleur, { y: -0.06, maat: 0.95 }),
        ...[0.19, 0.3, 0.41].map((y, i) => ({
          tag: 'line',
          attr: {
            x1: i === 1 ? -0.3 : -0.24, x2: i === 1 ? 0.3 : 0.24, y1: y, y2: y,
            stroke: wolkKleur, 'stroke-width': 0.055, 'stroke-linecap': 'round'
          }
        }))
      ]

    case 'motregen':
      return [...wolk(wolkKleur, { y: -0.06 }), ...druppels(neerslag, 2, { lang: 0.11, dikte: 0.05 })]

    case 'regen':
      return [...wolk(wolkKleur, { y: -0.06 }), ...druppels(neerslag, 3)]

    case 'sneeuw':
      return [...wolk(wolkKleur, { y: -0.08 }), ...vlokken(sneeuwKleur, [-0.16, 0.16])]

    case 'buien':
      // een zwaardere wolk met een enkele dikke sliert eronder
      return [
        ...wolk(wolkKleur, { y: -0.08, maat: 1.05 }),
        ...druppels(neerslag, 2, { lang: 0.22, dikte: 0.075 })
      ]

    case 'onweer':
      return [...wolk(wolkKleur, { y: -0.1 }), schicht(zonKleur)]

    default:
      return wolk(wolkKleur, {})
  }
}

/** ------------------------------------------------------- op de pagina */

/**
 * Eén weerteken op zijn plek, klaar om in de tekenlaag te hangen.
 *
 * @param {number|null} code   de WMO-code uit het weerarchief
 * @param {object} opties
 * @param {number} opties.x    midden van het teken, in millimeters
 * @param {number} opties.y
 * @param {number} opties.maatMm  hoe groot het vakje wordt
 * @param {string} [opties.vorm]  'gekleurd' of 'notatie'
 * @param {string} [opties.kleur] de inktkleur, voor de notatie
 * @param {object} [opties.palet] de vier kleuren, voor de pictogrammen
 * @returns {object|null} een groepsknoop, of niets als de code onbekend is
 */
export function weerTekenKnoop (code, { x, y, maatMm, vorm = 'notatie', kleur, palet }) {
  const soort = weerSoort(code)
  if (!soort) return null

  // De lijndikte staat in de eenheden van het vakje, dus omgerekend naar
  // millimeters wordt het maatMm maal deze factor. 0,045 komt bij een teken van
  // vier millimeter uit op 0,18 mm: ruim boven de drukgrens van 0,09 mm.
  const kind = vorm === 'gekleurd'
    ? weerPictogram(soort, palet)
    : weerKnopen(soort, { lijn: 0.09 })

  return {
    tag: 'g',
    attr: {
      transform: `translate(${r(x)} ${r(y)}) scale(${r(maatMm)})`,
      color: kleur
    },
    kind
  }
}
