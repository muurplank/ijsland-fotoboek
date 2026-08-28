/**
 * De voortgangsbalk: een strookje dat laat zien waar je die dag was.
 *
 * Bedoeld om onder een foto te zetten. De balk loopt van het begin van de dag
 * tot het eind, met een merkteken op elke stop, en is gevuld tot de stop waar de
 * foto hoort. Zo zie je in één oogopslag of dat ochtend of avond was.
 *
 * De stops staan op hun echte afstand, niet gelijk verdeeld. Vier stops vlak na
 * elkaar en dan tweehonderd kilometer niets is precies wat je wilt zien; ze
 * netjes uitsmeren zou dat wegpoetsen.
 *
 * Er zijn drie gedaantes, en ze tonen alle drie hetzelfde:
 *
 *   balk     de grafiek - een rechte baan met stippen erop
 *   penlijn  dezelfde lijn met de hand getrokken, streepjes op de stops, en een
 *            cirkel om waar je nu bent
 *   vak      een met de pen omlijnd vak, tot de stand van vandaag volgetekend
 *
 * Die laatste twee horen bij de veldnotitie-stijl. Een voortgangsbalk is het
 * enige element in dit boek dat niet uit een reis komt maar uit een programma,
 * en dat zie je: hoe mooi de kleuren ook staan, een strakke balk met ronde
 * stippen blijft een schermelement op een bladzijde die verder van papier is.
 * Met de hand getrokken - op een vel met vezels, met de opschriften erbij
 * getypt - leest het als wat iemand onderweg zelf zou hebben opgeschreven.
 *
 * Alles is gezaaid op het dagnummer. Twee keer dezelfde dag geeft dus exact
 * dezelfde hand; anders danst de tekening onder je handen weg zodra je aan een
 * andere knop draait, en zou elke export er anders uitzien dan de preview.
 */

import { voortgangMaat } from '../render/layout.js'
import { papierKnopen, zaadje } from '../render/papier.js'
import { bouwSvg, profielVorm } from '../render/profielvorm.js'
import { hoogtelijnKnopen } from '../render/hoogtelijnvulling.js'
import { penPunten, penKader, penCirkel, scheurPad, padVan, padTot, yBij } from '../render/pen.js'
import { typRegel } from './statsdelen.js'

const SVG = 'http://www.w3.org/2000/svg'

const maakSvg = (tag, eigenschappen = {}) => {
  const n = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(eigenschappen)) {
    if (v !== null && v !== undefined) n.setAttribute(k, String(v))
  }
  return n
}

const mm = waarde => `calc(${waarde} * var(--mm))`

/** Afronden op duizendsten van een millimeter; fijner ziet geen enkele pers. */
const rond = n => Math.round(n * 1000) / 1000

/** De stops van een dag met de afstand waarop ze liggen. */
export function stopsMetAfstand (gegevens) {
  const waypoints = gegevens.dag.waypoints
  const legs = gegevens.route.legs ?? []

  const uit = []
  let opgeteld = 0

  // uitgezette stops staan ook niet op het strookje, en niet in de keuzelijst
  const meetellen = w => w && w.type !== 'via' && w.toon !== false
  if (meetellen(waypoints[0])) {
    uit.push({ km: 0, naam: waypoints[0].name, type: waypoints[0].type, index: 0 })
  }

  for (const [i, leg] of legs.entries()) {
    opgeteld += leg.distanceKm
    const w = waypoints[i + 1]
    if (meetellen(w)) {
      uit.push({ km: opgeteld, naam: w.name, type: w.type, index: i + 1 })
    }
  }

  return { stops: uit, totaalKm: opgeteld }
}

/**
 * Het vel onder het strookje.
 *
 * Zonder ondergrond blijft dit een balkje dat op de pagina zweeft. Met dezelfde
 * vezels als onder de cijfers wordt het een strookje papier, en dat is het halve
 * verschil tussen een grafiek en een aantekening.
 *
 * Met de scheurrand erbij ligt het strookje óp de bladzijde in plaats van dat
 * het de bladzijde is. Alleen boven en onder gescheurd: links en rechts loopt
 * het paginabreed de afloop in.
 */
