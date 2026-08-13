/**
 * Afstanden en posities langs de route.
 *
 * Alle coordinaten zijn [lengtegraad, breedtegraad] in graden, net als GeoJSON.
 * Alle afstanden zijn meters.
 */

/** Straal van de aarde, gemiddeld. */
const R = 6371008.8

/** Hoogteverschillen kleiner dan dit zijn meetruis, geen klim. */
const KLIM_DREMPEL_M = 2

const rad = deg => (deg * Math.PI) / 180
const deg = r => (r * 180) / Math.PI

/** Hemelsbrede afstand tussen twee punten. */
export function distance ([lon1, lat1], [lon2, lat2]) {
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Afgelegde afstand op elk punt van de lijn, beginnend bij nul. */
export function cumulative (coords) {
  const out = [0]
  for (let i = 1; i < coords.length; i++) {
    out.push(out[i - 1] + distance(coords[i - 1], coords[i]))
  }
  return out
}

export function totalDistance (coords) {
  if (coords.length < 2) return 0
  const c = cumulative(coords)
  return c[c.length - 1]
}

/** Richting van punt a naar punt b, in graden vanaf het noorden met de klok mee. */
function heading ([lon1, lat1], [lon2, lat2]) {
  const dLon = rad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(rad(lat2))
  const x =
    Math.cos(rad(lat1)) * Math.sin(rad(lat2)) -
    Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(dLon)
  return (deg(Math.atan2(y, x)) + 360) % 360
}

/**
 * Het punt dat op de gegeven afgelegde afstand langs de lijn ligt, met de
 * richting waarin je daar rijdt. Voorbij het einde blijft het op het eindpunt.
 */
export function pointAtDistance (coords, meters) {
  if (coords.length === 0) return null
  if (coords.length === 1) {
    return { lon: coords[0][0], lat: coords[0][1], heading: 0, distance: 0 }
  }

  const c = cumulative(coords)
  const eind = c[c.length - 1]
  const doel = Math.max(0, Math.min(meters, eind))

  // zoek het segment waar het doel in valt
  let i = 1
  while (i < c.length - 1 && c[i] < doel) i++

  const vanaf = coords[i - 1]
  const naar = coords[i]
  const segLengte = c[i] - c[i - 1]
  const deel = segLengte === 0 ? 0 : (doel - c[i - 1]) / segLengte

  return {
    lon: vanaf[0] + (naar[0] - vanaf[0]) * deel,
    lat: vanaf[1] + (naar[1] - vanaf[1]) * deel,
    heading: heading(vanaf, naar),
    distance: doel
  }
}

/**
 * Punten met een vaste tussenafstand langs de route, voor de richtingspijltjes.
 * Het eerste pijltje staat een halve tussenafstand na de start, zodat er nooit
 * een pijltje bovenop de startmarker valt.
 */
export function pointsEvery (coords, spacingMeters) {
  if (spacingMeters <= 0) return []
  const eind = totalDistance(coords)
  const out = []
  for (let d = spacingMeters / 2; d < eind; d += spacingMeters) {
    out.push(pointAtDistance(coords, d))
  }
  return out
}

/**
 * Totale stijging over een reeks hoogtes. Kleine schommelingen tellen niet mee,
 * anders maakt de meetruis van het hoogtemodel van een vlakke weg een bergetappe.
 */
export function climb (elevations) {
  let totaal = 0
  let referentie = elevations[0]
  for (const h of elevations) {
    const verschil = h - referentie
    if (verschil >= KLIM_DREMPEL_M) {
      totaal += verschil
      referentie = h
    } else if (verschil < 0) {
      referentie = h
    }
  }
  return totaal
}
