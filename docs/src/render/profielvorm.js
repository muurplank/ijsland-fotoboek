/**
 * De vorm van het hoogteprofiel: zes manieren om hetzelfde vlak te tekenen.
 *
 * De grafiek zelf verandert niet - dezelfde meetpunten, dezelfde hoogteas,
 * dezelfde kilometers eronder. Alleen de manier waarop het vlak onder de lijn
 * gevuld wordt verschilt, want dat is het enige waar smaak over gaat.
 *
 * Waarom hier en niet in de pagina's: de dagpagina en de reiscijferpagina
 * tekenen allebei een profiel. Stond de vorm daar, dan bestond elke vorm twee
 * keer en liepen ze binnen een maand uit elkaar.
 *
 * Waarom knopen als gewone objecten en geen SVG-elementen: dan kan dit bestand
 * zonder browser getest worden, en blijft het net als styleSchema.js vooral
 * data. De pagina's zetten het met bouwSvg() om in echte elementen.
 *
 * De hoogtekleuren zijn zo gekozen dat de helderheid bij elke stap daalt
 * (OKLab 0,80 - 0,74 - 0,67 - 0,58 - 0,45). Daar leunen alle zes de vormen op:
 * ook wie de kleuren niet onderscheidt en ook in zwart-wit blijft hoger
 * donkerder. Zet je die trap om in een gewone regenboog, dan is het midden het
 * lichtst en klopt geen van deze vormen meer.
 */

const SVG = 'http://www.w3.org/2000/svg'

/** Afronden op duizendsten van een millimeter; fijner ziet geen enkele pers. */
const rond = n => Math.round(n * 1000) / 1000

export const VORMEN = ['silhouet', 'lagen', 'kam', 'arcering', 'terras', 'spiegel']

/**
 * Wat de pagina van een vorm moet weten zonder hem te tekenen.
 *
 * hoogteAs: of de meters langs de linkerkant nog kloppen. De spiegel propt twee
 * grafieken in dezelfde hoogte, dus daar wijst een streepje bij 400 m niet meer
 * naar 400 m. Een as die iets anders zegt dan hij aanwijst is erger dan geen as.
 */
export const VORM_INFO = {
  silhouet: { hoogteAs: true },
  lagen: { hoogteAs: true },
  kam: { hoogteAs: true },
  arcering: { hoogteAs: true },
  terras: { hoogteAs: true },
  spiegel: { hoogteAs: false }
}

/**
 * De hoogtetrap uit de instellingen, gegarandeerd oplopend.
 *
 * De schuifjes staan los van elkaar, dus je kunt "midden" onder "laag" zetten.
 * Dat mag, maar de trap zelf moet blijven kloppen.
 */
export function hoogteTrap (stijl) {
  const ruw = [
    { m: 0, kleur: stijl['profiel.dal'] },
    { m: stijl['profiel.laagM'], kleur: stijl['profiel.laag'] },
    { m: stijl['profiel.middenM'], kleur: stijl['profiel.midden'] },
    { m: stijl['profiel.hoogM'], kleur: stijl['profiel.hoog'] },
    { m: stijl['profiel.piekM'], kleur: stijl['profiel.piek'] }
  ]

  let vorige = -1
  return ruw.map(stap => {
    const m = Math.max(stap.m, vorige + 1)
    vorige = m
    return { m, kleur: stap.kleur }
  })
}

const hexNaarRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))

const rgbNaarHex = rgb => '#' + rgb
  .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
  .join('')

/**
 * De kleur die bij een hoogte hoort, met de tinten ertussen gemengd.
 *
 * De vormen die met vlakken werken hebben losse kleuren nodig in plaats van een
 * verloop: een band of een streepje heeft er maar één.
 */
export function kleurOpHoogte (trap, m) {
  if (m <= trap[0].m) return trap[0].kleur
  if (m >= trap.at(-1).m) return trap.at(-1).kleur

  for (let i = 1; i < trap.length; i++) {
    if (m > trap[i].m) continue
    const onder = trap[i - 1]
    const boven = trap[i]
    const deel = (m - onder.m) / (boven.m - onder.m)
    const a = hexNaarRgb(onder.kleur)
    const b = hexNaarRgb(boven.kleur)
    return rgbNaarHex(a.map((v, k) => v + (b[k] - v) * deel))
  }
  return trap.at(-1).kleur
}

/** Hoeveel banden er hoogstens komen; daarboven ziet niemand het verschil nog. */
const MAX_BANDEN = 60

