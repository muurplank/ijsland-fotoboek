/**
 * Bakt de bedieningspagina tot een statische site, voor GitHub Pages.
 *
 * De pagina zelf heeft geen server nodig om te tekenen - route, markers, labels,
 * titelblok, inzetkaartje, schaalbalk en kompas zijn allemaal vectoren die de
 * browser maakt. Wat de server doet is het zware beeldwerk: het schaduwreliëf
 * uit het hoogtemodel, het silhouet van IJsland, en de kleurbewerking en
 * pixelchirurgie over de Mapbox-tegels. Dat kan niet in een browser, en het
 * heeft je Mapbox-token nodig.
 *
 * Dus vragen we die antwoorden hier één keer op en zetten ze als bestanden neer.
 * De schil (`pages/statisch-schil.js`) leidt de aanroepen daarheen om, zodat de
 * tekencode zelf niets van dit alles hoeft te weten.
 *
 *   node src/statisch.js        # naar docs/, klaar om te committen
 *
 * Wat je verliest is het opnieuw renderen van de achtergrond: de 33 knoppen in
 * ACHTERGROND_KNOPPEN staan vast op wat hier gebakken is. De andere tweehonderd
 * blijven werken.
 */

import { spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UIT = join(ROOT, 'docs')
const POORT = Number(process.env.PORT ?? 4321)
const BASIS = `http://localhost:${POORT}`

/** De vaste JSON-antwoorden: die hangen niet aan een dag. */
const VAST = ['schema', 'presets', 'dagen', 'reis', 'reis-cijfers', 'hero']

async function serverDraait () {
  try {
    const a = await fetch(`${BASIS}/api/schema`, { signal: AbortSignal.timeout(1500) })
    return a.ok
  } catch { return false }
}

async function startServer () {
  const kind = spawn(process.execPath, [join(ROOT, 'src', 'server.js')], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, PORT: String(POORT) }
  })
  for (let i = 0; i < 80; i++) {
    await new Promise(r => setTimeout(r, 250))
    if (await serverDraait()) return kind
  }
  kind.kill()
  throw new Error('De previewserver kwam niet op')
}

/**
 * Alle modules die de browser vanaf preview.js binnenhaalt, gevonden door de
 * relatieve imports te volgen.
 *
 * Zo hoeft er geen lijst bijgehouden te worden, en het is meteen het bewijs dat
 * er niets serverachtigs in de bundel belandt: sharp en node:fs zitten alleen in
 * modules die hier niet bereikbaar zijn.
 */
