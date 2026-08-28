/**
 * Het voorblad: de hele reis, teruggebracht tot twee vormen.
 *
 * Dit is dezelfde reis als op de overzichtskaart en toch een ander blad. Daar
 * gaat het erom welke dag waar liep, dus staat er van alles bij: dagkleuren, een
 * legenda, plaatsnamen, een schaalbalk. Hier gaat het erom dat je in één blik
 * ziet wat dit boek is, en dan is alles wat je erbij zet er één te veel. Wat er
 * niet op staat is de helft van het ontwerp.
 *
 * Wat er wél op staat zijn twee omtrekken die elkaar uitleggen: de vorm van het
 * eiland en de vorm van de rit. De ene is een ring om de andere, en juist die
 * gelijkenis is waar een rondreis om draait.
 *
 * ## De kaart zit erin, maar altijd door iets heen
 *
 * Een gewone kaartachtergrond zou het blad meteen weer een kaartpagina maken.
 * Daarom komt de plaat er alleen doorheen waar hij iets toevoegt, en welke van
 * de vier dat is zegt `voorblad.kaart`:
 *
 * - `eiland`  de kaart vult het land, de zee blijft kaal papier
 * - `baan`    alleen een strook kaart langs de route
 * - `lijn`    de routelijn zelf is het venster
 * - `achter`  de hele kaart, ver weggezet
 * - `geen`    niets; dan wordt er ook niets opgehaald
 *
 * `eiland` knipt met een clipPath en de andere twee met een mask, en dat is geen
 * willekeur: een clipPath gebruikt de vúlling van zijn inhoud en negeert de
 * streek. Een baan langs de route is een dikke streek en heeft geen vulling, dus
 * daar kán clipPath niet. Andersom is clipPath voor het eiland juist beter, want
 * dat blijft in de PDF een echte snede in plaats van een rasterlaag.
 *
 * ## Waarom de kaartlaag in de SVG zit en niet als <img> erachter
 *
 * De andere bladen zetten de achtergrondplaat als los <img> achter de tekening.
 * Dat kan hier niet: het masker leeft in de millimeter-userspace van de SVG en
 * de <img> in beeldpunten van de pagina. Door de plaat als <image> in diezelfde
 * viewBox te zetten - op de vier getallen uit de x-plaatsing-kop - staan plaat
 * en masker per definitie in hetzelfde stelsel en kunnen ze niet uit elkaar
 * lopen bij een andere paginamaat of dpi.
 */

import { bouwSvg } from '../render/profielvorm.js'
import { padVan } from '../render/pen.js'
import { dekkendVak, vlagKnopen, vlagMaat, zegelKnopen, zegelMaat } from '../render/vlag.js'
import { papierKnopen, zaadje } from '../render/papier.js'
import { padData, projecteer, vereenvoudig } from '../render/svg.js'
import { paginaMaat, voorbladView } from '../render/layout.js'
import { DAGKLEUREN } from './overview.js'

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

/**
 * Een lijn een onvaste hand geven.
 *
 * Niet elk punt los verschuiven - dat geeft ruis en leest als een slechte scan.
 * Een hand dwaalt tráág af: hij loopt een centimeter naar buiten en komt daarna
 * weer terug. Dus wordt de afwijking uit een golf gehaald die langs de lijn
 * loopt, met een golflengte van een centimeter of wat, en staat de verschuiving
 * loodrecht op de lijn - anders wordt de kust langer of korter in plaats van
 * onvast.
 *
 * @param {Array<{x: number, y: number}>} punten
 * @param {Function} rnd        gezaaid, dus dezelfde stand geeft dezelfde hand
 * @param {number} amplitudeMm  hoe ver de pen maximaal afdwaalt
 * @param {number} golfMm       na hoeveel millimeter hij weer terug is
 */