function legPapier (svg, stijl, maat, zaad) {
  if (!stijl['voortgang.papierAan']) return

  const scheur = stijl['voortgang.scheurAan']
  const groep = maakSvg('g', { 'data-papier': 'strook' })

  if (scheur) {
    const rnd = zaadje(zaad * 31 + 7)
    const marge = maat.afloopMm + 0.7
    const vorm = padVan(scheurPad(maat.breedteMm, marge, maat.hoogteMm - marge, rnd), true)

    const defs = maakSvg('defs')
    const knip = maakSvg('clipPath', { id: 'voortgang-scheur', clipPathUnits: 'userSpaceOnUse' })
    knip.append(maakSvg('path', { d: vorm }))
    defs.append(knip)
    svg.append(defs)

    groep.setAttribute('clip-path', 'url(#voortgang-scheur)')
    groep.append(maakSvg('path', { d: vorm, fill: stijl['papier.kleur'] }))
  }

  for (const knoop of papierKnopen({
    breedteMm: maat.breedteMm,
    hoogteMm: maat.hoogteMm,
    stijl,
    zaad,
    id: 'voortgangpapier',
    grondvlak: !scheur
  })) {
    groep.append(bouwSvg(knoop))
  }

  svg.append(groep)
}

/** ------------------------------------------------------------- de balk
 *
 * De strakke gedaante, ongewijzigd: een rechte baan met stippen erop.
 */
function tekenBalk (svg, ctx) {
  const { stijl, links, rechts, midden, xVan, stops, huidige, kleuren } = ctx
  const dikte = stijl['voortgang.dikteMm']

  svg.append(maakSvg('line', {
    x1: links, x2: rechts, y1: midden, y2: midden,
    stroke: kleuren.baan,
    'stroke-opacity': kleuren.baanDekking,
    'stroke-width': dikte,
    'stroke-linecap': 'round'
  }))

  // Zelfde opbouw als de routelijn op de kaart: een dekkende rand met een
  // doorschijnende kern. Zo hoort de balk zichtbaar bij de route en niet bij
  // een willekeurig ander grafiekje.
  if (huidige.km > 0) {
    const eind = xVan(huidige.km)
    const buitenDikte = dikte + 2 * stijl['voortgang.buitenExtraMm']
    const d = `M ${links} ${midden} L ${eind} ${midden}`

    if (stijl['voortgang.buitenExtraMm'] > 0) {
      // de brede lijn met het midden eruit gemaskeerd, zodat er een echte rand
      // overblijft en de kern erdoorheen laat zien wat eronder ligt
      const defs = maakSvg('defs')
      const masker = maakSvg('mask', { id: 'voortgang-rand', maskUnits: 'userSpaceOnUse' })
      masker.append(maakSvg('path', {
        d, fill: 'none', stroke: '#ffffff', 'stroke-width': buitenDikte, 'stroke-linecap': 'round'
      }))
      masker.append(maakSvg('path', {
        d, fill: 'none', stroke: '#000000', 'stroke-width': dikte, 'stroke-linecap': 'round'
      }))
      defs.append(masker)
      svg.append(defs)

      svg.append(maakSvg('path', {
        d,
        fill: 'none',
        stroke: kleuren.lijn,
        'stroke-width': buitenDikte,
        'stroke-linecap': 'round',
        mask: 'url(#voortgang-rand)'
      }))
    }

    svg.append(maakSvg('path', {
      d,
      fill: 'none',
      stroke: kleuren.lijn,
      'stroke-opacity': stijl['voortgang.kernDekking'],
      'stroke-width': dikte,
      'stroke-linecap': 'round'
    }))
  }

  // Drie maten: waar je nu bent het grootst, waar je al geweest bent iets groter
  // dan gemiddeld, en wat nog komt het kleinst. Zo lees je de voortgang ook
  // zonder de kleuren te vergelijken.
  for (const stop of stops) {
    const gehad = stop.km <= huidige.km + 0.01
    const isHuidige = stop.index === huidige.index
    const straal = stijl['voortgang.stipMm'] * (
      isHuidige ? 0.8 : gehad ? stijl['voortgang.gehadFactor'] : 0.42
    )

    svg.append(maakSvg('circle', {
      cx: xVan(stop.km), cy: midden, r: straal,
      fill: gehad ? kleuren.lijn : kleuren.baan,
      'fill-opacity': gehad ? 1 : kleuren.baanDekking,
      stroke: kleuren.rand,
      'stroke-width': isHuidige ? stijl['voortgang.stipMm'] * 0.26 : 0
    }))
  }

  return {
    bovenY: midden - dikte / 2,
    naamY: () => midden + dikte / 2
  }
}

