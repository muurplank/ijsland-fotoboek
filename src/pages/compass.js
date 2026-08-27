/**
 * De kompasroos.
 *
 * Opgebouwd zoals op oude zeekaarten: acht punten die vanuit het midden naar
 * buiten steken, elk gesplitst over de as. De ene helft vangt licht, de andere
 * ligt in de schaduw - daardoor krijgt een plat figuur diepte, precies zoals
 * een graveur dat met arceringen deed.
 *
 * De vier hoofdrichtingen steken verder uit dan de tussenliggende, zodat je in
 * een oogopslag ziet waar het noorden is zonder de letters te lezen.
 *
 * De vorm "naald" ruilt die punten in voor een magneetnaald op dezelfde
 * wijzerplaat: rood naar het noorden, blank staal naar het zuiden en een
 * messing schroefje op de spil. Datzelfde drietal kleuren - rood, staal,
 * messing - kan ook over de klassieke roos heen: dan is de noordpunt rood, zijn
 * de andere punten van staal en zit het schroefje in het hart.
 */

const SVG = 'http://www.w3.org/2000/svg'

const maakSvg = (tag, eigenschappen = {}) => {
  const n = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(eigenschappen)) {
    if (v !== null && v !== undefined) n.setAttribute(k, String(v))
  }
  return n
}

/** Poolcoordinaat naar x,y, met nul graden recht omhoog. */
function polair (hoekGraden, straal) {
  const a = ((hoekGraden - 90) * Math.PI) / 180
  return { x: Math.cos(a) * straal, y: Math.sin(a) * straal }
}

const rond = n => Math.round(n * 1000) / 1000
const punt = p => `${rond(p.x)} ${rond(p.y)}`

/** Een hexkleur met doorzichtigheid, als rgb()-notatie. */
function metDekking (hex, dekking) {
  const h = hex.replace('#', '')
  const n = parseInt(h.slice(0, 6), 16)
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${dekking})`
}

/** Twee kleuren mengen; t = 0 geeft de eerste, t = 1 de tweede. */
function meng (hex, naar, t) {
  const lees = h => {
    const n = parseInt(h.replace('#', '').slice(0, 6), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const a = lees(hex)
  const b = lees(naar)
  const k = i => Math.round(a[i] + (b[i] - a[i]) * t)
  return `rgb(${k(0)} ${k(1)} ${k(2)})`
}

let glasTeller = 0

/**
 * Het glasplaatje onder de kompasroos.
 *
 * Hier met echte vormen opgebouwd in plaats van met CSS, zoals bij het
 * titelblok. Een kompasroos staat in de tekenlaag, en de eigenschappen waarmee
 * je in CSS glas maakt - backdrop-filter, box-shadow - werken daar niet of niet
 * betrouwbaar. Met een verloop, een lichtrand en een zachte schaduw komt het op
 * hetzelfde uit, en dit gaat gegarandeerd mee naar de PDF.
 *
 * @param {number} straal buitenmaat van het plaatje in millimeters
 */
export function kompasGlas (straal, {
  kleur = '#ffffff',
  dekking = 0.42,
  schaduw = true
} = {}) {
  const groep = maakSvg('g', { class: 'kompasglas' })
  const id = `kompasglas-${++glasTeller}`

  const defs = maakSvg('defs')

  // het licht valt van linksboven in, net als bij de arcering van de roos zelf
  const sheen = maakSvg('linearGradient', { id: `${id}-sheen`, x1: '0.15', y1: '0', x2: '0.7', y2: '1' })
  sheen.append(maakSvg('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': '0.55' }))
  sheen.append(maakSvg('stop', { offset: '0.45', 'stop-color': '#ffffff', 'stop-opacity': '0.10' }))
  sheen.append(maakSvg('stop', { offset: '1', 'stop-color': '#ffffff', 'stop-opacity': '0' }))
  defs.append(sheen)

  if (schaduw) {
    const filter = maakSvg('filter', {
      id: `${id}-schaduw`, x: '-40%', y: '-40%', width: '180%', height: '180%'
    })
    filter.append(maakSvg('feDropShadow', {
      dx: 0, dy: straal * 0.05, stdDeviation: straal * 0.07,
      'flood-color': '#000000', 'flood-opacity': '0.18'
    }))
    defs.append(filter)
  }

  groep.append(defs)

  // De rand vloeit uit in plaats van dat hij ergens ophoudt.
  //
  // Een harde cirkelrand op een kaart met veel kleur wordt in de druk een
  // scherpe halo: precies het soort randje dat je op papier ziet zitten en op
  // het scherm niet. Door de vulling in de laatste tien procent naar niets te
  // laten zakken loopt het plaatje in de kaart over, en blijft het midden dicht
  // genoeg om de roos te dragen.
  const vloei = maakSvg('radialGradient', { id: `${id}-vloei` })
  vloei.append(maakSvg('stop', { offset: '0', 'stop-color': kleur, 'stop-opacity': dekking }))
  vloei.append(maakSvg('stop', { offset: '0.78', 'stop-color': kleur, 'stop-opacity': dekking }))
  vloei.append(maakSvg('stop', { offset: '0.93', 'stop-color': kleur, 'stop-opacity': dekking * 0.55 }))
  vloei.append(maakSvg('stop', { offset: '1', 'stop-color': kleur, 'stop-opacity': 0 }))
  defs.append(vloei)

  groep.append(maakSvg('circle', {
    cx: 0, cy: 0, r: straal,
    fill: `url(#${id}-vloei)`,
    filter: schaduw ? `url(#${id}-schaduw)` : null
  }))

  groep.append(maakSvg('circle', {
    cx: 0, cy: 0, r: straal * 0.985,
    fill: `url(#${id}-sheen)`
  }))

  return groep
}

