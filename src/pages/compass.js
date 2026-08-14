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

/**
 * Tekent een kompasroos als losse groep, gecentreerd op de oorsprong.
 *
 * @param {object} opties
 * @param {number} opties.straal halve breedte in millimeters
 * @param {'klassiek'|'ster'|'pijl'} opties.vorm
 * @param {string} opties.donker kleur van de belichte helft
 * @param {string} opties.licht kleur van de schaduwhelft
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
  letterMm = 2.6
}) {
  const groep = maakSvg('g', { class: 'kompas' })

  // ---------------------------------------------------------------- ringen
  if (vorm === 'klassiek' && ringDikteMm > 0) {
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
  const schouder = straal * 0.17
  const hoofdLengte = vorm === 'pijl' ? straal * 0.92 : straal * 0.78
  const tussenLengte = straal * 0.42

  const richtingen = vorm === 'pijl'
    ? [0, 180]
    : [0, 45, 90, 135, 180, 225, 270, 315]

  for (const hoek of richtingen) {
    const hoofd = hoek % 90 === 0
    const lengte = hoofd ? hoofdLengte : tussenLengte
    if (!hoofd && vorm === 'ster') continue

    const tip = polair(hoek, lengte)
    const links = polair(hoek - 45, schouder)
    const rechts = polair(hoek + 45, schouder)

    // de helft die naar het licht wijst
    groep.append(maakSvg('path', {
      d: `M 0 0 L ${punt(links)} L ${punt(tip)} Z`,
      fill: licht,
      stroke: donker,
      'stroke-width': ringDikteMm * 0.7,
      'stroke-linejoin': 'round'
    }))

    // en de helft in de schaduw
    groep.append(maakSvg('path', {
      d: `M 0 0 L ${punt(tip)} L ${punt(rechts)} Z`,
      fill: donker,
      stroke: donker,
      'stroke-width': ringDikteMm * 0.7,
      'stroke-linejoin': 'round'
    }))
  }

  // een stipje in het hart, anders oogt het midden rommelig
  groep.append(maakSvg('circle', {
    cx: 0, cy: 0, r: straal * 0.055, fill: donker
  }))

  // ------------------------------------------------------------- de letters
  if (letters) {
    const namen = vorm === 'pijl'
      ? [['N', 0]]
      : [['N', 0], ['O', 90], ['Z', 180], ['W', 270]]

    for (const [naam, hoek] of namen) {
      const p = polair(hoek, straal * (vorm === 'klassiek' ? 1.22 : 1.1))
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