/** ---------------------------------------------------------- de penlijn
 *
 * Dezelfde balk, maar met de hand: een lijn die golft, streepjes waar je een
 * stop hebt afgetikt, en een cirkel om waar je nu bent.
 */
function tekenPenlijn (svg, ctx) {
  const { stijl, links, rechts, midden, xVan, stops, huidige, kleuren, rnd } = ctx
  const dikte = stijl['voortgang.dikteMm']
  const wiebel = stijl['voortgang.penJitter'] ?? 0.5

  const lijn = penPunten(links, rechts, midden, { rnd, amplitudeMm: wiebel * 0.9 })
  const yOp = x => yBij(lijn, x)

  // De liniaallijn die je eerst trekt en daarna pas invult. Dunner dan de
  // ingevulde haal, zodat je ziet welk stuk je gehad hebt zonder de kleuren
  // naast elkaar te hoeven leggen.
  svg.append(maakSvg('path', {
    d: padVan(lijn),
    fill: 'none',
    stroke: kleuren.baan,
    'stroke-opacity': kleuren.baanDekking,
    'stroke-width': dikte * 0.7,
    'stroke-linecap': 'round'
  }))

  // Twee halen over elkaar. Een pen die je een tweede keer over dezelfde lijn
  // haalt komt nooit precies terug op zijn spoor, en juist die dubbele haal is
  // wat een lijn "aangezet" laat lezen.
  if (huidige.km > 0) {
    const tot = padTot(lijn, xVan(huidige.km))
    const terug = tot
      .slice(0, Math.max(2, tot.length - 2))
      .map(p => ({ x: p.x + 0.12, y: p.y + wiebel * 0.22 }))

    svg.append(maakSvg('path', {
      d: padVan(tot),
      fill: 'none',
      stroke: kleuren.lijn,
      'stroke-width': dikte,
      'stroke-linecap': 'round'
    }))
    svg.append(maakSvg('path', {
      d: padVan(terug),
      fill: 'none',
      stroke: kleuren.lijn,
      'stroke-opacity': stijl['voortgang.kernDekking'],
      'stroke-width': dikte * 0.8,
      'stroke-linecap': 'round'
    }))
  }

  for (const stop of stops) {
    const x = xVan(stop.km)
    const y = yOp(x)
    const gehad = stop.km <= huidige.km + 0.01
    const isHuidige = stop.index === huidige.index

    const lengte = stijl['voortgang.stipMm'] * (isHuidige ? 1.9 : gehad ? 1.35 : 0.85)
    // een afgetikt streepje staat zelden precies loodrecht op de lijn
    const hoek = (rnd() - 0.5) * wiebel * 0.34
    const dx = Math.sin(hoek) * lengte / 2
    const dy = Math.cos(hoek) * lengte / 2

    svg.append(maakSvg('line', {
      x1: rond(x - dx), y1: rond(y - dy),
      x2: rond(x + dx), y2: rond(y + dy),
      stroke: gehad ? kleuren.lijn : kleuren.baan,
      'stroke-opacity': gehad ? 1 : kleuren.baanDekking,
      'stroke-width': dikte * (isHuidige ? 0.95 : 0.68),
      'stroke-linecap': 'round'
    }))

    if (isHuidige) {
      const cirkel = penCirkel(
        x, y,
        stijl['voortgang.stipMm'] * 1.6,
        stijl['voortgang.stipMm'] * 1.15,
        { rnd, wiebel }
      )
      svg.append(maakSvg('path', {
        d: padVan(cirkel),
        fill: 'none',
        stroke: kleuren.lijn,
        'stroke-width': dikte * 0.6,
        'stroke-linecap': 'round',
        'stroke-opacity': 0.92,
        transform: `rotate(${rond((rnd() - 0.5) * 9)} ${rond(x)} ${rond(y)})`
      }))
    }
  }

  return {
    bovenY: yOp(links) - dikte / 2,
    naamY: x => yOp(x) + stijl['voortgang.stipMm'] * 1.5
  }
}

