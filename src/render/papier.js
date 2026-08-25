/**
 * Het papier: een warm gebroken-wit vel met vezels, korrel en gebruikssporen.
 *
 * De hele veldnotitie-stijl leunt hierop. Een stempel op een effen wit vlak
 * blijft een plaatje; dezelfde stempel op een vel met vezels wordt een afdruk.
 * Dus is dit geen versiering achteraf maar de ondergrond waar de rest op ligt.
 *
 * Waarom knopen als gewone objecten en geen SVG-elementen: zelfde reden als bij
 * profielvorm.js - dan is het zonder browser te testen, en de pagina's zetten het
 * met bouwSvg() om in echte elementen.
 *
 * Waarom vezels als losse lijntjes en niet als filter: een feTurbulence-vlak is
 * één plaatje dat de PDF moet rasteren, en op 300 bij 300 millimeter wordt dat
 * een plaat van honderden megabytes of een wazige vlek. Achthonderd haarlijntjes
 * blijven vectoren, blijven scherp op elke resolutie, en kosten in de PDF minder
 * dan één ingesloten foto. De korrel via feTurbulence kan alsnog aan, maar staat
 * daarom standaard uit.
 *
 * Alles is gezaaid op het dagnummer. Twee keer dezelfde dag geeft dus exact
 * hetzelfde vel - anders danst het papier onder je handen weg zodra je aan een
 * andere knop draait, en zou elke export er anders uitzien dan de preview.
 */

/** Afronden op duizendsten van een millimeter; fijner ziet geen enkele pers. */
const rond = n => Math.round(n * 1000) / 1000

/**
 * Een gezaaide toevalsgenerator (mulberry32).
 *
 * Math.random() kan hier niet: dan is het papier bij elke hertekening anders en
 * wijkt de export af van wat je op het scherm goedkeurde. Deze is kort, snel, en
 * geeft bij hetzelfde zaad altijd dezelfde reeks.
 */
export function zaadje (zaad) {
  let a = (zaad * 0x9e3779b1) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Een hexkleur een tik lichter of donkerder, zonder een kleurbibliotheek. */
function schuif (hex, hoeveel) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  const uit = rgb.map(v => Math.max(0, Math.min(255, Math.round(v + hoeveel))))
  return `#${uit.map(v => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * De vezels: korte haarlijntjes kriskras door het vel.
 *
 * Twee tinten door elkaar - een die donkerder is dan het papier en een die
 * lichter is. Met alleen donkere vezels wordt het vel vuil in plaats van
 * geschept, want echt papier heeft ook vezels die het licht juist vangen.
 */
function vezels (rnd, { breedteMm, hoeveel, kleur2, langsteMm }) {
  const uit = []
  const licht = schuif(kleur2, 46)

  for (let i = 0; i < hoeveel; i++) {
    const x = rnd() * breedteMm.x
    const y = rnd() * breedteMm.y
    const hoek = rnd() * Math.PI
    const lengte = 0.5 + rnd() * langsteMm
    const bleek = rnd() < 0.42

    uit.push({
      tag: 'line',
      attr: {
        x1: rond(x),
        y1: rond(y),
        x2: rond(x + Math.cos(hoek) * lengte),
        y2: rond(y + Math.sin(hoek) * lengte),
        stroke: bleek ? licht : kleur2,
        'stroke-width': rond(0.05 + rnd() * 0.11),
        'stroke-linecap': 'round',
        'stroke-opacity': rond(0.03 + rnd() * (bleek ? 0.09 : 0.075))
      }
    })
  }
  return uit
}

/**
 * De gebruikssporen: een enkele vouw en een paar vage vlekken.
 *
 * Weinig en zwak. Dit is het verschil tussen een vel dat in een tas heeft
 * gezeten en een vel waar iemand een koffievlek op heeft geschilderd; het tweede
 * valt op en dat is precies niet de bedoeling.
 */
function sporen (rnd, { breedteMm, hoeveel, kleur2, id }) {
  const knopen = []
  const defs = []

  // een vouw: één lange, bijna rechte lijn met een zachte knik erin
  if (hoeveel > 0) {
    const verticaal = rnd() < 0.5
    const plek = 0.25 + rnd() * 0.5
    const punten = verticaal
      ? [[breedteMm.x * plek, 0], [breedteMm.x * (plek + (rnd() - 0.5) * 0.03), breedteMm.y]]
      : [[0, breedteMm.y * plek], [breedteMm.x, breedteMm.y * (plek + (rnd() - 0.5) * 0.03)]]

    knopen.push({
      tag: 'line',
      attr: {
        x1: rond(punten[0][0]), y1: rond(punten[0][1]),
        x2: rond(punten[1][0]), y2: rond(punten[1][1]),
        stroke: kleur2,
        'stroke-width': 0.28,
        'stroke-opacity': 0.055
      }
    })
  }

  // de vlekken, elk met zijn eigen verloop zodat de rand vervloeit
  for (let i = 0; i < hoeveel; i++) {
    const naam = `${id}-vlek-${i}`
    defs.push({
      tag: 'radialGradient',
      attr: { id: naam },
      kind: [
        { tag: 'stop', attr: { offset: '0', 'stop-color': kleur2, 'stop-opacity': 0.5 } },
        { tag: 'stop', attr: { offset: '1', 'stop-color': kleur2, 'stop-opacity': 0 } }
      ]
    })

    knopen.push({
      tag: 'ellipse',
      attr: {
        cx: rond(rnd() * breedteMm.x),
        cy: rond(rnd() * breedteMm.y),
        rx: rond(breedteMm.x * (0.04 + rnd() * 0.12)),
        ry: rond(breedteMm.y * (0.04 + rnd() * 0.12)),
        fill: `url(#${naam})`,
        opacity: rond(0.1 + rnd() * 0.16)
      }
    })
  }

  return { knopen, defs }
}

