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
import { exporteer, PAGINA_TYPES } from './export.js'
import { fetchRoute } from './fetch/route.js'
import { achtergrondVoorStijl } from './render/basemap.js'
import { ijslandKust, ijslandSilhouet } from './render/inset.js'
import { maakView, voorbladView } from './render/layout.js'
import { fetchDem } from './fetch/elevation.js'
import { haalPlaatsen } from './fetch/plaatsen.js'
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
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
}

/** Onthoudt de opgehaalde daggegevens, zodat draaien aan een knop niet opnieuw downloadt. */
const dagCache = maakDagCache()

/** De laatst gemaakte laag met opgetilde plaatsnamen. */
let bovenlaagCache = null

/**
 * De instellingen die bij een lopende export horen.
 *
 * De exportpagina wordt door Chromium geopend en niet door jouw tabblad, dus die
 * weet niets van de knoppen waar je net aan gedraaid hebt. Daarom legt de knop ze
 * hier neer en haalt de exportpagina ze op met het kaartje dat in zijn adres
 * staat. Ze gaan er meteen na afloop weer uit.
 */
const exportStijlen = new Map()
let exportTeller = 0

/** Eén export tegelijk: twee keer Chromium op 600 dpi is vragen om geheugennood. */
let exportBezig = false

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

/**
 * Een getal uit de adresregel, of de standaardwaarde als het er niet staat.
 *
 * De valstrik zit in Number(null), en dat is nul en niet NaN. Een controle op
 * Number.isFinite alleen laat een ontbrekende parameter dus als nul door in
 * plaats van als afwezig - waarmee de standaardwaarde nooit gebruikt wordt. Dat
 * gaf de kustlijn negentienduizend punten in plaats van twaalfhonderd, want de
 * tolerantie viel stil op nul terug.
 */
