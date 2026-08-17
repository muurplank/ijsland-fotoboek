/**
 * Routes die dezelfde weg delen naast elkaar leggen.
 *
 * Reed je op dag 2 en dag 7 over dezelfde weg, dan verdwijnt de ene lijn onder
 * de andere en lijkt het alsof je er maar één keer bent geweest. Cartografen
 * leggen zulke routes daarom naast elkaar, met een kleine tussenruimte.
 *
 * De verschuiving loopt vloeiend op en af: waar een route zijn eigen weg gaat
 * ligt hij weer gewoon op de weg, en daartussen zit geen sprong.
 */

/**
 * Houdt bij welke stukjes kaart al door een eerdere route bezet zijn.
 *
 * Werkt met een grof raster in millimeters. Fijner heeft geen zin: twee routes
 * over dezelfde weg liggen nooit exact op dezelfde coordinaten, want een
 * routeplanner geeft heen en terug net andere punten.
 */
export class Bezetting {
  constructor (celMm = 1) {
    this.celMm = celMm
    this.cellen = new Map()
  }

  sleutel (x, y) {
    return `${Math.round(x / this.celMm)},${Math.round(y / this.celMm)}`
  }

  /** Hoeveel routes er al door dit punt lopen. */
  aantalBij (x, y) {
    let meeste = 0
    // ook de buurcellen meetellen, anders mist hij een route die net een halve
    // cel verderop loopt
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const n = this.cellen.get(this.sleutel(x + dx * this.celMm, y + dy * this.celMm)) ?? 0
        if (n > meeste) meeste = n
      }
    }
    return meeste
  }

  /**
   * Legt beslag op de cellen langs deze lijn.
   *
   * Elke cel telt maar een keer mee, ook al lopen er tien meetpunten doorheen:
   * we willen weten hoeveel routes hier langskomen, niet hoeveel punten.
   *
   * Met `alGeteld` loopt dat ontdubbelen door over meerdere aanroepen heen.
   * Dat is nodig als een route stukje bij beetje beslag legt in plaats van in
   * één keer: zonder die gedeelde lijst telt elk segmentje apart, en loopt een
   * dicht bezette lijn op tot acht lagen waar er één hoort te staan.
   */
  leg (punten, alGeteld = null) {
    const geraakt = new Set()

    for (let i = 1; i < punten.length; i++) {
      const a = punten[i - 1]
      const b = punten[i]
      const lengte = Math.hypot(b.x - a.x, b.y - a.y)
      const stappen = Math.max(1, Math.ceil(lengte / (this.celMm / 2)))

      for (let s = 0; s <= stappen; s++) {
        const x = a.x + ((b.x - a.x) * s) / stappen
        const y = a.y + ((b.y - a.y) * s) / stappen
        geraakt.add(this.sleutel(x, y))
      }
    }

    for (const k of geraakt) {
      if (alGeteld) {
        if (alGeteld.has(k)) continue
        alGeteld.add(k)
      }
      this.cellen.set(k, (this.cellen.get(k) ?? 0) + 1)
    }
  }
}

/** Middelt een reeks getallen uit met zijn buren, zodat er geen sprongen zijn. */
function verzacht (waarden, straal) {
  const uit = new Array(waarden.length)
  for (let i = 0; i < waarden.length; i++) {
    let som = 0
    let n = 0
    for (let d = -straal; d <= straal; d++) {
      const j = i + d
      if (j < 0 || j >= waarden.length) continue
      som += waarden[j]
      n++
    }
    uit[i] = som / n
  }
  return uit
}

/** Van "hoeveelste ben ik hier" naar "hoeveel schuif ik opzij". */
function naarZijkant (n) {
  if (n === 0) return 0
  const stap = Math.ceil(n / 2)
  return (n % 2 === 1 ? 1 : -1) * stap
}

/**
 * Schuift elk punt haaks op de rijrichting opzij, zoveel als zijn laag aangeeft.
 *
 * De verschuiving wordt eerst uitgemiddeld, zodat een route die halverwege van
 * baan wisselt dat vloeiend doet in plaats van met een sprong.
 */
