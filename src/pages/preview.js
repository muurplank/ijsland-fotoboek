/**
 * De bedieningspagina: knoopt het paneel, de pagina en de server aan elkaar.
 *
 * Wat je hier ziet is exact wat er geprint wordt. Alle maten staan in
 * millimeters; --mm bepaalt hoeveel schermpixels een millimeter is, en dat is
 * het enige verschil tussen scherm en druk.
 *
 * De paginatypes delen dezelfde opmaakmachine:
 *   voorblad   - het omslag: de omtrek van het eiland en de ring van de reis
 *   kaart      - de dagkaart met route
 *   stats      - hoogteprofiel en kerncijfers
 *   overzicht  - de hele reis op een kaart
 *   reiscijfers- de cijfers van alle dagen naast elkaar
 *   voortgang  - het strookje dat over een foto gaat
 */

import { bouwPaneel } from './panel.js'
import { teken, tekenOmgevingsnamen } from './draw.js'
import { tekenBijwerk, inzetMaten } from './furniture.js'
import { tekenStatistieken } from './statspage.js'
import { tekenOverzicht } from './overview.js'
import { tekenVoorblad } from './voorblad.js'
import { tekenReisCijfers } from './tripstats.js'
import { tekenVoortgang, stopsMetAfstand } from './progress.js'
import { tekenStempelOpKaart } from './postzegel.js'
import { papierKnopen } from '../render/papier.js'
import { bouwSvg } from '../render/profielvorm.js'
import { maakBewerkbaar, pasPlaatsingToe } from './editable.js'
import { achtergrondSleutel, paginaMaat, voortgangMaat } from '../render/layout.js'
import { klem, knop as knopVan } from '../style.js'

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

/**
 * De bladen die bij het boek horen en niet bij een losse dag.
 *
 * Ze delen drie dingen: ze gebruiken de boekstijl in plaats van de dagstijl, hun
 * verschuivingen gaan naar boek.plaatsing, en de dagkiezer doet er niets. Die
 * toets stond eerst op vijf plekken los uitgeschreven, en dat is precies het
 * soort ding waar je er bij het zesde blad eentje van vergeet.
 */
const BOEKBREED = new Set(['voorblad', 'overzicht', 'reiscijfers'])
let silhouet = null
let silhouetSleutel = null
let kust = null            // de omtrek van IJsland, voor het voorblad
let kustSleutel = null
// De achtergrondplaat van het voorblad gaat niet naar de <img> achter de
// tekening maar naar een <image> ín de SVG, want het masker leeft in de
// millimeter-userspace van die SVG. Vandaar dat hij hier apart staat.
let voorbladPlaat = null
let plaatsen = []          // bekende plaatsen binnen de uitsnede
let plaatsenSleutel = null
let schilden = []          // waar de wegnummers in de kaartplaat staan
let vorigeAchtergrondSleutel = null
let boek = {}
let presets = []
let heros = {}          // per dag de stempels en de veldnotitie, uit data/hero/
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
  // Het strookje krijgt geen paginakleur: het is geen bladzijde maar iets wat
  // je over een foto legt, en dan moet de foto er onderuit komen. Op het scherm
  // zie je het ruitjespatroon van het werkblad erdoorheen, in de PNG blijft het
  // doorzichtig.
  const doorzichtig = (paginaType === 'voortgang' && stijl['voortgang.doorzichtig']) ||
    (paginaType === 'voorblad' && stijl['voorblad.doorzichtig'])
  pagina.style.setProperty('--paginakleur', doorzichtig ? 'transparent' : stijl['pagina.achtergrond'])

  const dpi = stijl['pagina.dpi']
  const px = m => Math.round((m / 25.4) * dpi)
  maatinfo.textContent =
    `${maat.snijBreedteMm} × ${maat.snijHoogteMm} mm + ${maat.afloopMm} mm afloop · ` +
    `${dpi} dpi · export ${px(maat.breedteMm)} × ${px(maat.hoogteMm)} px`
}

