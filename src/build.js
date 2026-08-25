/**
 * Exporteert een dag naar drukklare bestanden.
 *
 *   node src/build.js 1          de kaartpagina van dag 1
 *   node src/build.js 1 stats    de cijferpagina van dag 1
 *
 * Levert twee dingen op:
 *   - een PNG op de ingestelde resolutie, voor fotoboekprogramma's die alleen
 *     afbeeldingen slikken
 *   - een PDF waarin de routelijn, pijltjes, markers en tekst vectoren blijven:
 *     wiskundige vormen zonder resolutie, dus op elk formaat scherp
 *
 * Draait de previewserver zelf op als die nog niet aanstaat, en loopt na afloop
 * een controlelijst af zodat je niet pas op papier ontdekt dat er iets niet klopt.
 */

import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import sharp from 'sharp'

import { loadBook, loadDay } from './dayData.js'
import { renderPlan } from './geo/print.js'
import { paginaMaat } from './render/layout.js'
import { mergeStijl } from './style.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const POORT = Number(process.env.PORT ?? 4321)
const BASIS = `http://localhost:${POORT}`

/** Onder deze maten wordt het op papier onbetrouwbaar. */
const KLEINSTE_TEKST_MM = 1.8
const DUNSTE_LIJN_MM = 0.09

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

  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 250))
    if (await serverDraait()) return kind
  }
  kind.kill()
  throw new Error('De previewserver kwam niet op')
}

/** Loopt na of het bestand echt drukklaar is. */
function controleer (stijl, plan, echteBreedte, echteHoogte) {
  const punten = []
  const zeg = (goed, tekst) => punten.push({ goed, tekst })

  zeg(echteBreedte === plan.widthPx && echteHoogte === plan.heightPx,
    `pixelmaat exact ${plan.widthPx} × ${plan.heightPx} (gekregen ${echteBreedte} × ${echteHoogte})`)

  zeg(stijl['pagina.dpi'] >= 300,
    `resolutie ${stijl['pagina.dpi']} dpi (drukkerijen vragen 300)`)

  zeg(stijl['pagina.afloopMm'] >= 3,
    `afloop ${stijl['pagina.afloopMm']} mm (3 mm is de norm)`)

  const teksten = [
    ['bronvermelding', stijl['bron.grootteMm']],
    ['labels', stijl['labels.grootteMm']],
    ['bekende plaatsen', stijl['labels.omgevingGrootteMm']],
    ['statistiek-labels', stijl['statistieken.labelMm']],
    ['veldnotitie', stijl['veldnotitie.grootteMm']]
  ]
  for (const [naam, mm] of teksten) {
    zeg(mm >= KLEINSTE_TEKST_MM, `${naam} ${mm} mm (onder ${KLEINSTE_TEKST_MM} mm wordt het lastig lezen)`)
  }

  const lijnen = [
    ['routelijn', stijl['route.dikteMm']],
    ['eerdere dagen', stijl['eerdere.dikteMm']],
    ['wegen', stijl['lagen.wegenDikteMm']],
    // de dunste lijn op het inzetkaartje is de hele reis, half zo dik als de dag
    ['inzetkaartje: hele reis', stijl['inzet.lijnMm'] * 0.5],
    // de vezels van het papier zijn met opzet haarfijn: die horen weg te vallen
    // waar de pers ze niet aankan, en zijn dus geen punt om over te klagen
    ['draadmodel', stijl['statistieken.draadmodelLijnMm']]
  ]
  for (const [naam, mm] of lijnen) {
    zeg(mm >= DUNSTE_LIJN_MM, `${naam} ${mm} mm dik (onder ${DUNSTE_LIJN_MM} mm valt het weg in de druk)`)
  }

  return punten
}

/** ------------------------------------------------------------------ main */

const nummer = Number(process.argv[2] ?? 1)

/**
 * Welk blad van die dag: de kaart of de cijfers.
 *
 * Stond hier eerst niet, waardoor de cijferpagina alleen op het scherm bestond
 * en nooit door de drukcontrole kwam - terwijl juist daar de kleinste letters
 * en de dunste lijnen staan.
 */
