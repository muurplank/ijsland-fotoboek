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
import { tekenReisCijfers } from './tripstats.js'
import { tekenVoortgang, stopsMetAfstand, voortgangMaat } from './progress.js'
import { maakBewerkbaar, pasPlaatsingToe } from './editable.js'
import { achtergrondSleutel, paginaMaat } from '../render/layout.js'

const $ = id => document.getElementById(id)

const pagina = $('pagina')
const achtergrond = $('achtergrond')
const tekening = $('tekening')
const tekeningBoven = $('tekening-boven')
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
let reisCijfers = null   // per dag de statistieken en het profiel
let stopIndex = null     // tot welke stop de voortgangsbalk gevuld is
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
  // het voortgangsstrookje is paginabreed maar veel lager: het hoort onder
  // een foto, niet op een eigen bladzijde
  const maat = paginaType === 'voortgang' ? voortgangMaat(stijl) : paginaMaat(stijl)
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
  // De statistiekpagina heeft normaal geen kaartachtergrond, behalve als je
  // daar juist de dagkaart als achtergrond koos.
  const kaartAlsAchtergrond = paginaType === 'stats' &&
    stijl['statistieken.achtergrond'] === 'kaart'

  if (!kaartAlsAchtergrond &&
      (paginaType === 'stats' || paginaType === 'reiscijfers' || paginaType === 'voortgang')) {
    achtergrond.removeAttribute('src')
    achtergrond.style.width = '0'
    // ook de opgetilde plaatsnamen weg: die horen bij de kaart, en anders
    // lekken Akureyri en Egilsstadir door op de statistiekpagina
    bovenlaag.removeAttribute('src')
    bovenlaag.style.display = 'none'
    vorigeAchtergrondSleutel = null
    // deze pagina's hebben geen kaartachtergrond, dus hier is het al klaar
    zegt('klaar')
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
    achtergrond.style.opacity = kaartAlsAchtergrond
      ? String(stijl['statistieken.achtergrondDekking'])
      : '1'

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
  // alleen de dagkaart gebruikt de bovenste tekenlaag; de andere paginas
  // hebben geen opgetilde plaatsnamen, dus daar blijft hij leeg
  tekeningBoven.replaceChildren()

  if (paginaType === 'voortgang') {
    if (!gegevens) return
    tekenVoortgang(tekening, opschriften, gegevens, stijl, stopIndex)
    pasPlaatsingToe(pagina, plaatsingVoorPagina())
    return
  }

  if (paginaType === 'reiscijfers') {
    if (!reisCijfers) return
    tekenReisCijfers(tekening, opschriften, reisCijfers, stijl)
    pasPlaatsingToe(pagina, plaatsingVoorPagina())
    return
  }

  if (paginaType === 'overzicht') {
    if (!reis) return
    tekenOverzicht(tekening, opschriften, reis, stijl)
  } else if (!gegevens) {
    return
  } else if (paginaType === 'stats') {
    tekenStatistieken(tekening, opschriften, gegevens, stijl)
  } else {
    const view = teken(tekening, opschriften, gegevens, stijl, tekeningBoven)
    // het bijwerk krijgt de plaatsing mee: de schaalbalk en het inzetkaartje
    // worden op hun eigen maat opnieuw opgebouwd in plaats van uitgerekt
    tekenBijwerk(opschriften, gegevens, stijl, view,
      { silhouet, reis, svgLaag: tekeningBoven, plaatsing: plaatsingVoorPagina() })
  }

  // de handmatige verschuivingen liggen over de standaardopmaak heen.
  // Op de pagina en niet op de opschriftenlaag: de markers en het kompas
  // staan in de tekenlaag en horen er net zo goed bij.
  pasPlaatsingToe(pagina, plaatsingVoorPagina())
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

async function laadReisCijfers () {
  if (reisCijfers) return
  zegt('cijfers van alle acht dagen verzamelen (eerste keer duurt even)…')
  reisCijfers = await (await fetch('/api/reis-cijfers')).json()
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
  if (paginaType === 'reiscijfers') {
    await laadReisCijfers()
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
      stopIndex = null
      if (paginaType === 'voortgang') vulStopkiezer()
      vorigeAchtergrondSleutel = null
      hertekenAlles()
    } catch (fout) { zegt(`dag laden mislukt: ${fout.message}`) }
  })

  // ------ stopkiezer, alleen voor de voortgangsbalk
  function vulStopkiezer () {
    const kiezer = $('stop')
    kiezer.replaceChildren()
    if (!gegevens) return
    const { stops } = stopsMetAfstand(gegevens)
    for (const stop of stops) {
      const o = document.createElement('option')
      o.value = String(stop.index)
      o.textContent = `${stop.naam || '(naamloos)'} · ${stop.km.toFixed(0)} km`
      kiezer.append(o)
    }
    if (stopIndex === null && stops.length) stopIndex = stops[0].index
    kiezer.value = String(stopIndex ?? stops[0]?.index ?? 0)
  }

  $('stop').addEventListener('change', e => {
    stopIndex = Number(e.target.value)
    hertekenAlles()
  })

  // ------ paginakiezer
  for (const knop of $('paginakiezer').querySelectorAll('button')) {
    knop.addEventListener('click', async () => {
      paginaType = knop.dataset.pagina
      for (const k of $('paginakiezer').querySelectorAll('button')) {
        k.classList.toggle('actief', k === knop)
      }
      $('dag').disabled = paginaType === 'overzicht' || paginaType === 'reiscijfers'
      paneel.zetPagina(paginaType)
      if (paginaType === 'overzicht') await laadReis()
      if (paginaType === 'reiscijfers') await laadReisCijfers()

      $('stopkiezer-rij').classList.toggle('verborgen', paginaType !== 'voortgang')
      if (paginaType === 'voortgang') vulStopkiezer()

      // De overzichtskaart hoort bij het boek, niet bij een losse dag: wissel
      // daarom naar de boekinstellingen en terug.
      stijl = { ...(paginaType === 'overzicht' || paginaType === 'reiscijfers'
        ? gegevens.boekStijl : gegevens.stijl) }
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

  // ------ verslepen, schalen en teksten aanpassen
  //
  // Het doel is per paginatype een eigen hoekje in de plaatsing: de titel mag
  // op de kaart ergens anders staan dan op de statistiekpagina.
  const plaatsingDoel = () => paginaType === 'overzicht'
    ? ((boek.plaatsing ??= {}).overzicht ??= {})
    : ((gegevens.dag.plaatsing ??= {})[paginaType] ??= {})

  maakBewerkbaar(pagina, {
    huidigePlaatsing: plaatsingVoorPagina,

    bijVerschuiven: (id, dxMm, dyMm) => {
      const doel = plaatsingDoel()
      doel[id] = { ...doel[id], dxMm, dyMm }
      bewaarPlaatsing(`verplaatst: ${id}`)
    },

    bijSchalen: (id, schaal) => {
      const doel = plaatsingDoel()
      doel[id] = { dxMm: 0, dyMm: 0, ...doel[id], schaal }
      bewaarPlaatsing(`geschaald: ${id} (${schaal}×)`)
      // de schaalbalk en het inzetkaartje bouwen zichzelf op hun nieuwe maat
      // opnieuw op, dus die hebben een hertekening nodig
      tekenPagina()
    },

    bijTekst: (id, tekst) => {
      pasTekstToe(id, tekst)
      bewaarTekst(id)
      tekenPagina()
      return true
    },

    // klikken zonder te slepen: het paneel springt naar de knoppen die
    // bij dit onderdeel horen
    bijKlik: groep => paneel.toon(groep),

    bijMelding: zegt
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

/**
 * Wat er nog naar de server moet. Wordt samengevoegd tot de timer afloopt.
 *
 * Bewust alleen de velden die je werkelijk aanraakte.
 *
 * Eerder ging bij elke sleep de hele dag mee - titel, tekst en alle waypoints -
 * uit het geheugen van dit tabblad. Werd het dagbestand ondertussen buiten de
 * preview om aangepast, dan overschreef de eerstvolgende sleep dat weer met de
 * oude inhoud van dit tabblad. Een dagverhaal van duizend tekens was zo weg
 * door een titelblok twee millimeter te verschuiven.
 */
let teBewaren = null

const stuurOpmaak = ontdubbel(async () => {
  const velden = teBewaren
  teBewaren = null
  if (!velden) return

  const { melding, ...rest } = velden

  try {
    const antwoord = await fetch('/api/opmaak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dag: huidigeDag, ...rest })
    })
    zegt(antwoord.ok ? `${melding} · bewaard` : 'bewaren mislukt')
  } catch (fout) {
    zegt(`bewaren mislukt: ${fout.message}`)
  }
}, 600)

/** Zet velden klaar om te bewaren; meerdere handelingen vlak na elkaar gaan samen. */
function bewaarOpmaak (melding, velden) {
  teBewaren = { ...teBewaren, ...velden, melding }
  stuurOpmaak()
}

/** Slepen en schalen raken alleen de plaatsing. */
function bewaarPlaatsing (melding) {
  bewaarOpmaak(melding, {
    plaatsing: gegevens.dag.plaatsing,
    boek: paginaType === 'overzicht' ? { plaatsing: boek.plaatsing } : undefined
  })
}

/** Een tekstwijziging raakt precies één veld. */
function bewaarTekst (id) {
  if (id === 'titel') return bewaarOpmaak('titel aangepast', { titel: gegevens.dag.titel })
  if (id === 'tekst') return bewaarOpmaak('tekst aangepast', { tekst: gegevens.dag.tekst })

  if (id === 'overzichtstitel' || id === 'bron') {
    return bewaarOpmaak('tekst aangepast', {
      boek: { overzicht: boek.overzicht, bron: boek.bron }
    })
  }

  // een plaatsnaam: de waypoints gaan mee, want de server past de naam ook
  // op de andere dagen aan waar hetzelfde punt voorkomt
  bewaarOpmaak('naam aangepast', { waypoints: gegevens.dag.waypoints })
}

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