/** ------------------------------------------------------------- de vulling
 *
 * Wat er binnen het vak komt te staan, links van waar je nu bent.
 */
function vulKnopen (ctx, vak) {
  const { stijl, gegevens, kleuren, rnd, links, rechts, totaalKm } = ctx
  const soort = stijl['voortgang.vulling'] ?? 'inkt'
  const { boven, onder, hoogte } = vak

  if (soort === 'hoogtelijnen') {
    return hoogtelijnKnopen({
      breedteMm: rechts - links,
      hoogteMm: hoogte,
      x: links,
      y: boven,
      rnd,
      kleur: kleuren.lijn,
      lijnMm: Math.max(0.1, stijl['voortgang.kaderMm'] * 0.5),
      dekking: 0.9,
      lijnen: Math.max(4, Math.round(hoogte * 1.4)),
      ruwheid: stijl['voortgang.penJitter'] ?? 0.5
    })
  }

  if (soort === 'arcering') {
    // zelfde recept als de vorm "arcering" van het hoogteprofiel: een tegel met
    // één haaltje, schuin gezet
    const stap = Math.max(0.4, stijl['voortgang.stipMm'] * 0.42)
    return [
      {
        tag: 'defs',
        kind: [{
          tag: 'pattern',
          attr: {
            id: 'voortgang-arcering',
            width: rond(stap), height: rond(stap),
            patternUnits: 'userSpaceOnUse',
            patternTransform: 'rotate(45)'
          },
          kind: [{
            tag: 'line',
            attr: {
              x1: 0, y1: 0, x2: 0, y2: rond(stap),
              stroke: kleuren.lijn,
              'stroke-width': rond(stap * 0.38)
            }
          }]
        }]
      },
      {
        tag: 'rect',
        attr: {
          x: rond(links), y: rond(boven),
          width: rond(rechts - links), height: rond(hoogte),
          fill: 'url(#voortgang-arcering)'
        }
      }
    ]
  }

  if (soort === 'profiel') {
    // Het echte hoogteprofiel van die dag, als doorsnede door de balk. Dan is de
    // textuur in het vak geen versiering maar het terrein waar je overheen bent
    // gegaan - en op de kilometer waar je nu staat houdt de inkt op.
    const profiel = (gegevens.profiel ?? []).filter(p => p.hoogteM !== null)
    if (profiel.length < 2) return []

    // De hoogste top raakt precies de bovenkant van het vak. Afronden op vijftig
    // meter, zoals de grafiek op de cijferpagina doet, zou hier de helft van de
    // hoogte weggeven: die grafiek is vijftig millimeter hoog en dit vak zeven.
    const bovenGrens = Math.max(1, Math.max(...profiel.map(p => p.hoogteM)))

    // En de hoogtelijnen erdoorheen op eigen maat, want de bandstap van de grote
    // grafiek geeft in een vak van zeven millimeter nul of één lijn.
    const bandStap = Math.max(5, Math.round(bovenGrens / 12))

    return [{
      tag: 'g',
      attr: { opacity: rond(stijl['voortgang.kernDekking']) },
      kind: profielVorm('terras', {
        punten: profiel.map(p => ({ km: p.afstandKm, m: p.hoogteM })),
        xVan: km => links + (km / totaalKm) * (rechts - links),
        // De hoogte staat op de wortel en niet lineair. Een dag die tussen de
        // twee en de zeshonderd meter loopt heeft een middelste hoogte van
        // honderd: recht op de schaal is dat anderhalve millimeter in een vak
        // van zeven, en dan is het terrein een streepje langs de onderrand.
        // Op de wortel vult hetzelfde terrein het vak. Dat mag hier, want er
        // staat geen hoogteas bij en er valt niets aan af te meten - het vak
        // laat zien dát je door de bergen ging, de cijferpagina hoeveel meter.
        yVan: m => onder - Math.sqrt(Math.max(0, m) / bovenGrens) * hoogte,
        links,
        rechts,
        boven,
        onder,
        bovenGrens,
        stijl: {
          ...stijl,
          // in de inkt van het strookje, niet in de kleuren van de grafiek: het
          // vak hoort bij de balk en niet bij de cijferpagina
          'profiel.vulKleur': kleuren.lijn,
          'profiel.lijnKleur': kleuren.lijn,
          'profiel.bandStapM': bandStap,
          // De hoogtelijnen in de kleur van het papier, dus licht op donker.
          // De hoogtetrap van de grafiek loopt van bleek naar inkt, en op een
          // vlak dat zelf al inkt is verdwijnt de bovenste helft daarvan.
          ...Object.fromEntries(['dal', 'laag', 'midden', 'hoog', 'piek']
            .map(stap => [`profiel.${stap}`, stijl['papier.kleur']]))
        },
        lijnMm: Math.max(0.12, stijl['voortgang.kaderMm'] * 0.7),
        id: 'voortgangprofiel'
      })
    }]
  }

  return [{
    tag: 'rect',
    attr: {
      x: rond(links), y: rond(boven),
      width: rond(rechts - links), height: rond(hoogte),
      fill: kleuren.lijn,
      'fill-opacity': rond(stijl['voortgang.kernDekking'])
    }
  }]
}