const PAGINAS = { kaart: 'kaart', stats: 'stats', overzicht: 'overzicht', reiscijfers: 'reiscijfers' }
const paginaType = PAGINAS[process.argv[3] ?? 'kaart']
if (!paginaType) {
  console.error(`  Onbekende pagina "${process.argv[3]}". Kies uit: ${Object.keys(PAGINAS).join(', ')}`)
  process.exit(1)
}

const boek = await loadBook()
const dag = await loadDay(nummer)
const { stijl } = mergeStijl(boek.stijl, dag.stijl)

const maat = paginaMaat(stijl)
const plan = renderPlan(
  { widthMm: stijl['pagina.breedteMm'], heightMm: stijl['pagina.hoogteMm'], bleedMm: stijl['pagina.afloopMm'] },
  stijl['pagina.dpi']
)

console.log(`
Dag ${dag.dag} — ${dag.titel} (${paginaType})
  pagina    ${maat.snijBreedteMm} × ${maat.snijHoogteMm} mm + ${maat.afloopMm} mm afloop
  resolutie ${stijl['pagina.dpi']} dpi
  export    ${plan.widthPx} × ${plan.heightPx} px
`)

let eigenServer = null
if (!await serverDraait()) {
  console.log('  previewserver starten…')
  eigenServer = await startServer()
}

const uitmap = join(ROOT, 'out')
await mkdir(uitmap, { recursive: true })

const browser = await chromium.launch()
const naam = `dag-${String(nummer).padStart(2, '0')}-${paginaType}`

try {
  // ------------------------------------------------------------------ PNG
  console.log('  PNG renderen…')
  const png = await browser.newPage({
    viewport: { width: plan.viewportWidth, height: plan.viewportHeight },
    deviceScaleFactor: plan.deviceScaleFactor
  })

  const mmInCssPx = plan.viewportWidth / maat.breedteMm
  await png.goto(`${BASIS}/?export=png&pagina=${paginaType}&dag=${nummer}&mm=${mmInCssPx}`, { waitUntil: 'load' })
  await png.waitForFunction(() => window.klaarVoorExport === true, null, { timeout: 180000 })

  const beeld = await png.locator('#pagina').screenshot({ type: 'png' })
  const info = await sharp(beeld).metadata()
  await writeFile(join(uitmap, `${naam}.png`), beeld)
  await png.close()

  // ------------------------------------------------------------------ PDF
  // In de PDF blijven route, pijltjes, markers en tekst vectoren. Daarvoor moet
  // een millimeter precies 96/25.4 css-pixels zijn, want zo rekent PDF ook.
  console.log('  PDF renderen…')
  const pdfPagina = await browser.newPage()
  await pdfPagina.goto(`${BASIS}/?export=pdf&pagina=${paginaType}&dag=${nummer}&mm=${96 / 25.4}`, { waitUntil: 'load' })
  await pdfPagina.waitForFunction(() => window.klaarVoorExport === true, null, { timeout: 180000 })

  const pdf = await pdfPagina.pdf({
    width: `${maat.breedteMm}mm`,
    height: `${maat.hoogteMm}mm`,
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    pageRanges: '1'
  })
  await writeFile(join(uitmap, `${naam}.pdf`), pdf)
  await pdfPagina.close()

  // -------------------------------------------------------------- controle
  console.log('\n  Controle:')
  const punten = controleer(stijl, plan, info.width, info.height)
  for (const p of punten) console.log(`    ${p.goed ? '✓' : '✗'} ${p.tekst}`)

  const mis = punten.filter(p => !p.goed)
  console.log(`
  Klaar:
    out/${naam}.png   ${(beeld.length / 1e6).toFixed(1)} MB
    out/${naam}.pdf   ${(pdf.length / 1e6).toFixed(1)} MB  (tekst en lijnen als vectoren)
`)
  if (mis.length) {
    console.log(`  ${mis.length} punt(en) om naar te kijken voordat je dit laat drukken.\n`)
    process.exitCode = 1
  }
} finally {
  await browser.close()
  eigenServer?.kill()
}
