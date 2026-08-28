/**
 * Een vlak volgetekend met hoogtelijnen: geneste kringen die om elkaar heen
 * lopen en nooit kruisen.
 *
 * Bedoeld als vulling van een klein vak - de voortgangsbalk in veldnotitie-stijl
 * - waar een effen kleur te vlak is en arcering te regelmatig. Hoogtelijnen zijn
 * het patroon dat in dit boek sowieso al overal ligt: op de kaart, in het
 * hoogteprofiel, in de stempels. In de balk gaat het niet over echte hoogte,
 * maar het is wel dezelfde hand.
 *
 * Waarom niet gewoon een stapel ellipsen: die kruisen elkaar zodra er twee
 * naast elkaar staan, en kruisende hoogtelijnen bestaan niet. Je oog weet dat,
 * ook zonder het te kunnen benoemen, en dan valt het uit elkaar in losse ovalen.
 * Dus tekenen we een echt hoogteveld - een paar heuvels bij elkaar opgeteld - en
 * halen daar met marching squares de lijnen van gelijke hoogte uit. Twee heuvels
 * die tegen elkaar aan liggen smelten dan samen tot één lus, precies zoals op
 * een echte kaart.
 *
 * Waarom knopen als gewone objecten en geen SVG-elementen: zelfde reden als bij
 * papier.js en profielvorm.js - dan is het zonder browser te testen, en de
 * pagina's zetten het met bouwSvg() om in echte elementen.
 */

import { isoStreepjes, rijg, verzacht } from './isolijn.js'

/** Afronden op duizendsten van een millimeter; fijner ziet geen enkele pers. */
const rond = n => Math.round(n * 1000) / 1000

/**
 * Het hoogteveld: een paar heuvels bij elkaar opgeteld, met een trage golf
 * eroverheen zodat de kringen niet allemaal even braaf rond worden.
 */
function heuvelVeld (breedteMm, hoogteMm, rnd, ruwheid) {
  // hoeveel heuvels er in het vak passen: een liggend strookje krijgt er meer
  // dan een vierkantje, anders staan de kringen uitgerekt tot streepjes
  const aantal = Math.max(2, Math.min(7, Math.round(breedteMm / (hoogteMm * 1.6))))
  const toppen = []

  for (let i = 0; i < aantal; i++) {
    toppen.push({
      cx: breedteMm * ((i + 0.5) / aantal + (rnd() - 0.5) * 0.7 / aantal),
      cy: hoogteMm * (0.28 + rnd() * 0.44),
      sx: hoogteMm * (0.85 + rnd() * 1.3),
      sy: hoogteMm * (0.34 + rnd() * 0.3),
      top: 0.55 + rnd() * 0.85
    })
  }

  // drie golven met een eigen fase: dit is wat een kring een kaart laat lijken
  // in plaats van een ellips
  const golven = [1, 2, 3].map(k => ({
    fx: (0.9 + rnd() * 1.4) * k / Math.max(1, hoogteMm),
    fy: (0.7 + rnd() * 1.6) * k / Math.max(1, hoogteMm),
    fase: rnd() * Math.PI * 2,
    amp: ruwheid * 0.22 / k
  }))

  return (x, y) => {
    let h = 0
    for (const t of toppen) {
      const dx = (x - t.cx) / t.sx
      const dy = (y - t.cy) / t.sy
      h += t.top * Math.exp(-(dx * dx + dy * dy))
    }
    for (const g of golven) {
      h += g.amp * Math.sin(x * g.fx + y * g.fy + g.fase)
    }
    return h
  }
}

/**
 * Het vak volgetekend met hoogtelijnen.
 *
 * @param {object} opties
 * @param {number} opties.breedteMm  maat van het vak
 * @param {number} opties.hoogteMm
 * @param {number} [opties.x]        waar het vak op de pagina staat
 * @param {number} [opties.y]
 * @param {Function} opties.rnd      gezaaide toevalsgenerator; zelfde zaad, zelfde vulling
 * @param {string} opties.kleur      de inkt
 * @param {number} [opties.lijnMm]   dikte van een hoogtelijn
 * @param {number} [opties.dekking]
 * @param {number} [opties.lijnen]   hoeveel hoogtes er getekend worden
 * @param {number} [opties.ruwheid]  0 geeft nette kringen, 1 een grillige kaart
 * @returns {Array<{tag:string, attr:object}>} knopen voor bouwSvg()
 */
export function hoogtelijnKnopen ({
  breedteMm, hoogteMm, x = 0, y = 0, rnd,
  kleur, lijnMm = 0.16, dekking = 0.85, lijnen = 9, ruwheid = 0.5
}) {
  if (!(breedteMm > 0) || !(hoogteMm > 0)) return []

  // fijn genoeg dat de trapjes onder de lijndikte blijven, grof genoeg dat een
  // paginabrede strook geen tienduizenden cellen kost
  const stap = Math.max(0.25, Math.min(0.6, hoogteMm / 14))
  const kolommen = Math.ceil(breedteMm / stap) + 1
  const rijen = Math.ceil(hoogteMm / stap) + 1

  const veld = heuvelVeld(breedteMm, hoogteMm, rnd, ruwheid)
  const rooster = new Float64Array(kolommen * rijen)
  let laagste = Infinity
  let hoogste = -Infinity

  for (let j = 0; j < rijen; j++) {
    for (let i = 0; i < kolommen; i++) {
      const h = veld(i * stap, j * stap)
      rooster[j * kolommen + i] = h
      if (h < laagste) laagste = h
      if (h > hoogste) hoogste = h
    }
  }
  if (!(hoogste > laagste)) return []

  const knopen = []
  for (let n = 1; n <= lijnen; n++) {
    // de onderste en de bovenste hoogte slaan we over: die liggen zo dicht op
    // de rand van het veld dat er rafels van komen
    const niveau = laagste + (hoogste - laagste) * (n / (lijnen + 1))

    for (const lijn of rijg(isoStreepjes(rooster, kolommen, rijen, stap, niveau))) {
      if (lijn.length < 3) continue
      const zacht = verzacht(lijn)
      const gesloten =
        Math.hypot(zacht[0].x - zacht.at(-1).x, zacht[0].y - zacht.at(-1).y) < stap * 0.75

      const d = zacht
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${rond(p.x + x)} ${rond(p.y + y)}`)
        .join(' ')

      knopen.push({
        tag: 'path',
        attr: {
          d: gesloten ? `${d} Z` : d,
          fill: 'none',
          stroke: kleur,
          'stroke-width': rond(lijnMm),
          'stroke-opacity': rond(dekking),
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round'
        }
      })
    }
  }

  return knopen
}
