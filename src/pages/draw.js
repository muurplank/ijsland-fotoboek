/**
 * Tekent de kaartlaag: route, richtingspijltjes, markers en labels.
 *
 * Alles in millimeters, als vectoren. De SVG heeft een viewBox in millimeters,
 * dus een lijndikte van 1.1 hier is ook echt 1,1 mm op papier - bij elke
 * resolutie en elk paginaformaat.
 */

import { maakView, paginaMaat } from '../render/layout.js'
import { naastZichzelf } from '../render/parallel.js'
import { padData, pijltjesLangs, projecteer, vereenvoudig, verzachtLijn } from '../render/svg.js'

const SVG = 'http://www.w3.org/2000/svg'

const maak = (tag, eigenschappen = {}) => {
  const n = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(eigenschappen)) {
    if (v !== null && v !== undefined) n.setAttribute(k, String(v))
  }
  return n
}

const UITEINDEN = { rond: 'round', plat: 'butt', vierkant: 'square' }

/**
 * Binnen hoeveel graden twee punten dezelfde plek zijn: ongeveer zestig meter.
 *
 * Ruim genoeg voor een parkeerplaats of een hotelingang die je op twee dagen
 * net iets anders hebt aangetikt, krap genoeg om niet de buurman mee te nemen.
 * Dezelfde marge waarmee de server namen over dagen heen bijwerkt.
 */
const ZELFDE_PLEK_GRADEN = 0.0006

/** De eigenschappen waarmee de bedieningspagina een onderdeel herkent. */
const SLEEP = 'data-plek'
const SCHAALBAAR = 'data-schaalbaar'
const KNOPPEN = 'data-knoppen'

/** Ligt dit punt op de plek waar de vorige nacht eindigde? */
function isVorigeNacht (gegevens, w, i) {
  const vorige = gegevens.vorigeNacht
  return i === 0 && !!vorige &&
    Math.abs(vorige.lat - w.lat) <= ZELFDE_PLEK_GRADEN &&
    Math.abs(vorige.lon - w.lon) <= ZELFDE_PLEK_GRADEN
}

/**
 * Waar je bij dit punt sliep, of niets.
 *
 * Het vertrekpunt van een dag is de plek waar je de vorige nacht lag, maar in
 * het dagbestand staat het als een gewone start zonder verblijf. Vertrek je
 * daar 's ochtends uit een tent, dan hoort er ook een tentje te staan - anders
 * lijkt het alsof je de dag uit het niets begon.
 *
 * Afgeleid van de vorige dag en niet overgetypt in het bestand: verander je
 * waar dag 3 eindigde, dan volgt het vertrekpunt van dag 4 vanzelf.
 */
function verblijfVan (gegevens, w, i) {
  if (w.verblijf) return w.verblijf
  return isVorigeNacht(gegevens, w, i) ? (gegevens.vorigeNacht.verblijf ?? null) : null
}

/** De naam van dit punt; het vertrekpunt erft die van de nacht ervoor. */
function naamVan (gegevens, w, i) {
  if (w.name) return w.name
  return isVorigeNacht(gegevens, w, i) ? (gegevens.vorigeNacht.name ?? '') : ''
}

/**
 * De stukken van de route die op een F-weg liggen, als losse puntenreeksen.
 *
 * De etappelengtes vertellen waar elke etappe begint en eindigt op de route.
 * Staat het waypoint aan het begin van een etappe als F-weg gemarkeerd, dan
 * hoort die hele etappe erbij.
 */
function fwegStukken (gegevens, punten) {
  const waypoints = gegevens.dag.waypoints
  const legs = gegevens.route.legs ?? []
  if (!waypoints.some(w => w.fweg)) return []

  // de afgelegde afstand op elk punt van de getekende lijn
  const langs = [0]
  for (let i = 1; i < punten.length; i++) {
    langs.push(langs[i - 1] + Math.hypot(punten[i].x - punten[i - 1].x, punten[i].y - punten[i - 1].y))
  }
  const totaalMm = langs.at(-1)
  const totaalKm = legs.reduce((s, l) => s + l.distanceKm, 0)
  if (!totaalKm || !totaalMm) return []

  const stukken = []
  let km = 0

  for (const [i, leg] of legs.entries()) {
    const vanKm = km
    km += leg.distanceKm

    if (!waypoints[i]?.fweg) continue

    const vanMm = (vanKm / totaalKm) * totaalMm
    const totMm = (km / totaalKm) * totaalMm

    const stuk = punten.filter((_, j) => langs[j] >= vanMm && langs[j] <= totMm)
    if (stuk.length > 1) stukken.push(stuk)
  }

  return stukken
}

