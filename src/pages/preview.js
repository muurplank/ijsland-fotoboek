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
import { tekenBijwerk, inzetMaten } from './furniture.js'
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
let silhouetSleutel = null
let vorigeAchtergrondSleutel = null
let boek = {}
let presets = []
let stoppenOpen = false   // of de stoppenlijst in het paneel openstaat

/**
 * Labels die je even kwijt wilde door ze leeg te maken.
 *
 * Bewust alleen in het geheugen: dit gaat nooit naar een dagbestand, en na een
 * herlaadbeurt staan ze er weer. Wil je een stop blijvend weghebben, dan is het
 * vinkje in de stoppenlijst de plek daarvoor.
 */
let tijdelijkVerborgen = new Set()

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

/**
 * Het silhouet van IJsland voor het inzetkaartje.
 *
 * De sleutel is de hele adresregel en niet alleen de landkleur: de kustrand
 * wordt op de server van millimeters naar beeldpunten omgerekend, dus die hangt
 * ook aan de kleur van de rand, de dikte ervan en de breedte van het kaartje.
 * Alleen op de landkleur letten zou betekenen dat er zichtbaar niets verandert
 * als je aan een van die andere drie draait.
 */
async function silhouetNu () {
  if (!stijl['inzet.aan'] || paginaType !== 'kaart') return

  const { binnenBreedte } = inzetMaten(stijl, plaatsingVoorPagina())
  const adres = '/api/inzet?' + new URLSearchParams({
    kleur: stijl['inzet.landKleur'],
    kust: stijl['inzet.kustKleur'],
    kustMm: String(stijl['inzet.kustMm']),
    mm: binnenBreedte.toFixed(2)
  })
  if (adres === silhouetSleutel) return
  silhouetSleutel = adres

  try {
    const antwoord = await fetch(adres)
    if (!antwoord.ok) throw new Error(await antwoord.text())
    const bounds = JSON.parse(antwoord.headers.get('x-bounds'))
    const oud = silhouet?.url
    silhouet = { url: URL.createObjectURL(await antwoord.blob()), bounds }
    tekenPagina()
    // pas opruimen nadat het nieuwe plaatje staat, anders knippert het weg
    if (oud) URL.revokeObjectURL(oud)
  } catch (fout) {
    silhouetSleutel = null // zodat een volgende poging het opnieuw probeert
    zegt(`inzetkaartje mislukt: ${fout.message}`)
  }
}

// Slepen aan de breedte verandert de kustdikte in beeldpunten, en elke stap zou
// anders een nieuwe render van het hele eiland uitlokken.
const haalSilhouet = ontdubbel(silhouetNu, 260)

/** De hele reis, voor de vage lijn op het inzetkaartje. */
async function haalReis () {
  if (reis || paginaType !== 'kaart' || !stijl['inzet.aan']) return
  try {
    await laadReis()
    tekenPagina()
  } catch (fout) {
    // het kaartje tekent zonder de hele reis gewoon door, dus dit mag misgaan
    zegt(`hele reis ophalen mislukt: ${fout.message}`)
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
  haalReis()
}

/** ------------------------------------------------------- gegevens laden */

async function laadDag (nummer) {
  zegt(`dag ${nummer} ophalen (eerste keer kan even duren)…`)
  gegevens = await (await fetch(`/api/dag?dag=${nummer}`)).json()
  if (gegevens.fout) throw new Error(gegevens.fout)

  // verse dag, verse lijst met even weggeklikte labels
  tijdelijkVerborgen = new Set()
  gegevens.tijdelijkVerborgen = tijdelijkVerborgen

  huidigeDag = nummer
  document.title = `Dag ${gegevens.dag.dag} — ${gegevens.dag.titel}`
}

async function laadReis () {
  if (reis) return
  zegt('alle dagen ophalen…')
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
    // niet de ontdubbelde versies: die komen pas na een tel, en dan staat
    // klaarVoorExport allang aan en mist de PDF de vage reislijn
    await silhouetNu()
    if (paginaType === 'kaart' && stijl['inzet.aan']) await laadReis()
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

      // De instellingen blijven staan waar je ze had.
      //
      // Eerder werden ze vervangen door wat er voor de nieuwe dag opgeslagen
      // stond, en dan sprong alles waar je net aan gedraaid had terug zodra je
      // even op een andere dag keek. Je bent meestal aan het boek als geheel
      // aan het werken, niet aan één dag - vandaar dat de knoppen meereizen.
      // Met "Alleen deze dag" leg je ze alsnog per dag vast.
      stopIndex = null
      paneel.zetStops(bouwStoppenlijst())
      if (paginaType === 'voortgang') vulStopkiezer()
      vorigeAchtergrondSleutel = null
      hertekenAlles()
    } catch (fout) { zegt(`dag laden mislukt: ${fout.message}`) }
  })

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
      if (!tekst.trim()) return leegGemaakt(id)

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

  paneel.zetStops(bouwStoppenlijst())

  // De pagina kan ook rechtstreeks uit de adresbalk komen (?pagina=voortgang),
  // en dan is er nooit op een paginaknop geklikt. Dezelfde stand dus alsnog
  // zetten, anders blijft de stopkiezer verborgen en leeg.
  for (const k of $('paginakiezer').querySelectorAll('button')) {
    k.classList.toggle('actief', k.dataset.pagina === paginaType)
  }
  $('dag').disabled = paginaType === 'overzicht' || paginaType === 'reiscijfers'
  $('stopkiezer-rij').classList.toggle('verborgen', paginaType !== 'voortgang')
  if (paginaType === 'voortgang') vulStopkiezer()

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

