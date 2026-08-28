/**
 * Exporteert een dag naar drukklare bestanden.
 *
 *   node src/build.js 1              de kaartpagina van dag 1
 *   node src/build.js 1 stats        de cijferpagina van dag 1
 *   node src/build.js 3 voortgang 9  het strookje van dag 3, tot stop 9
 *
 * Levert twee dingen op:
 *   - een PNG op de ingestelde resolutie, voor fotoboekprogramma's die alleen
 *     afbeeldingen slikken
 *   - een PDF waarin de routelijn, pijltjes, markers en tekst vectoren blijven:
 *     wiskundige vormen zonder resolutie, dus op elk formaat scherp
 *
 * Het voortgangsstrookje is de uitzondering: dat wordt alleen een PNG, met een
 * doorzichtige achtergrond, want het hoort over een foto en niet op een vel.
 *
 * Draait de previewserver zelf op als die nog niet aanstaat, en loopt na afloop
 * een controlelijst af zodat je niet pas op papier ontdekt dat er iets niet klopt.
 *
 * Het browserwerk zelf staat in `src/export.js`, want de knop in de preview doet
 * precies hetzelfde en die twee horen niet uiteen te lopen.
 */

import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadBook, loadDay } from './dayData.js'
import { exportMaten, exporteer, PAGINA_TYPES } from './export.js'
import { mergeStijl } from './style.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const POORT = Number(process.env.PORT ?? 4321)
const BASIS = `http://localhost:${POORT}`

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

/** ------------------------------------------------------------------ main */

const nummer = Number(process.argv[2] ?? 1)

/**
 * Welk blad van die dag: de kaart of de cijfers.
 *
 * Stond hier eerst niet, waardoor de cijferpagina alleen op het scherm bestond
 * en nooit door de drukcontrole kwam - terwijl juist daar de kleinste letters
 * en de dunste lijnen staan.
 */
const paginaType = PAGINA_TYPES.find(p => p === (process.argv[3] ?? 'kaart'))
if (!paginaType) {
  console.error(`  Onbekende pagina "${process.argv[3]}". Kies uit: ${PAGINA_TYPES.join(', ')}`)
  process.exit(1)
}

/**
 * Het voortgangsstrookje is geen bladzijde maar iets wat je over een foto legt.
 *
 * Dus geen PDF - daar zou het als los A4'tje in gaan liggen - maar één PNG met
 * een doorzichtige achtergrond, zodat de foto er onderuit komt. Welke stop de
 * balk vult geef je erachteraan mee: `node src/build.js 3 voortgang 9`.
 */
const stopIndex = process.argv[4] !== undefined ? Number(process.argv[4]) : null

const boek = await loadBook()
const dag = await loadDay(nummer)
const { stijl } = mergeStijl(boek.stijl, dag.stijl)

const { maat, plan, doorzichtig } = exportMaten(stijl, paginaType)

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

const naam = `dag-${String(nummer).padStart(2, '0')}-${paginaType}`

try {
  const uit = await exporteer({
    basis: BASIS,
    dag: nummer,
    paginaType,
    stopIndex,
    stijl,
    melden: b => console.log(`  ${b}`)
  })

  await writeFile(join(uitmap, `${naam}.png`), uit.beeld)
  if (uit.pdf) await writeFile(join(uitmap, `${naam}.pdf`), uit.pdf)

  // -------------------------------------------------------------- controle
  console.log('\n  Controle:')
  for (const p of uit.controle) console.log(`    ${p.goed ? '✓' : '✗'} ${p.tekst}`)

  const mis = uit.controle.filter(p => !p.goed)
  console.log(`
  Klaar:
    out/${naam}.png   ${(uit.beeld.length / 1e6).toFixed(1)} MB${doorzichtig ? '  (doorzichtige achtergrond)' : ''}` +
    (uit.pdf ? `
    out/${naam}.pdf   ${(uit.pdf.length / 1e6).toFixed(1)} MB  (tekst en lijnen als vectoren)` : '') + '\n')
  if (mis.length) {
    console.log(`  ${mis.length} punt(en) om naar te kijken voordat je dit laat drukken.\n`)
    process.exitCode = 1
  }
} finally {
  eigenServer?.kill()
}
