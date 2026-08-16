/**
 * De previewserver.
 *
 * Serveert de kaartpagina met het bedieningspaneel ernaast. De pagina zelf is
 * exact wat er straks geprint wordt; het paneel staat er alleen omheen en gaat
 * bij het exporteren gewoon niet mee.
 *
 * De reliefachtergrond komt van de server (daar zit het hoogtemodel), al het
 * andere - route, pijltjes, markers, labels, typografie - tekent de browser
 * zelf. Daardoor reageren de meeste knoppen direct, zonder wachten.
 *
 *   npm run dev
 */

import { createServer } from 'node:http'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join, normalize, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { maakDagCache } from './dagCache.js'
import { fetchRoute } from './fetch/route.js'
import { achtergrondVoorStijl } from './render/basemap.js'
import { ijslandSilhouet } from './render/inset.js'
import { maakView } from './render/layout.js'
import { fetchDem } from './fetch/elevation.js'
import { expandBounds } from './geo/viewport.js'
import { mergeStijl } from './style.js'
import { GROEPEN, KNOPPEN } from './styleSchema.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const POORT = Number(process.env.PORT ?? 4321)

/** Resolutie voor de preview. Laag genoeg om vlot te draaien aan de knoppen. */
const PREVIEW_DPI = 110

const MIMES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
}

/** Onthoudt de opgehaalde daggegevens, zodat draaien aan een knop niet opnieuw downloadt. */
const dagCache = maakDagCache()

/** De laatst gemaakte laag met opgetilde plaatsnamen. */
let bovenlaagCache = null

async function dagGegevens (nummer, stijlOverschrijving) {
  return dagCache.dag(nummer, {
    stijlOverschrijving,
    onProgress: b => process.stdout.write(`  ... ${b}\n`)
  })
}

/** Alle dagbestanden, op volgorde. */
async function alleDagen () {
  const bestanden = (await readdir(join(ROOT, 'data', 'days')))
    .filter(b => /^day-\d+\.json$/.test(b))
    .sort()

  const uit = []
  for (const b of bestanden) {
    uit.push(JSON.parse(await readFile(join(ROOT, 'data', 'days', b), 'utf8')))
  }
  return uit
}

/**
 * Waar je de nacht voor deze dag sliep.
 *
 * De dagkaart tekent op het vertrekpunt hetzelfde icoon als waar je die nacht
 * lag - een tent, een huisje, een auto - want daar kwam je 's ochtends uit.
 * Dat wordt hier afgeleid en niet in het dagbestand overgetypt: verplaats je de
 * overnachting van dag 3, dan volgt het vertrekpunt van dag 4 vanzelf.
 *
 * Of het punt werkelijk samenvalt met het vertrek beoordeelt de tekenlaag; hier
 * gaat alleen mee waar en wat het was.
 */
async function vorigeNacht (nummer) {
  if (nummer <= 1) return null

  const vorige = (await alleDagen()).find(d => d.dag === nummer - 1)
  const laatste = vorige?.waypoints?.at(-1)
  if (!laatste?.verblijf) return null

  return {
    verblijf: laatste.verblijf,
    name: laatste.name ?? '',
    lat: laatste.lat,
    lon: laatste.lon
  }
}

/** De routepunten van de hele reis achter elkaar. */
let reisCoordsCache = null
async function heleReisCoords () {
  if (reisCoordsCache) return reisCoordsCache
  const coords = []
  for (const dag of await alleDagen()) {
    const route = await fetchRoute(dag.waypoints)
    coords.push(...route.coordinates)
  }
  reisCoordsCache = coords
  return coords
}

/** Het hoogteraster voor de overzichtskaart, over de hele reis. */
let reisDemCache = null
async function reisDem (stijl, view) {
  const detail = stijl['relief.detailZoom']
  if (reisDemCache?.detail === detail) return reisDemCache.dem

  const zicht = expandBounds(view.visibleBounds(), 0.05)
  const metersPerPixel = view.metersPerMm() / (stijl['pagina.dpi'] / 25.4)

  const dem = await fetchDem(zicht, {
    metersPerPixel,
    maxZoom: detail,
    onProgress: (n, totaal) =>
      process.stdout.write(`  ... overzicht (${typeof n === 'string' ? n : `${n}/${totaal}`})\n`)
  })

  reisDemCache = { detail, dem }
  return dem
}

