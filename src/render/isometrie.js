/**
 * Isometrisch kijken: een draadmodel in de ruimte wordt een tekening op de
 * bladzijde.
 *
 * Waarom isometrisch en niet in perspectief: een perspectief heeft een
 * kijkafstand nodig, en die keuze zie je terug in het beeld - een vliegtuig
 * vlak bij de lens is een ander plaatje dan hetzelfde vliegtuig ver weg. Bij
 * een isometrische projectie krimpt alles overal even hard, dus alle acht de
 * dagen zijn onderling vergelijkbaar zonder dat er ergens een lens tussen zit.
 *
 * Waarom geen verborgen lijnen weggehaald: dat vraagt om vlakken in plaats van
 * ribben, een dieptesortering en het knippen van veelhoeken tegen elkaar.
 * Honderden regels, en een hele nieuwe soort fouten. Bovendien is de doorkijk
 * juist wat er een tekening van maakt in plaats van een plaatje. Dat de
 * achterkant niet met de voorkant vervloeit regelt de dieptevervaging: wat
 * verder weg ligt wordt bleker, dus de dichtstbijzijnde omtrek wint vanzelf.
 *
 * Waarom knopen als gewone objecten en geen SVG-elementen: net als
 * profielvorm.js kan dit bestand dan zonder browser getest worden. De pagina
 * zet het met bouwSvg() om in echte elementen.
 */

/** Afronden op duizendsten van een millimeter; fijner ziet geen enkele pers. */
const rond = n => Math.round(n * 1000) / 1000

/** De kanteling waarbij alle drie de assen even hard krimpen: echt isometrisch. */
export const ISO_KANTEL_GRADEN = Math.atan(Math.SQRT1_2) * 180 / Math.PI

/** Zoveel tinten kent de dieptevervaging. Herhaalde waarden comprimeren beter. */
const DIEPTESTAPPEN = 5

/**
 * De projectie: van een punt in de ruimte naar een punt op het platte vlak.
 *
 * Parametrisch en niet de vaste isometrische formule, want met dezelfde twee
 * hoeken kun je ook dimetrisch kijken of bijna van bovenaf - en de
 * standaardstand is nog steeds precies isometrisch.
 *
 * De y op het scherm loopt naar beneden en de z in de wereld naar boven,
 * vandaar het minteken: hoger in de wereld hoort hoger op de bladzijde te
 * staan.
 */
export function isoProjectie ({ draaiGraden = 45, kantelGraden = ISO_KANTEL_GRADEN } = {}) {
  const d = (draaiGraden * Math.PI) / 180
  const k = (kantelGraden * Math.PI) / 180
  const cd = Math.cos(d)
  const sd = Math.sin(d)
  const ck = Math.cos(k)
  const sk = Math.sin(k)

  return {
    /** Een punt in de ruimte naar het vlak, plus hoe ver het bij de kijker vandaan ligt. */
    punt (p) {
      const x = p.x * cd - p.y * sd
      const y = p.x * sd + p.y * cd
      return { x, y: y * sk - p.z * ck, diepte: y * ck + p.z * sk }
    }
  }
}

/**
 * De schaal en verschuiving waarmee een geprojecteerd model precies in zijn vak
 * past.
 *
 * Geeft de plaatsing terug en niet de punten zelf, zodat wie er later nog iets
 * naast wil zetten met exact dezelfde schaal en verschuiving kan rekenen.
 *
 * De schaal is altijd gelijk in beide richtingen. Een model uitrekken naar het
 * vak zou van elke dag een andere vervorming maken, en dan is de reeks weg.
 *
 * @returns {{schaal:number, dx:number, dy:number}} vlakMm = punt * schaal + d
 */