/**
 * De drie letterfamilies.
 *
 * American Typewriter staat alleen op macOS. Courier New staat daar wél overal
 * achter, dus op een andere machine - of in de gebakken docs/ - valt de
 * typemachine daarop terug. Iets minder mooi, maar wel dezelfde soort letter:
 * een schrijfmachineletter met schreven, en niet ineens een schreefloze.
 */
const LETTERS = {
  'systeem-schreefloos': '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  'systeem-schreef': 'Georgia, "Times New Roman", serif',
  typemachine: '"American Typewriter", "Courier New", Courier, ui-monospace, monospace'
}

function zetTypografie () {
  const p = pagina.style
  p.setProperty('--labelkleur', stijl['labels.kleur'])
  p.setProperty('--labelgrootte', `calc(${stijl['labels.grootteMm']} * var(--mm))`)
  p.setProperty('--halokleur', stijl['labels.haloKleur'])
  p.setProperty('--halo', `calc(${stijl['labels.haloMm']} * var(--mm))`)
  p.setProperty('--letterafstand', `${stijl['labels.letterafstand']}em`)
  p.setProperty('--hoofdletters', stijl['labels.hoofdletters'] ? 'uppercase' : 'none')
  p.setProperty('--omgevingkleur', stijl['labels.omgevingKleur'])
  p.setProperty('--omgevinggrootte', `calc(${stijl['labels.omgevingGrootteMm']} * var(--mm))`)
  p.fontFamily = LETTERS[stijl['typografie.lettertype']] ?? LETTERS['systeem-schreefloos']
}

/** ------------------------------------------------------- achtergrond */