/**
 * Het pijltje als pad, wijzend naar rechts met de punt in de oorsprong.
 *
 * De vormen die met een lijn getekend worden (chevrons, de streep) staan in
 * LIJNVORMEN; die krijgen geen vulling maar een streek. De rest zijn gesloten
 * vormen die wel gevuld worden.
 */
export const LIJNVORMEN = new Set(['chevron', 'dubbele-chevron', 'streep', 'haakje'])

function pijlPad (vorm, grootte) {
  const l = grootte

  switch (vorm) {
    case 'chevron':
      return `M ${-l * 0.9} ${-l * 0.55} L 0 0 L ${-l * 0.9} ${l * 0.55}`

    case 'dubbele-chevron':
      // twee chevrons achter elkaar: leest sterker als richting
      return `M ${-l * 0.85} ${-l * 0.5} L ${-l * 0.05} 0 L ${-l * 0.85} ${l * 0.5} ` +
             `M ${-l * 1.55} ${-l * 0.5} L ${-l * 0.75} 0 L ${-l * 1.55} ${l * 0.5}`

    case 'haakje':
      // een smal V-tje, terughoudender dan een chevron
      return `M ${-l * 0.7} ${-l * 0.38} L 0 0 L ${-l * 0.7} ${l * 0.38}`

    case 'streep':
      // dwarsstreepje met een klein punt eraan; heel rustig op drukke kaarten
      return `M ${-l * 0.15} ${-l * 0.5} L ${-l * 0.15} ${l * 0.5} M ${-l * 0.15} 0 L 0 0`

    case 'driehoek-vol':
      // gewone gesloten driehoek, zonder de inham aan de achterkant
      return `M 0 0 L ${-l} ${-l * 0.52} L ${-l} ${l * 0.52} Z`

    case 'dart':
      // gestrekte pijlpunt: sneller ogend, past bij een lange route
      return `M 0 0 L ${-l * 1.25} ${-l * 0.42} L ${-l * 0.85} 0 L ${-l * 1.25} ${l * 0.42} Z`

    case 'pijl': {
      // pijlpunt met een steel eraan
      const punt = l * 0.55
      return `M 0 0 L ${-punt} ${-punt * 0.62} L ${-punt} ${-punt * 0.24} ` +
             `L ${-l * 1.5} ${-punt * 0.24} L ${-l * 1.5} ${punt * 0.24} ` +
             `L ${-punt} ${punt * 0.24} L ${-punt} ${punt * 0.62} Z`
    }

    case 'druppel':
      // afgeronde druppel die naar voren wijst
      return `M 0 0 C ${-l * 0.5} ${-l * 0.62} ${-l * 1.05} ${-l * 0.36} ${-l * 1.05} 0 ` +
             `C ${-l * 1.05} ${l * 0.36} ${-l * 0.5} ${l * 0.62} 0 0 Z`

    default:
      // driehoek met een lichte inham achterin: de klassieke kaartpijl
      return `M 0 0 L ${-l} ${-l * 0.5} L ${-l * 0.72} 0 L ${-l} ${l * 0.5} Z`
  }
}

/** Een marker van de gevraagde vorm, gecentreerd op de oorsprong. */
function markerVorm (vorm, straal) {
  if (vorm === 'vierkant') {
    return maak('rect', { x: -straal, y: -straal, width: straal * 2, height: straal * 2 })
  }
  if (vorm === 'ruit') {
    return maak('path', { d: `M 0 ${-straal} L ${straal} 0 L 0 ${straal} L ${-straal} 0 Z` })
  }
  if (vorm === 'ster') {
    const punten = []
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? straal : straal * 0.45
      const hoek = (Math.PI / 5) * i - Math.PI / 2
      punten.push(`${(Math.cos(hoek) * r).toFixed(3)},${(Math.sin(hoek) * r).toFixed(3)}`)
    }
    return maak('polygon', { points: punten.join(' ') })
  }
  if (vorm === 'speld') {
    const h = straal * 2.4
    return maak('path', {
      d: `M 0 0 C ${-straal * 1.35} ${-h * 0.55} ${-straal} ${-h} 0 ${-h} ` +
         `C ${straal} ${-h} ${straal * 1.35} ${-h * 0.55} 0 0 Z`
    })
  }

  return maak('circle', { cx: 0, cy: 0, r: straal })
}

