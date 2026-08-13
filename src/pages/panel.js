/**
 * Bouwt het bedieningspaneel uit het instellingenschema.
 *
 * Elke knop uit het schema wordt hier een besturing van het juiste soort. Een
 * knop toevoegen is dus alleen een regel in het schema; hier hoeft niets bij.
 */

const el = (tag, klasse, tekst) => {
  const n = document.createElement(tag)
  if (klasse) n.className = klasse
  if (tekst !== undefined) n.textContent = tekst
  return n
}

function hexNaarRgb (hex) {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  ]
}

const rgbNaarHex = (r, g, b) =>
  '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')

/** Netjes leesbare weergave van een waarde, met eenheid. */
function toon (knop, waarde) {
  if (knop.type === 'mm') return `${waarde} mm`
  if (knop.type === 'cm') return `${waarde} cm`
  if (knop.type === 'graden') return `${waarde}°`
  if (knop.eenheid) return `${waarde} ${knop.eenheid}`
  return String(waarde)
}

/**
 * @param {HTMLElement} houder waar het paneel in komt
 * @param {{groepen: Array, knoppen: Array}} schema
 * @param {object} stijl huidige waarden
 * @param {(key: string, waarde: any) => void} bijWijziging
 */
export function bouwPaneel (houder, schema, stijl, bijWijziging) {
  houder.replaceChildren()

  const besturingen = new Map()

  for (const groep of schema.groepen) {
    const knoppen = schema.knoppen.filter(k => k.groep === groep.id)
    if (!knoppen.length) continue

    const details = el('details', 'groep')
    details.open = ['route', 'pijltjes', 'relief'].includes(groep.id)

    const kop = el('summary')
    kop.append(el('span', null, groep.label))
    details.append(kop)

    for (const knop of knoppen) {
      const { node, zet } = maakBesturing(knop, stijl[knop.key], bijWijziging)
      besturingen.set(knop.key, { node, zet, knop })
      details.append(node)
    }

    houder.append(details)
  }

  return {
    /** Zet een waarde in het paneel zonder een wijziging uit te lokken. */
    zet (key, waarde) { besturingen.get(key)?.zet(waarde) },

    /** Toont alleen de knoppen die bij de zoekterm passen. */
    filter (term) {
      const t = term.trim().toLowerCase()
      for (const [key, { node, knop }] of besturingen) {
        const past = !t ||
          knop.label.toLowerCase().includes(t) ||
          key.toLowerCase().includes(t) ||
          (knop.help ?? '').toLowerCase().includes(t)
        node.classList.toggle('verborgen', !past)
      }
      // groepen zonder zichtbare knoppen inklappen weghalen
      for (const details of houder.querySelectorAll('details.groep')) {
        const zichtbaar = details.querySelectorAll('.knop:not(.verborgen)').length
        details.style.display = zichtbaar ? '' : 'none'
        if (t && zichtbaar) details.open = true
      }
    }
  }
}

function maakBesturing (knop, waarde, bijWijziging) {
  const node = el('div', 'knop')

  const kop = el('div', 'knop-kop')
  const label = el('label', null, knop.label)
  const waardeTekst = el('span', 'waarde')
  kop.append(label, waardeTekst)
  node.append(kop)

  let zet = () => {}

  const meld = v => {
    waardeTekst.textContent = toon(knop, v)
    bijWijziging(knop.key, v)
  }

  // ------------------------------------------------------------ aan / uit
  if (knop.type === 'aanuit') {
    // een vinkje heeft geen aparte koptekst nodig; het label staat ernaast
    const rij = el('div', 'aanuit')
    const vinkje = el('input')
    vinkje.type = 'checkbox'
    vinkje.checked = !!waarde
    vinkje.addEventListener('change', () => bijWijziging(knop.key, vinkje.checked))

    rij.append(vinkje, el('label', null, knop.label))
    node.replaceChildren(rij)

    zet = v => { vinkje.checked = !!v }

  // --------------------------------------------------------------- keuze
  } else if (knop.type === 'keuze') {
    const rij = el('div', 'knop-regel')
    const kiezer = el('select')
    for (const optie of knop.opties) {
      const o = el('option', null, String(optie))
      o.value = String(optie)
      kiezer.append(o)
    }
    kiezer.value = String(waarde)
    kiezer.addEventListener('change', () => {
      const ruw = kiezer.value
      const getal = Number(ruw)
      bijWijziging(knop.key, Number.isFinite(getal) && ruw.trim() !== '' ? getal : ruw)
    })
    rij.append(kiezer)
    node.append(rij)
    waardeTekst.remove()
    zet = v => { kiezer.value = String(v) }

  // --------------------------------------------------------------- kleur
  } else if (knop.type === 'kleur') {
    waardeTekst.remove()
    const doos = el('div', 'rgb')
    const [r0, g0, b0] = hexNaarRgb(waarde)
    const schuiven = []

    for (const [naam, letter, start] of [['r', 'R', r0], ['g', 'G', g0], ['b', 'B', b0]]) {
      const rij = el('div', `rgb-rij ${naam}`)
      rij.append(el('span', null, letter))
      const s = el('input')
      s.type = 'range'; s.min = 0; s.max = 255; s.step = 1; s.value = start
      rij.append(s)
      doos.append(rij)
      schuiven.push(s)
    }

    const onder = el('div', 'rgb-onder')
    const staal = el('div', 'staal')
    staal.style.background = waarde
    const hexVeld = el('input')
    hexVeld.type = 'text'
    hexVeld.value = waarde
    onder.append(staal, hexVeld)
    doos.append(onder)
    node.append(doos)

    const vanSchuiven = () => {
      const hex = rgbNaarHex(+schuiven[0].value, +schuiven[1].value, +schuiven[2].value)
      staal.style.background = hex
      hexVeld.value = hex
      bijWijziging(knop.key, hex)
    }
    schuiven.forEach(s => s.addEventListener('input', vanSchuiven))

    hexVeld.addEventListener('input', () => {
      const v = hexVeld.value.trim()
      if (!/^#[0-9a-f]{6}$/i.test(v)) return
      const [r, g, b] = hexNaarRgb(v)
      schuiven[0].value = r; schuiven[1].value = g; schuiven[2].value = b
      staal.style.background = v
      bijWijziging(knop.key, v.toLowerCase())
    })

    zet = v => {
      const [r, g, b] = hexNaarRgb(v)
      schuiven[0].value = r; schuiven[1].value = g; schuiven[2].value = b
      staal.style.background = v
      hexVeld.value = v
    }

  // ---------------------------------------------------- getal met schuifje
  } else {
    const rij = el('div', 'knop-regel')
    const schuif = el('input')
    schuif.type = 'range'
    schuif.min = knop.min; schuif.max = knop.max; schuif.step = knop.step ?? 0.01
    schuif.value = waarde

    const veld = el('input')
    veld.type = 'number'
    veld.min = knop.min; veld.max = knop.max; veld.step = knop.step ?? 0.01
    veld.value = waarde

    schuif.addEventListener('input', () => {
      veld.value = schuif.value
      meld(Number(schuif.value))
    })
    veld.addEventListener('input', () => {
      const v = Number(veld.value)
      if (!Number.isFinite(v)) return
      schuif.value = v
      meld(v)
    })

    rij.append(schuif, veld)
    node.append(rij)
    waardeTekst.textContent = toon(knop, waarde)

    zet = v => { schuif.value = v; veld.value = v; waardeTekst.textContent = toon(knop, v) }
  }

  if (knop.help) node.append(el('div', 'hulp', knop.help))

  return { node, zet }
}