async function achtergrondNu () {
  // de statistiekpagina heeft geen kaartachtergrond
  // De statistiekpagina heeft normaal geen kaartachtergrond, behalve als je
  // daar juist de dagkaart als achtergrond koos.
  const kaartAlsAchtergrond = paginaType === 'stats' &&
    stijl['statistieken.achtergrond'] === 'kaart'

  // Het voorblad zonder kaart hoeft niets op te halen. De sleutel gaat op nul,
  // want anders denkt de volgende ronde dat de plaat er al is: voorblad.kaart
  // zit niet in de achtergrondknoppen, dus de sleutel zou niet veranderen en
  // terugzetten op "eiland" leverde een leeg eiland op.
  if (paginaType === 'voorblad' && stijl['voorblad.kaart'] === 'geen') {
    if (voorbladPlaat) URL.revokeObjectURL(voorbladPlaat.url)
    voorbladPlaat = null
    achtergrond.removeAttribute('src')
    achtergrond.style.width = '0'
    bovenlaag.style.display = 'none'
    vorigeAchtergrondSleutel = null
    tekenPagina()
    zegt('klaar')
    return
  }

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
  const wat = paginaType === 'overzicht'
    ? '&overzicht=1'
    : paginaType === 'voorblad' ? '&voorblad=1' : ''

  // Het voorblad mag een andere kaartlaag hebben dan de rest van het boek, en
  // dat gaat door lagen.stijl te overschrijven in wat we meesturen in plaats van
  // door het te bewaren. Zo houdt het blad zijn eigen laag zonder dat de
  // dagkaarten meeveranderen - die lezen dezelfde boekstijl.
  const laag = paginaType === 'voorblad' && stijl['voorblad.kaartLaag'] !== 'zoals het boek'
    ? { ...stijl, 'lagen.stijl': stijl['voorblad.kaartLaag'] }
    : stijl

  const url = `/api/achtergrond?dag=${huidigeDag}${dpi}${wat}` +
    `&stijl=${encodeURIComponent(JSON.stringify(laag))}`

  try {
    const antwoord = await fetch(url)
    if (!antwoord.ok) throw new Error((await antwoord.text()).slice(0, 200))

    const plaatsing = JSON.parse(antwoord.headers.get('x-plaatsing'))
    schilden = plaatsing.schilden ?? []
    const blob = await antwoord.blob()

    // Het voorblad gebruikt de plaat als <image> binnen de tekening, zodat hij
    // in hetzelfde stelsel staat als het masker dat hem uitknipt. Eerst laten
    // decoderen en dán pas tekenen: zo staat het beeld er meteen, ook bij de
    // export, waar niemand een tweede tekenronde afwacht.
    if (paginaType === 'voorblad') {
      const vers = URL.createObjectURL(blob)
      const proef = new Image()
      proef.src = vers
      await proef.decode().catch(() => {})

      const vorige = voorbladPlaat?.url
      voorbladPlaat = { url: vers, ...plaatsing }
      if (vorige) URL.revokeObjectURL(vorige)

      achtergrond.removeAttribute('src')
      achtergrond.style.width = '0'
      bovenlaag.style.display = 'none'
      tekenPagina()
      zegt('klaar')
      return
    }

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

  const { binnenBreedte } = inzetMaten(stijl)
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

/**
 * De bekende plaatsen binnen deze uitsnede.
 *
 * Alleen de knoppen die de uitsnede bepalen gaan mee, en die vormen meteen de
 * sleutel: aan een kleur draaien hoeft geen namen op te halen, aan de zoom wel.
 * De server cachet het antwoord op schijf, dus dezelfde uitsnede is daarna gratis.
 */
const UITSNEDE_KNOPPEN = [
  'pagina.breedteMm', 'pagina.hoogteMm', 'pagina.afloopMm',
  'uitsnede.zoom', 'uitsnede.panXMm', 'uitsnede.panYMm', 'uitsnede.margeMm'
]

async function haalPlaatsnamen () {
  const kaartachtig = paginaType === 'kaart' || paginaType === 'overzicht'
  if (!kaartachtig || !stijl['labels.omgevingAan']) return
  if (paginaType === 'kaart' && !gegevens) return

  const vraag = new URLSearchParams({
    dag: String(huidigeDag),
    stijl: JSON.stringify(Object.fromEntries(UITSNEDE_KNOPPEN.map(k => [k, stijl[k]])))
  })
  if (paginaType === 'overzicht') vraag.set('overzicht', '1')

  const adres = `/api/plaatsen?${vraag}`
  if (adres === plaatsenSleutel) return
  plaatsenSleutel = adres

  try {
    const antwoord = await fetch(adres)
    if (!antwoord.ok) throw new Error(await antwoord.text())
    const uit = await antwoord.json()
    plaatsen = uit.plaatsen ?? []
    if (uit.fout) zegt(`plaatsnamen: ${uit.fout}`)
    tekenPagina()
  } catch (fout) {
    // de kaart tekent zonder bekende plaatsen gewoon door
    plaatsenSleutel = null
    zegt(`plaatsnamen ophalen mislukt: ${fout.message}`)
  }
}

/**
 * De omtrek van IJsland, voor het voorblad.
 *
 * Hangt aan één knop - hoe klein een eiland nog mag zijn - en verder aan niets,
 * dus de sleutel is dat ene getal. Anders dan het silhouet van het inzetkaartje
 * is dit geen plaatje maar een lijst ringen in lengte- en breedtegraden.
 */
async function kustNu () {
  if (paginaType !== 'voorblad') return

  const sleutel = String(stijl['voorblad.kustDetail'])
  if (sleutel === kustSleutel && kust) return
  kustSleutel = sleutel

  try {
    zegt('omtrek van IJsland ophalen…')
    kust = await (await fetch(`/api/kustlijn?minKm2=${sleutel}`)).json()
    tekenPagina()
    zegt('klaar')
  } catch (fout) {
    kustSleutel = null
    zegt(`omtrek ophalen mislukt: ${fout.message}`)
  }
}

const haalKust = ontdubbel(kustNu, 200)

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

  if (paginaType === 'voorblad') {
    tekenVoorblad(tekening, opschriften,
      { reis, kust, boek, plaat: voorbladPlaat }, stijl)
    pasPlaatsingToe(pagina, plaatsingVoorPagina())
    return
  }

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
    const view = tekenOverzicht(tekening, opschriften, reis, stijl)
    // De overzichtskaart zet geen namen bij de stops - alleen dagnummers - dus
    // er is ook niets dat een bekende plaats overbodig maakt. Zou hier de lijst
    // met stops meegaan, dan viel juist Reykjavík af terwijl zijn buitenwijken
    // bleven staan.
    zetOmgevingsnamen(view, [])
  } else if (!gegevens) {
    return
  } else if (paginaType === 'stats') {
    tekenStatistieken(tekening, opschriften,
      { ...gegevens, hero: heros[huidigeDag], plaatsing: plaatsingVoorPagina() }, stijl)
  } else {
    const view = teken(tekening, opschriften, gegevens, stijl, tekeningBoven)
    // Het vel over de kaart: boven de kaartplaat, maar vóór de route getekend,
    // dus onder de route. Zo lijkt alles op hetzelfde papier gedrukt zonder dat
    // de lijn die je moet kunnen volgen erdoor vertroebelt.
    legPapierOverKaart()
    // het bijwerk krijgt de plaatsing mee: de schaalbalk en het inzetkaartje
    // worden op hun eigen maat opnieuw opgebouwd in plaats van uitgerekt
    tekenBijwerk(opschriften, gegevens, stijl, view,
      { silhouet, reis, svgLaag: tekeningBoven, plaatsing: plaatsingVoorPagina() })
    tekenStempelOpKaart(opschriften, heros[huidigeDag], stijl,
      paginaMaat(stijl), paginaMaat(stijl).afloopMm + stijl['pagina.veiligeMargeMm'])
    zetOmgevingsnamen(view, benoemdePunten(gegevens.dag.waypoints))
  }

  // de handmatige verschuivingen liggen over de standaardopmaak heen.
  // Op de pagina en niet op de opschriftenlaag: de markers en het kompas
  // staan in de tekenlaag en horen er net zo goed bij.
  pasPlaatsingToe(pagina, plaatsingVoorPagina())
}

