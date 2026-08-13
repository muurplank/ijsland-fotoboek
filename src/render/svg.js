/**
 * De tekenlaag van de kaart: route, pijltjes en markers, allemaal in
 * millimeters op de pagina.
 *
 * Alles wat hier uitkomt gaat als vectoren de SVG in. In de PDF-export blijven
 * dat wiskundige vormen zonder resolutie, dus de routelijn en de pijltjes zijn
 * op elk formaat scherp - ongeacht wat de achtergrond doet.
 */

/** Coordinaten naar punten op de pagina. */
export function projecteer (coords, view) {
  return coords.map(([lon, lat]) => view.project(lon, lat))
}

/** Afronden op duizendsten van een millimeter; fijner ziet geen enkele pers. */
const rond = n => Math.round(n * 1000) / 1000

/** Punten naar de d-eigenschap van een SVG-pad. */
export function padData (punten) {
  if (!punten.length) return ''
  const stukken = punten.map((p, i) => `${i === 0 ? 'M' : 'L'} ${rond(p.x)} ${rond(p.y)}`)
  return stukken.join(' ')
}

/** Lengte van een reeks punten, in millimeters. */
export function lengteMm (punten) {
  let totaal = 0
  for (let i = 1; i < punten.length; i++) {
    totaal += Math.hypot(punten[i].x - punten[i - 1].x, punten[i].y - punten[i - 1].y)
  }
  return totaal
}

/**
 * Pijltjes met een vaste tussenafstand in millimeters op papier.
 *
 * Bewust op papier gemeten en niet in kilometers over de grond: zo staan ze
 * altijd even ver uit elkaar in het boek, ongeacht hoe ver je die dag reed.
 * Het eerste pijltje staat een halve tussenafstand na de start, zodat er nooit
 * eentje onder de startmarker verdwijnt.
 */
export function pijltjesLangs (punten, afstandMm) {
  if (afstandMm <= 0 || punten.length < 2) return []

  const totaal = lengteMm(punten)
  const uit = []

  let segment = 1
  let afgelegd = 0 // aan het begin van het huidige segment

  for (let doel = afstandMm / 2; doel < totaal; doel += afstandMm) {
    while (segment < punten.length - 1) {
      const l = Math.hypot(
        punten[segment].x - punten[segment - 1].x,
        punten[segment].y - punten[segment - 1].y
      )
      if (afgelegd + l >= doel) break
      afgelegd += l
      segment++
    }

    const a = punten[segment - 1]
    const b = punten[segment]
    const l = Math.hypot(b.x - a.x, b.y - a.y)
    const deel = l === 0 ? 0 : (doel - afgelegd) / l

    uit.push({
      x: a.x + (b.x - a.x) * deel,
      y: a.y + (b.y - a.y) * deel,
      hoek: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
    })
  }

  return uit
}

/**
 * Gooit punten weg die binnen de tolerantie op dezelfde plek liggen
 * (Douglas-Peucker). Een route van duizenden punten wordt zo een paar honderd,
 * zonder dat je op papier het verschil ziet - dat scheelt fors in de omvang van
 * de PDF, en de browser hoeft minder te tekenen bij elke draai aan een knop.
 */
export function vereenvoudig (punten, tolerantieMm) {
  if (punten.length < 3) return [...punten]

  const houden = new Uint8Array(punten.length)
  houden[0] = 1
  houden[punten.length - 1] = 1

  const stapel = [[0, punten.length - 1]]

  while (stapel.length) {
    const [begin, eind] = stapel.pop()
    const a = punten[begin]
    const b = punten[eind]

    const dx = b.x - a.x
    const dy = b.y - a.y
    const lengte = Math.hypot(dx, dy)

    let verste = -1
    let versteAfstand = 0

    for (let i = begin + 1; i < eind; i++) {
      const p = punten[i]
      const afstand = lengte === 0
        ? Math.hypot(p.x - a.x, p.y - a.y)
        : Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / lengte

      if (afstand > versteAfstand) {
        versteAfstand = afstand
        verste = i
      }
    }

    if (versteAfstand > tolerantieMm) {
      houden[verste] = 1
      stapel.push([begin, verste], [verste, eind])
    }
  }

  return punten.filter((_, i) => houden[i])
}