/**
 * Past een hernoemde plek ook aan op de andere dagen.
 *
 * Twee punten zijn dezelfde plek als ze binnen ongeveer zestig meter van elkaar
 * liggen: ruim genoeg voor een parkeerplaats of een hotelingang die je op twee
 * dagen net iets anders hebt aangetikt, krap genoeg om niet per ongeluk de
 * buurman te hernoemen.
 */
async function hernoemOveral (hernoemd, behalveDag) {
  const GRENS_GRADEN = 0.0006 // ongeveer zestig meter
  const aangepast = []

  for (const dag of await alleDagen()) {
    if (dag.dag === Number(behalveDag)) continue

    let veranderd = false
    for (const w of dag.waypoints) {
      for (const { w: nieuw, oud } of hernoemd) {
        // Een lege naam nooit doorzetten. Anders maakt één misplaatste
        // backspace in de preview van één label een wijziging in meerdere
        // dagbestanden tegelijk - en dat is niet terug te draaien met Escape.
        if (!nieuw.name?.trim()) continue
        if (w.name !== oud.name) continue
        if (Math.abs(w.lat - nieuw.lat) > GRENS_GRADEN) continue
        if (Math.abs(w.lon - nieuw.lon) > GRENS_GRADEN) continue
        w.name = nieuw.name
        veranderd = true
      }
    }

    if (veranderd) {
      const naam = String(dag.dag).padStart(2, '0')
      await writeFile(join(ROOT, 'data', 'days', `day-${naam}.json`),
        JSON.stringify(dag, null, 2) + '\n')
      aangepast.push(dag.dag)
    }
  }

  return aangepast
}

function json (res, waarde, status = 200) {
  const body = JSON.stringify(waarde)
  res.writeHead(status, { 'content-type': MIMES['.json'], 'content-length': Buffer.byteLength(body) })
  res.end(body)
}

async function leesBody (req) {
  const stukken = []
  for await (const s of req) stukken.push(s)
  return JSON.parse(Buffer.concat(stukken).toString() || '{}')
}