/** De vormen waar je sliep; die krijgen een badge in plaats van een silhouet. */
const SLAAPVORMEN = new Set(['tent', 'huisje', 'auto'])

/**
 * Het tekentje voor waar je sliep, in een eenheidsvierkant van -1 tot 1.
 *
 * Alles is bewust hoekig en zonder details: op vier millimeter papier overleeft
 * alleen de grote vorm. De deuropening in de tent en het huisje zijn gaten
 * (evenodd), niet lijntjes - een lijn van een tiende millimeter verdwijnt in de
 * druk, een gat blijft staan omdat de vulkleur eromheen er dwars doorheen komt.
 */
function slaapTeken (vorm) {
  if (vorm === 'tent') {
    // A-tent: twee schuine wanden op een vlakke grond, met een openstaande flap
    return 'M 0 -0.78 L 0.86 0.62 L 0.56 0.62 L 0 -0.28 L -0.56 0.62 L -0.86 0.62 Z ' +
           'M 0 0.06 L 0.34 0.62 L -0.34 0.62 Z'
  }

  if (vorm === 'huisje') {
    // dak met overstek op een vierkant huis, met een deur als gat erin
    return 'M 0 -0.82 L 0.92 -0.02 L 0.68 -0.02 L 0.68 0.7 L -0.68 0.7 ' +
           'L -0.68 -0.02 L -0.92 -0.02 Z ' +
           'M -0.2 0.7 L -0.2 0.16 L 0.2 0.16 L 0.2 0.7 Z'
  }

  // auto: motorkap, cabine en twee wielen die onder de bodem uit steken
  return 'M -0.9 0.1 L -0.66 0.1 L -0.44 -0.42 L 0.44 -0.42 L 0.66 0.1 L 0.9 0.1 ' +
         'L 0.9 0.4 L -0.9 0.4 Z ' +
         'M -0.52 0.4 A 0.2 0.2 0 1 0 -0.52 0.41 Z ' +
         'M 0.52 0.4 A 0.2 0.2 0 1 0 0.52 0.41 Z'
}

/**
 * Een overnachting als badge: een gevulde schijf met het tekentje erin.
 *
 * Een kaal silhouet in de routekleur verdwijnt op een drukke kaart - een tentje
 * op een groen dal is nauwelijks te vinden. Een gevulde schijf met het icoon in
 * de randkleur erop geeft altijd hetzelfde contrast, ongeacht wat eronder ligt.
 * Dat is ook hoe kaarten hun voorzieningen zetten.
 */
function slaapBadge (vorm, straal, { vulling, rand, randMm }) {
  const groep = maak('g')

  // Een dunnere ring dan de gewone stops hebben.
  //
  // Die stops zijn een witte schijf met een dikke gekleurde ring - daar ís de
  // ring het teken. Hier is de ring alleen bedoeld om de badge van de kaart los
  // te maken, en op de volle dikte vreet hij de schijf op: er blijft dan zo
  // weinig vulkleur over dat het witte tekentje en de witte ring in elkaar
  // overlopen en je een wit vlekje ziet in plaats van een tentje.
  const ring = Math.min(randMm, straal * 0.18)

  groep.append(maak('circle', {
    cx: 0, cy: 0, r: straal - ring / 2,
    fill: vulling,
    stroke: rand,
    'stroke-width': ring
  }))

  // Het tekentje schikt zich naar de binnenmaat van de ring, niet naar de
  // buitenrand, zodat er rondom altijd een band vulkleur overblijft. Dat
  // bandje is wat het als badge laat lezen.
  const binnen = straal - ring
  const schaal = binnen * 0.74

  groep.append(maak('path', {
    d: slaapTeken(vorm),
    transform: `scale(${schaal.toFixed(4)})`,
    fill: rand,
    'fill-rule': 'evenodd',
    'stroke-linejoin': 'round'
  }))

  return groep
}