/** Vult de keuzelijst "Tot" met de stops die aan staan; alleen voor de voortgangsbalk. */
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

  // de stop waar hij op stond kan net uitgezet zijn; dan terug naar de eerste
  if (!stops.some(s => s.index === stopIndex)) stopIndex = stops[0]?.index ?? null
  kiezer.value = String(stopIndex ?? 0)
}

/**
 * De stops van deze dag, elk met een vinkje om hem aan of uit te zetten.
 *
 * Niet elk punt in een dagbestand verdient een plek op de kaart: een tankstop,
 * een keerpunt dat je alleen nodig had om de route langs de goede weg te
 * sturen, of een punt dat je per ongeluk aantikte. Uitzetten laat het punt in
 * de route staan - je reed er langs, dus de kilometers kloppen - maar haalt de
 * stip, de naam en de plek in de voortgangsbalk weg.
 */
function bouwStoppenlijst () {
  const doos = document.createElement('details')
  doos.className = 'groep stoppen'

  // De lijst wordt na elk vinkje opnieuw opgebouwd, want de kop telt mee
  // hoeveel er aan staan. Zonder dit klapte hij daarbij steeds dicht en kon je
  // er geen twee achter elkaar uitzetten.
  doos.open = stoppenOpen
  doos.addEventListener('toggle', () => { stoppenOpen = doos.open })

  const waypoints = gegevens?.dag.waypoints ?? []
  const zichtbaar = waypoints.filter(w => w.type !== 'via')
  const uit = zichtbaar.filter(w => w.toon === false).length

  const kop = document.createElement('summary')
  kop.append(Object.assign(document.createElement('span'), {
    textContent: uit ? `Stops (${zichtbaar.length - uit} van ${zichtbaar.length} aan)` : 'Stops'
  }))
  doos.append(kop)

  for (const [i, w] of waypoints.entries()) {
    if (w.type === 'via') continue

    const rij = document.createElement('div')
    rij.className = 'knop'

    const regel = document.createElement('div')
    regel.className = 'aanuit'

    const vinkje = document.createElement('input')
    vinkje.type = 'checkbox'
    vinkje.checked = w.toon !== false

    const naam = document.createElement('label')
    naam.textContent = w.name || '(naamloos)'
    if (!w.name) naam.style.opacity = '.6'

    vinkje.addEventListener('change', () => {
      // alleen opschrijven als hij uit staat; standaard is aan, en dan hoort
      // er niets extra's in het dagbestand te komen
      if (vinkje.checked) delete w.toon
      else w.toon = false

      bewaarOpmaak(`stop ${vinkje.checked ? 'aan' : 'uit'}: ${w.name || '(naamloos)'}`,
        { waypoints: gegevens.dag.waypoints })

      if (paginaType === 'voortgang') vulStopkiezer()
      tekenPagina()
      paneel.zetStops(bouwStoppenlijst())
    })

    regel.append(vinkje, naam)
    rij.append(regel)
    doos.append(rij)
  }

  return doos
}

/**
 * Wat er gebeurt als je een tekst helemaal leeghaalt.
 *
 * Voor een plaatsnaam is dat een manier om hem even weg te hebben: hij
 * verdwijnt van de kaart, maar alleen in dit tabblad. De naam blijft gewoon in
 * het dagbestand staan, dus na een herlaadbeurt is hij er weer. Zo kun je
 * proberen hoe de kaart eruitziet zonder dat label zonder iets kwijt te raken.
 *
 * Voor de andere teksten niet. Na het dubbelklikken staat alles geselecteerd,
 * dus één backspace maakt een dagverhaal van duizend tekens leeg - en dát is
 * bijna nooit de bedoeling. Die wijziging nemen we niet aan.
 *
 * @returns {boolean} of de wijziging is aangenomen
 */
function leegGemaakt (id) {
  const waypoint = id.match(/^waypoint:(\d+)$/)

  if (waypoint) {
    tijdelijkVerborgen.add(Number(waypoint[1]))
    tekenPagina()
    zegt('label verborgen tot je de pagina herlaadt - de naam blijft bewaard')
    return true
  }

  zegt('deze tekst kan niet leeg - met Escape maak je een bewerking ongedaan')
  return false
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
