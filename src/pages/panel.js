/**
 * Het bedieningspaneel, opgebouwd uit het instellingenschema.
 *
 * Er zijn ruim honderdveertig knoppen, en die allemaal tegelijk tonen maakt het
 * onwerkbaar. Daarom drie lagen:
 *
 *   1. Kleurensets bovenaan - een klik en het geheel klopt
 *   2. "Snel" toont alleen de knoppen waar je normaal aan draait
 *   3. "Alles" opent de volledige lijst voor wie wil fijnregelen
 *
 * Verder tonen we alleen de groepen die bij de pagina horen waar je naar kijkt:
 * hoogtelijnkleuren zijn zinloos op de statistiekpagina.
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

/**
 * De knoppen waar je in de praktijk aan draait. De rest staat onder "Alles".
 */
const SNEL = new Set([
  'lagen.stijl',
  'lagen.mapboxLabelMm',
  'lagen.verbleking',
  'lagen.ontzadiging',
  'uitsnede.zoom',
  'uitsnede.margeMm',
  'relief.zonRichting',
  'relief.overdrijving',
  'relief.contrast',
  'route.kleur',
  'route.dikteMm',
  'route.dekking',
  'route.buitenKleur',
  'route.buitenExtraMm',
  'route.buitenDekking',
  'route.buitenAlsRand',
  'route.streepjes',
  'route.fwegStippels',
  'overzicht.dagkleuren',
  'overzicht.dikteMm',
  'overzicht.buitenMm',
  'overzicht.langsElkaar',
  'overzicht.tussenruimteMm',
  'pijltjes.aan',
  'pijltjes.vorm',
  'pijltjes.afstandCm',
  'pijltjes.grootteMm',
  'pijltjes.kleur',
  'pijltjes.randKleur',
  'pijltjes.randMm',
  'pijltjes.lijnDikte',
  'markers.stopGrootteMm',
  'markers.slaapGrootteMm',
  'labels.aan',
  'labels.grootteMm',
  'labels.kleur',
  'labels.haloMm',
  'typografie.titelMm',
  'typografie.tekstMm',
  'titelblok.aan',
  'inzet.aan',
  'inzet.breedteMm',
  'schaal.balkAan',
  'schaal.noordpijlAan',
  'schaal.kompasVorm',
  'schaal.kompasMm',
  'schaal.kompasHoek',
  'profiel.hoogteMm',
  'profiel.verloopAan',
  'profiel.dagLijnenAan',
  'profiel.dagLijnKleur',
  'profiel.rasterAan',
  'profiel.rasterFijnheid',
  'profiel.verloopDekking',
  'profiel.vulKleur',
  'profiel.lijnKleur',
  'voortgang.hoogteMm',
  'voortgang.dikteMm',
  'voortgang.kernDekking',
  'voortgang.buitenExtraMm',
  'voortgang.gehadFactor',
  'voortgang.stipMm',
  'voortgang.naamMm',
  'statistieken.getalMm',
  'statistieken.kolommen',
  'pagina.breedteMm',
  'pagina.hoogteMm',
  'pagina.dpi'
])

/** Welke groepen bij welk paginatype horen. */
const GROEPEN_PER_PAGINA = {
  kaart: ['pagina', 'uitsnede', 'kaartvorm', 'lagen', 'relief', 'terrein', 'route',
    'pijltjes', 'eerdere', 'markers', 'labels', 'typografie', 'titelblok', 'inzet',
    'schaal', 'bron'],
  stats: ['pagina', 'typografie', 'titelblok', 'profiel', 'statistieken', 'bron'],
  overzicht: ['pagina', 'uitsnede', 'kaartvorm', 'lagen', 'relief', 'terrein', 'route',
    'eerdere', 'markers', 'typografie', 'titelblok', 'schaal', 'bron'],
  reiscijfers: ['pagina', 'typografie', 'titelblok', 'profiel', 'statistieken', 'bron'],
  voortgang: ['pagina', 'route', 'voortgang', 'typografie', 'statistieken']
}

/** Een handvol kleuren die vaak van pas komen, per soort knop. */
const STALEN = {
  standaard: ['#ffffff', '#f7f4ee', '#e8e4dd', '#b9b2a8', '#8a8279', '#55504a', '#2e2a26', '#000000'],
  route: ['#8c2f39', '#9e2f24', '#f7b267', '#7d3a12', '#24405c', '#1c4966', '#4a2c45', '#2e2a26'],
  terrein: ['#a8b894', '#c5c193', '#cbb287', '#c2a184', '#fbfbfa', '#eef2f4', '#d9d3c8', '#8a9b7a']
}

function stalenVoor (key) {
  if (key.startsWith('terrein.') || key.includes('zeeKleur') || key.includes('landKleur')) return STALEN.terrein
  if (key.startsWith('route.') || key.startsWith('markers.') || key.startsWith('pijltjes.')) return STALEN.route
  return STALEN.standaard
}

function toon (knop, waarde) {
  if (knop.type === 'mm') return `${waarde} mm`
  if (knop.type === 'cm') return `${waarde} cm`
  if (knop.type === 'graden') return `${waarde}°`
  if (knop.eenheid) return `${waarde} ${knop.eenheid}`
  return String(waarde)
}