/**
 * De hoogtes waarop de banden van lagen, arcering en terras liggen.
 * Loopt altijd van nul tot precies de bovengrens, zodat er bovenin geen reepje
 * ongevuld blijft.
 */
export function bandGrenzen (bovenGrens, stapM) {
  let stap = Math.max(10, stapM)
  while (bovenGrens / stap > MAX_BANDEN) stap *= 2

  const uit = [0]
  for (let h = stap; h < bovenGrens - stap * 0.05; h += stap) uit.push(h)
  uit.push(bovenGrens)
  return uit
}

const puntenTekst = (punten, xVan, yVan) =>
  punten.map(p => `${rond(xVan(p.km))},${rond(yVan(p.m))}`).join(' ')

const omtrekTekst = (reeks, { links, rechts, onder }) =>
  `${rond(links)},${rond(onder)} ${reeks} ${rond(rechts)},${rond(onder)}`

/** De hoogtelijn zelf, die over elke vorm heen gaat. */
const profielLijn = (reeks, ctx) => ({
  tag: 'polyline',
  attr: {
    points: reeks,
    fill: 'none',
    stroke: ctx.stijl['profiel.lijnKleur'],
    'stroke-width': ctx.lijnMm ?? ctx.stijl['profiel.lijnDikteMm'],
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round'
  }
})

/** Het staande kleurverloop, met de stops op de echte hoogtes. */
function verloop (ctx, naam) {
  const { stijl, yVan, bovenGrens } = ctx
  return {
    tag: 'defs',
    kind: [{
      tag: 'linearGradient',
      attr: {
        id: naam,
        gradientUnits: 'userSpaceOnUse',
        x1: 0, y1: rond(yVan(0)), x2: 0, y2: rond(yVan(bovenGrens))
      },
      kind: hoogteTrap(stijl).map(stap => ({
        tag: 'stop',
        attr: {
          offset: `${Math.min(100, (stap.m / bovenGrens) * 100).toFixed(2)}%`,
          'stop-color': stap.kleur
        }
      }))
    }]
  }
}

/** De omtrek van het profiel als knipvorm, zodat vullingen erbinnen blijven. */
const knipvorm = (reeks, ctx) => ({
  tag: 'defs',
  kind: [{
    tag: 'clipPath',
    attr: { id: `${ctx.id}-knip` },
    kind: [{ tag: 'polygon', attr: { points: omtrekTekst(reeks, ctx) } }]
  }]
})

// ------------------------------------------------------------------ silhouet

function silhouet (ctx) {
  const { punten, xVan, yVan, stijl, id } = ctx
  const knopen = []
  const reeks = puntenTekst(punten, xVan, yVan)

  let vulling = stijl['profiel.vulKleur']
  if (stijl['profiel.verloopAan']) {
    knopen.push(verloop(ctx, `${id}-verloop`))
    vulling = `url(#${id}-verloop)`
  }

  knopen.push({
    tag: 'polygon',
    attr: {
      points: omtrekTekst(reeks, ctx),
      fill: vulling,
      'fill-opacity': stijl['profiel.verloopAan'] ? stijl['profiel.verloopDekking'] : 1
    }
  })
  knopen.push(profielLijn(reeks, ctx))
  return knopen
}

// --------------------------------------------------------------------- lagen

/**
 * Vlakke hoogtebanden met een haarlijn ertussen: het profiel als uitgesneden
 * lagen multiplex. Het scheidingslijntje heeft de kleur van het papier, want
 * een lijn in een andere kleur zou een zesde kleur aan de trap toevoegen.
 */
function lagen (ctx) {
  const { punten, xVan, yVan, links, rechts, bovenGrens, stijl } = ctx
  const reeks = puntenTekst(punten, xVan, yVan)
  const knip = `url(#${ctx.id}-knip)`
  const knopen = [knipvorm(reeks, ctx)]

  const trap = hoogteTrap(stijl)
  const grenzen = bandGrenzen(bovenGrens, stijl['profiel.bandStapM'])

  for (let i = 0; i < grenzen.length - 1; i++) {
    const onderin = grenzen[i]
    const bovenin = grenzen[i + 1]
    const yBoven = yVan(bovenin)
    const yOnder = yVan(onderin)

    knopen.push({
      tag: 'rect',
      attr: {
        x: rond(links), y: rond(yBoven),
        width: rond(rechts - links), height: rond(yOnder - yBoven),
        fill: kleurOpHoogte(trap, (onderin + bovenin) / 2),
        'fill-opacity': stijl['profiel.verloopDekking'],
        'clip-path': knip
      }
    })

    if (i > 0) {
      knopen.push({
        tag: 'line',
        attr: {
          x1: rond(links), x2: rond(rechts), y1: rond(yOnder), y2: rond(yOnder),
          stroke: stijl['pagina.achtergrond'],
          'stroke-width': 0.18,
          'clip-path': knip
        }
      })
    }
  }

  knopen.push(profielLijn(reeks, ctx))
  return knopen
}