let schroefTeller = 0

/**
 * Het messing schroefje op de spil.
 *
 * Een bolling maak je met een radiaal verloop dat niet in het midden begint
 * maar linksboven: daar komt het licht vandaan, en daardoor kantelt het vlakje
 * weg naar een donkere rand. Het spiegelvlakje erbovenop doet de rest.
 *
 * @param {number} r straal in millimeters
 */
function schroefje (r, kleur, lijnMm) {
  const groep = maakSvg('g', { class: 'kompasschroef' })
  const id = `kompasschroef-${++schroefTeller}`

  const defs = maakSvg('defs')
  const bol = maakSvg('radialGradient', {
    id, cx: '0.5', cy: '0.5', r: '0.6', fx: '0.33', fy: '0.28'
  })
  bol.append(maakSvg('stop', { offset: '0', 'stop-color': meng(kleur, '#ffffff', 0.62) }))
  bol.append(maakSvg('stop', { offset: '0.4', 'stop-color': meng(kleur, '#ffffff', 0.1) }))
  bol.append(maakSvg('stop', { offset: '0.82', 'stop-color': meng(kleur, '#000000', 0.22) }))
  bol.append(maakSvg('stop', { offset: '1', 'stop-color': meng(kleur, '#000000', 0.46) }))
  defs.append(bol)
  groep.append(defs)

  groep.append(maakSvg('circle', {
    cx: 0, cy: 0, r,
    fill: `url(#${id})`,
    stroke: meng(kleur, '#000000', 0.55),
    'stroke-width': lijnMm * 0.4
  }))

  // het spiegelvlakje waaraan je ziet dat het bol staat
  groep.append(maakSvg('ellipse', {
    cx: -r * 0.3, cy: -r * 0.33, rx: r * 0.34, ry: r * 0.2,
    fill: '#ffffff', opacity: 0.5,
    transform: `rotate(-38 ${rond(-r * 0.3)} ${rond(-r * 0.33)})`
  }))

  return groep
}

let naaldTeller = 0

/**
 * De magneetnaald uit een echt kompas.
 *
 * Geen graveerwerk maar gereedschap: twee lange lansen die in het draaipunt in
 * elkaar overlopen, de rode naar het noorden en het blanke staal naar het
 * zuiden, met een messing schroefje op de spil. Elke lans is over de lengte
 * geknikt - de ene flank vangt licht, de andere ligt in de schaduw - want dat
 * is wat een plat driehoekje tot een geslepen blad maakt.
 *
 * Bij de zuidhelft draait het blad mee, maar de belichte flank niet: de naald
 * is één stuk metaal, dus dezelfde kant blijft naar het licht wijzen. Daarom
 * wisselen daar de twee vullingen van plek.
 *
 * @param {number} opties.straal halve breedte van de roos in millimeters
 */