function getalUit (params, naam, terug) {
  if (!params.has(naam)) return terug
  const v = Number(params.get(naam))
  return Number.isFinite(v) ? v : terug
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

/**
 * Het hoogteraster voor de bladen die de hele reis beslaan.
 *
 * De cache let ook op de uitsnede en niet alleen op de detailstand. Dat moet
 * sinds het voorblad er is: dat kadert op het eiland en de overzichtskaart op de
 * rit, en dat zijn twee verschillende vakken. Zou alleen de detailstand tellen,
 * dan kreeg het tweede blad dat je opent het raster van het eerste - zonder
 * foutmelding, want een DemGrid van het verkeerde gebied ziet er precies zo uit
 * als een goede.
 */
let reisDemCache = null
async function reisDem (stijl, view) {
  const detail = stijl['relief.detailZoom']
  const b = view.visibleBounds()
  const vak = [b.west, b.south, b.east, b.north].map(v => v.toFixed(3)).join(',')
  if (reisDemCache?.detail === detail && reisDemCache?.vak === vak) return reisDemCache.dem

  const zicht = expandBounds(view.visibleBounds(), 0.05)
  const metersPerPixel = view.metersPerMm() / (stijl['pagina.dpi'] / 25.4)

  const dem = await fetchDem(zicht, {
    metersPerPixel,
    maxZoom: detail,
    onProgress: (n, totaal) =>
      process.stdout.write(`  ... overzicht (${typeof n === 'string' ? n : `${n}/${totaal}`})\n`)
  })

  reisDemCache = { detail, vak, dem }
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

    // ------------------------------------------------ de stempels per dag
    //
    // Eén antwoord met alle dagen erin, op dagnummer. De pagina vraagt hem één
    // keer en heeft daarna alles: acht losse verzoeken voor acht kleine JSON's
    // is duurder dan het bestand zelf.
    //
    // Ontbreekt de map, dan is het antwoord een leeg object en geen fout: dan is
    // `node src/stempel.js` gewoon nog niet gedraaid, en de pagina hoort dan een
    // blad zonder stempelband te tekenen in plaats van een foutmelding.
    if (pad === '/api/hero') {
      const map = join(ROOT, 'data', 'hero')
      const uit = {}
      for (const b of (await readdir(map).catch(() => [])).sort()) {
        if (!/^dag-\d+\.json$/.test(b)) continue
        const notitie = JSON.parse(await readFile(join(map, b), 'utf8'))
        uit[notitie.dag] = notitie
      }
      return json(res, uit)
    }

    // De afdrukken en de foto's zelf. Onder /api/ zodat de statische versie ze
    // op precies hetzelfde adres kan neerzetten.
    if (pad.startsWith('/api/hero/')) {
      const naam = pad.slice('/api/hero/'.length)
      if (!/^[\w.-]+$/.test(naam)) return res.writeHead(400).end('Rare bestandsnaam')
      return bestand(res, join('data', 'hero', naam))
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
          voorblad: d.boek.voorblad,
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

      // De overzichtskaart en het voorblad beslaan allebei de hele reis, dus
      // een eigen uitsnede en een eigen, ruimer hoogteraster.
      //
      // Ze kaderen alleen niet hetzelfde. Het overzicht past op de rit; het
      // voorblad past op het eiland, want de Westfjorden en de oostpunt liggen
      // buiten de route en een omslag waarop IJsland is afgesneden klopt niet.
      // De browser rekent met precies dezelfde ringen, zodat de plaat en de
      // getekende kust op elkaar vallen.
      const overzicht = url.searchParams.get('overzicht') === '1'
      const voorblad = url.searchParams.get('voorblad') === '1'
      const heleReis = overzicht || voorblad

      const coords = heleReis ? await heleReisCoords() : d.route.coordinates
      const kader = voorblad
        ? (await ijslandKust({ minKm2: Math.max(0, stijl['voorblad.kustDetail'] ?? 5) }))
            .ringen.flat()
        : coords

      const view = voorblad ? voorbladView(kader, stijl) : maakView(kader, stijl)
      const dem = heleReis ? await reisDem(stijl, view) : d.dem

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
          bovenlaag: !!r.bovenPng,
          schilden: r.schilden ?? []
        }),
        'cache-control': 'no-store'
      })
      return res.end(r.png)
    }

    // ------------------------------------------------------- plaatsnamen
    //
    // De namen die de browser zelf op de kaart zet. Ze komen van dezelfde bron
    // als de labels die Mapbox in de plaat bakt, maar dan als gegevens, zodat
    // ze in de letter van het boek getekend kunnen worden.
    if (pad === '/api/plaatsen') {
      const nummer = Number(url.searchParams.get('dag') ?? 1)
      const overzicht = url.searchParams.get('overzicht') === '1'

      const d = await dagGegevens(nummer)
      const eigen = JSON.parse(url.searchParams.get('stijl') ?? '{}')
      const { stijl } = mergeStijl(d.boek.stijl, overzicht ? {} : d.dag.stijl, eigen)

      const coords = overzicht ? await heleReisCoords() : d.route.coordinates
      const zicht = expandBounds(maakView(coords, stijl).visibleBounds(), 0.04)

      try {
        const plaatsen = await haalPlaatsen(zicht, {
          onProgress: b => process.stdout.write(`  ... ${b}\n`)
        })
        return json(res, { plaatsen })
      } catch (fout) {
        // Zonder namen tekent de kaart gewoon door. Een ontbrekende token of een
        // dienst die er even uit ligt mag geen lege pagina opleveren.
        process.stdout.write(`  ... plaatsnamen mislukt: ${fout.message}\n`)
        return json(res, { plaatsen: [], fout: fout.message })
      }
    }

    // ------------------------------------------- opgetilde plaatsnamen
    if (pad === '/api/bovenlaag') {
      if (!bovenlaagCache) { res.writeHead(204).end(); return }
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' })
      return res.end(bovenlaagCache)
    }

    // ------------------------------------------------------- inzetkaartje
    /**
     * De kustlijn van IJsland als lijn in plaats van als vlak.
     *
     * Het voorblad trekt hem met een pen na en knipt de kaart erop uit. Anders
     * dan /api/inzet hangt dit aan geen enkele kleur, dus het antwoord is voor
     * elke stijl hetzelfde en het rekenwerk gebeurt een keer per detailstand.
     */
    if (pad === '/api/kustlijn') {
      const kust = await ijslandKust({
        minKm2: Math.max(0, getalUit(url.searchParams, 'minKm2', 5)),
        tolerantieM: Math.max(0, getalUit(url.searchParams, 'tolerantieM', 500)),
        onProgress: (n, totaal) =>
          process.stdout.write(`  ... kustlijn (${typeof n === 'string' ? n : `${n}/${totaal}`})\n`)
      })

      return json(res, { ringen: kust.ringen, bounds: kust.bounds })
    }

    if (pad === '/api/inzet') {
      const landKleur = url.searchParams.get('kleur') ?? '#e8e4dd'
      const silhouet = await ijslandSilhouet({
        landKleur,
        kustKleur: url.searchParams.get('kust') ?? landKleur,
        kustMm: getalUit(url.searchParams, 'kustMm', 0),
        // de breedte waarop het kaartje straks staat: daarmee wordt de dikte van
        // de kustrand van millimeters naar beeldpunten omgerekend
        breedteMm: getalUit(url.searchParams, 'mm', 46),
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
        if (boek.voorblad) b.voorblad = boek.voorblad
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

    // --------------------------------------------------------------- exporteren
    //
    // Dezelfde export als `node src/build.js`, maar dan met de instellingen zoals
    // ze op dit moment op je scherm staan - ook de knoppen die je nog niet
    // bewaard hebt - en het resultaat gaat niet naar out/ maar terug naar de
    // browser, zodat je zelf kiest waar het bestand belandt.
    if (pad === '/api/export' && req.method === 'POST') {
      if (exportBezig) return json(res, { fout: 'Er loopt al een export' }, 409)

      const body = await leesBody(req)
      const nummer = Number(body.dag ?? 1)
      const paginaType = PAGINA_TYPES.find(p => p === (body.pagina ?? 'kaart'))
      if (!paginaType) return json(res, { fout: `Onbekende pagina "${body.pagina}"` }, 400)

      // Door mergeStijl heen: dat klemt waarden binnen hun bereik en gooit
      // sleutels weg die het schema niet kent, net als bij het bewaren.
      const { stijl } = mergeStijl(body.stijl ?? {})

      const token = `e${++exportTeller}`
      exportStijlen.set(token, stijl)
      exportBezig = true

      console.log(`  exporteren: dag ${nummer} ${paginaType} op ${stijl['pagina.dpi']} dpi`)

      try {
        const uit = await exporteer({
          basis: `http://localhost:${POORT}`,
          dag: nummer,
          paginaType,
          stopIndex: body.stop ?? null,
          stijl,
          stijlToken: token,
          formaat: 'jpg',
          pdf: false,
          melden: b => process.stdout.write(`  ... ${b}\n`)
        })

        // Het voortgangsstrookje komt als PNG terug ook al vroegen we om JPG:
        // dat leeft van zijn doorzichtige achtergrond. Vandaar dat de naam uit
        // het antwoord komt en niet uit de vraag.
        const naam = `dag-${String(nummer).padStart(2, '0')}-${paginaType}.${uit.formaat}`

        const mis = uit.controle.filter(p => !p.goed)
        console.log(`  ${naam} klaar (${(uit.beeld.length / 1e6).toFixed(1)} MB)` +
          (mis.length ? `, ${mis.length} punt(en) om naar te kijken` : ''))

        res.writeHead(200, {
          'content-type': uit.mime,
          'content-length': uit.beeld.length,
          'content-disposition': `attachment; filename="${naam}"`,
          // alleen wat niet klopt: de hele lijst is nooit interessant als hij goed is
          'x-controle': JSON.stringify({ totaal: uit.controle.length, mis }),
          'cache-control': 'no-store'
        })
        return res.end(uit.beeld)
      } finally {
        exportBezig = false
        exportStijlen.delete(token)
      }
    }

    // De knopstanden voor de pagina die Chromium net geopend heeft.
    if (pad === '/api/exportstijl') {
      return json(res, exportStijlen.get(url.searchParams.get('token')) ?? {})
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
