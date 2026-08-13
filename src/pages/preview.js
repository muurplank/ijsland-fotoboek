/**
 * De preview: knoopt het paneel, de pagina en de server aan elkaar.
 *
 * De pagina die je hier ziet is exact wat er geprint wordt. Alle maten staan in
 * millimeters; --mm bepaalt hoeveel schermpixels een millimeter is, en dat is
 * het enige verschil tussen scherm en druk.
 */

import { bouwPaneel } from './panel.js'
import { teken } from './draw.js'
import { tekenBijwerk } from './furniture.js'
import { achtergrondSleutel, paginaMaat } from '../render/layout.js'

const $ = id => document.getElementById(id)

const pagina = $('pagina')
const achtergrond = $('achtergrond')
const tekening = $('tekening')
const opschriften = $('opschriften')
const melding = $('melding')
const maatinfo = $('maatinfo')

let schema
let gegevens
let stijl
let paneel
let vorigeAchtergrondSleutel = null

/**
 * Exportmodus: dezelfde pagina, maar zonder paneel en op de exacte drukmaat.
 * Dit is waarom wat je ziet ook echt is wat je print - het is letterlijk
 * dezelfde opmaakcode, alleen met een andere waarde voor een millimeter.
 */
const params = new URLSearchParams(location.search)
const EXPORT = params.get('export')          // 'png' | 'pdf' | null
const huidigeDag = Number(params.get('dag') ?? 1)
const EXPORT_MM = Number(params.get('mm') ?? 0)

/** ------------------------------------------------------------ hulpjes */

function zegt (tekst) { melding.textContent = tekst }

function ontdubbel (fn, ms) {
  let handvat
  return (...args) => {
    clearTimeout(handvat)
    handvat = setTimeout(() => fn(...args), ms)
  }
}

/** ------------------------------------------------- pagina op schaal zetten */

function schaalPagina () {
  const maat = paginaMaat(stijl)
  const doek = $('doek')

  let mm
  if (EXPORT_MM > 0) {
    // exportmodus: de aanroeper rekent uit hoeveel css-pixels een millimeter is
    mm = EXPORT_MM
  } else {
    const beschikbaarBreed = doek.clientWidth - 56
    const beschikbaarHoog = doek.clientHeight - 56
    mm = Math.min(beschikbaarBreed / maat.breedteMm, beschikbaarHoog / maat.hoogteMm)
  }

  pagina.style.setProperty('--mm', `${mm}px`)
  pagina.style.width = `calc(${maat.breedteMm} * var(--mm))`
  pagina.style.height = `calc(${maat.hoogteMm} * var(--mm))`
  pagina.style.setProperty('--paginakleur', stijl['pagina.achtergrond'])

  const dpi = stijl['pagina.dpi']
  const px = m => Math.round((m / 25.4) * dpi)
  maatinfo.textContent =
    `${maat.snijBreedteMm} × ${maat.snijHoogteMm} mm + ${maat.afloopMm} mm afloop · ` +
    `${dpi} dpi · export ${px(maat.breedteMm)} × ${px(maat.hoogteMm)} px`
}

/** --------------------------------------------------- typografie doorgeven */

function zetTypografie () {
  const p = pagina.style
  p.setProperty('--labelkleur', stijl['labels.kleur'])
  p.setProperty('--labelgrootte', `calc(${stijl['labels.grootteMm']} * var(--mm))`)
  p.setProperty('--halokleur', stijl['labels.haloKleur'])
  p.setProperty('--halo', `calc(${stijl['labels.haloMm']} * var(--mm))`)
  p.setProperty('--letterafstand', `${stijl['labels.letterafstand']}em`)
  p.setProperty('--hoofdletters', stijl['labels.hoofdletters'] ? 'uppercase' : 'none')
}

/** ------------------------------------------------------- achtergrond halen */

async function achtergrondNu () {
  const sleutel = achtergrondSleutel(stijl)
  if (sleutel === vorigeAchtergrondSleutel) return
  vorigeAchtergrondSleutel = sleutel

  zegt('reliëf berekenen…')

  // in exportmodus op volle drukresolutie, in de preview zuiniger
  const dpi = EXPORT ? `&dpi=${stijl['pagina.dpi']}` : ''
  const url = `/api/achtergrond?dag=${huidigeDag}${dpi}&stijl=${encodeURIComponent(JSON.stringify(stijl))}`

  try {
    const antwoord = await fetch(url)
    if (!antwoord.ok) throw new Error(await antwoord.text())

    const plaatsing = JSON.parse(antwoord.headers.get('x-plaatsing'))
    const blob = await antwoord.blob()

    const oud = achtergrond.src
    achtergrond.src = URL.createObjectURL(blob)
    if (oud.startsWith('blob:')) URL.revokeObjectURL(oud)

    achtergrond.style.left = `calc(${plaatsing.xMm} * var(--mm))`
    achtergrond.style.top = `calc(${plaatsing.yMm} * var(--mm))`
    achtergrond.style.width = `calc(${plaatsing.breedteMm} * var(--mm))`
    achtergrond.style.height = `calc(${plaatsing.hoogteMm} * var(--mm))`

    // wacht tot de browser hem echt getekend heeft, anders schiet de export
    // hem voorbij en krijg je een lege achtergrond
    if (!achtergrond.complete) {
      await new Promise(klaar => {
        achtergrond.onload = klaar
        achtergrond.onerror = klaar
      })
    }
    await achtergrond.decode().catch(() => {})

    zegt('klaar')
  } catch (fout) {
    zegt(`reliëf mislukt: ${fout.message}`)
  }
}