// ----------------------------------------------------------------------- kam

/**
 * Eén staand streepje per meetpunt, elk in zijn eigen hoogtekleur. Het verloop
 * zit dan in de streepjes zelf in plaats van in een vlak erachter.
 *
 * De streepjes worden net iets smaller getekend dan de afstand ertussen, zodat
 * er licht tussendoor blijft en het geen dichtgelopen vlak wordt.
 */
function kam (ctx) {
  const { punten, xVan, yVan, onder, boven, stijl } = ctx
  const knopen = []
  const trap = hoogteTrap(stijl)
  const afstand = Math.max(0.2, stijl['profiel.kamAfstandMm'])

  let vorigeX = -Infinity
  for (const p of punten) {
    const x = xVan(p.km)
    if (x - vorigeX < afstand) continue
    vorigeX = x

    knopen.push({
      tag: 'line',
      attr: {
        x1: rond(x), x2: rond(x),
        y1: rond(onder),
        y2: rond(Math.max(boven, yVan(p.m))),
        stroke: kleurOpHoogte(trap, p.m),
        'stroke-width': rond(afstand * 0.62),
        'stroke-opacity': stijl['profiel.verloopDekking'],
        'stroke-linecap': 'butt'
      }
    })
  }

  knopen.push(profielLijn(puntenTekst(punten, xVan, yVan), ctx))
  return knopen
}

// ------------------------------------------------------------------ arcering

/**
 * Fijne schuine lijntjes die dichter gaan staan naarmate het hoger wordt: een
 * gravure in plaats van een vlak. Werkt ook als het boek zwart-wit gedrukt zou
 * worden, want daar draagt de dichtheid het verhaal en niet de kleur.
 */
function arcering (ctx) {
  const { punten, xVan, yVan, links, rechts, bovenGrens, stijl, id } = ctx
  const reeks = puntenTekst(punten, xVan, yVan)
  const knip = `url(#${id}-knip)`
  const knopen = [knipvorm(reeks, ctx)]

  const trap = hoogteTrap(stijl)
  const grenzen = bandGrenzen(bovenGrens, stijl['profiel.bandStapM'])
  const banden = grenzen.length - 1
  const ruimste = Math.max(0.3, stijl['profiel.arceringMm'])

  const patronen = []
  for (let i = 0; i < banden; i++) {
    const onderin = grenzen[i]
    const bovenin = grenzen[i + 1]
    const deel = banden > 1 ? i / (banden - 1) : 0
    const stap = rond(ruimste * (1 - 0.62 * deel))
    const naam = `${id}-arcering-${i}`

    patronen.push({
      tag: 'pattern',
      attr: {
        id: naam,
        width: stap, height: stap,
        patternUnits: 'userSpaceOnUse',
        patternTransform: 'rotate(45)'
      },
      kind: [{
        tag: 'line',
        attr: {
          x1: 0, y1: 0, x2: 0, y2: stap,
          stroke: kleurOpHoogte(trap, (onderin + bovenin) / 2),
          // ruim vier tiende van de tegel is inkt: genoeg om naast de andere
          // vormen overeind te blijven, weinig genoeg om arcering te blijven
          'stroke-width': rond(stap * 0.42)
        }
      }]
    })

    const yBoven = yVan(bovenin)
    const yOnder = yVan(onderin)
    knopen.push({
      tag: 'rect',
      attr: {
        x: rond(links), y: rond(yBoven),
        width: rond(rechts - links), height: rond(yOnder - yBoven),
        fill: `url(#${naam})`,
        'clip-path': knip
      }
    })
  }

  knopen.push({ tag: 'defs', kind: patronen })
  knopen.push(profielLijn(reeks, ctx))
  return knopen
}

// -------------------------------------------------------------------- terras

/**
 * Een rustig vlak met hoogtelijnen erdoorheen, op vaste afstanden: de grafiek
 * als doorsnede door de kaart. Zelfde idee als de hoogtelijnen op de kaart,
 * alleen dan van opzij gezien.
 */