/** -------------------------------------------------------------- het vak
 *
 * Een met de pen omlijnd vak dat je invult tot waar je gekomen bent. Waar de
 * inkt ophoudt sta je nu; een apart merkteken voor de huidige stop is dan
 * dubbelop.
 */
function tekenVak (svg, ctx) {
  const { stijl, links, rechts, midden, xVan, stops, huidige, kleuren, rnd } = ctx
  const hoogte = stijl['voortgang.vakHoogteMm'] ?? 7
  const boven = midden - hoogte / 2
  const onder = boven + hoogte
  const wiebel = stijl['voortgang.penJitter'] ?? 0.5
  const kaderMm = stijl['voortgang.kaderMm'] ?? 0.35
  const hoekMm = Math.min(1.4, hoogte * 0.22)

  const { omtrek, haal } = penKader(links, boven, rechts - links, hoogte, {
    rnd, amplitudeMm: wiebel * 0.32, hoekMm
  })

  // twee knipvormen: het vak zelf, en het stuk dat je al gehad hebt. De vulling
  // zit in allebei, dus ze knippen elkaar aan tot precies het ingevulde deel.
  const eind = xVan(huidige.km)
  const rand = penPunten(boven - 1, onder + 1, eind, {
    rnd, amplitudeMm: wiebel * 0.45, knikken: 4, staand: true
  })
  const tot = padVan([
    { x: links - 2, y: boven - 1 },
    ...rand,
    { x: links - 2, y: onder + 1 }
  ], true)

  const defs = maakSvg('defs')
  const knipVak = maakSvg('clipPath', { id: 'voortgang-vak', clipPathUnits: 'userSpaceOnUse' })
  knipVak.append(maakSvg('path', { d: padVan(omtrek, true) }))
  const knipTot = maakSvg('clipPath', { id: 'voortgang-tot', clipPathUnits: 'userSpaceOnUse' })
  knipTot.append(maakSvg('path', { d: tot }))
  defs.append(knipVak, knipTot)
  svg.append(defs)

  // --- wat nog komt: het vak blijft daar leeg, met alleen een tint erin zodat
  //     het niet als een gat in de bladzijde leest
  svg.append(maakSvg('path', {
    d: padVan(omtrek, true),
    fill: kleuren.baan,
    'fill-opacity': rond((kleuren.baanDekking ?? 1) * 0.35)
  }))

  // --- het ingevulde deel
  if (huidige.km > 0) {
    const binnen = maakSvg('g', { 'clip-path': 'url(#voortgang-vak)' })
    const gehad = maakSvg('g', { 'clip-path': 'url(#voortgang-tot)' })
    for (const knoop of vulKnopen(ctx, { boven, onder, hoogte })) {
      gehad.append(bouwSvg(knoop))
    }
    binnen.append(gehad)
    svg.append(binnen)
  }

  // --- het kader eroverheen, zodat de vulling er nooit overheen kruipt
  svg.append(maakSvg('path', {
    d: padVan(haal),
    fill: 'none',
    stroke: kleuren.lijn,
    'stroke-width': kaderMm,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round'
  }))

  // --- de stops als streepjes vanaf de bovenrand naar binnen, zoals je een
  //     schaal aftikt. Naar binnen en niet erbovenuit: het kader moet één
  //     doorgetrokken haal blijven, en boven het vak staat het opschrift.
  //     De huidige stop krijgt geen streepje - daar houdt de inkt al op.
  for (const stop of stops) {
    if (stop.index === huidige.index) continue
    const x = xVan(stop.km)
    const isGehad = stop.km <= huidige.km + 0.01
    const lengte = hoogte * (isGehad ? 0.5 : 0.32)
    const hoek = (rnd() - 0.5) * wiebel * 0.3

    svg.append(maakSvg('line', {
      x1: rond(x), y1: rond(boven + kaderMm * 0.5),
      x2: rond(x + Math.sin(hoek) * lengte), y2: rond(boven + kaderMm * 0.5 + lengte),
      stroke: kleuren.lijn,
      'stroke-opacity': isGehad ? 0.9 : 0.55,
      'stroke-width': kaderMm * 0.9,
      'stroke-linecap': 'round'
    }))
  }

  return {
    bovenY: boven,
    naamY: () => onder
  }
}

