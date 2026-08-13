/**
 * Alles bij elkaar rapen wat er voor een dag nodig is: de route over de weg, de
 * hoogtes daarlangs, het weer, en de afgeleide statistieken.
 */

import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchRoute } from './fetch/route.js'
import { fetchDem } from './fetch/elevation.js'
import { fetchWeather } from './fetch/weather.js'
import { climb, pointAtDistance, totalDistance } from './geo/measure.js'
import { boundsOf, expandBounds, MapView } from './geo/viewport.js'
import { mergeStijl } from './style.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export async function loadDay (nummer) {
  const naam = String(nummer).padStart(2, '0')
  return JSON.parse(await readFile(join(ROOT, 'data', 'days', `day-${naam}.json`), 'utf8'))
}

export async function loadBook () {
  return JSON.parse(await readFile(join(ROOT, 'data', 'book.json'), 'utf8'))
}

/**
 * Verdeelt de route in gelijke stappen en leest op elk punt de hoogte af.
 * Gelijke stappen, want anders zit het hoogteprofiel vol met meetpunten waar de
 * weg toevallig veel bochten had.
 */
export function sampleProfile (coords, dem, aantal = 400) {
  const lengte = totalDistance(coords)
  const punten = []

  for (let i = 0; i < aantal; i++) {
    const afstand = (lengte * i) / (aantal - 1)
    const p = pointAtDistance(coords, afstand)
    punten.push({
      afstandKm: afstand / 1000,
      hoogteM: dem.elevationAt(p.lon, p.lat),
      lon: p.lon,
      lat: p.lat
    })
  }

  return punten
}

/**
 * Haalt alles op voor een dag. De zware onderdelen komen uit de cache zodra ze
 * een keer opgehaald zijn.
 */
export async function buildDay (nummer, { onProgress = () => {} } = {}) {
  const boek = await loadBook()
  const dag = await loadDay(nummer)
  const { stijl, genegeerd } = mergeStijl(boek.stijl, dag.stijl)

  onProgress('route berekenen over de weg')
  const route = await fetchRoute(dag.waypoints)

  // Bepaal de uitsnede eerst, want daaruit volgt hoe fijn de hoogtes moeten zijn
  const view = MapView.fit(route.coordinates, {
    widthMm: stijl['pagina.breedteMm'],
    heightMm: stijl['pagina.hoogteMm'],
    paddingMm: stijl['uitsnede.margeMm'],
    zoom: stijl['uitsnede.zoom'],
    panXMm: stijl['uitsnede.panXMm'],
    panYMm: stijl['uitsnede.panYMm']
  })

  // Genoeg hoogtepunten voor een vloeiend relief op drukresolutie
  const metersPerMm = view.metersPerMm()
  const metersPerPixel = metersPerMm / (stijl['pagina.dpi'] / 25.4)

  const zicht = expandBounds(view.visibleBounds(), 0.05)
  onProgress('hoogtes ophalen')
  const dem = await fetchDem(zicht, {
    metersPerPixel,
    maxZoom: stijl['relief.detailZoom'],
    onProgress: (n, totaal) =>
      onProgress(typeof n === 'string' ? n : `hoogtes ophalen (${n}/${totaal} tegels)`)
  })

  const profiel = sampleProfile(route.coordinates, dem)
  const hoogtes = profiel.map(p => p.hoogteM).filter(h => h !== null)

  onProgress('weer opzoeken')
  const midden = pointAtDistance(route.coordinates, totalDistance(route.coordinates) / 2)
  let weer = dag.weer ?? null
  if (!weer) {
    try {
      weer = await fetchWeather(midden.lat, midden.lon, dag.datum)
    } catch (fout) {
      weer = null
      onProgress(`weer niet gelukt: ${fout.message}`)
    }
  }

  return {
    dag,
    boek,
    stijl,
    genegeerd,
    route,
    view,
    dem,
    profiel,
    weer,
    bounds: boundsOf(route.coordinates),
    statistieken: {
      afstandKm: route.distanceKm,
      rijtijdUren: route.durationHours,
      hoogstePuntM: hoogtes.length ? Math.max(...hoogtes) : null,
      laagstePuntM: hoogtes.length ? Math.min(...hoogtes) : null,
      stijgingM: climb(hoogtes)
    }
  }
}