export function verschuifOpzij (punten, lagen, { afstandMm = 1.2, verzachting = 6 } = {}) {
  const zacht = verzacht(lagen.map(naarZijkant), verzachting)

  return punten.map((p, i) => {
    const vorige = punten[Math.max(0, i - 1)]
    const volgende = punten[Math.min(punten.length - 1, i + 1)]

    const dx = volgende.x - vorige.x
    const dy = volgende.y - vorige.y
    const lengte = Math.hypot(dx, dy) || 1

    // haaks op de rijrichting
    const nx = -dy / lengte
    const ny = dx / lengte
    const zij = zacht[i] * afstandMm

    return { x: p.x + nx * zij, y: p.y + ny * zij }
  })
}

/**
 * Legt deze route naast de routes die er al liggen, en legt daarna zelf beslag.
 *
 * De volgorde van verschuiven is 0, +1, -1, +2, -2: de eerste blijft op de weg
 * liggen, en daarna wisselen ze om de beurt van kant zodat het geheel om de
 * echte weg heen gecentreerd blijft.
 */
export function langsElkaar (punten, bezetting, { afstandMm = 1.2, verzachting = 6 } = {}) {
  if (punten.length < 2) return [...punten]

  // hoeveel routes er al over elk punt lopen
  const lagen = punten.map(p => bezetting.aantalBij(p.x, p.y))
  const uit = verschuifOpzij(punten, lagen, { afstandMm, verzachting })

  // beslag leggen op de oorspronkelijke weg, niet op de verschoven lijn: een
  // volgende route moet zich verhouden tot de weg, niet tot onze uitwijking
  bezetting.leg(punten)

  return uit
}

/**
 * Legt een route naast zichzelf waar hij over zijn eigen weg terugkomt.
 *
 * Op een dagkaart is het probleem net anders dan op de overzichtskaart: daar
 * botsen verschillende dagen, hier botst één route met zichzelf. Reed je een
 * doodlopende fjordweg in en er weer uit, dan ligt de terugweg precies op de
 * heenweg en zie je één lijn - alsof je er nooit gekeerd bent.
 *
 * De route wordt daarom van begin tot eind afgelopen, waarbij hij gaandeweg
 * beslag legt op de weg achter zich. Komt hij later op bezet terrein, dan is
 * dat zijn eigen heenweg en gaat hij ernaast liggen.
 *
 * De bezetting loopt bewust een stuk achter: `negeerMm` bepaalt hoeveel weg
 * vlak achter je niet meetelt. Zonder die achterstand zou elk punt zijn eigen
 * buren als bezet zien en zou de hele route wegdrijven van de weg.
 */
export function naastZichzelf (punten, {
  afstandMm = 1.2,
  celMm = null,
  verzachting = 6,
  negeerMm = 25
} = {}) {
  if (punten.length < 3) return [...punten]

  const bezetting = new Bezetting(celMm ?? afstandMm * 1.6)

  // de afgelegde weg op elk punt, om de achterstand in mm te kunnen meten
  const langs = [0]
  for (let i = 1; i < punten.length; i++) {
    langs.push(langs[i - 1] + Math.hypot(punten[i].x - punten[i - 1].x, punten[i].y - punten[i - 1].y))
  }

  // Eén gedeelde lijst voor de hele route, zodat een cel hooguit één laag
  // oplevert. De weg ligt er immers één keer; het gaat erom of je er later
  // nog eens overheen komt, niet hoeveel meetpunten er in die cel vielen.
  //
  // Gevolg: reed je een weg drie keer, dan liggen de tweede en de derde keer
  // op dezelfde baan naast de eerste. Op een dagkaart is dat prima - heen en
  // terug is verreweg het gewone geval.
  const alGeteld = new Set()

  const lagen = new Array(punten.length).fill(0)
  let achter = 1

  for (let i = 0; i < punten.length; i++) {
    // alles wat meer dan negeerMm terug ligt telt vanaf nu als bezet
    const grens = langs[i] - negeerMm
    while (achter < i && langs[achter] < grens) {
      bezetting.leg([punten[achter - 1], punten[achter]], alGeteld)
      achter++
    }

    lagen[i] = bezetting.aantalBij(punten[i].x, punten[i].y)
  }

  return verschuifOpzij(punten, lagen, { afstandMm, verzachting })
}