// Let op het ontbreken van "import" in dit patroon: een importregel mag over
// meerdere regels lopen, en de eerste versie hiervan eiste alles op één regel.
// Daardoor bleef statsdelen.js achter en laadde de hele pagina niet meer. Nu
// zoeken we alleen naar het adres zelf, in from '...', import '...' en
// import('...').
const IMPORTPAD = /(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g

async function modulesVan (start) {
  const gezien = new Set()
  const wachtrij = [start]

  while (wachtrij.length) {
    const pad = wachtrij.pop()
    if (gezien.has(pad)) continue
    gezien.add(pad)

    const bron = await readFile(pad, 'utf8')
    for (const m of bron.matchAll(IMPORTPAD)) {
      wachtrij.push(join(dirname(pad), m[1]))
    }
  }
  return [...gezien]
}

/**
 * Kijkt na of elke import in de gebakken map ook echt naast zich staat.
 *
 * Eén gemiste module laat de hele pagina zwijgend leeg: de browser stopt met
 * laden en er komt niets in beeld. Dat wil je hier weten en niet pas op Pages.
 */
async function controleerImports (bestanden) {
  const kwijt = []
  for (const pad of bestanden) {
    if (!pad.endsWith('.js')) continue
    for (const m of (await readFile(pad, 'utf8')).matchAll(IMPORTPAD)) {
      const doel = join(dirname(pad), m[1])
      if (!bestanden.includes(doel)) kwijt.push(`${relative(UIT, pad)} vraagt ${m[1]}`)
    }
  }
  if (kwijt.length) {
    throw new Error(`ontbrekende modules in docs/:\n    ${kwijt.join('\n    ')}`)
  }
}

/** Haalt een adres op en schrijft het weg; geeft terug of er iets kwam. */
async function bewaar (adres, bestand, kopNaam = null, kopBestand = null) {
  const a = await fetch(`${BASIS}${adres}`)
  if (a.status === 204) return false
  if (!a.ok) throw new Error(`${adres} gaf ${a.status}: ${(await a.text()).slice(0, 200)}`)

  const buf = Buffer.from(await a.arrayBuffer())
  await mkdir(dirname(bestand), { recursive: true })
  await writeFile(bestand, buf)

  if (kopNaam && kopBestand) {
    const kop = a.headers.get(kopNaam)
    if (kop) await writeFile(kopBestand, kop + '\n')
  }
  return buf.length
}

const kb = n => `${(n / 1024).toFixed(0)} KB`

/** ------------------------------------------------------------------ main */

let eigenServer = null
if (!await serverDraait()) {
  console.log('  previewserver starten…')
  eigenServer = await startServer()
}

console.log('\nStatische site bakken naar docs/\n')

await rm(UIT, { recursive: true, force: true })
await mkdir(join(UIT, 'api'), { recursive: true })

// ----------------------------------------------------------------- de code
const modules = await modulesVan(join(ROOT, 'src', 'pages', 'preview.js'))
const gekopieerd = []
for (const pad of modules) {
  const doel = join(UIT, relative(ROOT, pad))
  await mkdir(dirname(doel), { recursive: true })
  await cp(pad, doel)
  gekopieerd.push(doel)
}
await controleerImports(gekopieerd)
await cp(join(ROOT, 'src', 'pages', 'preview.css'), join(UIT, 'src', 'pages', 'preview.css'))
await cp(join(ROOT, 'src', 'pages', 'statisch-schil.js'), join(UIT, 'src', 'pages', 'statisch-schil.js'))
console.log(`  ${modules.length} modules plus het stijlblad en de schil`)

// De adressen in de HTML zijn absoluut, en op Pages staat de site in een map met
// de naam van de repo. Dus relatief maken, en de schil ervoor zetten zodat die
// klaar is voordat de tekencode begint.
const html = (await readFile(join(ROOT, 'src', 'pages', 'preview.html'), 'utf8'))
  .replaceAll('"/src/pages/', '"src/pages/')
  .replace('<script type="module"',
    '<script src="src/pages/statisch-schil.js"></script>\n<script type="module"')
await writeFile(join(UIT, 'index.html'), html)

// Pages laat mappen met een liggend streepje ervoor anders vallen.
await writeFile(join(UIT, '.nojekyll'), '')

// ---------------------------------------------------------------- de data
let totaal = 0
for (const naam of VAST) {
  const n = await bewaar(`/api/${naam}`, join(UIT, 'api', `${naam}.json`))
  totaal += n
  console.log(`  api/${naam}.json`.padEnd(28) + kb(n))
}

const dagen = await (await fetch(`${BASIS}/api/dagen`)).json()

for (const d of dagen) {
  const n = await bewaar(`/api/dag?dag=${d.dag}`, join(UIT, 'api', `dag-${d.dag}.json`))
  totaal += n
}
console.log(`  api/dag-N.json`.padEnd(28) + `${dagen.length} dagen`)

// ------------------------------------------------------------- de plaatjes
//
// De achtergrond zonder stijl-parameter geeft de standaarden van het boek plus
// die van de dag - precies wat de pagina bij het openen ook vraagt. En meteen
// daarna de plaatsnamenlaag, want die zet de server bij dit verzoek klaar.
for (const d of dagen) {
  const n = await bewaar(`/api/achtergrond?dag=${d.dag}`,
    join(UIT, 'api', `achtergrond-${d.dag}.png`),
    'x-plaatsing', join(UIT, 'api', `achtergrond-${d.dag}.json`))
  const b = await bewaar('/api/bovenlaag', join(UIT, 'api', `bovenlaag-${d.dag}.png`))
  const p = await bewaar(`/api/plaatsen?dag=${d.dag}`, join(UIT, 'api', `plaatsen-${d.dag}.json`))
  totaal += n + (b || 0) + (p || 0)
  console.log(`  dag ${String(d.dag).padStart(2)}`.padEnd(28) +
    `achtergrond ${kb(n)}${b ? `, opgetild ${kb(b)}` : ''}${p ? `, plaatsnamen ${kb(p)}` : ''}`)
}

// De boekinstellingen: het voorblad, het inzetkaartje en de kustlijn hangen er
// alle drie aan, dus haal ze een keer op in plaats van de maten hier nog eens
// over te schrijven.
const boekStijl = (await (await fetch(`${BASIS}/api/dag?dag=1`)).json()).boekStijl ?? {}

// Het voorblad mag een andere kaartlaag hebben dan de rest van het boek, en de
// browser regelt dat door lagen.stijl te overschrijven in wat hij meestuurt.
// Dat moet hier dus ook: zonder deze regel bakt de statische versie de
// dagkaartlaag onder het voorblad, mét wegen en wegnummer-schildjes, terwijl je
// in de preview het kale relief ziet.
const voorbladLaag = boekStijl['voorblad.kaartLaag'] ?? 'relief'
const voorbladStijl = voorbladLaag === 'zoals het boek'
  ? ''
  : `&stijl=${encodeURIComponent(JSON.stringify({ 'lagen.stijl': voorbladLaag }))}`

const v = await bewaar(`/api/achtergrond?dag=1&voorblad=1${voorbladStijl}`,
  join(UIT, 'api', 'achtergrond-voorblad.png'),
  'x-plaatsing', join(UIT, 'api', 'achtergrond-voorblad.json'))
totaal += v
console.log('  voorblad'.padEnd(28) + `achtergrond ${kb(v)} (${voorbladLaag})`)

const o = await bewaar('/api/achtergrond?dag=1&overzicht=1',
  join(UIT, 'api', 'achtergrond-overzicht.png'),
  'x-plaatsing', join(UIT, 'api', 'achtergrond-overzicht.json'))
await bewaar('/api/bovenlaag', join(UIT, 'api', 'bovenlaag-overzicht.png'))
totaal += o + (await bewaar('/api/plaatsen?dag=1&overzicht=1',
  join(UIT, 'api', 'plaatsen-overzicht.json')) || 0)
console.log('  hele reis'.padEnd(28) + `achtergrond ${kb(o)}`)

// Het inzetkaartje hangt aan de kleuren en de breedte uit het boek.
const vraag = new URLSearchParams({
  kleur: boekStijl['inzet.landKleur'] ?? '#e2ddd4',
  kust: boekStijl['inzet.kustKleur'] ?? '#b9b0a3',
  kustMm: String(boekStijl['inzet.kustMm'] ?? 0.12),
  mm: String((boekStijl['inzet.breedteMm'] ?? 52) - 2 * (boekStijl['inzet.padMm'] ?? 3.5))
})
const i = await bewaar(`/api/inzet?${vraag}`, join(UIT, 'api', 'inzet.png'),
  'x-bounds', join(UIT, 'api', 'inzet.json'))
totaal += i
console.log('  inzetkaartje'.padEnd(28) + kb(i))

// De omtrek van IJsland voor het voorblad. Net als bij de achtergrondplaten
// vriest dit de detailstand vast: aan "kleinste eiland" draaien doet in de
// gebakken versie niets meer, want de uitsnede hangt eraan en die zit in de
// plaat gebakken.
const k = await bewaar(
  `/api/kustlijn?minKm2=${boekStijl['voorblad.kustDetail'] ?? 5}`,
  join(UIT, 'api', 'kustlijn.json'))
totaal += k
console.log('  kustlijn'.padEnd(28) + kb(k))

// --------------------------------------------------------- de stempels
//
// De afdrukken en de foto's uit data/hero/. Kleiner gemaakt dan ze op schijf
// staan: die zijn op drukmaat, en een scherm heeft daar niets aan terwijl het
// de map wel verdubbelt. De ruwe platen uit data/hero/ruw/ blijven thuis - dat
// is het archief, geen website.
const HERO_PX = 1400
const heroMap = join(ROOT, 'data', 'hero')
const heroBestanden = (await readdir(heroMap).catch(() => []))
  .filter(b => /\.(png|jpe?g)$/i.test(b))

if (heroBestanden.length) {
  await mkdir(join(UIT, 'api', 'hero'), { recursive: true })
  let heroTotaal = 0

  for (const naam of heroBestanden) {
    const beeld = sharp(join(heroMap, naam)).resize({
      width: HERO_PX, height: HERO_PX, fit: 'inside', withoutEnlargement: true
    })
    // PNG houdt zijn doorzichtigheid, want daar hangt de hele stempel op
    const buf = naam.toLowerCase().endsWith('.png')
      ? await beeld.png({ compressionLevel: 9 }).toBuffer()
      : await beeld.jpeg({ quality: 82 }).toBuffer()

    await writeFile(join(UIT, 'api', 'hero', naam), buf)
    heroTotaal += buf.length
  }

  totaal += heroTotaal
  console.log('  stempels en foto´s'.padEnd(28) +
    `${heroBestanden.length} bestanden, ${kb(heroTotaal)}`)
}

console.log(`\n  Klaar: docs/ is ${(totaal / 1e6).toFixed(1)} MB`)
console.log('  Zet Pages in de repo-instellingen op main / docs\n')

eigenServer?.kill()
