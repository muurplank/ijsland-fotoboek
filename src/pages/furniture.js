/**
 * Het bijwerk op de kaartpagina: titelblok, inzetkaartje, schaalbalk,
 * noordpijl en bronvermelding.
 *
 * Alles in millimeters op de pagina, net als de rest.
 */

import { MapView } from '../geo/viewport.js'
import { paginaMaat } from '../render/layout.js'
import { padData, projecteer, vereenvoudig } from '../render/svg.js'
import { klem } from '../style.js'
import { kompasGlas, kompasroos } from './compass.js'
import { schaalVan } from './editable.js'

const SVG = 'http://www.w3.org/2000/svg'

const maakSvg = (tag, eigenschappen = {}) => {
  const n = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(eigenschappen)) {
    if (v !== null && v !== undefined) n.setAttribute(k, String(v))
  }
  return n
}

const mm = waarde => `calc(${waarde} * var(--mm))`

/** Een hexkleur met een doorzichtigheid erop, als rgb()-notatie. */
function metDekking (hex, dekking) {
  const h = hex.replace('#', '')
  const n = parseInt(h.slice(0, 6), 16)
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${dekking})`
}

/**
 * Legt het glasplaatje achter een titelblok.
 *
 * Alle vier de paginatypes tekenen hun eigen titelblok, dus dit staat hier
 * apart: zo ziet de titel er op de statistiekpagina hetzelfde uit als op de
 * kaart, en hoeft de vormgeving maar op één plek bijgesteld te worden.
 *
 * Geeft terug of er een plaatje kwam, zodat de aanroeper weet of hij het oude
 * platte vlak nog moet zetten.
 */
export function zetGlas (blok, stijl) {
  if (!stijl['titelblok.glasAan']) return false

  blok.classList.add('glas')
  blok.style.setProperty('--glasvul',
    metDekking(stijl['titelblok.glasKleur'], stijl['titelblok.glasDekking']))
  blok.style.setProperty('--glasblur', stijl['titelblok.glasBlurMm'])
  blok.style.setProperty('--glasronding', stijl['titelblok.glasRondingMm'])
  blok.style.setProperty('--glaspad', stijl['titelblok.glasPadMm'])
  blok.style.setProperty('--glasschaduw', stijl['titelblok.glasSchaduw']
    ? `0 ${mm(0.5)} ${mm(1.7)} rgb(0 0 0 / .13), 0 ${mm(0.1)} ${mm(0.35)} rgb(0 0 0 / .08)`
    : 'none')

  return true
}

/** Zet een element in een van de vier hoeken van de pagina. */
function inHoek (node, hoek, margeMm, maat) {
  node.style.position = 'absolute'
  if (hoek.includes('links')) node.style.left = mm(margeMm)
  else node.style.right = mm(margeMm)
  if (hoek.includes('boven')) node.style.top = mm(margeMm)
  else node.style.bottom = mm(margeMm)
  return node
}

/** Een rond getal dat lekker leest op een schaalbalk. */
function netteAfstand (ruwKm) {
  const stappen = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500]
  for (const s of stappen) if (ruwKm <= s) return s
  return Math.round(ruwKm / 100) * 100
}

/** ---------------------------------------------------- het inzetkaartje */

/** Onder deze breedte valt er in het binnenvak niets meer te zien. */
const MIN_BINNEN_MM = 4

/** Hoe rond de hoeken van de uitsnede zijn, als deel van de kortste zijde. */
const UITSNEDE_RONDING = 0.09

/** Ruimte tussen het kaartje en de bronvermelding eronder. */
const BOVEN_BRON_MM = 2

/** Hoeveel grover de hele reis vereenvoudigd wordt dan de dag zelf. */
const TOLERANTIE_DAG = 0.04
const TOLERANTIE_REIS = 0.06

const rond = n => Math.round(n * 1000) / 1000

/**
 * Het inzetkaartje omtoveren tot een postzegel.
 *
 * Drie dingen maken een postzegel herkenbaar, en niet één ervan is het plaatje:
 * de kartelrand, de witte bies eromheen, en een afstempeling die er half
 * overheen loopt. Dus doen we die drie, en laten we het kaartje zelf met rust -
 * de kleur van het eiland regel je gewoon met de landkleur, en die zet de
 * kleurenset al goed.
 *
 * De kartels zijn een masker van halve rondjes langs alle vier de kanten, in
 * CSS. Dat blijft scherp op elke maat; een gekartelde PNG zou dat niet doen, en
 * dit kaartje wordt nu juist opnieuw opgebouwd zodra je eraan trekt.
 *
 * De afstempeling zijn een paar golfjes over een hoek. Bleek, want een echte
 * afstempeling is inkt over inkt en niet een sticker erbovenop.
 */
function maakZegel (doos, binnen, stijl, { dagNummer, breedte, hoogte }) {
  const bies = stijl['inzet.biesMm']

  doos.classList.add('inzet-zegel')
  doos.style.setProperty('--tand', mm(stijl['inzet.tandMm']))
  doos.style.background = stijl['papier.kleur']
  doos.style.padding = mm(bies)
  doos.style.borderRadius = '0'
  doos.style.borderWidth = '0'
  // Een schaduw onder een gekarteld masker valt buiten het masker en wordt dus
  // een rechthoekige vlek om de tandjes heen. Zegel en schaduw gaan niet samen.
  doos.style.boxShadow = 'none'

  // ---- het onderschrift, binnen de bies
  if (stijl['inzet.zegelTekst']) {
    const regel = document.createElement('div')
    regel.className = 'inzet-zegeltekst'
    regel.style.fontSize = mm(Math.max(1.8, stijl['veldnotitie.grootteMm'] * 0.8))
    regel.style.color = stijl['veldnotitie.zwakKleur']
    regel.style.letterSpacing = `${stijl['veldnotitie.letterafstand']}em`
    regel.textContent =
      `${stijl['inzet.zegelTekst']} · ${String(dagNummer).padStart(2, '0')}`
    doos.append(regel)
  }

  // ---- de afstempeling
  if (stijl['inzet.afstempeling'] > 0) {
    const stempel = maakSvg('svg', {
      viewBox: `0 0 ${rond(breedte)} ${rond(hoogte)}`,
      class: 'inzet-afstempeling'
    })

    // vier golfjes schuin over de rechterbovenhoek, zoals een poststempel er
    // altijd half naast valt
    for (let i = 0; i < 4; i++) {
      const y = hoogte * 0.12 + i * hoogte * 0.055
      const punten = []
      for (let x = breedte * 0.42; x <= breedte * 1.05; x += breedte * 0.04) {
        const golf = Math.sin((x / breedte) * 22) * hoogte * 0.012
        punten.push(`${punten.length ? 'L' : 'M'} ${rond(x)} ${rond(y + golf - (x / breedte) * hoogte * 0.1)}`)
      }
      stempel.append(maakSvg('path', {
        d: punten.join(' '),
        fill: 'none',
        stroke: stijl['veldnotitie.kleur'],
        'stroke-width': rond(Math.max(0.09, hoogte * 0.008)),
        'stroke-linecap': 'round',
        'stroke-opacity': rond(stijl['inzet.afstempeling'] * 0.55)
      }))
    }
    binnen.append(stempel)
  }
}

/**
 * De maten van het inzetkaartje, op een plek.
 *
 * Zowel het tekenen als het ophalen van het silhouet heeft ze nodig: de dikte
 * van de kustlijn wordt van millimeters naar beeldpunten omgerekend, en dan
 * moeten beide kanten wel dezelfde breedte bedoelen.
 */
export function inzetMaten (stijl, plaatsing = {}) {
  const buiten = stijl['inzet.breedteMm'] * schaalVan(plaatsing, 'inzet')
  const pad = stijl['inzet.padMm']
  const rand = stijl['inzet.randMm']
  return {
    buiten,
    pad,
    rand,
    binnenBreedte: Math.max(MIN_BINNEN_MM, buiten - 2 * pad - 2 * rand)
  }
}

/**
 * Een afgeronde rechthoek als padtekst.
 *
 * Straal nul geeft rechte hoeken: een boog met straal nul is volgens de
 * SVG-regels gewoon een rechte lijn, dus dat hoeft niet apart afgevangen.
 */
function rondeRect (x, y, b, h, r) {
  const s = rond(Math.max(0, Math.min(r, b / 2, h / 2)))
  const [x0, y0, x1, y1] = [rond(x), rond(y), rond(x + b), rond(y + h)]
  return `M ${x0 + s} ${y0} H ${x1 - s} A ${s} ${s} 0 0 1 ${x1} ${y0 + s}` +
    ` V ${y1 - s} A ${s} ${s} 0 0 1 ${x1 - s} ${y1}` +
    ` H ${x0 + s} A ${s} ${s} 0 0 1 ${x0} ${y1 - s}` +
    ` V ${y0 + s} A ${s} ${s} 0 0 1 ${x0 + s} ${y0} Z`
}

/**
 * Het pad van alle dagen samen, onthouden zolang het vak even groot blijft.
 *
 * De hele reis is zestigduizend punten. Die bij elke draai aan een kleurknop
 * opnieuw projecteren en vereenvoudigen is zonde: alleen de maat van het vak
 * verandert er iets aan.
 */
let reisPadCache = { sleutel: '', d: '' }

function reisPad (reis, view, breedte, hoogte) {
  const sleutel = `${breedte}|${hoogte}|${reis.length}`
  if (reisPadCache.sleutel !== sleutel) {
    // padData begint elk stuk met een M, dus de dagen worden niet aan elkaar
    // geregen ook al staan ze in een pad
    const d = reis
      .map(dag => padData(vereenvoudig(projecteer(dag.coordinates, view), TOLERANTIE_REIS)))
      .filter(Boolean)
      .join(' ')
    reisPadCache = { sleutel, d }
  }
  return reisPadCache.d
}

/**
 * Tekent al het bijwerk in de opschriftenlaag.
 *
 * @param {HTMLElement} laag
 * @param {object} gegevens dag, route, statistieken
 * @param {object} stijl
 * @param {MapView} view de uitsnede van de grote kaart
 * @param {object} bronnen
 * @param {object|null} bronnen.silhouet {url, bounds} van het inzetkaartje
 * @param {object[]|null} bronnen.reis alle dagen, voor de vage lijn op het inzetkaartje
 * @param {SVGElement|null} bronnen.svgLaag de tekenlaag, waar het kompas in komt
 * @param {object} bronnen.plaatsing de bewaarde verschuivingen en schalen van deze pagina
 */
export function tekenBijwerk (laag, gegevens, stijl, view, {
  silhouet = null,
  reis = null,
  svgLaag = null,
  plaatsing = {}
} = {}) {
  const maat = paginaMaat(stijl)
  const marge = maat.afloopMm + stijl['pagina.veiligeMargeMm']

  // Hoe hoog het titelblok werkelijk werd. Het kompas mag die hoogte volgen,
  // en dat kan pas als het blok in de pagina staat: een titel over twee regels
  // is hoger dan een titel over één.
  let titelHoogteMm = 0

  // ------------------------------------------------------------- titelblok
  if (stijl['titelblok.aan']) {
    const blok = document.createElement('div')
    blok.className = 'titelblok'
    blok.setAttribute('data-plek', 'titelblok')
    blok.setAttribute('data-schaalbaar', 'css')
    blok.setAttribute('data-midden', '')
    blok.setAttribute('data-knoppen', 'titelblok')
    // Nooit tegen de rand aan, ook niet als je hem daarheen sleept: vanaf de
    // snijlijn gerekend, want de afloop wordt eraf gesneden.
    blok.setAttribute('data-binnen-marge',
      String(maat.afloopMm + stijl['titelblok.minMargeMm']))
    inHoek(blok, stijl['titelblok.positie'], marge, maat)

    blok.style.textAlign = stijl['titelblok.uitlijning']
    blok.style.color = stijl['titelblok.kleur']

    const glas = zetGlas(blok, stijl)
    if (!glas && stijl['titelblok.vlakAan']) {
      blok.style.background = stijl['titelblok.vlakKleur']
      blok.style.opacity = '1'
      blok.style.padding = mm(3)
      blok.style.borderRadius = mm(1.5)
      blok.style.setProperty('--vlakdekking', stijl['titelblok.vlakDekking'])
    }

    const datum = document.createElement('div')
    datum.className = 'titel-datum'
    datum.style.fontSize = mm(stijl['typografie.datumMm'])
    datum.textContent = `Dag ${gegevens.dag.dag} · ${leesbareDatum(gegevens.dag.datum)}`

    const titel = document.createElement('div')
    titel.className = 'titel-hoofd'
    titel.setAttribute('data-tekst', 'titel')
    titel.style.fontSize = mm(stijl['typografie.titelMm'])
    titel.textContent = gegevens.dag.titel

    blok.append(datum, titel)
    laag.append(blok)

    // offsetHeight en niet getBoundingClientRect: die eerste is de opmaakhoogte,
    // los van de schaal die pasPlaatsingToe er straks overheen legt. Die schaal
    // tellen we er zelf bij op, want het gaat om de hoogte zoals je hem ziet:
    // heb je het titelblok groter getrokken, dan hoort het kompas mee te gaan.
    const mmPx = parseFloat(getComputedStyle(blok).getPropertyValue('--mm')) || 1
    titelHoogteMm = (blok.offsetHeight / mmPx) * schaalVan(plaatsing, 'titelblok')
  }

  // ---------------------------------------------------------- inzetkaartje
  //
  // Een klein kaartje verdient dezelfde aandacht als een groot. Het vertelt
  // twee dingen tegelijk: waar deze dag in de hele reis valt, en welk stuk van
  // het eiland op de grote kaart staat.
  //
  // Dat tweede gaat met een sluier in plaats van met een gekleurde doos. Alles
  // buiten de uitsnede wordt naar het papier van het kaartje toe gedempt, zodat
  // het gebied van vandaag vanzelf oplicht. Een passe-partout dus, en geen
  // markeerstift.
  if (stijl['inzet.aan'] && silhouet) {
    const b = silhouet.bounds
    // Het kaartje wordt op zijn nieuwe maat opnieuw opgebouwd in plaats van
    // beeldschermbreed uitgerekt: er zit een gerenderde PNG van IJsland in, en
    // die oprekken wordt wazig in de export.
    const { buiten: buitenBreedte, pad, rand, binnenBreedte: breedte } = inzetMaten(stijl, plaatsing)

    // De hulp-uitsnede past de bounds in een vierkant, alleen om de hoogte te
    // vinden; view2 hieronder projecteert in breedte bij hoogte. Die twee geven
    // dezelfde schaal zolang het eiland breder is dan hoog - dan zijn ze allebei
    // breedtebegrensd. Wordt IJSLAND ooit smaller gemaakt, dan loopt dat mis en
    // staat het eiland weer scheef in zijn kader.
    const hulp = MapView.fit(
      [[b.west, b.south], [b.east, b.north]],
      { widthMm: breedte, heightMm: breedte, paddingMm: 0 }
    )
    const hoek0 = hulp.project(b.west, b.north)
    const hoek1 = hulp.project(b.east, b.south)
    const hoogte = Math.abs(hoek1.y - hoek0.y)

    const doos = document.createElement('div')
    doos.className = 'inzet'
    doos.setAttribute('data-plek', 'inzet')
    doos.setAttribute('data-schaalbaar', 'hertekenen')
    doos.setAttribute('data-midden', '')
    doos.setAttribute('data-knoppen', 'inzet')
    // hoger zetten dan de bronvermelding, anders lopen ze in elkaar
    inHoek(doos, stijl['inzet.hoek'], marge, maat)
    if (!stijl['inzet.hoek'].includes('boven') && stijl['bron.aan']) {
      doos.style.bottom = mm(marge + stijl['bron.grootteMm'] + BOVEN_BRON_MM)
    }

    // maat inclusief marge en randlijn: de doos meet wat de knop zegt
    doos.style.width = mm(buitenBreedte)
    doos.style.height = mm(hoogte + 2 * pad + 2 * rand)
    doos.style.padding = mm(pad)
    doos.style.borderRadius = mm(stijl['inzet.afrondingMm'])
    doos.style.borderWidth = mm(rand)
    doos.style.borderColor = stijl['inzet.randKleur']
    doos.style.background = stijl['inzet.achtergrond']
    if (stijl['inzet.schaduw']) {
      // wijd en zacht met daaroverheen strak en fijn, in de inkttint van het
      // boek in plaats van in puur zwart: dat laatste maakt papier vuil
      doos.style.boxShadow =
        `0 ${mm(0.9)} ${mm(2.6)} rgb(43 41 38 / .085), ` +
        `0 ${mm(0.12)} ${mm(0.4)} rgb(43 41 38 / .10)`
    }

    const binnen = document.createElement('div')
    binnen.className = 'inzet-binnen'
    binnen.style.width = mm(breedte)
    binnen.style.height = mm(hoogte)
    // De zee is de achtergrond van het vak, niet een kleur in het plaatje: de
    // PNG heeft daar doorzichtige punten, en zo kost een andere zeetint geen
    // nieuwe render op de server.
    binnen.style.background = stijl['inzet.zeeKleur']
    // een vak in een afgeronde kaart hoort zelf ook rond te zijn, maar strakker
    binnen.style.borderRadius = stijl['inzet.afrondingMm'] === 0
      ? '0'
      : mm(Math.max(0.6, stijl['inzet.afrondingMm'] - pad))

    // Het eiland vult het binnenvak precies.
    //
    // Eerder werd het geplaatst via een hulp-uitsnede die in een vierkant
    // centreerde, terwijl de route in een vak van breedte bij hoogte werd
    // getekend. Die twee centreren verschillend, dus stond het eiland een halve
    // vakhoogte te laag ten opzichte van het kadertje. Nu delen ze dezelfde
    // uitsnede: de bounds passen zonder marge, dus het eiland vult het vak.
    const eiland = document.createElement('img')
    eiland.src = silhouet.url
    eiland.style.left = '0'
    eiland.style.top = '0'
    eiland.style.width = mm(breedte)
    eiland.style.height = mm(hoogte)
    binnen.append(eiland)

    const svg = document.createElementNS(SVG, 'svg')
    svg.setAttribute('viewBox', `0 0 ${breedte} ${hoogte}`)

    const view2 = MapView.fit(
      [[b.west, b.south], [b.east, b.north]],
      { widthMm: breedte, heightMm: hoogte, paddingMm: 0 }
    )

    // waar de grote kaart naar kijkt, als afgeronde rechthoek
    const zicht = view.visibleBounds()
    const a = view2.project(zicht.west, zicht.north)
    const c = view2.project(zicht.east, zicht.south)
    const kx = Math.min(a.x, c.x)
    const ky = Math.min(a.y, c.y)
    const kb = Math.abs(c.x - a.x)
    const kh = Math.abs(c.y - a.y)
    const uitsnede = rondeRect(kx, ky, kb, kh, Math.min(kb, kh) * UITSNEDE_RONDING)

    // ---- de sluier, over het eiland maar onder de lijnen
    //
    // Onder de lijnen, want een melkfilm over de routelijn maakt hem niet
    // alleen lichter maar schuift zijn kleur naar papier toe: het oranje dat
    // overal elders in het boek precies hetzelfde is, wordt hier dan zalm. Het
    // verschil tussen vol en gedempt land draagt de uitsnede prima alleen.
    //
    // Even-oneven vult wat in de buitenrand zit maar niet in de uitsnede. Steekt
    // de uitsnede over de vakrand heen, dan klopt dat vanzelf nog; bedekt hij
    // het hele vak, dan valt er niets te dempen en blijft alles vol. Daarom
    // wordt er niets geklemd.
    if (stijl['inzet.sluierDekking'] > 0) {
      svg.append(maakSvg('path', {
        d: `M 0 0 H ${rond(breedte)} V ${rond(hoogte)} H 0 Z ${uitsnede}`,
        'fill-rule': 'evenodd',
        fill: stijl['inzet.achtergrond'],
        'fill-opacity': stijl['inzet.sluierDekking']
      }))
    }

    // ---- de hele reis, dun en licht onder de dag van vandaag
    const lijn = stijl['inzet.lijnMm']
    if (reis?.length) {
      const d = reisPad(reis, view2, breedte, hoogte)
      if (d) {
        svg.append(maakSvg('path', {
          d,
          fill: 'none',
          stroke: stijl['inzet.reisKleur'],
          'stroke-width': lijn * 0.5,
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round'
        }))
      }
    }

    // ---- de etappe van vandaag, met een witte rand eronder zoals op de kaart
    const dagPad = padData(vereenvoudig(projecteer(gegevens.route.coordinates, view2), TOLERANTIE_DAG))
    if (dagPad) {
      svg.append(maakSvg('path', {
        d: dagPad,
        fill: 'none',
        stroke: stijl['route.buitenKleur'],
        'stroke-width': lijn + 0.24,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round'
      }))
      svg.append(maakSvg('path', {
        d: dagPad,
        fill: 'none',
        stroke: stijl['inzet.routeKleur'],
        'stroke-width': lijn,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round'
      }))
    }

    // ---- waar de dag begon en waar hij eindigde
    //
    // De uiteinden van de getekende lijn, niet de waypoints: die liggen een
    // slag naast de weg waar de routeplanner ze op vastzet, en dit is gratis
    // nauwkeuriger.
    //
    // Wit met een gekleurde ring, precies zoals de stopmarkers op de grote
    // kaart. Andersom - gekleurd met een witte ring - wint het wit het op deze
    // maat van de vulling en lijken het gaatjes in de kaart.
    const stipStraal = stijl['inzet.stipMm'] / 2
    const punten = gegevens.route.coordinates
    if (stipStraal > 0 && punten?.length) {
      for (const [lon, lat] of [punten[0], punten.at(-1)]) {
        const p = view2.project(lon, lat)
        svg.append(maakSvg('circle', {
          cx: rond(p.x), cy: rond(p.y), r: rond(stipStraal),
          fill: stijl['route.buitenKleur'],
          stroke: stijl['inzet.routeKleur'],
          'stroke-width': rond(stipStraal * 0.55)
        }))
      }
    }

    // ---- het dunne lijntje langs de uitsnede
    if (stijl['inzet.kaderMm'] > 0) {
      svg.append(maakSvg('path', {
        d: uitsnede,
        fill: 'none',
        stroke: stijl['inzet.kaderKleur'],
        'stroke-width': stijl['inzet.kaderMm'],
        'stroke-linejoin': 'round'
      }))
    }

    binnen.append(svg)
    doos.append(binnen)

    // De postzegel als laatste, want hij verandert de doos die er dan al staat.
    if (stijl['inzet.postzegel']) {
      maakZegel(doos, binnen, stijl, {
        dagNummer: gegevens.dag.dag, breedte, hoogte
      })
    }

    laag.append(doos)
  }

  // ------------------------------------------------------------ schaalbalk
  if (stijl['schaal.balkAan']) {
    const mPerMm = view.metersPerMm()

    // Groter maken verandert de streefbreedte, waarna er opnieuw een rond
    // kilometergetal bij wordt gezocht. Een schaalbalk die je beeldschermbreed
    // uitrekt liegt namelijk: er staat "50 km" onder een balk die er 65 meet.
    // Zo klopt de balk altijd; alleen het getal springt af en toe.
    const streefBreedteMm = maat.breedteMm * 0.16 * schaalVan(plaatsing, 'schaalbalk')
    const km = netteAfstand((streefBreedteMm * mPerMm) / 1000)
    const balkMm = (km * 1000) / mPerMm

    const balk = document.createElement('div')
    balk.className = 'schaalbalk'
    balk.setAttribute('data-plek', 'schaalbalk')
    balk.setAttribute('data-schaalbaar', 'hertekenen')
    balk.setAttribute('data-midden', '')
    balk.setAttribute('data-knoppen', 'schaal')
    inHoek(balk, stijl['schaal.positie'], marge, maat)
    balk.style.color = stijl['schaal.kleur']
    balk.style.fontSize = mm(2.2)

    const streep = document.createElement('div')
    streep.className = 'schaal-streep'
    streep.style.width = mm(balkMm)
    streep.style.borderColor = stijl['schaal.kleur']
    streep.style.borderWidth = mm(0.35)

    const tekst = document.createElement('div')
    tekst.textContent = `${km} km`

    balk.append(streep, tekst)
    laag.append(balk)
  }

  // -------------------------------------------------------------- kompasroos
  if (stijl['schaal.noordpijlAan']) {
    // De roos even hoog als het titelblok maken doet meer dan netjes staan:
    // omdat het een cirkel is met precies die hoogte, betekent de bovenkanten
    // gelijk zetten ook de middens en de onderkanten gelijk. Eén snaplijn is
    // dan genoeg om zeker te weten dat ze op één hoogte staan.
    //
    // Het glasschijfje is wat je ziet, dus die buitenmaat wordt vergeleken.
    // Staat het glas uit, dan is de roos zelf de buitenmaat.
    let kompasMm = stijl['schaal.kompasMm']
    if (stijl['schaal.kompasVolgtTitel'] && titelHoogteMm > 0) {
      const glasFactor = stijl['schaal.kompasGlas'] ? stijl['schaal.kompasGlasFactor'] : 1
      kompasMm = klem('schaal.kompasMm', titelHoogteMm / glasFactor)
    }

    const straal = kompasMm / 2

    // Hoe ver het hart van de roos van de rand blijft, gerekend naar wat er het
    // verst uitsteekt. Met glas is dat het schijfje - de letters zitten op 1,22
    // maal de straal en vallen daar ruim binnen. Zonder glas zijn de letters zelf
    // de buitenmaat.
    //
    // Dit is ook wat het kompas en het titelblok zonder slepen al op één hoogte
    // zet: beide buitenkanten komen dan op de marge te liggen.
    const buitenStraal = stijl['schaal.kompasGlas']
      ? straal * stijl['schaal.kompasGlasFactor']
      : straal + (stijl['schaal.kompasLetters'] ? stijl['schaal.kompasLetterMm'] * 1.4 : 1)
    const rand = marge + buitenStraal

    const hoek = stijl['schaal.kompasHoek']
    const x = hoek.includes('links') ? rand : maat.breedteMm - rand
    const y = hoek.includes('boven') ? rand : maat.hoogteMm - rand

    const roos = kompasroos({
      straal,
      vorm: stijl['schaal.kompasVorm'],
      donker: stijl['schaal.kompasDonker'],
      licht: stijl['schaal.kompasLicht'],
      ring: stijl['schaal.kompasRing'],
      ringDikteMm: stijl['schaal.kompasLijnMm'],
      letters: stijl['schaal.kompasLetters'],
      letterMm: stijl['schaal.kompasLetterMm'],
      kleuren: stijl['schaal.kompasKleuren'],
      noordKleur: stijl['schaal.kompasNoordKleur'],
      staalKleur: stijl['schaal.kompasStaalKleur'],
      schroefKleur: stijl['schaal.kompasSchroefKleur']
    })
    // Zelfde opzet als bij de markers: een buitenste groep die de plek bepaalt
    // en een binnenste die jouw verschuiving en schaal opvangt, zodat schalen om
    // het hart van de roos draait en niet om de hoek van de pagina.
    const anker = maakSvg('g', { transform: `translate(${x} ${y})` })
    const beweegbaar = maakSvg('g', {
      'data-plek': 'kompas',
      'data-schaalbaar': 'css',
      // sleep hem verticaal langs het titelblok en hij pakt op gelijke hoogte
      'data-snap-op': 'titelblok',
      'data-knoppen': 'schaal'
    })

    // het glasplaatje eerst, zodat de roos erbovenop komt
    if (stijl['schaal.kompasGlas']) {
      beweegbaar.append(kompasGlas(straal * stijl['schaal.kompasGlasFactor'], {
        kleur: stijl['titelblok.glasKleur'],
        dekking: stijl['titelblok.glasDekking'],
        schaduw: stijl['titelblok.glasSchaduw']
      }))
    }

    beweegbaar.append(roos)
    anker.append(beweegbaar)
    svgLaag?.append(anker)
  }

  // ---------------------------------------------------------- bronvermelding
  if (stijl['bron.aan']) {
    const bron = document.createElement('div')
    bron.className = 'bronvermelding'
    bron.setAttribute('data-plek', 'bron')
    bron.setAttribute('data-tekst', 'bron')
    bron.setAttribute('data-schaalbaar', 'css')
    bron.setAttribute('data-midden', '')
    bron.setAttribute('data-knoppen', 'bron')
    bron.style.position = 'absolute'
    bron.style.right = mm(marge)
    bron.style.bottom = mm(maat.afloopMm + 1.5)
    bron.style.fontSize = mm(stijl['bron.grootteMm'])
    bron.style.color = stijl['bron.kleur']
    bron.textContent = 'Hoogtegegevens: Terrain Tiles · Route: OSRM/OpenStreetMap'
    laag.append(bron)
  }
}

function leesbareDatum (iso) {
  const maanden = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december']
  const [jaar, maand, dag] = iso.split('-').map(Number)
  return `${dag} ${maanden[maand - 1]} ${jaar}`
}