/**
 * @param {HTMLElement} houder
 * @param {{groepen: Array, knoppen: Array}} schema
 * @param {object} stijl huidige waarden
 * @param {(key: string, waarde: any) => void} bijWijziging
 * @param {object} extra { presets, bijPreset, paginaType }
 */
export function bouwPaneel (houder, schema, stijl, bijWijziging, extra = {}) {
  houder.replaceChildren()

  const besturingen = new Map()
  let allesTonen = false
  let paginaType = extra.paginaType ?? 'kaart'

  // ------------------------------------------------------------ kleurensets
  if (extra.presets?.length) {
    const doos = el('div', 'presets')
    doos.append(el('div', 'presets-kop', 'Kleurenset'))

    const rij = el('div', 'presets-rij')
    for (const p of extra.presets) {
      const knop = el('button', 'preset')
      knop.title = `${p.naam} — ${p.beschrijving}`

      const staal = el('span', 'preset-staal')
      for (const kleur of p.voorbeeld ?? []) {
        const streep = el('span')
        streep.style.background = kleur
        staal.append(streep)
      }

      knop.append(staal, el('span', 'preset-naam', p.naam))
      knop.addEventListener('click', () => extra.bijPreset?.(p))
      rij.append(knop)
    }

    doos.append(rij)
    houder.append(doos)
  }

  // --------------------------------------------------------- snel of alles
  const schakelaar = el('div', 'weergave')
  const snelKnop = el('button', 'actief', 'Snel')
  const allesKnop = el('button', null, 'Alles')
  schakelaar.append(snelKnop, allesKnop)
  houder.append(schakelaar)

  const groepenHouder = el('div', 'groepen-lijst')
  houder.append(groepenHouder)

  // --------------------------------------------------------------- groepen
  for (const groep of schema.groepen) {
    const knoppen = schema.knoppen.filter(k => k.groep === groep.id)
    if (!knoppen.length) continue

    const details = el('details', 'groep')
    details.dataset.groep = groep.id
    details.open = ['route', 'lagen'].includes(groep.id)

    const kop = el('summary')
    kop.append(el('span', null, groep.label))
    details.append(kop)

    for (const knop of knoppen) {
      const { node, zet, isStandaard } = maakBesturing(knop, stijl[knop.key], bijWijziging)
      node.dataset.snel = SNEL.has(knop.key) ? '1' : '0'
      besturingen.set(knop.key, { node, zet, knop, isStandaard })
      details.append(node)
    }

    groepenHouder.append(details)
  }

  function ververs () {
    for (const [, { node, knop }] of besturingen) {
      const inWeergave = allesTonen || SNEL.has(knop.key)
      const inPagina = GROEPEN_PER_PAGINA[paginaType]?.includes(knop.groep) ?? true
      node.classList.toggle('verborgen', !(inWeergave && inPagina))
    }
    for (const details of groepenHouder.querySelectorAll('details.groep')) {
      const zichtbaar = details.querySelectorAll('.knop:not(.verborgen)').length
      details.style.display = zichtbaar ? '' : 'none'
    }
  }

  snelKnop.addEventListener('click', () => {
    allesTonen = false
    snelKnop.classList.add('actief'); allesKnop.classList.remove('actief')
    ververs()
  })
  allesKnop.addEventListener('click', () => {
    allesTonen = true
    allesKnop.classList.add('actief'); snelKnop.classList.remove('actief')
    ververs()
  })

  ververs()

  return {
    zet (key, waarde) { besturingen.get(key)?.zet(waarde) },

    zetPagina (type) { paginaType = type; ververs() },

    filter (term) {
      const t = term.trim().toLowerCase()
      if (!t) { ververs(); return }

      for (const [key, { node, knop }] of besturingen) {
        const past = knop.label.toLowerCase().includes(t) ||
          key.toLowerCase().includes(t) ||
          (knop.help ?? '').toLowerCase().includes(t)
        node.classList.toggle('verborgen', !past)
      }
      for (const details of groepenHouder.querySelectorAll('details.groep')) {
        const zichtbaar = details.querySelectorAll('.knop:not(.verborgen)').length
        details.style.display = zichtbaar ? '' : 'none'
        if (zichtbaar) details.open = true
      }
    }
  }
}