/**
 * De punten die op de kaart al met zoveel woorden benoemd zijn.
 *
 * Alleen dié houden een bekende plaats tegen. De doorrijpunten waarmee de route
 * langs de goede weg gestuurd wordt zijn naamloos en staan met tientallen langs
 * de route; die zouden anders elke plaats waar je doorheen reed van de kaart
 * houden - juist de plaatsen die je wilt kunnen aanwijzen.
 */
function benoemdePunten (waypoints) {
  return waypoints.filter(w =>
    w.toon !== false && w.type !== 'via' && w.toonLabel !== false && (w.name ?? '').trim())
}

/**
 * De bekende plaatsen erbij zetten, als laatste onderdeel van de kaart.
 *
 * Eerst de verschuivingen toepassen en dan pas meten: een naam hoort te wijken
 * voor het titelblok zoals jij dat neergezet hebt, niet voor waar het van
 * zichzelf zou staan. Daarna volgt in `tekenPagina` nog een tweede ronde
 * verschuivingen, en die pikt deze verse namen op.
 */
function zetOmgevingsnamen (view, punten) {
  const plaatsing = plaatsingVoorPagina()
  pasPlaatsingToe(pagina, plaatsing)

  // De wegnummers zitten in de kaartplaat gebakken, dus er staat niets in de
  // pagina wat je kunt opmeten. Ze komen als millimeters mee met de plaat en
  // worden hier omgerekend naar het scherm, zodat een naam er niet bovenop valt.
  const mmPx = parseFloat(getComputedStyle(pagina).getPropertyValue('--mm')) || 1
  const hoek = pagina.getBoundingClientRect()
  const gebakken = schilden.map(s => ({
    left: hoek.left + s.xMm * mmPx,
    top: hoek.top + s.yMm * mmPx,
    right: hoek.left + (s.xMm + s.breedteMm) * mmPx,
    bottom: hoek.top + (s.yMm + s.hoogteMm) * mmPx
  }))

  tekenOmgevingsnamen(pagina, opschriften, stijl, view, { plaatsen, punten, plaatsing, gebakken })
}

/**
 * Hetzelfde vel als op de cijferpagina, maar dan over de kaart.
 *
 * Zonder grondvlak: alleen de vezels, de sporen en de vuile randen. Met vlak
 * zou de kaart eronder verdwijnen, en dan is het geen papier meer maar verf.
 *
 * De laag gaat vooraan in de tekenlaag, dus onder alles wat daar al staat.
 */