const haalAchtergrond = ontdubbel(achtergrondNu, 260)

/** ------------------------------------------------------------- hertekenen */

function hertekenAlles () {
  schaalPagina()
  zetTypografie()
  const view = teken(tekening, opschriften, gegevens, stijl)
  tekenBijwerk(opschriften, gegevens, stijl, view, silhouet)
  haalAchtergrond()
  haalSilhouet()
}

/** Het silhouet van IJsland voor het inzetkaartje; hoeft maar een keer. */
let silhouet = null
let silhouetKleur = null

async function haalSilhouet () {
  const kleur = stijl['inzet.landKleur']
  if (!stijl['inzet.aan'] || kleur === silhouetKleur) return
  silhouetKleur = kleur

  try {
    const antwoord = await fetch(`/api/inzet?kleur=${encodeURIComponent(kleur)}`)
    if (!antwoord.ok) throw new Error(await antwoord.text())
    const bounds = JSON.parse(antwoord.headers.get('x-bounds'))
    const blob = await antwoord.blob()
    silhouet = { url: URL.createObjectURL(blob), bounds }
    const view = teken(tekening, opschriften, gegevens, stijl)
    tekenBijwerk(opschriften, gegevens, stijl, view, silhouet)
  } catch (fout) {
    zegt(`inzetkaartje mislukt: ${fout.message}`)
  }
}

/** ------------------------------------------------------------------ start */

async function start () {
  zegt('schema laden…')
  schema = await (await fetch('/api/schema')).json()

  zegt('daggegevens ophalen (eerste keer kan even duren)…')
  gegevens = await (await fetch(`/api/dag?dag=${huidigeDag}`)).json()
  stijl = { ...gegevens.stijl }

  // Exportmodus: geen paneel, alleen de pagina, en pas klaarmelden als alles
  // echt getekend is. build.js wacht op window.klaarVoorExport.
  if (EXPORT) {
    document.body.classList.add('exporteren')
    schaalPagina()
    zetTypografie()
    await haalSilhouet()
    const view = teken(tekening, opschriften, gegevens, stijl)
    tekenBijwerk(opschriften, gegevens, stijl, view, silhouet)
    await achtergrondNu()
    await document.fonts.ready
    window.klaarVoorExport = true
    return
  }

  paneel = bouwPaneel($('groepen'), schema, stijl, (key, waarde) => {
    stijl[key] = waarde
    hertekenAlles()
  })

  $('zoek').addEventListener('input', e => paneel.filter(e.target.value))
  window.addEventListener('resize', ontdubbel(() => {
    schaalPagina()
    const view = teken(tekening, opschriften, gegevens, stijl)
    tekenBijwerk(opschriften, gegevens, stijl, view, silhouet)
  }, 120))

  $('bewaar-boek').addEventListener('click', () => bewaar('boek'))
  $('bewaar-dag').addEventListener('click', () => bewaar('dag'))
  $('herstel').addEventListener('click', herstel)

  document.title = `Dag ${gegevens.dag.dag} — ${gegevens.dag.titel}`
  $('dagkiezer').textContent = `Dag ${gegevens.dag.dag} — ${gegevens.dag.titel}`

  hertekenAlles()

  if (gegevens.genegeerd?.length) {
    zegt(`let op: onbekende instellingen overgeslagen: ${gegevens.genegeerd.join(', ')}`)
  }
}

async function bewaar (niveau) {
  zegt('bewaren…')
  const antwoord = await fetch('/api/stijl', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ niveau, dag: huidigeDag, stijl })
  })
  zegt(antwoord.ok
    ? (niveau === 'dag' ? 'bewaard voor deze dag' : 'bewaard voor het hele boek')
    : 'bewaren mislukt')
}

function herstel () {
  const standaard = Object.fromEntries(schema.knoppen.map(k => [k.key, k.standaard]))
  stijl = standaard
  for (const [key, waarde] of Object.entries(stijl)) paneel.zet(key, waarde)
  hertekenAlles()
  zegt('terug naar de standaardinstellingen (nog niet bewaard)')
}

start().catch(fout => {
  console.error(fout)
  zegt(`fout bij starten: ${fout.message}`)
})