export function wiebel (punten, { rnd, amplitudeMm, golfMm = 14 }) {
  if (!(amplitudeMm > 0) || punten.length < 3) return punten

  // een handvol toevalswaarden waar we straks zacht tussen wegen; met minder
  // dan vier wordt de golf zo lang dat je hem niet meer als hand herkent
  const knopen = []
  for (let i = 0; i < 64; i++) knopen.push(rnd() * 2 - 1)

  const zacht = t => {
    const i = Math.floor(t)
    const deel = t - i
    const a = knopen[((i % 64) + 64) % 64]
    const b = knopen[(((i + 1) % 64) + 64) % 64]
    // cosinus-overgang: dan is er op de knopen geen knik
    const w = (1 - Math.cos(deel * Math.PI)) / 2
    return a + (b - a) * w
  }

  const uit = []
  let langs = 0

  for (let i = 0; i < punten.length; i++) {
    const p = punten[i]
    if (i > 0) langs += Math.hypot(p.x - punten[i - 1].x, p.y - punten[i - 1].y)

    // de richting van de lijn hier, uit de buren; aan de uiteinden uit één buur
    const vorige = punten[i - 1] ?? p
    const volgende = punten[i + 1] ?? p
    const dx = volgende.x - vorige.x
    const dy = volgende.y - vorige.y
    const lengte = Math.hypot(dx, dy) || 1

    const afwijking = zacht(langs / golfMm) * amplitudeMm
    uit.push({
      x: p.x + (-dy / lengte) * afwijking,
      y: p.y + (dx / lengte) * afwijking
    })
  }

  return uit
}

/** De kustringen geprojecteerd op de pagina, vereenvoudigd en met de hand. */
function kustPaden (kust, view, stijl, rnd) {
  const hand = stijl['voorblad.penAan'] ? stijl['voorblad.penWiebelMm'] : 0

  return (kust?.ringen ?? []).map(ring => {
    const punten = vereenvoudig(projecteer(ring, view), 0.06)
    return wiebel(punten, { rnd, amplitudeMm: hand, golfMm: 18 })
  }).filter(p => p.length > 3)
}

/** De route van de hele reis, per dag, geprojecteerd en met dezelfde hand. */
function routePaden (reis, view, stijl, rnd) {
  // De route krijgt een kleinere wiebel dan de kust. Een weg ís recht getrokken
  // door iemand met een graafmachine; een kustlijn niet. Dezelfde afwijking op
  // allebei laat de weg dronken lijken.
  const hand = stijl['voorblad.penAan'] ? stijl['voorblad.penWiebelMm'] * 0.45 : 0

  return reis.map(dag => {
    const punten = vereenvoudig(projecteer(dag.coordinates, view), 0.05)
    return { dag, punten: wiebel(punten, { rnd, amplitudeMm: hand, golfMm: 26 }) }
  })
}

/**
 * De laag met de kaart erin, gemaskerd volgens de gekozen stand.
 *
 * Geeft een <g> terug met de defs én de <image>, zodat een eventuele
 * rasterisatie in de PDF binnen deze groep blijft en de kustlijn en de route
 * eromheen vector houdt.
 *
 * Daarnaast komt `knip` terug: de manier waarop deze laag is uitgesneden, zodat
 * het vel dat er straks overheen gaat exact dezelfde snede kan volgen. Zonder
 * dat zou dat vel de hele bladzijde vullen en was de doorzichtige achtergrond
 * meteen weer weg.
 */