function kompasnaald ({ straal, noord, zuid, schroef, lijnMm }) {
  const groep = maakSvg('g', { class: 'kompasnaald' })
  const id = `kompasnaald-${++naaldTeller}`
  const defs = maakSvg('defs')

  const schaduw = maakSvg('filter', {
    id: `${id}-schaduw`, x: '-30%', y: '-30%', width: '160%', height: '160%'
  })
  schaduw.append(maakSvg('feDropShadow', {
    dx: straal * 0.012, dy: straal * 0.028, stdDeviation: straal * 0.022,
    'flood-color': '#000000', 'flood-opacity': '0.28'
  }))
  defs.append(schaduw)

  // Maten van het blad, met de punt recht omhoog. Het breedste punt ligt net
  // voorbij het hart, zodat de lans niet als een ruit oogt maar als een naald
  // die vanaf de spil naar voren uitloopt.
  const lengte = straal * 0.84
  const breed = straal * 0.09
  const zwelling = straal * 0.055
  const kont = straal * 0.13

  const flank = kant => [
    `M 0 ${rond(kont)}`,
    // een botte, ronde kont: die schuift onder het schroefje door en kruist de
    // andere helft, zoals bij een naald die uit één stuk metaal is gezet
    `Q ${rond(kant * breed * 0.5)} ${rond(kont)} ${rond(kant * breed * 0.78)} ${rond(kont * 0.72)}`,
    `Q ${rond(kant * breed)} ${rond(kont * 0.15)} ${rond(kant * breed)} ${rond(-zwelling)}`,
    `Q ${rond(kant * breed * 0.5)} ${rond(-lengte * 0.55)} 0 ${rond(-lengte)}`,
    'Z'
  ].join(' ')

  const blad = (kleur, zuidwaarts) => {
    const g = maakSvg('g', zuidwaarts ? { transform: 'rotate(180)' } : {})
    const licht = meng(kleur, '#ffffff', 0.26)
    const donker = meng(kleur, '#17110a', 0.3)
    const rand = meng(kleur, '#000000', 0.45)
    for (const [kant, vulling] of [[-1, zuidwaarts ? donker : licht], [1, zuidwaarts ? licht : donker]]) {
      g.append(maakSvg('path', {
        d: flank(kant),
        fill: vulling,
        stroke: rand,
        'stroke-width': lijnMm * 0.35,
        'stroke-linejoin': 'round'
      }))
    }
    return g
  }

  const naald = maakSvg('g', { filter: `url(#${id}-schaduw)` })
  naald.append(blad(zuid, true))
  naald.append(blad(noord, false))

  groep.append(defs)
  groep.append(naald)
  groep.append(schroefje(straal * 0.105, schroef, lijnMm))

  return groep
}

/**
 * Tekent een kompasroos als losse groep, gecentreerd op de oorsprong.
 *
 * @param {object} opties
 * @param {number} opties.straal halve breedte in millimeters
 * @param {'klassiek'|'ster'|'pijl'|'naald'} opties.vorm
 * @param {string} opties.donker kleur van de belichte helft
 * @param {string} opties.licht kleur van de schaduwhelft
 * @param {boolean} opties.kleuren rood noorden, stalen punten, messing hart
 * @param {string} opties.ring kleur van de cirkel eromheen
 * @param {boolean} opties.letters N/O/Z/W erbij
 */