function legPapierOverKaart () {
  if (!stijl['papier.overKaart']) return

  const maat = paginaMaat(stijl)
  const vel = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  vel.setAttribute('opacity', String(stijl['papier.overKaartDekking']))
  vel.setAttribute('pointer-events', 'none')

  for (const knoop of papierKnopen({
    breedteMm: maat.breedteMm,
    hoogteMm: maat.hoogteMm,
    stijl,
    zaad: huidigeDag,
    id: 'kaartpapier',
    grondvlak: false
  })) {
    vel.append(bouwSvg(knoop))
  }

  tekening.prepend(vel)
}

/** De verschuivingen die bij dit paginatype horen. */
function plaatsingVoorPagina () {
  if (BOEKBREED.has(paginaType)) return boek.plaatsing?.[paginaType] ?? {}
  return gegevens?.dag.plaatsing?.[paginaType] ?? {}
}

function hertekenAlles () {
  schaalPagina()
  zetTypografie()
  tekenPagina()
  haalAchtergrond()
  haalSilhouet()
  haalKust()
  haalReis()
  haalPlaatsnamen()
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

  // De stempels van deze dag erbij. Mag ontbreken, dus dit mag de dag nooit
  // laten mislukken - vandaar dat laadHero zelf alles opslikt.
  await laadHero(nummer)
}

/**
 * De stempels en de veldnotitie van een dag.
 *
 * Mag ontbreken: dagen waarvan nog geen heropfoto door src/stempel.js is gehaald
 * krijgen simpelweg geen stempelband. Daarom wordt een mislukking hier stil
 * opgeslikt en niet als fout gemeld - er is niets kapot, er is alleen nog niets.
 */
