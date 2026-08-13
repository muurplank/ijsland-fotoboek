/**
 * De bedieningspagina: knoopt het paneel, de pagina en de server aan elkaar.
 *
 * Wat je hier ziet is exact wat er geprint wordt. Alle maten staan in
 * millimeters; --mm bepaalt hoeveel schermpixels een millimeter is, en dat is
 * het enige verschil tussen scherm en druk.
 *
 * Drie paginatypes delen dezelfde opmaakmachine:
 *   kaart      - de dagkaart met route
 *   stats      - hoogteprofiel en kerncijfers
 *   overzicht  - de hele reis op een kaart
 */

import { bouwPaneel } from './panel.js'
import { teken } from './draw.js'
import { tekenBijwerk } from './furniture.js'
import { tekenStatistieken } from './statspage.js'
import { tekenOverzicht } from './overview.js'
import { maakBewerkbaar, pasPlaatsingToe } from './editable.js'
import { achtergrondSleutel, paginaMaat } from '../render/layout.js'

const $ = id => document.getElementById(id)

const pagina = $('pagina')
const achtergrond = $('achtergrond')
const tekening = $('tekening')
const bovenlaag = $('bovenlaag')
const opschriften = $('opschriften')
const melding = $('melding')
const maatinfo = $('maatinfo')

const params = new URLSearchParams(location.search)
const EXPORT = params.get('export')            // 'png' | 'pdf' | null
const EXPORT_MM = Number(params.get('mm') ?? 0)

let schema
let stijl
let paneel
let gegevens = null      // van de huidige dag
let reis = null          // alle dagen, voor de overzichtskaart
let dagen = []
let huidigeDag = Number(params.get('dag') ?? 1)
let paginaType = params.get('pagina') ?? 'kaart'
let silhouet = null
let silhouetKleur = null
let vorigeAchtergrondSleutel = null
let boek = {}
let presets = []

/** ------------------------------------------------------------- hulpjes */

function zegt (tekst) { melding.textContent = tekst }

function ontdubbel (fn, ms) {
  let handvat
  return (...args) => {
    clearTimeout(handvat)
    handvat = setTimeout(() => fn(...args), ms)
  }
}

/** ---------------------------------------------------- pagina op schaal */