export function pasInVak (geprojecteerd, vak, vulling = 1) {
  const midden = { schaal: 1, dx: vak.breedteMm / 2, dy: vak.hoogteMm / 2 }
  if (!geprojecteerd.length) return midden

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const p of geprojecteerd) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return midden

  const breedte = maxX - minX
  const hoogte = maxY - minY

  // een model dat tot een punt of een streep inklapt heeft geen maat om op te
  // schalen; dan maar op ware grootte in het midden
  const passend = Math.min(
    breedte > 1e-9 ? vak.breedteMm / breedte : Infinity,
    hoogte > 1e-9 ? vak.hoogteMm / hoogte : Infinity
  )
  const schaal = Number.isFinite(passend) && passend > 0 ? passend * vulling : 1

  return {
    schaal,
    dx: vak.breedteMm / 2 - ((minX + maxX) / 2) * schaal,
    dy: vak.hoogteMm / 2 - ((minY + maxY) / 2) * schaal
  }
}

/**
 * Het hele draadmodel als knopen.
 *
 * @param {{punten:Array<{x,y,z}>, lijnen:Array<{ketting:number[], nadruk?:number}>}} model
 * @param {object} opties
 * @param {object} [opties.info] wat dit onderwerp aan eigen draaiing en vulling wil
 * @param {object} opties.maat uit paginaMaat()
 * @param {object} opties.stijl
 * @returns {Array<{tag:string, attr?:object, kind?:Array}>}
 */
export function draadmodelKnopen (model, { info = {}, maat, stijl }) {
  const projectie = isoProjectie({
    draaiGraden: stijl['statistieken.draadmodelDraaiGraden'] + (info.draaiGraden ?? 0),
    kantelGraden: stijl['statistieken.draadmodelKantelGraden']
  })

  const vlak = model.punten.map(p => projectie.punt(p))
  const plaatsing = pasInVak(
    vlak,
    { breedteMm: maat.breedteMm, hoogteMm: maat.hoogteMm },
    stijl['statistieken.draadmodelVulling'] * (info.vulling ?? 1)
  )
  plaatsing.dy += stijl['statistieken.draadmodelVerschuifMm']

  const naarVlak = p => ({
    x: p.x * plaatsing.schaal + plaatsing.dx,
    y: p.y * plaatsing.schaal + plaatsing.dy
  })

  let ondiepst = Infinity
  let diepst = -Infinity
  for (const p of vlak) {
    if (!Number.isFinite(p.diepte)) continue
    if (p.diepte < ondiepst) ondiepst = p.diepte
    if (p.diepte > diepst) diepst = p.diepte
  }
  const spanning = diepst - ondiepst

  const dekking = stijl['statistieken.draadmodelDekking']
  const vervaging = stijl['statistieken.draadmodelDiepte']
  const lijnMm = stijl['statistieken.draadmodelLijnMm']

  /** Hoe bleek een lijn wordt op zijn gemiddelde afstand, in vaste stappen. */
  const dekkingOp = diepte => {
    if (!(spanning > 1e-9) || !Number.isFinite(diepte)) return dekking
    const ver = (diepte - ondiepst) / spanning
    const trap = Math.round(ver * DIEPTESTAPPEN) / DIEPTESTAPPEN
    return dekking * (1 - trap * vervaging)
  }

  const polylijn = (punten, diepte, nadruk) => {
    const teksten = punten.map(p => `${rond(p.x)},${rond(p.y)}`)
    return {
      tag: 'polyline',
      attr: {
        points: teksten.join(' '),
        'stroke-opacity': rond(dekkingOp(diepte)),
        'stroke-width': nadruk === 1 ? null : rond(lijnMm * nadruk)
      }
    }
  }

  const kind = []

  for (const lijn of model.lijnen) {
    const punten = lijn.ketting.map(i => vlak[i]).filter(Boolean)
    if (punten.length < 2) continue
    const diepte = punten.reduce((s, p) => s + p.diepte, 0) / punten.length
    kind.push(polylijn(punten.map(naarVlak), diepte, lijn.nadruk ?? 1))
  }

  return [{
    tag: 'g',
    attr: {
      fill: 'none',
      stroke: stijl['statistieken.draadmodelKleur'],
      'stroke-width': rond(lijnMm),
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round'
    },
    kind
  }]
}