/**
 * Tekent alles opnieuw.
 *
 * @param {SVGElement} svg het tekenvlak
 * @param {HTMLElement} opschriften laag voor de labels (gewone tekst, geen svg)
 * @param {object} gegevens route en waypoints van de dag
 * @param {object} stijl alle instellingen
 */
export function teken (svg, opschriften, gegevens, stijl) {
  const maat = paginaMaat(stijl)
  const view = maakView(gegevens.route.coordinates, stijl)

  svg.setAttribute('viewBox', `0 0 ${maat.breedteMm} ${maat.hoogteMm}`)
  svg.replaceChildren()
  opschriften.replaceChildren()

  // ------------------------------------------------------------------ route
  const ruw = projecteer(gegevens.route.coordinates, view)

  // een tiende millimeter is al fijner dan een drukpers kan zetten
  const rechtdoor = vereenvoudig(ruw, 0.05)

  // Reed je een doodlopende fjordweg in en er weer uit, dan ligt de terugweg
  // precies op de heenweg en zie je één lijn - alsof je er nooit gekeerd bent.
  // Naast elkaar leggen laat zien dat je er twee keer reed, net als wat de
  // overzichtskaart met gedeelde wegen tussen dagen doet.
  //
  // Dit gebeurt vóór alles wat de lijn volgt, zodat de pijltjes en de
  // F-wegstippels vanzelf op de verschoven lijn terechtkomen.
  // De twee banen liggen een lijndikte plus de gewenste witruimte uit elkaar.
  // Alleen de witruimte aanhouden zou ze grotendeels laten overlappen, en dan
  // zie je één dikke streep in plaats van twee richtingen. Door de dikte erbij
  // op te tellen blijft er precies zoveel over als je instelt, en dat gat wordt
  // gevuld door de buitenlijn die de route toch al heeft.
  const punten = stijl['route.heenEnTerug']
    ? naastZichzelf(rechtdoor, {
        afstandMm: stijl['route.dikteMm'] + stijl['route.tussenruimteMm'],
        negeerMm: stijl['route.keerNegeerMm']
      })
    : rechtdoor

  const streepjes = stijl['route.streepjes']
    ? `${stijl['route.streepMm']} ${stijl['route.gatMm']}`
    : null

  const d = padData(punten)

  // De hele routelijn komt in één groep, en de doorzichtigheid zit op die groep
  // in plaats van op de lijnen zelf.
  //
  // Dat is het verschil tussen "elke lijn half doorzichtig" en "de route als
  // geheel half doorzichtig". Reed je een weg heen én terug, dan liggen er twee
  // lijnen over elkaar; met doorzichtigheid per lijn wordt dat stuk donkerder,
  // alsof je er twee keer zo hard reed. Op de groep wordt alles eerst platgeslagen
  // en pas daarna doorzichtig gemaakt, dus dubbel rijden telt niet dubbel.
  const routeGroep = maak('g', { opacity: stijl['route.dekking'] })

  const buitenDikte = stijl['route.dikteMm'] + 2 * stijl['route.buitenExtraMm']
  if (stijl['route.buitenExtraMm'] > 0) {
    const buiten = maak('path', {
      d,
      fill: 'none',
      stroke: stijl['route.buitenKleur'],
      'stroke-width': buitenDikte,
      'stroke-opacity': stijl['route.buitenDekking'],
      'stroke-linecap': UITEINDEN[stijl['route.uiteinden']],
      'stroke-linejoin': 'round',
      'stroke-dasharray': streepjes
    })

    // Met de buitenlijn als omranding wordt het midden eruit gemaskeerd, zodat
    // de kaart door je route heen schijnt in plaats van dat je de buitenlijn ziet.
    if (stijl['route.buitenAlsRand']) {
      const maskerId = 'route-omranding'
      const defs = maak('defs')
      const masker = maak('mask', { id: maskerId, maskUnits: 'userSpaceOnUse' })

      masker.append(maak('path', {
        d, fill: 'none', stroke: '#ffffff', 'stroke-width': buitenDikte,
        'stroke-linecap': UITEINDEN[stijl['route.uiteinden']], 'stroke-linejoin': 'round',
        'stroke-dasharray': streepjes
      }))
      masker.append(maak('path', {
        d, fill: 'none', stroke: '#000000', 'stroke-width': stijl['route.dikteMm'],
        'stroke-linecap': UITEINDEN[stijl['route.uiteinden']], 'stroke-linejoin': 'round',
        'stroke-dasharray': streepjes
      }))

      defs.append(masker)
      routeGroep.append(defs)
      buiten.setAttribute('mask', `url(#${maskerId})`)
    }

    routeGroep.append(buiten)
  }

  routeGroep.append(maak('path', {
    d,
    fill: 'none',
    stroke: stijl['route.kleur'],
    'stroke-width': stijl['route.dikteMm'],
    'stroke-linecap': UITEINDEN[stijl['route.uiteinden']],
    'stroke-linejoin': 'round',
    'stroke-dasharray': streepjes
  }))

  // De F-wegen als stippellijn erbovenop.
  //
  // De routelijn is een doorlopend pad, dus we knippen hem niet op. In plaats
  // daarvan komt er een stippellijn overheen op de stukken waar je op een F-weg
  // reed - het onverharde hooglandwerk. Waar die stukken liggen volgt uit de
  // etappelengtes: elke etappe loopt van waypoint naar waypoint.
  if (stijl['route.fwegStippels']) {
    const stukken = fwegStukken(gegevens, punten)
    for (const stuk of stukken) {
      // De stippellijn krijgt een eigen, gladdere lijn dan de route zelf.
      //
      // Een hooglandweg zit vol minibochtjes, en de route is vereenvoudigd op
      // 0,05 mm - fijner dan een pers kan zetten, dus die blijven er allemaal
      // in. Een streepjespatroon telt langs de booglengte, dus over zo'n
      // gekartelde lijn wordt een streepje van 1,6 mm in het oog veel korter,
      // buigt het in zichzelf, en klit het met zijn buren. Grover vereenvoudigen
      // en daarna de knikken afronden haalt het gekriebel eruit; de echte
      // haarspeldbochten blijven staan. De route zelf blijft ongemoeid.
      const glad = verzachtLijn(vereenvoudig(stuk, 0.35), 2)

      routeGroep.append(maak('path', {
        d: padData(glad),
        fill: 'none',
        stroke: stijl['route.buitenKleur'],
        'stroke-width': stijl['route.dikteMm'] * 0.55,
        'stroke-dasharray': `${stijl['route.fwegStreepMm']} ${stijl['route.fwegGatMm']}`,
        // plat, niet rond: ronde uiteinden zetten een halve lijndikte extra
        // inkt aan elke kant van elk streepje, en in de bochten klonteren die
        // aan elkaar tot blobjes
        'stroke-linecap': 'butt'
      }))
    }
  }

  svg.append(routeGroep)

  // -------------------------------------------------------------- pijltjes
  if (stijl['pijltjes.aan']) {
    const groep = maak('g')
    for (const p of pijltjesLangs(punten, stijl['pijltjes.afstandCm'] * 10)) {
      const alsLijn = LIJNVORMEN.has(stijl['pijltjes.vorm'])

      groep.append(maak('path', {
        d: pijlPad(stijl['pijltjes.vorm'], stijl['pijltjes.grootteMm']),
        transform: `translate(${p.x.toFixed(3)} ${p.y.toFixed(3)}) rotate(${p.hoek.toFixed(2)})`,
        fill: alsLijn ? 'none' : stijl['pijltjes.kleur'],
        stroke: alsLijn
          ? stijl['pijltjes.kleur']
          : (stijl['pijltjes.randMm'] > 0 ? stijl['pijltjes.randKleur'] : 'none'),
        'stroke-width': alsLijn
          ? stijl['pijltjes.grootteMm'] * stijl['pijltjes.lijnDikte']
          : stijl['pijltjes.randMm'],
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }))
    }
    svg.append(groep)
  }

  // --------------------------------------------------------------- markers
  const markers = maak('g')
  let stopNummer = 0

  for (const [i, w] of gegevens.dag.waypoints.entries()) {
    // uitgezette stops tekenen we helemaal niet: geen stip, geen naam, en ze
    // tellen ook niet mee in de nummering
    if (w.toon === false) continue

    const p = view.project(w.lon, w.lat)
    const verblijf = verblijfVan(gegevens, w, i)
    const slaap = w.type === 'overnight' || (i === 0 && !!verblijf)
    const via = w.type === 'via'

    const straal = (slaap
      ? stijl['markers.slaapGrootteMm']
      : via ? stijl['markers.viaGrootteMm'] : stijl['markers.stopGrootteMm']) / 2

    if (straal <= 0) continue

    // Waar je sliep bepaalt het icoon: een tent voor kamperen, een huis voor
    // een hotel, een auto voor de nacht op de parkeerplaats. Staat het niet in
    // het dagbestand, dan valt hij terug op de ingestelde vorm.
    const slaapVorm = { tent: 'tent', hotel: 'huisje', auto: 'auto' }[verblijf] ??
      stijl['markers.slaapVorm']

    const gekozen = slaap ? slaapVorm : via ? 'cirkel' : stijl['markers.stopVorm']
    const alsBadge = slaap && SLAAPVORMEN.has(gekozen)

    const vorm = alsBadge
      ? slaapBadge(gekozen, straal, {
          vulling: stijl['markers.slaapVulling'],
          rand: stijl['markers.slaapRand'],
          randMm: stijl['markers.stopRandMm']
        })
      : markerVorm(gekozen, straal)

    if (!alsBadge) {
      vorm.setAttribute('fill', slaap
        ? stijl['markers.slaapVulling']
        : via ? stijl['markers.viaVulling'] : stijl['markers.stopVulling'])

      if (!via) {
        vorm.setAttribute('stroke', slaap ? stijl['markers.slaapRand'] : stijl['markers.stopRand'])
        vorm.setAttribute('stroke-width', stijl['markers.stopRandMm'])
      }
    }

    markers.append(vorm)

    if (stijl['markers.nummers'] && !via) {
      stopNummer++
      const nr = maak('text', {
        x: p.x, y: p.y + straal * 0.36,
        'text-anchor': 'middle',
        'font-size': straal * 1.05,
        'font-weight': 650,
        fill: slaap ? '#ffffff' : stijl['markers.stopRand']
      })
      nr.textContent = String(stopNummer)
      markers.append(nr)
    }
  }
  svg.append(markers)

  // ---------------------------------------------------------------- labels
  if (stijl['labels.aan']) {
    // Dezelfde plek twee keer benoemen is altijd fout: reed je heen en weer
    // langs het vliegveld, dan hoort er één keer "Keflavík Airport" te staan.
    //
    // Op de plek ontdubbelen en niet op de naam. Op de naam ontdubbelen leek
    // hetzelfde, maar liet een label verdwijnen zodra je het de naam van een
    // ander punt gaf - en dat is precies wat je doet als twee stops allebei
    // "Kamperen" heten. Twee plekken die toevallig hetzelfde heten horen er
    // gewoon allebei te staan; hetzelfde punt twee keer niet.
    const alGetoond = []
    const zelfdePlek = (w, naam) =>
      alGetoond.some(g =>
        g.naam === naam &&
        Math.abs(g.lat - w.lat) <= ZELFDE_PLEK_GRADEN &&
        Math.abs(g.lon - w.lon) <= ZELFDE_PLEK_GRADEN)

    for (const [i, w] of gegevens.dag.waypoints.entries()) {
      if (w.type === 'via' && !w.label) continue
      if (w.toonLabel === false) continue

      // het vertrekpunt heeft vaak zelf geen naam en erft die van de nacht ervoor
      const tekst = naamVan(gegevens, w, i)
      if (!tekst) continue
      if (zelfdePlek(w, tekst)) continue
      alGetoond.push({ naam: tekst, lat: w.lat, lon: w.lon })

      const p = view.project(w.lon, w.lat)
      const verschuivingX = w.labelDxMm ?? 0
      const verschuivingY = w.labelDyMm ?? -(stijl['markers.stopGrootteMm'] / 2 + 1.6)

      const naam = document.createElement('div')
      naam.className = 'plaatsnaam'
      naam.setAttribute('data-plek', `label:${i}`)
      naam.setAttribute('data-tekst', `waypoint:${i}`)
      naam.textContent = w.name
      naam.style.left = `calc(${(p.x + verschuivingX)} * var(--mm))`
      naam.style.top = `calc(${(p.y + verschuivingY)} * var(--mm))`
      opschriften.append(naam)
    }
  }

  return view
}