/** ------------------------------------------------------------ de opschriften
 *
 * Getypt is dezelfde onvaste aanslag als onder de stempels: letter voor letter
 * een haartje scheef. Dat is wat er van een bijschrift een aantekening maakt, en
 * het leent de knoppen van de veldnotitie zodat de hele bladzijde uit dezelfde
 * machine komt.
 */
function maakOpschrift (klasse, plek) {
  const el = document.createElement('div')
  el.className = klasse
  el.setAttribute('data-plek', plek)
  el.setAttribute('data-knoppen', 'voortgang')
  return el
}

/**
 * De tekst erin, gezet of getypt.
 *
 * typRegel() hangt elke letter in zijn eigen spanje; die halen we hier uit het
 * regeltje en zetten we rechtstreeks in het opschrift. Een div in een div zou
 * de klasse veldnotitie-regel meenemen, en daarmee de regelafstand van de
 * onderschriften onder de stempels - waar dit opschrift niets mee te maken heeft.
 */
function zetTekst (el, tekst, stijl, tekstRnd) {
  if (stijl['voortgang.hoofdletters']) el.style.textTransform = 'uppercase'

  if (!stijl['voortgang.getyptAan']) {
    el.textContent = tekst
    return el
  }

  el.style.letterSpacing = `${stijl['veldnotitie.letterafstand']}em`
  el.append(...typRegel(tekst, {
    jitter: stijl['veldnotitie.jitter'],
    rnd: tekstRnd
  }).childNodes)
  return el
}

/** Een haal met de pen onder een regel tekst, als los svg'tje in het opschrift. */
function handOnderstreping (kleur, rnd) {
  const svg = maakSvg('svg', {
    class: 'voortgang-onderstreep',
    viewBox: '0 0 100 4',
    preserveAspectRatio: 'none'
  })

  const punten = []
  for (let i = 0; i <= 8; i++) punten.push({ x: i * 12.5, y: 2.1 + (rnd() - 0.5) * 1.5 })

  svg.append(maakSvg('path', {
    d: padVan(punten),
    fill: 'none',
    stroke: kleur,
    'stroke-width': 1.2,
    'stroke-linecap': 'round',
    'stroke-opacity': 0.85
  }))
  return svg
}

/**
 * Tekent de balk.
 *
 * @param {number} totIndex tot welke stop de balk gevuld is; -1 is helemaal leeg
 */