function kaartLaag (plaat, { stand, kustPaden, routePaden, stijl, maat }) {
  if (stand === 'geen' || !plaat?.url) return null

  const groep = maakSvg('g', { 'data-laag': 'voorblad-kaart' })
  const defs = maakSvg('defs')
  const dekking = stijl['voorblad.kaartDekking']

  const beeld = maakSvg('image', {
    href: plaat.url,
    x: rond(plaat.xMm),
    y: rond(plaat.yMm),
    width: rond(plaat.breedteMm),
    height: rond(plaat.hoogteMm),
    opacity: rond(dekking),
    preserveAspectRatio: 'none'
  })

  if (stand === 'achter') {
    groep.append(beeld)
    return { groep, knip: null }
  }

  if (stand === 'eiland') {
    // clipPath en niet mask: dan blijft het in de PDF een echte snede langs de
    // kust in plaats van een gerasterde laag. evenodd omdat de omloopsrichting
    // van de ringen niet vastligt - zie ringOppervlak in render/kustringen.js
    const clip = maakSvg('clipPath', {
      id: 'voorblad-eiland',
      clipPathUnits: 'userSpaceOnUse'
    })
    clip.append(maakSvg('path', {
      d: kustPaden.map(p => padVan(p, true)).join(' '),
      'clip-rule': 'evenodd'
    }))
    defs.append(clip)
    beeld.setAttribute('clip-path', 'url(#voorblad-eiland)')
    groep.append(defs, beeld)
    return { groep, knip: ['clip-path', 'url(#voorblad-eiland)'] }
  }

  // baan en lijn: allebei een dikke streek langs de route, alleen anders breed.
  // Dit moet een mask zijn en kan geen clipPath zijn, want een clipPath kijkt
  // naar de vulling van zijn inhoud en een streek heeft die niet.
  const breedte = stand === 'lijn' ? stijl['voorblad.routeMm'] : stijl['voorblad.baanMm']
  const zacht = stand === 'baan' ? stijl['voorblad.zachteRandMm'] : 0

  const masker = maakSvg('mask', {
    id: 'voorblad-baan',
    maskUnits: 'userSpaceOnUse',
    x: 0,
    y: 0,
    width: maat.breedteMm,
    height: maat.hoogteMm
  })

  const d = routePaden.map(r => padVan(r.punten)).join(' ')

  // De zachte rand als een stapeltje strepen van breed-en-donker naar
  // smal-en-wit. Geen feGaussianBlur: dat rastert het masker, en op 600 dpi over
  // een blad van dertig centimeter is dat een plaat van tientallen megabytes.
  // Zo blijft het een handvol paden, en op een baan van centimeters breed ziet
  // niemand de trapjes.
  const stappen = zacht > 0 ? 6 : 1
  for (let i = 0; i < stappen; i++) {
    const deel = stappen === 1 ? 1 : i / (stappen - 1)
    masker.append(maakSvg('path', {
      d,
      fill: 'none',
      stroke: '#ffffff',
      'stroke-opacity': rond(stappen === 1 ? 1 : deel * deel),
      'stroke-width': rond(breedte + zacht * 2 * (1 - deel)),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }))
  }

  defs.append(masker)
  beeld.setAttribute('mask', 'url(#voorblad-baan)')
  groep.append(defs, beeld)
  return { groep, knip: ['mask', 'url(#voorblad-baan)'] }
}

/**
 * Tekent het voorblad.
 *
 * @param {SVGElement} svg
 * @param {HTMLElement} opschriften
 * @param {object} gegevens
 * @param {Array} gegevens.reis   alle dagen met hun routes
 * @param {object} gegevens.kust  de ringen van /api/kustlijn
 * @param {object} gegevens.boek  titel, ondertitel en de bewerkte teksten
 * @param {object|null} gegevens.plaat  de achtergrondplaat met zijn plaatsing
 * @param {object} stijl
 */