async function laadHero (nummer) {
  if (nummer in heros) return heros[nummer]
  try {
    const antwoord = await fetch('/api/hero')
    heros = antwoord.ok ? await antwoord.json() : {}
  } catch {
    heros = {}
  }
  return heros[nummer]
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

  if (BOEKBREED.has(paginaType)) stijl = { ...gegevens.boekStijl }
  if (paginaType === 'overzicht' || paginaType === 'voorblad') await laadReis()
  if (paginaType === 'reiscijfers') await laadReisCijfers()

  // ------ exportmodus: geen paneel, en pas klaarmelden als alles getekend is
  if (EXPORT) {
    document.body.classList.add('exporteren')
    schaalPagina()
    zetTypografie()
    // niet de ontdubbelde versies: die komen pas na een tel, en dan staat
    // klaarVoorExport allang aan en mist de PDF de vage reislijn
    await silhouetNu()
    if (paginaType === 'kaart' && stijl['inzet.aan']) await laadReis()
    // Het voorblad kan niets tekenen zonder de omtrek: die bepaalt de uitsnede.
    await kustNu()
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
      $('dag').disabled = BOEKBREED.has(paginaType)
      paneel.zetPagina(paginaType)
      if (paginaType === 'overzicht' || paginaType === 'voorblad') await laadReis()
      if (paginaType === 'reiscijfers') await laadReisCijfers()

      $('stopkiezer-rij').classList.toggle('verborgen', paginaType !== 'voortgang')
      if (paginaType === 'voortgang') vulStopkiezer()

      // Het voorblad, de overzichtskaart en de reiscijfers horen bij het boek
      // en niet bij een losse dag: wissel daarom naar de boekinstellingen en
      // terug.
      stijl = { ...(BOEKBREED.has(paginaType) ? gegevens.boekStijl : gegevens.stijl) }
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
  const plaatsingDoel = () => BOEKBREED.has(paginaType)
    ? ((boek.plaatsing ??= {})[paginaType] ??= {})
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

    // Een tekstvak dat je aan zijn hoek groter of kleiner sleept, waarbij de
    // tekst zich erin herwikkelt. De letter blijft even groot; alleen de doos
    // verandert. null zet hem terug op de standaardmaat van de opmaak.
    bijDoos: (id, maat) => {
      const doel = plaatsingDoel()
      if (maat === null) {
        if (doel[id]) { delete doel[id].breedteMm; delete doel[id].hoogteMm }
        bewaarPlaatsing(`maat terug: ${id}`)
      } else {
        doel[id] = { dxMm: 0, dyMm: 0, ...doel[id], ...maat }
        bewaarPlaatsing(`maat: ${id} (${maat.breedteMm} × ${maat.hoogteMm} mm)`)
      }
      tekenPagina()
    },

    // Een maat die voor het hele boek geldt, zoals de grootte van de markers.
    // Die gaat naar de instelling en niet naar deze ene marker, want anders
    // staan de tentjes in elk dagbestand op een andere maat.
    bijStijlMaat: (key, mm) => {
      const k = knopVan(key)
      if (!k) return

      const waarde = mm === null ? k.standaard : klem(key, mm)
      stijl[key] = waarde
      paneel.zet(key, waarde)
      tekenPagina()
      // Het inzetkaartje heeft een op maat gerenderd silhouet in zich; dat moet
      // in zijn nieuwe breedte opgehaald worden, anders staat er een uitgerekte
      // PNG in. Verandert de breedte niet, dan doet dit niets.
      haalSilhouet()
      zegt(`${k.label}: ${waarde} mm — geldt voor alle dagen, nog bewaren voor het boek`)
    },

    // Het icoontje van de kaart af, met de naam en de voortgangsbalk erbij.
    bijWeghalen: id => {
      // Een bekende plaats die je niet op déze kaart wilt. Dat gaat naar de
      // plaatsing en niet naar een dagbestand: het is een opmaakbesluit over
      // deze pagina, net als het verschuiven ervan, en het blijft dus bewaard.
      const plaats = /^plaats:(.+)$/.exec(id)
      if (plaats) {
        const doel = plaatsingDoel()
        doel[id] = { ...doel[id], verborgen: true }
        bewaarPlaatsing(`plaatsnaam weg: ${plaats[1]}`)
        tekenPagina()
        return
      }

      const m = /^marker:(\d+)$/.exec(id)
      const w = m && gegevens?.dag.waypoints[Number(m[1])]
      if (!w) return

      w.toonIcoon = false
      bewaarOpmaak(`icoontje weg: ${w.name || '(naamloos)'}`,
        { waypoints: gegevens.dag.waypoints })
      tekenPagina()
      paneel.zetStops(bouwStoppenlijst())
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
  $('dag').disabled = BOEKBREED.has(paginaType)
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

    // Op de kaart haal je een icoontje weg met Delete of een dubbelklik. Dat is
    // de snelle weg, maar dan moet er ook een weg terug zijn: hier staat welke
    // er uit staan.
    let terug = null
    if (w.toonIcoon === false) {
      terug = document.createElement('button')
      terug.className = 'stil icoon-terug'
      terug.textContent = 'icoontje uit · terugzetten'
      terug.addEventListener('click', () => {
        delete w.toonIcoon
        bewaarOpmaak(`icoontje terug: ${w.name || '(naamloos)'}`,
          { waypoints: gegevens.dag.waypoints })
        tekenPagina()
        paneel.zetStops(bouwStoppenlijst())
      })
    }

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
    if (terug) rij.append(terug)
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
  if (id === 'voorbladtitel') { (boek.voorblad ??= {}).titel = tekst; return }
  if (id === 'voorbladondertitel') { (boek.voorblad ??= {}).ondertitel = tekst; return }
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
    boek: BOEKBREED.has(paginaType) ? { plaatsing: boek.plaatsing } : undefined
  })
}

/** Een tekstwijziging raakt precies één veld. */
function bewaarTekst (id) {
  if (id === 'titel') return bewaarOpmaak('titel aangepast', { titel: gegevens.dag.titel })
  if (id === 'tekst') return bewaarOpmaak('tekst aangepast', { tekst: gegevens.dag.tekst })

  if (id === 'overzichtstitel' || id === 'voorbladtitel' ||
      id === 'voorbladondertitel' || id === 'bron') {
    return bewaarOpmaak('tekst aangepast', {
      boek: { overzicht: boek.overzicht, voorblad: boek.voorblad, bron: boek.bron }
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