function maakBesturing (knop, waarde, bijWijziging) {
  const node = el('div', 'knop')
  const isStandaard = () => node.dataset.gewijzigd !== '1'

  const kop = el('div', 'knop-kop')
  const label = el('label', null, knop.label)
  const rechts = el('span', 'knop-rechts')
  const waardeTekst = el('span', 'waarde')

  // een klein terugzetknopje, alleen zichtbaar als je iets veranderd hebt
  const terug = el('button', 'terugzet')
  terug.type = 'button'
  terug.title = 'terug naar de standaardwaarde'
  terug.textContent = '↺'
  terug.addEventListener('click', () => {
    zet(knop.standaard)
    bijWijziging(knop.key, knop.standaard)
    node.dataset.gewijzigd = '0'
  })

  rechts.append(waardeTekst, terug)
  kop.append(label, rechts)
  node.append(kop)

  const meld = v => {
    node.dataset.gewijzigd = v === knop.standaard ? '0' : '1'
    bijWijziging(knop.key, v)
  }

  let zet = () => {}

  // ------------------------------------------------------------ aan / uit
  if (knop.type === 'aanuit') {
    const rij = el('div', 'aanuit')
    const vinkje = el('input')
    vinkje.type = 'checkbox'
    vinkje.checked = !!waarde
    vinkje.addEventListener('change', () => meld(vinkje.checked))

    rij.append(vinkje, el('label', null, knop.label), terug)
    node.replaceChildren(rij)
    zet = v => { vinkje.checked = !!v }

  // --------------------------------------------------------------- keuze
  } else if (knop.type === 'keuze') {
    waardeTekst.remove()
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
      meld(Number.isFinite(getal) && ruw.trim() !== '' ? getal : ruw)
    })
    rij.append(kiezer)
    node.append(rij)
    zet = v => { kiezer.value = String(v) }

  // --------------------------------------------------------------- kleur
  } else if (knop.type === 'kleur') {
    waardeTekst.remove()

    const rij = el('div', 'kleur-regel')

    // de systeemkiezer: veruit de prettigste manier om een kleur te kiezen
    const kiezer = el('input')
    kiezer.type = 'color'
    kiezer.value = waarde

    const hexVeld = el('input', 'hex')
    hexVeld.type = 'text'
    hexVeld.value = waarde
    hexVeld.spellcheck = false

    const fijn = el('button', 'fijnknop')
    fijn.type = 'button'
    fijn.title = 'rood, groen en blauw apart instellen'
    fijn.textContent = 'RGB'

    rij.append(kiezer, hexVeld, fijn)
    node.append(rij)

    // de stalen: een rij veelgebruikte kleuren, scheelt zoeken
    const stalen = el('div', 'stalen')
    for (const kleur of stalenVoor(knop.key)) {
      const s = el('button', 'staal')
      s.type = 'button'
      s.style.background = kleur
      s.title = kleur
      s.addEventListener('click', () => { zet(kleur); meld(kleur) })
      stalen.append(s)
    }
    node.append(stalen)

    // de rgb-schuiven blijven bestaan, maar ingeklapt
    const rgb = el('div', 'rgb verborgen')
    const schuiven = []
    const [r0, g0, b0] = hexNaarRgb(waarde)
    for (const [naam, letter, start] of [['r', 'R', r0], ['g', 'G', g0], ['b', 'B', b0]]) {
      const r = el('div', `rgb-rij ${naam}`)
      r.append(el('span', null, letter))
      const s = el('input')
      s.type = 'range'; s.min = 0; s.max = 255; s.step = 1; s.value = start
      r.append(s)
      rgb.append(r)
      schuiven.push(s)
    }
    node.append(rgb)

    fijn.addEventListener('click', () => {
      rgb.classList.toggle('verborgen')
      fijn.classList.toggle('actief', !rgb.classList.contains('verborgen'))
    })

    const vanSchuiven = () => {
      const hex = rgbNaarHex(+schuiven[0].value, +schuiven[1].value, +schuiven[2].value)
      kiezer.value = hex
      hexVeld.value = hex
      meld(hex)
    }
    schuiven.forEach(s => s.addEventListener('input', vanSchuiven))

    kiezer.addEventListener('input', () => {
      hexVeld.value = kiezer.value
      const [r, g, b] = hexNaarRgb(kiezer.value)
      schuiven[0].value = r; schuiven[1].value = g; schuiven[2].value = b
      meld(kiezer.value)
    })

    hexVeld.addEventListener('input', () => {
      const v = hexVeld.value.trim()
      if (!/^#[0-9a-f]{6}$/i.test(v)) return
      kiezer.value = v
      const [r, g, b] = hexNaarRgb(v)
      schuiven[0].value = r; schuiven[1].value = g; schuiven[2].value = b
      meld(v.toLowerCase())
    })

    zet = v => {
      kiezer.value = v
      hexVeld.value = v
      const [r, g, b] = hexNaarRgb(v)
      schuiven[0].value = r; schuiven[1].value = g; schuiven[2].value = b
    }

  // -------------------------------------------------- getal met schuifje
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
      waardeTekst.textContent = toon(knop, Number(schuif.value))
      meld(Number(schuif.value))
    })
    veld.addEventListener('input', () => {
      const v = Number(veld.value)
      if (!Number.isFinite(v)) return
      schuif.value = v
      waardeTekst.textContent = toon(knop, v)
      meld(v)
    })

    rij.append(schuif, veld)
    node.append(rij)
    waardeTekst.textContent = toon(knop, waarde)

    zet = v => {
      schuif.value = v; veld.value = v
      waardeTekst.textContent = toon(knop, v)
    }
  }

  if (knop.help) node.append(el('div', 'hulp', knop.help))
  node.dataset.gewijzigd = waarde === knop.standaard ? '0' : '1'

  return { node, zet, isStandaard }
}
