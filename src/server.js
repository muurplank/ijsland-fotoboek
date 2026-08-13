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
import { readFile, writeFile } from 'node:fs/promises'
import { extname, join, normalize, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildDay } from './dayData.js'
import { achtergrondVoorStijl } from './render/basemap.js'
import { ijslandSilhouet } from './render/inset.js'
import { maakView } from './render/layout.js'
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
const dagCache = new Map()

async function dagGegevens (nummer, stijlOverschrijving) {
  const sleutel = `${nummer}:${JSON.stringify(stijlOverschrijving ?? {})}`
  if (!dagCache.has(sleutel)) {
    dagCache.set(sleutel, buildDay(nummer, {
      stijlOverschrijving,
      onProgress: b => process.stdout.write(`  ... ${b}\n`)
    }))
  }
  return dagCache.get(sleutel)
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

    // ------------------------------------------------------------ daggegevens
    if (pad === '/api/dag') {
      const nummer = Number(url.searchParams.get('dag') ?? 1)
      const d = await dagGegevens(nummer)
      return json(res, {
        dag: d.dag,
        boek: { titel: d.boek.titel, ondertitel: d.boek.ondertitel },
        stijl: d.stijl,
        route: { coordinates: d.route.coordinates, legs: d.route.legs },
        statistieken: d.statistieken,
        weer: d.weer,
        profiel: d.profiel,
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

      const view = maakView(d.route.coordinates, stijl)
      const r = await achtergrondVoorStijl({
        dem: d.dem, view, stijl, dpi,
        onProgress: b => process.stdout.write(`  ... ${typeof b === 'string' ? b : ''}\n`)
      })

      res.writeHead(200, {
        'content-type': 'image/png',
        'x-plaatsing': JSON.stringify({
          xMm: r.xMm, yMm: r.yMm, breedteMm: r.breedteMm, hoogteMm: r.hoogteMm,
          bronvermelding: r.bronvermelding
        }),
        'cache-control': 'no-store'
      })
      return res.end(r.png)
    }

    // ------------------------------------------------------- inzetkaartje
    if (pad === '/api/inzet') {
      const landKleur = url.searchParams.get('kleur') ?? '#e8e4dd'
      const silhouet = await ijslandSilhouet({
        landKleur,
        onProgress: (n, totaal) =>
          process.stdout.write(`  ... inzetkaartje (${typeof n === 'string' ? n : `${n}/${totaal}`})\n`)
      })

      res.writeHead(200, {
        'content-type': 'image/png',
        'x-bounds': JSON.stringify(silhouet.bounds),
        'cache-control': 'no-store'
      })
      return res.end(silhouet.png)
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

      dagCache.clear()
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