export function kompasroos ({
  straal = 8,
  vorm = 'klassiek',
  donker = '#3a352e',
  licht = '#ffffff',
  ring = '#3a352e',
  ringDikteMm = 0.2,
  letters = true,
  letterMm = 2.6,
  kleuren = true,
  noordKleur = '#e03a28',
  staalKleur = '#c8ccd1',
  schroefKleur = '#c9a227'
}) {
  const groep = maakSvg('g', { class: 'kompas' })

  // ---------------------------------------------------------------- ringen
  const wijzerplaat = vorm === 'klassiek' || vorm === 'naald'
  if (wijzerplaat && ringDikteMm > 0) {
    groep.append(maakSvg('circle', {
      cx: 0, cy: 0, r: straal * 0.96,
      fill: 'none', stroke: ring, 'stroke-width': ringDikteMm
    }))
    groep.append(maakSvg('circle', {
      cx: 0, cy: 0, r: straal * 0.86,
      fill: 'none', stroke: ring, 'stroke-width': ringDikteMm * 0.5
    }))

    // streepjes op elke halve tussenrichting, zoals een gradenverdeling
    for (let hoek = 0; hoek < 360; hoek += 22.5) {
      const groot = hoek % 90 === 0
      const a = polair(hoek, straal * 0.86)
      const b = polair(hoek, straal * (groot ? 0.72 : 0.79))
      groep.append(maakSvg('line', {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: ring, 'stroke-width': ringDikteMm * (groot ? 1 : 0.6)
      }))
    }
  }

  // ------------------------------------------------------------ de punten
  //
  // Elke punt is een vlieger van het midden naar de tip, met twee schouders
  // opzij. Door de twee helften verschillend te vullen lijkt de punt te
  // kantelen, en dat geeft het geheel reliëf.
  //
  // Staat "kleuren" aan, dan komt daar de kleur van een echt kompas overheen:
  // de noordpunt rood, de andere punten van staal. De schaduwhelft blijft ook
  // dan uit dezelfde kleur gemengd, want anders valt het reliëf weg.
  const schouder = straal * 0.17
  const hoofdLengte = vorm === 'pijl' ? straal * 0.92 : straal * 0.78
  const tussenLengte = straal * 0.42

  const richtingen = vorm === 'naald'
    ? []
    : vorm === 'pijl'
      ? [0, 180]
      : [0, 45, 90, 135, 180, 225, 270, 315]

  for (const hoek of richtingen) {
    const hoofd = hoek % 90 === 0
    const lengte = hoofd ? hoofdLengte : tussenLengte
    if (!hoofd && vorm === 'ster') continue

    const tip = polair(hoek, lengte)
    const links = polair(hoek - 45, schouder)
    const rechts = polair(hoek + 45, schouder)

    const noordwaarts = kleuren && hoek === 0
    const basis = noordwaarts ? noordKleur : staalKleur
    const vulLicht = kleuren ? meng(basis, '#ffffff', noordwaarts ? 0.18 : 0.5) : licht
    const vulDonker = noordwaarts ? meng(basis, '#17110a', 0.3) : donker
    const lijn = noordwaarts ? meng(basis, '#000000', 0.5) : donker

    // de helft die naar het licht wijst
    groep.append(maakSvg('path', {
      d: `M 0 0 L ${punt(links)} L ${punt(tip)} Z`,
      fill: vulLicht,
      stroke: lijn,
      'stroke-width': ringDikteMm * 0.7,
      'stroke-linejoin': 'round'
    }))

    // en de helft in de schaduw
    groep.append(maakSvg('path', {
      d: `M 0 0 L ${punt(tip)} L ${punt(rechts)} Z`,
      fill: vulDonker,
      stroke: lijn,
      'stroke-width': ringDikteMm * 0.7,
      'stroke-linejoin': 'round'
    }))
  }

  if (vorm === 'naald') {
    groep.append(kompasnaald({
      straal,
      noord: noordKleur,
      zuid: staalKleur,
      schroef: schroefKleur,
      lijnMm: ringDikteMm
    }))
  } else if (kleuren) {
    // hetzelfde schroefje als op de naald: het dekt af waar acht punten in het
    // midden samenkomen, en het houdt de drie kleuren bij elkaar
    groep.append(schroefje(straal * 0.085, schroefKleur, ringDikteMm))
  } else {
    // een stipje in het hart, anders oogt het midden rommelig
    groep.append(maakSvg('circle', {
      cx: 0, cy: 0, r: straal * 0.055, fill: donker
    }))
  }

  // ------------------------------------------------------------- de letters
  if (letters) {
    const namen = vorm === 'pijl'
      ? [['N', 0]]
      : [['N', 0], ['O', 90], ['Z', 180], ['W', 270]]

    for (const [naam, hoek] of namen) {
      const p = polair(hoek, straal * (wijzerplaat ? 1.22 : 1.1))
      const t = maakSvg('text', {
        x: p.x, y: p.y + letterMm * 0.35,
        'text-anchor': 'middle',
        'font-size': letterMm,
        'font-weight': naam === 'N' ? 700 : 500,
        fill: donker
      })
      t.textContent = naam
      groep.append(t)
    }
  }

  return groep
}
