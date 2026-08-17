/**
 * De bouwstenen waar de draadmodellen uit bestaan.
 *
 * Acht onderwerpen met de hand uit losse punten opschrijven levert acht
 * puntenbrijen op die niemand meer kan nalezen of veranderen. Hier staan in
 * plaats daarvan de manieren waarop je iets in de ruimte kunt maken: een
 * omtrek, doorsneden op een rij, een profiel dat je ronddraait, en een raster
 * met hoogtes. Alle acht de onderwerpen worden daaruit samengesteld.
 *
 * Een model is bewust zo kaal mogelijk:
 *
 *   { punten: [{x, y, z}], lijnen: [{ketting: [i, j, ...], nadruk}] }
 *
 * Een ketting is een reeks puntindexen die samen één polylijn wordt. De
 * meridianen van een omwentelingslichaam, de rijen van een hoogteveld en de
 * omtrek van een doorsnede zijn allemaal van nature zulke reeksen. Als
 * polylijn delen ze hun punten, wat de coordinatentekst ongeveer halveert en
 * het aantal SVG-elementen een orde scheelt - en dat telt in de PDF.
 *
 * Geen vlakken en geen normalen: het is een draadmodel, dus ribben zijn genoeg.
 *
 * Afspraak waar elk onderwerp zich aan houdt: opgebouwd in modeleenheden, met
 * de voeten op z = 0, gecentreerd op de oorsprong in x en y, en de langste maat
 * rond de tien eenheden. Na het inpassen op de bladzijde doet de absolute maat
 * er niet meer toe, maar de afspraak houdt de verhoudingscontroles zinnig en
 * zorgt dat de acht onderwerpen onderling vergelijkbaar blijven.
 */

export function leegModel () {
  return { punten: [], lijnen: [] }
}

/** Modellen achter elkaar plakken, met de kettingen mee hernummerd. */
export function voegSamen (...modellen) {
  const uit = leegModel()

  for (const model of modellen) {
    if (!model) continue
    const verschuiving = uit.punten.length
    for (const p of model.punten) uit.punten.push({ ...p })
    for (const lijn of model.lijnen) {
      uit.lijnen.push({
        ketting: lijn.ketting.map(i => i + verschuiving),
        nadruk: lijn.nadruk ?? 1
      })
    }
  }

  return uit
}

/** Elk punt door dezelfde bewerking halen; de kettingen blijven staan. */
function herteken (model, hoe) {
  return {
    punten: model.punten.map(hoe),
    lijnen: model.lijnen.map(l => ({ ketting: [...l.ketting], nadruk: l.nadruk ?? 1 }))
  }
}

export function verplaats (model, { x = 0, y = 0, z = 0 } = {}) {
  return herteken(model, p => ({ x: p.x + x, y: p.y + y, z: p.z + z }))
}

/** Schalen met één getal, of per richting met {x, y, z}. */
export function schaal (model, factor) {
  const f = typeof factor === 'number' ? { x: factor, y: factor, z: factor } : factor
  return herteken(model, p => ({
    x: p.x * (f.x ?? 1),
    y: p.y * (f.y ?? 1),
    z: p.z * (f.z ?? 1)
  }))
}

/** Draaien om een van de drie assen. */
export function draai (model, graden, as = 'z') {
  const a = (graden * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)

  if (as === 'x') return herteken(model, p => ({ x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }))
  if (as === 'y') return herteken(model, p => ({ x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c }))
  return herteken(model, p => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z }))
}

/**
 * Het spiegelbeeld erbij zetten.
 *
 * Vleugels, wielen en de flanken van de kerk staan symmetrisch; die schrijf je
 * één keer op en spiegelt de andere helft erbij.
 */
export function spiegel (model, as = 'y') {
  const om = { x: { x: -1 }, y: { y: -1 }, z: { z: -1 } }[as] ?? { y: -1 }
  return voegSamen(model, schaal(model, om))
}

