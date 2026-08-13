/**
 * De route over echte wegen.
 *
 * Jij geeft een lijstje coordinaten in de volgorde waarin je gereden bent; de
 * routeplanner maakt daar de snelste route tussen. OSRM is gekozen omdat er geen
 * account voor nodig is. Wisselen van planner raakt alleen dit bestand.
 */

import { cached, fetchWithRetry } from './cache.js'

const OSRM = 'https://router.project-osrm.org/route/v1/driving'

export function osrmUrl (waypoints) {
  if (!waypoints || waypoints.length < 2) {
    throw new Error('Een route heeft minstens twee punten nodig')
  }
  const punten = waypoints.map(w => `${w.lon},${w.lat}`).join(';')
  return `${OSRM}/${punten}?overview=full&geometries=geojson&steps=false`
}

/** Vertaalt het antwoord van de routeplanner naar wat de rest van het project gebruikt. */
export function parseOsrmRoute (antwoord, waypoints) {
  if (antwoord.code !== 'Ok' || !antwoord.routes?.length) {
    throw new Error(
      `De routeplanner vond geen route tussen deze punten (${antwoord.code ?? 'onbekende fout'}). ` +
      'Ligt een van de coordinaten misschien niet op een weg?'
    )
  }

  const route = antwoord.routes[0]

  return {
    coordinates: route.geometry.coordinates,
    distanceKm: route.distance / 1000,
    durationHours: route.duration / 3600,
    legs: (route.legs ?? []).map((leg, i) => ({
      from: waypoints[i]?.name ?? `punt ${i + 1}`,
      to: waypoints[i + 1]?.name ?? `punt ${i + 2}`,
      distanceKm: leg.distance / 1000,
      durationHours: leg.duration / 3600
    }))
  }
}

/** Haalt de route op (of pakt hem uit de cache) voor deze reeks punten. */
export async function fetchRoute (waypoints) {
  const identiteit = ['osrm', waypoints.map(w => [w.lon, w.lat])]

  return cached('route', identiteit, async () => {
    const antwoord = await fetchWithRetry(osrmUrl(waypoints))
    return parseOsrmRoute(await antwoord.json(), waypoints)
  })
}