export function tekenVoorblad (svg, opschriften, { reis, kust, boek, plaat }, stijl) {
  const maat = paginaMaat(stijl)
  const marge = maat.afloopMm + stijl['pagina.veiligeMargeMm']

  svg.setAttribute('viewBox', `0 0 ${maat.breedteMm} ${maat.hoogteMm}`)
  svg.replaceChildren()
  opschriften.replaceChildren()

  if (!kust?.ringen?.length) return null

  // Het voorblad kadert op de kust en niet op de route: de Westfjorden en de
  // oostpunt liggen buiten de rit, en een omslag met een afgesneden IJsland
  // klopt niet. De server rekent met exact dezelfde ringen voor de plaat.
  const view = voorbladView(kust.ringen.flat(), stijl)
  const rnd = zaadje(stijl['voorblad.zaad'])

  // ------------------------------------------------------------- het vel
  if (stijl['voorblad.papierAan']) {
    const vel = maakSvg('g', { 'data-laag': 'voorblad-papier' })
    for (const knoop of papierKnopen({
      breedteMm: maat.breedteMm,
      hoogteMm: maat.hoogteMm,
      stijl,
      zaad: stijl['voorblad.zaad'],
      id: 'voorbladpapier'
    })) {
      vel.append(bouwSvg(knoop))
    }
    svg.append(vel)
  }

  const kusten = kustPaden(kust, view, stijl, rnd)
  const routes = routePaden(reis ?? [], view, stijl, rnd)

  // ------------------------------------------------------------ de kaart
  const kaart = kaartLaag(plaat, {
    stand: stijl['voorblad.kaart'],
    kustPaden: kusten,
    routePaden: routes,
    stijl,
    maat
  })
  if (kaart) svg.append(kaart.groep)

  // --------------------------------------------------- het vel over de kaart
  //
  // Hetzelfde vel nog eens, nu bovenop de kaart maar onder de lijnen. Dat is de
  // truc die de dagkaarten ook gebruiken: zonder dit ligt er een lichte plaat op
  // warm papier en zie je twee materialen, met dit loopt dezelfde vezel over het
  // eiland en de zee en is het één vel waar iets op gedrukt staat. Onder de
  // lijnen door, want de kust en de route moeten scherp blijven.
  if (kaart && stijl['voorblad.papierOverKaart']) {
    const over = maakSvg('g', {
      opacity: rond(stijl['voorblad.papierOverDekking']),
      'pointer-events': 'none'
    })
    // dezelfde snede als de kaart eronder: het vel hoort de plaat te temperen,
    // niet de bladzijde te vullen
    if (kaart.knip) over.setAttribute(kaart.knip[0], kaart.knip[1])
    for (const knoop of papierKnopen({
      breedteMm: maat.breedteMm,
      hoogteMm: maat.hoogteMm,
      stijl,
      zaad: stijl['voorblad.zaad'],
      id: 'voorbladpapier-over',
      grondvlak: true
    })) {
      over.append(bouwSvg(knoop))
    }
    svg.append(over)
  }

  // -------------------------------------------------- de vlag als het eiland
  //
  // De landsgrens is hier het venster en de vlag de vulling. Hij komt vóór de
  // kustlijn en de route, want juist dat maakt het een kaart en geen plaatje:
  // de omtrek en de rit liggen er als lijn overheen.
  //
  // De vlag wordt niet uitgerekt naar de vorm van het land maar dekkend
  // geschaald met behoud van verhouding - IJsland is breder dan de vlag hoog is,
  // dus wat boven en onder uitsteekt knipt de kust vanzelf weg. Uitrekken zou
  // het kruis vervormen, en een vlag met een scheef kruis is geen vlag meer.
  if (stijl['voorblad.vlagAan'] && stijl['voorblad.vlagPlek'] === 'als het eiland') {
    const clip = maakSvg('clipPath', {
      id: 'voorblad-vlageiland',
      clipPathUnits: 'userSpaceOnUse'
    })
    clip.append(maakSvg('path', {
      d: kusten.map(k => padVan(k, true)).join(' '),
      'clip-rule': 'evenodd'
    }))

    const defs = maakSvg('defs')
    defs.append(clip)

    const xen = kusten.flat().map(p => p.x)
    const yen = kusten.flat().map(p => p.y)
    const vak = dekkendVak({
      x: Math.min(...xen),
      y: Math.min(...yen),
      breedte: Math.max(...xen) - Math.min(...xen),
      hoogte: Math.max(...yen) - Math.min(...yen)
    })

    const groep = maakSvg('g', { 'clip-path': 'url(#voorblad-vlageiland)' })
    for (const knoop of vlagKnopen({
      x: vak.x,
      y: vak.y,
      breedteMm: vak.breedteMm,
      dekking: stijl['voorblad.vlagDekking']
    })) {
      groep.append(bouwSvg(knoop))
    }

    svg.append(defs, groep)
  }

  // ------------------------------------------------------------- de kust
  if (stijl['voorblad.kustAan']) {
    for (const punten of kusten) {
      svg.append(maakSvg('path', {
        d: padVan(punten, true),
        fill: 'none',
        stroke: stijl['voorblad.kustKleur'],
        'stroke-width': stijl['voorblad.kustMm'],
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round'
      }))
    }
  }

  // ------------------------------------------------------------ de route
  const kleuren = stijl['voorblad.dagkleuren']
    ? routes.map((_, i) => DAGKLEUREN[i % DAGKLEUREN.length])
    : routes.map(() => stijl['voorblad.routeKleur'])

  for (const [i, r] of routes.entries()) {
    if (r.punten.length < 2) continue
    svg.append(maakSvg('path', {
      d: padData(r.punten),
      fill: 'none',
      stroke: kleuren[i],
      'stroke-width': stijl['voorblad.routeMm'],
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }))
  }

  // --------------------------------------------------- de overnachtingen
  //
  // De scharnierpunten van de reis: waar je sliep hield de dag op. Dat zijn er
  // acht, en daarmee zijn ze te tellen zonder legenda.
  const stip = stijl['voorblad.stipMm']

  if (stip > 0 || stijl['voorblad.dagnummersAan']) {
    for (const [i, r] of routes.entries()) {
      for (const w of r.dag.waypoints ?? []) {
        if (w.type !== 'overnight' && w.type !== 'end') continue
        const p = view.project(w.lon, w.lat)

        if (stip > 0) {
          svg.append(maakSvg('circle', {
            cx: rond(p.x),
            cy: rond(p.y),
            r: rond(stip / 2),
            fill: kleuren[i],
            stroke: stijl['papier.kleur'],
            'stroke-width': rond(stip * 0.16)
          }))
        }

        if (stijl['voorblad.dagnummersAan']) {
          const nr = document.createElement('div')
          nr.className = 'voorblad-dagnummer'
          nr.setAttribute('data-plek', `voorblad-dagnummer:${r.dag.dag}`)
          nr.setAttribute('data-knoppen', 'voorblad')
          nr.style.left = mm(p.x)
          nr.style.top = mm(p.y)
          nr.style.fontSize = mm(stijl['voorblad.dagnummerMm'])
          nr.style.color = stijl['voorblad.titelKleur']
          nr.textContent = String(r.dag.dag)
          opschriften.append(nr)
        }
      }
    }
  }

  // ---------------------------------------------------------------- de vlag
  //
  // Niet in een hoek geparkeerd, want een vlag die daar staat is een logo en een
  // boek met een logo erop is een brochure. Als postzegel krijgt hij een reden
  // om er te zijn - rechtsboven, waar op een envelop een zegel hoort - en leest
  // het omslag als post uit IJsland in plaats van als een kaart met een
  // vlaggetje erbij.
  //
  // De draaiing zit op een binnengroep en niet op de groep met data-plek erop.
  // Dat moet: het slepen en schalen zet een CSS-transform op dat element, en een
  // transform-attribuut zou daar door overschreven worden - de zegel stond dan
  // recht zodra je hem aanraakte.
  const losseVlag = stijl['voorblad.vlagAan'] &&
    stijl['voorblad.vlagPlek'] !== 'als het eiland'

  if (losseVlag) {
    const plek = stijl['voorblad.vlagPlek']
    const zegel = plek === 'postzegel'
    const breedte = stijl['voorblad.vlagBreedteMm']
    const tandMm = stijl['voorblad.vlagTandMm']

    const afmeting = zegel ? zegelMaat(breedte, tandMm) : vlagMaat(breedte)

    let vx
    let vy

    if (plek === 'bij het beginpunt') {
      // waar de reis begon, en dan net naast het punt zodat de stip vrij blijft
      const start = (reis?.[0]?.waypoints ?? []).find(w => w.type === 'start') ??
        reis?.[0]?.waypoints?.[0]
      const p = start ? view.project(start.lon, start.lat) : null
      vx = (p?.x ?? maat.breedteMm / 2) + afmeting.breedteMm * 0.18
      vy = (p?.y ?? maat.hoogteMm / 2) - afmeting.hoogteMm * 1.15
    } else {
      const hoek = stijl['voorblad.vlagHoek']
      vx = hoek.startsWith('rechts') ? maat.breedteMm - marge - afmeting.breedteMm : marge
      vy = hoek.endsWith('boven') ? marge : maat.hoogteMm - marge - afmeting.hoogteMm
    }

    const doos = maakSvg('g', {
      'data-plek': 'voorbladvlag',
      'data-schaalbaar': 'css',
      'data-knoppen': 'voorblad'
    })

    const scheef = maakSvg('g', {
      transform: `rotate(${rond(stijl['voorblad.vlagDraaiing'])} ` +
        `${rond(vx + afmeting.breedteMm / 2)} ${rond(vy + afmeting.hoogteMm / 2)})`
    })

    // een eigen zaad naast dat van het vel: anders verandert de aandruk van de
    // vlag mee zodra je aan de vezels van het papier draait
    const zaad = zaadje(stijl['voorblad.zaad'] * 17 + 5)

    const knopen = zegel
      ? zegelKnopen({
          x: vx,
          y: vy,
          breedteMm: breedte,
          rnd: zaad,
          tandMm,
          papierKleur: stijl['papier.kleur'],
          inktKleur: stijl['voorblad.kustKleur'],
          afstempeling: stijl['voorblad.vlagAfstempeling'],
          dekking: stijl['voorblad.vlagDekking'],
          id: 'voorbladzegel'
        })
      : vlagKnopen({
          x: vx,
          y: vy,
          breedteMm: breedte,
          dekking: stijl['voorblad.vlagDekking']
        })

    for (const knoop of knopen) scheef.append(bouwSvg(knoop))
    doos.append(scheef)
    svg.append(doos)
  }

  // --------------------------------------------------------- het titelblok
  //
  // Staat standaard uit. Zie de knoppen in styleSchema.js voor waarom.
  if (!stijl['voorblad.titelAan']) return view

  const hoek = stijl['voorblad.titelHoek']
  const blok = document.createElement('div')
  blok.className = 'voorblad-titel'
  blok.setAttribute('data-plek', 'voorbladtitel')
  blok.setAttribute('data-schaalbaar', 'css')
  blok.setAttribute('data-knoppen', 'voorblad')
  blok.setAttribute('data-binnen-marge', '')
  blok.style.position = 'absolute'
  blok.style.color = stijl['voorblad.titelKleur']
  blok.style.textAlign = hoek.startsWith('rechts') ? 'right' : 'left'

  if (hoek.startsWith('rechts')) blok.style.right = mm(marge)
  else blok.style.left = mm(marge)
  if (hoek.endsWith('boven')) blok.style.top = mm(marge)
  else blok.style.bottom = mm(marge)

  const titel = document.createElement('div')
  titel.className = 'voorblad-hoofd'
  titel.setAttribute('data-tekst', 'voorbladtitel')
  titel.style.fontSize = mm(stijl['voorblad.titelMm'])
  titel.textContent = boek?.voorblad?.titel ?? boek?.titel ?? 'IJsland'

  const onder = document.createElement('div')
  onder.className = 'voorblad-onder'
  onder.setAttribute('data-tekst', 'voorbladondertitel')
  onder.style.fontSize = mm(stijl['voorblad.ondertitelMm'])
  onder.textContent = boek?.voorblad?.ondertitel ?? boek?.ondertitel ?? ''

  blok.append(titel, onder)

  if (stijl['voorblad.bijregel'] && reis?.length) {
    const km = reis.reduce((s, d) => s + (d.afstandKm ?? 0), 0)
    const regel = document.createElement('div')
    regel.className = 'voorblad-bijregel'
    regel.style.fontSize = mm(stijl['voorblad.regelMm'])
    regel.textContent = `${reis.length} dagen · ${km.toFixed(0)} km · ${datums(reis)}`
    blok.append(regel)
  }

  opschriften.append(blok)

  return view
}

/** "6 – 13 augustus 2026", of alleen het jaar als de datums ontbreken. */
function datums (reis) {
  const eerste = reis[0]?.datum
  const laatste = reis.at(-1)?.datum
  if (!eerste || !laatste) return ''

  const maanden = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
    'augustus', 'september', 'oktober', 'november', 'december']
  const deel = d => {
    const [jaar, maand, dag] = d.split('-').map(Number)
    return { jaar, maand, dag }
  }

  const a = deel(eerste)
  const b = deel(laatste)

  // binnen dezelfde maand hoeft de maandnaam er maar één keer te staan
  if (a.jaar === b.jaar && a.maand === b.maand) {
    return `${a.dag}–${b.dag} ${maanden[b.maand - 1]} ${b.jaar}`
  }
  if (a.jaar === b.jaar) {
    return `${a.dag} ${maanden[a.maand - 1]} – ${b.dag} ${maanden[b.maand - 1]} ${b.jaar}`
  }
  return `${a.dag} ${maanden[a.maand - 1]} ${a.jaar} – ${b.dag} ${maanden[b.maand - 1]} ${b.jaar}`
}