/**
 * Het model met zijn voeten op de vloer en midden boven de oorsprong.
 *
 * Elk onderwerp wordt opgeschreven op de maten die bij dat onderwerp horen -
 * een vleugel meet je vanaf de romp, een basaltzuil vanaf de kust. Dat elk
 * onderwerp uiteindelijk netjes op z = 0 staat en midden in beeld valt, is een
 * zorg die je één keer regelt in plaats van acht keer met de hand uitrekenen.
 */
export function zetOpDeVloer (model) {
  if (!model.punten.length) return model

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity

  for (const p of model.punten) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
    if (p.z < minZ) minZ = p.z
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minZ)) return model
  return verplaats(model, { x: -(minX + maxX) / 2, y: -(minY + maxY) / 2, z: -minZ })
}

/**
 * Tussenwaarden bijzetten in een reeks getalvelden.
 *
 * Waarvoor: de fijnheidsknop maakt een omwentelingslichaam wel rónder - meer
 * zijden - maar niet fijner in de lengte. Een vuurtoren van acht profielpunten
 * blijft acht ringen hoog, hoe hoog je de knop ook draait. Door hier extra
 * doorsneden tussen te schuiven wordt het een echt fijnmazig gaas in beide
 * richtingen, zonder dat de acht onderwerpen een letter langer worden.
 *
 * Werkt op elk veld dat een getal is; wat geen getal is komt van de linkerbuur.
 */
export function verdeel (reeks, tussen = 0) {
  const n = Math.max(0, Math.round(tussen))
  if (n === 0 || reeks.length < 2) return [...reeks]

  const uit = []
  for (let i = 0; i < reeks.length - 1; i++) {
    const a = reeks[i]
    const b = reeks[i + 1]
    uit.push(a)

    for (let k = 1; k <= n; k++) {
      const deel = k / (n + 1)
      const mengsel = {}
      for (const [naam, waarde] of Object.entries(a)) {
        const ander = b[naam]
        mengsel[naam] = typeof waarde === 'number' && typeof ander === 'number'
          ? waarde + (ander - waarde) * deel
          : waarde
      }
      uit.push(mengsel)
    }
  }

  uit.push(reeks.at(-1))
  return uit
}

/** Een gesloten omtrek van gelijke zijden, plat in x en y. */
export function ring (straal, zijden = 8, hoekOffset = 0) {
  const n = Math.max(3, Math.round(zijden))
  const uit = []
  for (let i = 0; i < n; i++) {
    const a = ((hoekOffset + (360 * i) / n) * Math.PI) / 180
    uit.push({ x: straal * Math.cos(a), y: straal * Math.sin(a) })
  }
  return uit
}

/** Een rechthoekige omtrek met afgeronde hoeken, plat in x en y. */
export function afgerondeRechthoek (breedte, diepte, ronding = 0, zijden = 3) {
  const hb = breedte / 2
  const hd = diepte / 2
  const r = Math.max(0, Math.min(ronding, hb, hd))

  if (r < 1e-9) {
    return [{ x: hb, y: hd }, { x: -hb, y: hd }, { x: -hb, y: -hd }, { x: hb, y: -hd }]
  }

  const hoeken = [
    { cx: hb - r, cy: hd - r, van: 0 },
    { cx: -hb + r, cy: hd - r, van: 90 },
    { cx: -hb + r, cy: -hd + r, van: 180 },
    { cx: hb - r, cy: -hd + r, van: 270 }
  ]

  const stappen = Math.max(1, Math.round(zijden))
  const uit = []
  for (const h of hoeken) {
    for (let i = 0; i <= stappen; i++) {
      const a = ((h.van + (90 * i) / stappen) * Math.PI) / 180
      uit.push({ x: h.cx + r * Math.cos(a), y: h.cy + r * Math.sin(a) })
    }
  }
  return uit
}

/**
 * Doorsneden op een rij, van onder naar boven, met de lengtelijnen ertussen.
 *
 * De lengtelijnen lopen als één ketting door alle doorsneden heen in plaats van
 * per verdieping een los stukje: acht meridianen in plaats van veertig
 * losse ribbetjes.
 *
 * Een doorsnede met schaal 0 krimpt tot een punt. Dat is de top van een spits,
 * en alle meridianen komen daar vanzelf samen.
 *
 * @param {Array<{omtrek:Array<{x,y}>, z:number, verschuif?:{x,y}, schaal?:number}>} secties
 */