/** Serveert een bestand uit het project, zonder buiten de projectmap te kunnen kijken. */
async function bestand (res, relatief) {
  const pad = join(ROOT, normalize(relatief).replace(/^(\.\.[/\\])+/, ''))
  if (!pad.startsWith(ROOT)) {
    res.writeHead(403).end('Niet toegestaan')
    return
  }
  try {
    const inhoud = await readFile(pad)
    res.writeHead(200, { 'content-type': MIMES[extname(pad)] ?? 'application/octet-stream' })
    res.end(inhoud)
  } catch {
    res.writeHead(404).end('Niet gevonden')
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${POORT}`)
  const pad = url.pathname

  try {
    // ---------------------------------------------------------------- pagina
    if (pad === '/') return bestand(res, 'src/pages/preview.html')

    // ---------------------------------------------------------------- schema
    if (pad === '/api/schema') return json(res, { groepen: GROEPEN, knoppen: KNOPPEN })

    // ------------------------------------------------------------- kleurensets
    if (pad === '/api/presets') {
      const map = join(ROOT, 'data', 'presets')
      const uit = []
      for (const b of (await readdir(map)).filter(b => b.endsWith('.json')).sort()) {
        uit.push(JSON.parse(await readFile(join(map, b), 'utf8')))
      }
      return json(res, uit)
    }

    // ------------------------------------------------------- welke dagen zijn er
    if (pad === '/api/dagen') {
      const dagen = (await alleDagen()).map(d => ({ dag: d.dag, datum: d.datum, titel: d.titel }))
      return json(res, dagen)
    }

    // ------------------------------------------------- de hele reis in een keer
    if (pad === '/api/reis') {
      const uit = []
      for (const dag of await alleDagen()) {
        const route = await fetchRoute(dag.waypoints)
        uit.push({
          dag: dag.dag,
          datum: dag.datum,
          titel: dag.titel,
          coordinates: route.coordinates,
          afstandKm: route.distanceKm,
          waypoints: dag.waypoints.filter(w => w.type !== 'via')
        })
      }
      return json(res, uit)
    }

    // -------------------------------------------- cijfers van de hele reis
    if (pad === '/api/reis-cijfers') {
      const dagen = []
      for (const kort of await alleDagen()) {
        const d = await dagGegevens(kort.dag)
        dagen.push({
          dag: d.dag.dag,
          datum: d.dag.datum,
          titel: d.dag.titel,
          statistieken: d.statistieken,
          weer: d.weer,
          // uitgedund: voor een profiel over tweeduizend kilometer is elk
          // vierde meetpunt ruim genoeg, en het scheelt fors in de overdracht
          profiel: d.profiel.filter((_, i) => i % 4 === 0)
        })
      }
      return json(res, dagen)
    }

    // ------------------------------------------------------------ daggegevens
    if (pad === '/api/dag') {
      const nummer = Number(url.searchParams.get('dag') ?? 1)
      const d = await dagGegevens(nummer)
      return json(res, {
        dag: d.dag,
        boek: {
          titel: d.boek.titel,
          ondertitel: d.boek.ondertitel,
          plaatsing: d.boek.plaatsing,
          overzicht: d.boek.overzicht,
          bron: d.boek.bron
        },
        stijl: d.stijl,
        // zonder de afwijkingen van deze dag: de overzichtskaart hoort niet de
        // satellietstijl van dag 1 over te nemen
        boekStijl: mergeStijl(d.boek.stijl).stijl,
        route: { coordinates: d.route.coordinates, legs: d.route.legs },
        statistieken: d.statistieken,
        weer: d.weer,
        profiel: d.profiel,
        vorigeNacht: await vorigeNacht(nummer),
        genegeerd: d.genegeerd
      })
    }

    // -------------------------------------------------------- achtergrondbeeld
    if (pad === '/api/achtergrond') {
      const nummer = Number(url.searchParams.get('dag') ?? 1)
      const dpi = Number(url.searchParams.get('dpi') ?? PREVIEW_DPI)

      const d = await dagGegevens(nummer)
      const eigen = JSON.parse(url.searchParams.get('stijl') ?? '{}')
      const { stijl } = mergeStijl(d.boek.stijl, d.dag.stijl, eigen)

      // de overzichtskaart beslaat de hele reis, dus een eigen uitsnede en
      // een eigen, ruimer hoogteraster
      const overzicht = url.searchParams.get('overzicht') === '1'
      const coords = overzicht ? await heleReisCoords() : d.route.coordinates
      const view = maakView(coords, stijl)
      const dem = overzicht ? await reisDem(stijl, view) : d.dem

      const r = await achtergrondVoorStijl({
        dem, view, stijl, dpi, route: coords,
        onProgress: b => process.stdout.write(`  ... ${typeof b === 'string' ? b : ''}\n`)
      })

      // De opgetilde plaatsnamen worden apart opgehaald; hier alleen melden dat
      // ze er zijn, zodat de pagina weet of hij die laag moet ophalen.
      bovenlaagCache = r.bovenPng ?? null

      res.writeHead(200, {
        'content-type': 'image/png',
        'x-plaatsing': JSON.stringify({
          xMm: r.xMm, yMm: r.yMm, breedteMm: r.breedteMm, hoogteMm: r.hoogteMm,
          bronvermelding: r.bronvermelding,
          bovenlaag: !!r.bovenPng
        }),
        'cache-control': 'no-store'
      })
      return res.end(r.png)
    }

    // ------------------------------------------- opgetilde plaatsnamen
    if (pad === '/api/bovenlaag') {
      if (!bovenlaagCache) { res.writeHead(204).end(); return }
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' })
      return res.end(bovenlaagCache)
    }

    // ------------------------------------------------------- inzetkaartje
    if (pad === '/api/inzet') {
      const getal = (naam, terug) => {
        const v = Number(url.searchParams.get(naam))
        return Number.isFinite(v) ? v : terug
      }

      const landKleur = url.searchParams.get('kleur') ?? '#e8e4dd'
      const silhouet = await ijslandSilhouet({
        landKleur,
        kustKleur: url.searchParams.get('kust') ?? landKleur,
        kustMm: getal('kustMm', 0),
        // de breedte waarop het kaartje straks staat: daarmee wordt de dikte van
        // de kustrand van millimeters naar beeldpunten omgerekend
        breedteMm: getal('mm', 46),
        onProgress: (n, totaal) =>
          process.stdout.write(`  ... inzetkaartje (${typeof n === 'string' ? n : `${n}/${totaal}`})\n`)
      })

      res.writeHead(200, {
        'content-type': 'image/png',
        'x-bounds': JSON.stringify(silhouet.bounds),
        'x-kust': String(silhouet.kustPx),
        'cache-control': 'no-store'
      })
      return res.end(silhouet.png)
    }

    // ----------------------------------------------------------- opmaak opslaan
    //
    // Verschoven onderdelen en aangepaste teksten gaan terug naar het dagbestand,
    // zodat ze een herstart overleven en gewoon in git staan.
    if (pad === '/api/opmaak' && req.method === 'POST') {
      const { dag, titel, tekst, waypoints, plaatsing, boek } = await leesBody(req)

      const naam = String(dag).padStart(2, '0')
      const bestandsnaam = join(ROOT, 'data', 'days', `day-${naam}.json`)
      const inhoud = JSON.parse(await readFile(bestandsnaam, 'utf8'))

      const oudeWaypoints = inhoud.waypoints

      if (titel !== undefined) inhoud.titel = titel
      if (tekst !== undefined) inhoud.tekst = tekst
      if (waypoints) inhoud.waypoints = waypoints
      if (plaatsing) inhoud.plaatsing = plaatsing

      await writeFile(bestandsnaam, JSON.stringify(inhoud, null, 2) + '\n')

      // Een plek die je hernoemt, hernoemen we overal.
      //
      // Dagen delen punten: het hotel waar dag 3 eindigt is waar dag 4 begint.
      // Pas je die naam op één dag aan, dan hoort hij niet op de volgende dag
      // nog de oude te heten.
      if (waypoints) {
        const hernoemd = waypoints
          .map((w, i) => ({ w, oud: oudeWaypoints?.[i] }))
          .filter(({ w, oud }) => oud && w.name !== oud.name)

        if (hernoemd.length) {
          const meegegaan = await hernoemOveral(hernoemd, dag)
          if (meegegaan.length) {
            console.log(`  ... naam ook aangepast op dag ${meegegaan.join(', ')}`)
          }
        }
      }

      if (boek) {
        const boekBestand = join(ROOT, 'data', 'book.json')
        const b = JSON.parse(await readFile(boekBestand, 'utf8'))
        if (boek.plaatsing) b.plaatsing = boek.plaatsing
        if (boek.overzicht) b.overzicht = boek.overzicht
        if (boek.bron) b.bron = boek.bron
        await writeFile(boekBestand, JSON.stringify(b, null, 2) + '\n')
      }

      dagCache.leeg()
      return json(res, { opgeslagen: true })
    }

    // ------------------------------------------------------- instellingen opslaan
    if (pad === '/api/stijl' && req.method === 'POST') {
      const { niveau, dag, stijl } = await leesBody(req)

      if (niveau === 'dag') {
        const naam = String(dag).padStart(2, '0')
        const bestandsnaam = join(ROOT, 'data', 'days', `day-${naam}.json`)
        const inhoud = JSON.parse(await readFile(bestandsnaam, 'utf8'))
        inhoud.stijl = stijl
        await writeFile(bestandsnaam, JSON.stringify(inhoud, null, 2) + '\n')
      } else {
        const bestandsnaam = join(ROOT, 'data', 'book.json')
        const inhoud = JSON.parse(await readFile(bestandsnaam, 'utf8'))
        inhoud.stijl = stijl
        await writeFile(bestandsnaam, JSON.stringify(inhoud, null, 2) + '\n')
      }

      dagCache.leeg()
      return json(res, { opgeslagen: true })
    }

    // ------------------------------------------------------------- bronbestanden
    if (pad.startsWith('/src/')) return bestand(res, pad.slice(1))

    res.writeHead(404).end('Niet gevonden')
  } catch (fout) {
    console.error(fout)
    json(res, { fout: fout.message }, 500)
  }
})

server.listen(POORT, () => {
  console.log(`
  IJsland-fotoboek draait op http://localhost:${POORT}

  De pagina die je ziet is exact wat er geprint wordt.
  Draai aan de knoppen; met "Bewaren" leg je ze vast voor de export.
`)
})