export function tekenVoortgang (svg, opschriften, gegevens, stijl, totIndex) {
  const maat = voortgangMaat(stijl)
  const marge = maat.afloopMm + stijl['pagina.veiligeMargeMm']
  const zaad = gegevens.dag.dag ?? 1

  svg.setAttribute('viewBox', `0 0 ${maat.breedteMm} ${maat.hoogteMm}`)
  svg.replaceChildren()
  opschriften.replaceChildren()

  legPapier(svg, stijl, maat, zaad)

  const { stops, totaalKm } = stopsMetAfstand(gegevens)
  if (!stops.length || !totaalKm) return

  const links = marge
  const rechts = maat.breedteMm - marge
  const breedte = rechts - links
  const midden = maat.hoogteMm / 2
  const xVan = km => links + (km / totaalKm) * breedte
  const huidige = stops.find(s => s.index === totIndex) ?? stops.at(-1)

  // --------------------------------------------------------- één kleur of niet
  //
  // In één kleur blijft het strookje leesbaar doordat het onderscheid al in de
  // maten zit: waar je nu bent is het merkteken het grootst, wat je gehad hebt
  // iets groter dan wat nog komt. De kleur hoeft dat verschil dus niet te
  // dragen. Wat nog moet komen wordt lichter gezet in plaats van andersgekleurd.
  const een = stijl['voortgang.eenKleur']
  const kleur = stijl['voortgang.kleur']
  const kleuren = {
    baan: een ? kleur : stijl['voortgang.baanKleur'],
    baanDekking: een ? stijl['voortgang.legeDekking'] : 1,
    lijn: een ? kleur : stijl['route.kleur'],
    rand: een ? kleur : stijl['voortgang.stipRand'],
    naam: een ? kleur : stijl['statistieken.getalKleur'],
    label: een ? kleur : stijl['statistieken.labelKleur']
  }

  const ctx = {
    stijl, gegevens, links, rechts, midden, xVan, stops, huidige, totaalKm, kleuren,
    rnd: zaadje(zaad * 131 + 17)
  }

  const vorm = stijl['voortgang.vorm'] ?? 'balk'
  const plek = vorm === 'vak'
    ? tekenVak(svg, ctx)
    : vorm === 'penlijn'
      ? tekenPenlijn(svg, ctx)
      : tekenBalk(svg, ctx)

  // ------------------------------------------- naam, afstand en dag erbij
  const tekstRnd = zaadje(zaad * 53 + 11)
  const naamMm = stijl['voortgang.naamMm']
  // ruim boven de tekening: de onderstreping hangt onder de dagregel, en die
  // mag niet als tweede kaderlijn gaan lezen
  const bovenlijn = plek.bovenY - 3.2 - naamMm * 0.85

  if (stijl['voortgang.naamAan'] && huidige.naam) {
    const x = Math.min(rechts - 2, Math.max(links + 2, xVan(huidige.km)))
    const naam = maakOpschrift('voortgang-naam', 'voortgangnaam')
    naam.style.left = mm(x)
    naam.style.top = mm(plek.naamY(x) + 2.5)
    naam.style.fontSize = mm(naamMm)
    naam.style.color = kleuren.naam
    opschriften.append(zetTekst(naam, huidige.naam, stijl, tekstRnd))
  }

  if (stijl['voortgang.kmAan']) {
    const deel = totaalKm > 0 ? Math.round((huidige.km / totaalKm) * 100) : 0
    const kmTekst = maakOpschrift('voortgang-km', 'voortgangkm')
    kmTekst.style.left = mm(rechts)
    kmTekst.style.top = mm(bovenlijn)
    kmTekst.style.fontSize = mm(naamMm * 0.85)
    kmTekst.style.color = kleuren.label
    opschriften.append(zetTekst(
      kmTekst,
      `${huidige.km.toFixed(0)} van ${totaalKm.toFixed(0)} km` +
        (stijl['voortgang.procentAan'] ? ` · ${deel}%` : ''),
      stijl, tekstRnd
    ))
  }

  if (stijl['voortgang.dagAan']) {
    const dagTekst = maakOpschrift('voortgang-dag', 'voortgangdag')
    dagTekst.style.left = mm(links)
    dagTekst.style.top = mm(bovenlijn)
    dagTekst.style.fontSize = mm(naamMm * 0.85)
    dagTekst.style.color = kleuren.label
    zetTekst(dagTekst, `Dag ${gegevens.dag.dag} · ${gegevens.dag.titel}`, stijl, tekstRnd)

    // De dagregel is de kop van het strookje, en een kop onderstreep je.
    if (stijl['voortgang.onderstreepAan']) {
      dagTekst.append(handOnderstreping(kleuren.label, tekstRnd))
    }
    opschriften.append(dagTekst)
  }
}
