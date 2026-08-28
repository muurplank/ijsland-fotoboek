/**
 * Marching squares: uit een rooster met getallen de lijn halen waar een bepaalde
 * waarde precies gehaald wordt.
 *
 * Dit stond eerst binnenin hoogtelijnvulling.js, want daar was het voor bedoeld:
 * de kringen in het voortgangsvak. Maar er is niets aan deze drie functies dat
 * met hoogte te maken heeft - ze werken op elk rooster, met elk niveau. De
 * kustlijn van IJsland is dezelfde bewerking op het echte hoogtemodel met
 * niveau nul, en dan is zeeniveau de hoogtelijn.
 *
 * Ze staan hier onveranderd. De vulling gedraagt zich dus precies zoals eerst,
 * en test/hoogtelijnvulling.test.js is de controle daarop.
 *
 * De eenheid van `stapMm` is die van de aanroeper: millimeters bij de vulling,
 * roostercellen bij de kustlijn. De naam is uit de eerste gebruiker blijven
 * hangen; het is gewoon de maat van een cel.
 */

/**
 * Marching squares: de lijn van gelijke hoogte door een rooster.
 *
 * Geeft losse streepjes terug, per cel eentje of twee. Die worden daarna aan
 * elkaar geregen; als losse streepjes tekenen zou werken, maar levert duizenden
 * paadjes op in de PDF en ronde uiteinden op elke celgrens.
 */
export function isoStreepjes (rooster, kolommen, rijen, stapMm, niveau) {
  const uit = []
  const bij = (i, j) => rooster[j * kolommen + i]

  // waar op een celrand de lijn de hoogte precies raakt
  const tussen = (a, b) => {
    const deel = (niveau - a) / (b - a)
    return Math.max(0, Math.min(1, deel))
  }

  for (let j = 0; j < rijen - 1; j++) {
    for (let i = 0; i < kolommen - 1; i++) {
      const lb = bij(i, j + 1)
      const rb = bij(i + 1, j + 1)
      const ro = bij(i + 1, j)
      const lo = bij(i, j)

      let geval = 0
      if (lo > niveau) geval |= 8
      if (ro > niveau) geval |= 4
      if (rb > niveau) geval |= 2
      if (lb > niveau) geval |= 1
      if (geval === 0 || geval === 15) continue

      const x0 = i * stapMm
      const y0 = j * stapMm
      const boven = () => ({ x: x0 + tussen(lo, ro) * stapMm, y: y0 })
      const rechts = () => ({ x: x0 + stapMm, y: y0 + tussen(ro, rb) * stapMm })
      const onder = () => ({ x: x0 + tussen(lb, rb) * stapMm, y: y0 + stapMm })
      const links = () => ({ x: x0, y: y0 + tussen(lo, lb) * stapMm })

      switch (geval) {
        case 1: case 14: uit.push([links(), onder()]); break
        case 2: case 13: uit.push([onder(), rechts()]); break
        case 3: case 12: uit.push([links(), rechts()]); break
        case 4: case 11: uit.push([boven(), rechts()]); break
        case 6: case 9: uit.push([boven(), onder()]); break
        case 7: case 8: uit.push([links(), boven()]); break
        // de twee zadels: welke twee hoeken bij elkaar horen beslist het midden
        case 5: case 10: {
          const midden = (lo + ro + rb + lb) / 4
          const zelfde = (geval === 5) === (midden > niveau)
          if (zelfde) {
            uit.push([links(), boven()], [onder(), rechts()])
          } else {
            uit.push([links(), onder()], [boven(), rechts()])
          }
          break
        }
      }
    }
  }
  return uit
}

/** Losse streepjes aan elkaar rijgen tot zo lang mogelijke lijnen. */
export function rijg (streepjes) {
  const sleutel = p => `${Math.round(p.x * 500)}|${Math.round(p.y * 500)}`

  const buren = new Map()
  for (const [i, s] of streepjes.entries()) {
    for (const k of [sleutel(s[0]), sleutel(s[1])]) {
      if (!buren.has(k)) buren.set(k, [])
      buren.get(k).push(i)
    }
  }

  const op = new Array(streepjes.length).fill(false)
  const lijnen = []

  for (let i = 0; i < streepjes.length; i++) {
    if (op[i]) continue
    op[i] = true
    const rij = [streepjes[i][0], streepjes[i][1]]

    // vanaf allebei de uiteinden doorgroeien tot er niets meer aansluit
    for (const achteraan of [true, false]) {
      for (;;) {
        const eind = achteraan ? rij.at(-1) : rij[0]
        const j = (buren.get(sleutel(eind)) ?? []).find(k => !op[k])
        if (j === undefined) break
        op[j] = true
        const s = streepjes[j]
        const volgende = sleutel(s[0]) === sleutel(eind) ? s[1] : s[0]
        if (achteraan) rij.push(volgende)
        else rij.unshift(volgende)
      }
    }
    lijnen.push(rij)
  }
  return lijnen
}

/**
 * De hoeken van het rooster eraf halen.
 *
 * Marching squares zet de lijn precies op de celranden, en op een rooster van
 * een halve millimeter zie je die trapjes op de pers terug. Eén keer middelen
 * met de buren haalt ze eruit zonder de vorm te verschuiven.
 */
export function verzacht (punten, rondes = 2) {
  let rij = punten
  for (let r = 0; r < rondes; r++) {
    if (rij.length < 3) return rij
    const uit = [rij[0]]
    for (let i = 1; i < rij.length - 1; i++) {
      uit.push({
        x: (rij[i - 1].x + 2 * rij[i].x + rij[i + 1].x) / 4,
        y: (rij[i - 1].y + 2 * rij[i].y + rij[i + 1].y) / 4
      })
    }
    uit.push(rij.at(-1))
    rij = uit
  }
  return rij
}