function schaalPagina () {
  const maat = paginaMaat(stijl)
  const doek = $('doek')

  const mm = EXPORT_MM > 0
    ? EXPORT_MM
    : Math.min(
        (doek.clientWidth - 56) / maat.breedteMm,
        (doek.clientHeight - 56) / maat.hoogteMm
      )

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

function zetTypografie () {
  const p = pagina.style
  p.setProperty('--labelkleur', stijl['labels.kleur'])
  p.setProperty('--labelgrootte', `calc(${stijl['labels.grootteMm']} * var(--mm))`)
  p.setProperty('--halokleur', stijl['labels.haloKleur'])
  p.setProperty('--halo', `calc(${stijl['labels.haloMm']} * var(--mm))`)
  p.setProperty('--letterafstand', `${stijl['labels.letterafstand']}em`)
  p.setProperty('--hoofdletters', stijl['labels.hoofdletters'] ? 'uppercase' : 'none')
  p.fontFamily = stijl['typografie.lettertype'] === 'systeem-schreef'
    ? 'Georgia, "Times New Roman", serif'
    : '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
}

/** ------------------------------------------------------- achtergrond */

async function achtergrondNu () {
  // de statistiekpagina heeft geen kaartachtergrond
  if (paginaType === 'stats') {
    achtergrond.removeAttribute('src')
    achtergrond.style.width = '0'
    // ook de opgetilde plaatsnamen weg: die horen bij de kaart, en anders
    // lekken Akureyri en Egilsstadir door op de statistiekpagina
    bovenlaag.removeAttribute('src')
    bovenlaag.style.display = 'none'
    vorigeAchtergrondSleutel = null
    return
  }

  const sleutel = `${paginaType}:${huidigeDag}:${achtergrondSleutel(stijl)}`
  if (sleutel === vorigeAchtergrondSleutel) return
  vorigeAchtergrondSleutel = sleutel

  zegt('achtergrond berekenen…')

  const dpi = EXPORT ? `&dpi=${stijl['pagina.dpi']}` : ''
  const wat = paginaType === 'overzicht' ? '&overzicht=1' : ''
  const url = `/api/achtergrond?dag=${huidigeDag}${dpi}${wat}` +
    `&stijl=${encodeURIComponent(JSON.stringify(stijl))}`

  try {
    const antwoord = await fetch(url)
    if (!antwoord.ok) throw new Error((await antwoord.text()).slice(0, 200))

    const plaatsing = JSON.parse(antwoord.headers.get('x-plaatsing'))
    const blob = await antwoord.blob()

    const oud = achtergrond.src
    achtergrond.src = URL.createObjectURL(blob)
    if (oud.startsWith('blob:')) URL.revokeObjectURL(oud)

    achtergrond.style.left = `calc(${plaatsing.xMm} * var(--mm))`
    achtergrond.style.top = `calc(${plaatsing.yMm} * var(--mm))`
    achtergrond.style.width = `calc(${plaatsing.breedteMm} * var(--mm))`
    achtergrond.style.height = `calc(${plaatsing.hoogteMm} * var(--mm))`

    // de uit de kaart geknipte plaatsnamen, op exact dezelfde plek
    if (plaatsing.bovenlaag) {
      const oudeBoven = bovenlaag.src
      bovenlaag.src = `/api/bovenlaag?t=${Date.now()}`
      if (oudeBoven.startsWith('blob:')) URL.revokeObjectURL(oudeBoven)
      bovenlaag.style.left = achtergrond.style.left
      bovenlaag.style.top = achtergrond.style.top
      bovenlaag.style.width = achtergrond.style.width
      bovenlaag.style.height = achtergrond.style.height
      bovenlaag.style.display = ''
    } else {
      bovenlaag.style.display = 'none'
    }

    if (!achtergrond.complete) {
      await new Promise(klaar => { achtergrond.onload = klaar; achtergrond.onerror = klaar })
    }
    await achtergrond.decode().catch(() => {})

    zegt('klaar')
  } catch (fout) {
    zegt(`achtergrond mislukt: ${fout.message}`)
  }
}

const haalAchtergrond = ontdubbel(achtergrondNu, 260)

/** Het silhouet van IJsland voor het inzetkaartje; hoeft maar een keer. */
async function haalSilhouet () {
  const kleur = stijl['inzet.landKleur']
  if (!stijl['inzet.aan'] || paginaType !== 'kaart' || kleur === silhouetKleur) return
  silhouetKleur = kleur

  try {
    const antwoord = await fetch(`/api/inzet?kleur=${encodeURIComponent(kleur)}`)
    if (!antwoord.ok) throw new Error(await antwoord.text())
    const bounds = JSON.parse(antwoord.headers.get('x-bounds'))
    silhouet = { url: URL.createObjectURL(await antwoord.blob()), bounds }
    tekenPagina()
  } catch (fout) {
    zegt(`inzetkaartje mislukt: ${fout.message}`)
  }
}

/** ------------------------------------------------------- de pagina zelf */

function tekenPagina () {
  if (paginaType === 'overzicht') {
    if (!reis) return
    tekenOverzicht(tekening, opschriften, reis, stijl)
  } else if (!gegevens) {
    return
  } else if (paginaType === 'stats') {
    tekenStatistieken(tekening, opschriften, gegevens, stijl)
  } else {
    const view = teken(tekening, opschriften, gegevens, stijl)
    tekenBijwerk(opschriften, gegevens, stijl, view, silhouet)
  }

  // de handmatige verschuivingen liggen over de standaardopmaak heen
  pasPlaatsingToe(opschriften, plaatsingVoorPagina())
}

/** De verschuivingen die bij dit paginatype horen. */
function plaatsingVoorPagina () {
  if (paginaType === 'overzicht') return boek.plaatsing?.overzicht ?? {}
  return gegevens?.dag.plaatsing?.[paginaType] ?? {}
}

function hertekenAlles () {
  schaalPagina()
  zetTypografie()
  tekenPagina()
  haalAchtergrond()
  haalSilhouet()
}

/** ------------------------------------------------------- gegevens laden */

async function laadDag (nummer) {
  zegt(`dag ${nummer} ophalen (eerste keer kan even duren)…`)
  gegevens = await (await fetch(`/api/dag?dag=${nummer}`)).json()
  if (gegevens.fout) throw new Error(gegevens.fout)
  huidigeDag = nummer
  document.title = `Dag ${gegevens.dag.dag} — ${gegevens.dag.titel}`
}

async function laadReis () {
  if (reis) return
  zegt('alle dagen ophalen voor de overzichtskaart…')
  reis = await (await fetch('/api/reis')).json()
}

/** ------------------------------------------------------------- start */

async function start () {
  zegt('schema laden…')
  schema = await (await fetch('/api/schema')).json()
  dagen = await (await fetch('/api/dagen')).json()
  presets = await (await fetch('/api/presets')).json().catch(() => [])

  await laadDag(huidigeDag)
  stijl = { ...gegevens.stijl }
  boek = gegevens.boek ?? {}

  if (paginaType === 'overzicht') {
    await laadReis()
    stijl = { ...gegevens.boekStijl }
  }

  // ------ exportmodus: geen paneel, en pas klaarmelden als alles getekend is
  if (EXPORT) {
    document.body.classList.add('exporteren')
    schaalPagina()
    zetTypografie()
    await haalSilhouet()
    tekenPagina()
    await achtergrondNu()
    await document.fonts.ready
    window.klaarVoorExport = true
    return
  }

  // ------ dagkiezer
  const kiezer = $('dag')
  for (const d of dagen) {
    const optie = document.createElement('option')
    optie.value = String(d.dag)
    optie.textContent = `${d.dag} — ${d.titel}`
    kiezer.append(optie)
  }
  kiezer.value = String(huidigeDag)
  kiezer.addEventListener('change', async () => {
    try {
      await laadDag(Number(kiezer.value))
      // instellingen van de nieuwe dag overnemen, maar het paneel bijwerken
      stijl = { ...gegevens.stijl }
      for (const [key, waarde] of Object.entries(stijl)) paneel.zet(key, waarde)
      vorigeAchtergrondSleutel = null
      hertekenAlles()
    } catch (fout) { zegt(`dag laden mislukt: ${fout.message}`) }
  })

  // ------ paginakiezer
  for (const knop of $('paginakiezer').querySelectorAll('button')) {
    knop.addEventListener('click', async () => {
      paginaType = knop.dataset.pagina
      for (const k of $('paginakiezer').querySelectorAll('button')) {
        k.classList.toggle('actief', k === knop)
      }
      $('dag').disabled = paginaType === 'overzicht'
      paneel.zetPagina(paginaType)
      if (paginaType === 'overzicht') await laadReis()

      // De overzichtskaart hoort bij het boek, niet bij een losse dag: wissel
      // daarom naar de boekinstellingen en terug.
      stijl = { ...(paginaType === 'overzicht' ? gegevens.boekStijl : gegevens.stijl) }
      for (const [key, waarde] of Object.entries(stijl)) paneel.zet(key, waarde)

      vorigeAchtergrondSleutel = null
      hertekenAlles()
    })
  }

  paneel = bouwPaneel($('groepen'), schema, stijl, (key, waarde) => {
    stijl[key] = waarde
    hertekenAlles()
  }, {
    presets,
    paginaType,
    bijPreset: p => {
      Object.assign(stijl, p.stijl)
      for (const [key, waarde] of Object.entries(stijl)) paneel.zet(key, waarde)
      vorigeAchtergrondSleutel = null
      hertekenAlles()
      zegt(`kleurenset "${p.naam}" toegepast (nog niet bewaard)`)
    }
  })

  // ------ verslepen en teksten aanpassen
  maakBewerkbaar(pagina, {
    huidigePlaatsing: plaatsingVoorPagina,
    bijVerschuiven: (id, dxMm, dyMm) => {
      const doel = paginaType === 'overzicht'
        ? (boek.plaatsing ??= {}).overzicht ??= {}
        : ((gegevens.dag.plaatsing ??= {})[paginaType] ??= {})
      doel[id] = { dxMm, dyMm }
      bewaarOpmaak(`verplaatst: ${id}`)
    },
    bijTekst: (id, tekst) => {
      pasTekstToe(id, tekst)
      bewaarOpmaak(`tekst aangepast`)
      tekenPagina()
    }
  })

  $('zoek').addEventListener('input', e => paneel.filter(e.target.value))
  window.addEventListener('resize', ontdubbel(() => { schaalPagina(); tekenPagina() }, 120))

  $('bewaar-boek').addEventListener('click', () => bewaar('boek'))
  $('bewaar-dag').addEventListener('click', () => bewaar('dag'))
  $('herstel').addEventListener('click', herstel)

  hertekenAlles()

  if (gegevens.genegeerd?.length) {
    zegt(`let op: onbekende instellingen overgeslagen: ${gegevens.genegeerd.join(', ')}`)
  }
}

/** Zet een aangepaste tekst op de plek waar hij hoort. */
function pasTekstToe (id, tekst) {
  if (id === 'titel') { gegevens.dag.titel = tekst; return }
  if (id === 'tekst') { gegevens.dag.tekst = tekst; return }
  if (id === 'overzichtstitel') { (boek.overzicht ??= {}).titel = tekst; return }
  if (id === 'bron') { (boek.bron ??= {}).tekst = tekst; return }

  const waypoint = id.match(/^waypoint:(\d+)$/)
  if (waypoint) {
    const w = gegevens.dag.waypoints[Number(waypoint[1])]
    if (w) w.name = tekst
  }
}

/** Bewaart de opmaak van deze dag; ontdubbeld, want slepen levert veel wijzigingen op. */
const bewaarOpmaak = ontdubbel(async melding => {
  try {
    const antwoord = await fetch('/api/opmaak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dag: huidigeDag,
        titel: gegevens.dag.titel,
        tekst: gegevens.dag.tekst,
        waypoints: gegevens.dag.waypoints,
        plaatsing: gegevens.dag.plaatsing,
        boek: paginaType === 'overzicht' ? boek : undefined
      })
    })
    zegt(antwoord.ok ? `${melding} · bewaard` : 'bewaren mislukt')
  } catch (fout) {
    zegt(`bewaren mislukt: ${fout.message}`)
  }
}, 600)

async function bewaar (niveau) {
  zegt('bewaren…')
  const antwoord = await fetch('/api/stijl', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ niveau, dag: huidigeDag, stijl })
  })
  zegt(antwoord.ok
    ? (niveau === 'dag' ? `bewaard voor dag ${huidigeDag}` : 'bewaard voor het hele boek')
    : 'bewaren mislukt')
}

function herstel () {
  stijl = Object.fromEntries(schema.knoppen.map(k => [k.key, k.standaard]))
  for (const [key, waarde] of Object.entries(stijl)) paneel.zet(key, waarde)
  vorigeAchtergrondSleutel = null
  hertekenAlles()
  zegt('terug naar de standaardinstellingen (nog niet bewaard)')
}

start().catch(fout => {
  console.error(fout)
  zegt(`fout bij starten: ${fout.message}`)
})