export function loft (secties, { sluiten = true, ribben = true, tussen = 0 } = {}) {
  const punten = []
  const lijnen = []
  const blokken = []

  for (const sectie of verdeel(secties, tussen)) {
    const s = sectie.schaal ?? 1
    const dx = sectie.verschuif?.x ?? 0
    const dy = sectie.verschuif?.y ?? 0
    const begin = punten.length

    if (Math.abs(s) < 1e-9 || sectie.omtrek.length < 2) {
      punten.push({ x: dx, y: dy, z: sectie.z })
      blokken.push({ begin, aantal: 1 })
      continue
    }

    for (const p of sectie.omtrek) {
      punten.push({ x: p.x * s + dx, y: p.y * s + dy, z: sectie.z })
    }
    const aantal = sectie.omtrek.length
    blokken.push({ begin, aantal })

    if (sluiten) {
      const ketting = []
      for (let i = 0; i < aantal; i++) ketting.push(begin + i)
      ketting.push(begin)
      lijnen.push({ ketting, nadruk: 1 })
    }
  }

  if (ribben && blokken.length > 1) {
    const meridianen = Math.max(...blokken.map(b => b.aantal))
    for (let i = 0; i < meridianen; i++) {
      lijnen.push({ ketting: blokken.map(b => b.begin + (i % b.aantal)), nadruk: 1 })
    }
  }

  return { punten, lijnen }
}

/** Een omtrek recht omhoog getrokken tussen twee hoogtes. */
export function prisma (omtrek, z0, z1, { tussen = 0 } = {}) {
  return loft([{ omtrek, z: z0 }, { omtrek, z: z1 }], { tussen })
}

/**
 * Een profiel rond de staande as gedraaid.
 *
 * @param {Array<{r:number, z:number}>} profiel van onder naar boven
 */
export function draaiLichaam (profiel, zijden = 8, { ringen = true, tussen = 0 } = {}) {
  const eenheid = ring(1, zijden)
  return loft(
    verdeel(profiel, tussen).map(p => ({ omtrek: eenheid, z: p.z, schaal: p.r })),
    { sluiten: ringen, ribben: true }
  )
}

/**
 * Een raster met een hoogte op elk kruispunt: de terreinvlakken.
 *
 * De hoogtefunctie krijgt twee waarden van nul tot een, zodat dezelfde
 * beschrijving bij elke fijnheid hetzelfde landschap oplevert.
 */
export function hoogteVeld (hoogteVan, {
  nx = 11,
  ny = 11,
  van = { x: -5, y: -5 },
  tot = { x: 5, y: 5 }
} = {}) {
  const kolommen = Math.max(2, Math.round(nx))
  const rijen = Math.max(2, Math.round(ny))
  const punten = []
  const lijnen = []

  for (let j = 0; j < rijen; j++) {
    for (let i = 0; i < kolommen; i++) {
      const u = i / (kolommen - 1)
      const v = j / (rijen - 1)
      punten.push({
        x: van.x + (tot.x - van.x) * u,
        y: van.y + (tot.y - van.y) * v,
        z: hoogteVan(u, v)
      })
    }
  }

  for (let j = 0; j < rijen; j++) {
    const ketting = []
    for (let i = 0; i < kolommen; i++) ketting.push(j * kolommen + i)
    lijnen.push({ ketting, nadruk: 1 })
  }

  for (let i = 0; i < kolommen; i++) {
    const ketting = []
    for (let j = 0; j < rijen; j++) ketting.push(j * kolommen + i)
    lijnen.push({ ketting, nadruk: 1 })
  }

  return { punten, lijnen }
}

/** Eén losse lijn door de ruimte: een streep, een straal, een dakrail. */
export function pad (punten, nadruk = 1) {
  return {
    punten: punten.map(p => ({ x: p.x, y: p.y, z: p.z })),
    lijnen: [{ ketting: punten.map((_, i) => i), nadruk }]
  }
}