function terras (ctx) {
  const { punten, xVan, yVan, links, rechts, bovenGrens, stijl } = ctx
  const reeks = puntenTekst(punten, xVan, yVan)
  const knip = `url(#${ctx.id}-knip)`
  const knopen = [knipvorm(reeks, ctx)]

  knopen.push({
    tag: 'polygon',
    attr: {
      points: omtrekTekst(reeks, ctx),
      fill: stijl['profiel.vulKleur']
    }
  })

  const trap = hoogteTrap(stijl)
  for (const h of bandGrenzen(bovenGrens, stijl['profiel.bandStapM']).slice(1, -1)) {
    const y = rond(yVan(h))
    knopen.push({
      tag: 'line',
      attr: {
        x1: rond(links), x2: rond(rechts), y1: y, y2: y,
        stroke: kleurOpHoogte(trap, h),
        'stroke-width': 0.22,
        'stroke-opacity': stijl['profiel.verloopDekking'],
        'clip-path': knip
      }
    })
  }

  knopen.push(profielLijn(reeks, ctx))
  return knopen
}

// ------------------------------------------------------------------- spiegel

/**
 * Het profiel en zijn spiegelbeeld, als een berg in het water. Puur decoratief,
 * bedoeld als kop boven een fotopagina.
 *
 * Allebei de helften worden als silhouet getekend, elk in de helft van het vak
 * dat de grafiek krijgt. Zo blijft de grafiek precies even hoog als de andere
 * vormen en schuift er niets onder de namen van de stops.
 */
function spiegel (ctx) {
  const { boven, onder, bovenGrens, id } = ctx
  const midden = (boven + onder) / 2
  const halveHoogte = midden - boven

  const omhoog = {
    ...ctx,
    id: `${id}-op`,
    onder: midden,
    yVan: vormSchaal('spiegel', ctx)
  }
  const omlaag = {
    ...ctx,
    id: `${id}-neer`,
    boven: midden,
    onder: midden,
    yVan: m => midden + (m / bovenGrens) * halveHoogte
  }

  const weerkaatst = silhouet(omlaag).map(knoop => {
    if (knoop.tag === 'defs') return knoop
    const attr = { ...knoop.attr }
    if (attr.fill && attr.fill !== 'none') attr['fill-opacity'] = (attr['fill-opacity'] ?? 1) * 0.4
    if (attr.stroke) attr['stroke-opacity'] = 0.4
    return { ...knoop, attr }
  })

  return [...silhouet(omhoog), ...weerkaatst]
}

/**
 * De y-schaal die een vorm werkelijk gebruikt.
 *
 * Alleen de spiegel wijkt af: die propt twee grafieken in dezelfde hoogte en
 * tekent dus op halve schaal. De pagina heeft dit nodig om het label bij het
 * hoogste punt op de goede plek te zetten in plaats van erboven.
 */
export function vormSchaal (vorm, ctx) {
  if (vorm !== 'spiegel') return ctx.yVan

  const midden = (ctx.boven + ctx.onder) / 2
  return m => midden - (m / ctx.bovenGrens) * (midden - ctx.boven)
}

const TEKENAARS = { silhouet, lagen, kam, arcering, terras, spiegel }

/**
 * De knopen voor één profiel, in tekenvolgorde.
 *
 * @param {string} vorm een van VORMEN; iets anders wordt het silhouet
 * @param {object} ctx
 * @param {Array<{km:number,m:number}>} ctx.punten meetpunten, oplopend in km
 * @param {Function} ctx.xVan kilometers naar millimeters op de pagina
 * @param {Function} ctx.yVan meters naar millimeters op de pagina
 * @param {number} ctx.links linkerkant van de grafiek, in mm
 * @param {number} ctx.rechts rechterkant, in mm
 * @param {number} ctx.boven bovenkant, in mm
 * @param {number} ctx.onder basislijn, in mm
 * @param {number} ctx.bovenGrens hoogte bovenaan de as, in meters
 * @param {object} ctx.stijl
 * @param {number} [ctx.lijnMm] dikte van de profiellijn
 * @param {string} ctx.id voorvoegsel voor de defs, uniek per grafiek op de pagina
 * @returns {Array<{tag:string, attr?:object, kind?:Array}>}
 */
export function profielVorm (vorm, ctx) {
  return (TEKENAARS[vorm] ?? silhouet)(ctx)
}

/** Een knoop omzetten in een echt SVG-element. Alleen in de browser bruikbaar. */
export function bouwSvg (knoop) {
  const n = document.createElementNS(SVG, knoop.tag)
  for (const [naam, waarde] of Object.entries(knoop.attr ?? {})) {
    if (waarde !== null && waarde !== undefined) n.setAttribute(naam, String(waarde))
  }
  for (const kind of knoop.kind ?? []) n.append(bouwSvg(kind))
  return n
}