/**
 * Het vel papier, als een rij SVG-knopen om achter alles te zetten.
 *
 * @param {object} opties
 * @param {number} opties.breedteMm   buitenmaat, dus inclusief de afloop
 * @param {number} opties.hoogteMm
 * @param {object} opties.stijl       de instellingen
 * @param {number} [opties.zaad]      dagnummer; hetzelfde zaad geeft hetzelfde vel
 * @param {string} [opties.id]        voorvoegsel voor de defs, uniek per pagina
 * @param {boolean} [opties.grondvlak] false laat het effen vlak weg, voor de
 *                                     laag over de kaart: daar moet de kaart
 *                                     doorheen blijven komen
 */
export function papierKnopen ({
  breedteMm, hoogteMm, stijl, zaad = 1, id = 'papier', grondvlak = true
}) {
  const rnd = zaadje(zaad)
  const maat = { x: breedteMm, y: hoogteMm }
  const kleur = stijl['papier.kleur']
  const kleur2 = stijl['papier.vezelKleur']

  const knopen = []
  const defs = []

  if (grondvlak) {
    knopen.push({
      tag: 'rect',
      attr: { x: 0, y: 0, width: rond(breedteMm), height: rond(hoogteMm), fill: kleur }
    })
  }

  // --- de vezels
  const hoeveel = Math.round(stijl['papier.vezels'] * 1600)
  if (hoeveel > 0) {
    knopen.push({
      tag: 'g',
      attr: { 'data-papier': 'vezels' },
      kind: vezels(rnd, {
        breedteMm: maat, hoeveel, kleur2, langsteMm: stijl['papier.vezelMm']
      })
    })
  }

  // --- de gebruikssporen
  const vlekken = Math.round(stijl['papier.vlekken'] * 6)
  if (vlekken > 0) {
    const spoor = sporen(rnd, { breedteMm: maat, hoeveel: vlekken, kleur2, id })
    defs.push(...spoor.defs)
    knopen.push({ tag: 'g', attr: { 'data-papier': 'sporen' }, kind: spoor.knopen })
  }

  // --- vuile randen
  //
  // Papier vergeelt van buiten naar binnen, want daar komt de lucht bij. Zonder
  // dit leest het vel als een egale kleur en dus als een digitale vulling.
  if (stijl['papier.randSlijtage'] > 0) {
    const naam = `${id}-rand`
    defs.push({
      tag: 'radialGradient',
      attr: { id: naam, cx: '0.5', cy: '0.5', r: '0.72' },
      kind: [
        { tag: 'stop', attr: { offset: '0.45', 'stop-color': kleur2, 'stop-opacity': 0 } },
        { tag: 'stop', attr: { offset: '1', 'stop-color': kleur2, 'stop-opacity': 1 } }
      ]
    })
    knopen.push({
      tag: 'rect',
      attr: {
        x: 0, y: 0, width: rond(breedteMm), height: rond(hoogteMm),
        fill: `url(#${naam})`,
        opacity: rond(stijl['papier.randSlijtage'])
      }
    })
  }

  // --- de korrel
  //
  // Standaard uit: dit is het enige stuk dat in de PDF een raster wordt, en over
  // een hele pagina is dat een zware plaat. Aan zetten mag, maar dan weet je
  // waarom je export ineens groeit.
  if (stijl['papier.korrelAan']) {
    const naam = `${id}-korrel`
    defs.push({
      tag: 'filter',
      attr: { id: naam, x: '0', y: '0', width: '100%', height: '100%' },
      kind: [
        {
          tag: 'feTurbulence',
          attr: {
            type: 'fractalNoise',
            baseFrequency: rond(stijl['papier.korrelFijnheid']),
            numOctaves: 3,
            seed: zaad,
            result: 'ruis'
          }
        },
        {
          tag: 'feColorMatrix',
          attr: { type: 'saturate', values: '0' }
        }
      ]
    })
    knopen.push({
      tag: 'rect',
      attr: {
        x: 0, y: 0, width: rond(breedteMm), height: rond(hoogteMm),
        filter: `url(#${naam})`,
        opacity: rond(stijl['papier.korrelDekking']),
        style: 'mix-blend-mode: multiply'
      }
    })
  }

  return defs.length ? [{ tag: 'defs', kind: defs }, ...knopen] : knopen
}
