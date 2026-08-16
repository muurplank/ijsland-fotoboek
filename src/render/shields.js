/**
 * Wegnummer-badges weghalen waar de route eroverheen loopt.
 *
 * De kaartachtergrond komt als plaatje binnen, dus we kunnen er geen laag in
 * uitzetten. Maar een wegnummer half onder je eigen routelijn is lelijk en
 * zegt niets: die weg volg je nu juist. Daarom zoeken we de witte badges op en
 * poetsen we alleen die weg waar de route overheen gaat.
 *
 * Bewust voorzichtig: alleen kleine, blokvormige, bijna-witte vlakken die de
 * route raken. Een gletsjer is te groot, een weg te langgerekt, en een badge
 * ergens anders op de kaart blijft gewoon staan.
 */

/**
 * Zoekt losse bijna-witte vlakken die qua maat en vorm op een badge lijken.
 *
 * @param {{data: Buffer, width: number, height: number}} beeld
 */
export function vindWitteVlakken (beeld, {
  drempel = 235,
  minOppervlak = 100,
  maxOppervlak = 6000,
  maxVerhouding = 4
} = {}) {
  const { data, width, height } = beeld
  // De kaarttegels komen als rgba binnen, losse proefbeelden als rgb. Het
  // aantal kanalen moet dus meekomen: rekenen op drie waar er vier zijn levert
  // verschoven pixels op en dus geen enkele treffer.
  const kanalen = beeld.kanalen ?? 3
  const gezien = new Uint8Array(width * height)
  const vlakken = []

  const isWit = i => {
    const p = i * kanalen
    return data[p] >= drempel && data[p + 1] >= drempel && data[p + 2] >= drempel
  }

  // vlakvulling per gevonden startpunt; een gewone lijst als wachtrij is hier
  // sneller dan recursie en kan niet omvallen op grote vlakken
  const wachtrij = new Int32Array(width * height)

  for (let start = 0; start < width * height; start++) {
    if (gezien[start] || !isWit(start)) continue

    let kop = 0
    let staart = 0
    wachtrij[staart++] = start
    gezien[start] = 1

    let x0 = width; let y0 = height; let x1 = -1; let y1 = -1
    let oppervlak = 0
    let teGroot = false

    while (kop < staart) {
      const i = wachtrij[kop++]
      const x = i % width
      const y = (i / width) | 0

      oppervlak++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y

      if (oppervlak > maxOppervlak) { teGroot = true; break }

      if (x > 0 && !gezien[i - 1] && isWit(i - 1)) { gezien[i - 1] = 1; wachtrij[staart++] = i - 1 }
      if (x < width - 1 && !gezien[i + 1] && isWit(i + 1)) { gezien[i + 1] = 1; wachtrij[staart++] = i + 1 }
      if (y > 0 && !gezien[i - width] && isWit(i - width)) { gezien[i - width] = 1; wachtrij[staart++] = i - width }
      if (y < height - 1 && !gezien[i + width] && isWit(i + width)) { gezien[i + width] = 1; wachtrij[staart++] = i + width }
    }

    if (teGroot) {
      // de rest van dit gebied ook afvinken, anders vinden we hem meteen opnieuw
      while (kop < staart) {
        const i = wachtrij[kop++]
        const x = i % width
        const y = (i / width) | 0
        if (x > 0 && !gezien[i - 1] && isWit(i - 1)) { gezien[i - 1] = 1; wachtrij[staart++] = i - 1 }
        if (x < width - 1 && !gezien[i + 1] && isWit(i + 1)) { gezien[i + 1] = 1; wachtrij[staart++] = i + 1 }
        if (y > 0 && !gezien[i - width] && isWit(i - width)) { gezien[i - width] = 1; wachtrij[staart++] = i - width }
        if (y < height - 1 && !gezien[i + width] && isWit(i + width)) { gezien[i + width] = 1; wachtrij[staart++] = i + width }
      }
      continue
    }

    if (oppervlak < minOppervlak) continue

    const breedte = x1 - x0 + 1
    const hoogte = y1 - y0 + 1
    const verhouding = Math.max(breedte / hoogte, hoogte / breedte)
    if (verhouding > maxVerhouding) continue

    // een badge is grotendeels gevuld; een grillige vorm is iets anders
    if (oppervlak / (breedte * hoogte) < 0.45) continue

    vlakken.push({ x0, y0, breedte, hoogte, oppervlak })
  }

  return vlakken
}

/** Ligt dit rechthoekje op of vlak bij de route? */
function raaktRoute (vlak, route, marge) {
  const links = vlak.x0 - marge
  const rechts = vlak.x0 + vlak.breedte + marge
  const boven = vlak.y0 - marge
  const onder = vlak.y0 + vlak.hoogte + marge

  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]
    const b = route[i]

    // grof: als het lijnstuk het vak helemaal mist, meteen door
    if (Math.max(a.x, b.x) < links || Math.min(a.x, b.x) > rechts) continue
    if (Math.max(a.y, b.y) < boven || Math.min(a.y, b.y) > onder) continue

    // fijn: loop het lijnstuk af in stapjes van een pixel
    const lengte = Math.hypot(b.x - a.x, b.y - a.y)
    const stappen = Math.max(1, Math.ceil(lengte))
    for (let s = 0; s <= stappen; s++) {
      const x = a.x + ((b.x - a.x) * s) / stappen
      const y = a.y + ((b.y - a.y) * s) / stappen
      if (x >= links && x <= rechts && y >= boven && y <= onder) return true
    }
  }
  return false
}

/**
 * Vult een rechthoekje op met de kleuren eromheen.
 *
 * Werkt van de rand naar binnen: elke lege pixel krijgt het gemiddelde van zijn
 * al gevulde buren. Daardoor loopt de omgeving vloeiend door in plaats van dat
 * er een egaal blok verschijnt.
 */
function vulOp (beeld, x0, y0, breedte, hoogte) {
  const { data, width, height } = beeld
  const kanalen = beeld.kanalen ?? 3

  const leeg = new Uint8Array(breedte * hoogte).fill(1)
  const kleur = new Float32Array(breedte * hoogte * 3)

  for (let ronde = 0; ronde < breedte + hoogte; ronde++) {
    let ingevuld = 0

    for (let y = 0; y < hoogte; y++) {
      for (let x = 0; x < breedte; x++) {
        const l = y * breedte + x
        if (!leeg[l]) continue

        let r = 0; let g = 0; let b = 0; let n = 0

        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const bx = x + dx
          const by = y + dy

          if (bx < 0 || by < 0 || bx >= breedte || by >= hoogte) {
            // buiten het gat: pak de echte pixel uit het beeld
            const gx = Math.min(width - 1, Math.max(0, x0 + bx))
            const gy = Math.min(height - 1, Math.max(0, y0 + by))
            const p = (gy * width + gx) * kanalen
            r += data[p]; g += data[p + 1]; b += data[p + 2]; n++
          } else if (!leeg[by * breedte + bx]) {
            const q = (by * breedte + bx) * 3
            r += kleur[q]; g += kleur[q + 1]; b += kleur[q + 2]; n++
          }
        }

        if (!n) continue
        const q = l * 3
        kleur[q] = r / n; kleur[q + 1] = g / n; kleur[q + 2] = b / n
        leeg[l] = 0
        ingevuld++
      }
    }

    if (!ingevuld) break
  }

  for (let y = 0; y < hoogte; y++) {
    for (let x = 0; x < breedte; x++) {
      const l = y * breedte + x
      const p = ((y0 + y) * width + (x0 + x)) * kanalen
      const q = l * 3
      data[p] = kleur[q]
      data[p + 1] = kleur[q + 1]
      data[p + 2] = kleur[q + 2]
    }
  }
}

/**
 * Poetst de wegnummer-badges weg die onder de route liggen.
 *
 * @param {{data: Buffer, width: number, height: number}} beeld
 * @param {Array<{x: number, y: number}>} route in pixels van dit beeld
 * @returns {number} hoeveel badges er weggehaald zijn
 */
export function verwijderSchilden (beeld, route, {
  lijnDikte = 8,
  drempel = 235,
  minOppervlak = 100,
  maxOppervlak = 6000,
  maxVerhouding = 4
} = {}) {
  return behandelSchilden(beeld, route, {
    lijnDikte, drempel, minOppervlak, maxOppervlak, maxVerhouding
  }).aantal
}

/**
 * Zoekt de badges op de route en doet er iets mee.
 *
 * @param {'wissen'|'optillen'} wat
 *   wissen   - poetst ze weg en vult het gat met de omgeving
 *   optillen - knipt ze uit en geeft ze terug als losse laag, om over de
 *              routelijn heen te leggen. Zo dekt je route de kaart wel af,
 *              maar de tekst niet.
 * @returns {{aantal: number, laag: Buffer|null}} laag is rgba, even groot als het beeld
 */
export function behandelSchilden (beeld, route, {
  wat = 'wissen',
  lijnDikte = 8,
  drempel = 235,
  minOppervlak = 100,
  maxOppervlak = 6000,
  maxVerhouding = 4
} = {}) {
  if (!route || route.length < 2) return { aantal: 0, laag: null }

  const vlakken = vindWitteVlakken(beeld, { drempel, minOppervlak, maxOppervlak, maxVerhouding })

  const optillen = wat === 'optillen'
  const laag = optillen ? Buffer.alloc(beeld.width * beeld.height * 4, 0) : null
  let aantal = 0

  for (const vlak of vlakken) {
    if (!raaktRoute(vlak, route, lijnDikte)) continue

    // iets ruimer nemen, zodat de rand en het cijfer ook meegaan
    const rand = 3
    const x0 = Math.max(0, vlak.x0 - rand)
    const y0 = Math.max(0, vlak.y0 - rand)
    const x1 = Math.min(beeld.width, vlak.x0 + vlak.breedte + rand)
    const y1 = Math.min(beeld.height, vlak.y0 + vlak.hoogte + rand)

    if (optillen) {
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = (y * beeld.width + x) * (beeld.kanalen ?? 3)
          const q = (y * beeld.width + x) * 4
          laag[q] = beeld.data[p]
          laag[q + 1] = beeld.data[p + 1]
          laag[q + 2] = beeld.data[p + 2]
          laag[q + 3] = 255
        }
      }
    } else {
      vulOp(beeld, x0, y0, x1 - x0, y1 - y0)
    }

    aantal++
  }

  return { aantal, laag }
}

/* ========================================================================
 * Plaatsnamen optillen
 *
 * Een plaatsnaam die half onder je routelijn verdwijnt is erger dan een
 * wegnummer: die naam wil je juist lezen. Wissen kan dus niet - hij moet
 * er bovenop.
 *
 * Herkennen gaat op het patroon dat kaarttekst altijd heeft: donkere letters
 * met een lichte rand eromheen, vlak naast elkaar. Landschap heeft dat niet;
 * daar liggen donker en licht zelden binnen een paar pixels van elkaar.
 * ===================================================================== */

/**
 * Zoekt gebieden die eruitzien als kaarttekst.
 *
 * @param {{data: Buffer, width: number, height: number, kanalen?: number}} beeld
 */
export function vindTekstVlakken (beeld, {
  donker = 110,
  licht = 235,
  venster = 5,
  minOppervlak = 120,
  maxOppervlak = 60000,
  gatDichten = 6
} = {}) {
  const { data, width, height } = beeld
  const kanalen = beeld.kanalen ?? 3

  const isDonker = new Uint8Array(width * height)
  const isLicht = new Uint8Array(width * height)

  for (let i = 0; i < width * height; i++) {
    const p = i * kanalen
    const min = Math.min(data[p], data[p + 1], data[p + 2])
    const max = Math.max(data[p], data[p + 1], data[p + 2])
    if (max <= donker) isDonker[i] = 1
    if (min >= licht) isLicht[i] = 1
  }

  // een pixel telt als tekst als er binnen een klein venster zowel iets heel
  // donkers als iets heel lichts staat
  const tekst = new Uint8Array(width * height)
  for (let y = venster; y < height - venster; y++) {
    for (let x = venster; x < width - venster; x++) {
      let d = false
      let l = false
      for (let dy = -venster; dy <= venster && !(d && l); dy++) {
        for (let dx = -venster; dx <= venster; dx++) {
          const j = (y + dy) * width + (x + dx)
          if (isDonker[j]) d = true
          else if (isLicht[j]) l = true
          if (d && l) break
        }
      }
      if (d && l) tekst[y * width + x] = 1
    }
  }

  // losse letters aan elkaar plakken tot een woord
  const gedicht = verbreed(tekst, width, height, gatDichten)

  const vlakken = vlakkenUitMasker(gedicht, width, height, { minOppervlak, maxOppervlak })

  // het nauwe masker meesturen: bij het optillen willen we alleen de letters en
  // hun rand meenemen, niet het hele rechthoek eromheen. Anders valt er een blok
  // uit de routelijn in plaats van dat de tekst er netjes overheen staat.
  vlakken.masker = verbreed(tekst, width, height, 2)
  return vlakken
}

/** Verbreedt een masker met een aantal pixels, zodat losse stukjes aan elkaar groeien. */
function verbreed (masker, width, height, straal) {
  if (straal <= 0) return masker
  const uit = new Uint8Array(width * height)

  // horizontaal en verticaal apart: veel sneller dan een rond venster
  const tussen = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!masker[y * width + x]) continue
      for (let dx = -straal; dx <= straal; dx++) {
        const nx = x + dx
        if (nx >= 0 && nx < width) tussen[y * width + nx] = 1
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!tussen[y * width + x]) continue
      for (let dy = -straal; dy <= straal; dy++) {
        const ny = y + dy
        if (ny >= 0 && ny < height) uit[ny * width + x] = 1
      }
    }
  }
  return uit
}

/** Losse gebieden uit een masker halen. */
function vlakkenUitMasker (masker, width, height, { minOppervlak, maxOppervlak }) {
  const gezien = new Uint8Array(width * height)
  const wachtrij = new Int32Array(width * height)
  const vlakken = []

  for (let start = 0; start < width * height; start++) {
    if (gezien[start] || !masker[start]) continue

    let kop = 0; let staart = 0
    wachtrij[staart++] = start
    gezien[start] = 1

    let x0 = width; let y0 = height; let x1 = -1; let y1 = -1
    let oppervlak = 0

    while (kop < staart) {
      const i = wachtrij[kop++]
      const x = i % width
      const y = (i / width) | 0
      oppervlak++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y

      if (x > 0 && !gezien[i - 1] && masker[i - 1]) { gezien[i - 1] = 1; wachtrij[staart++] = i - 1 }
      if (x < width - 1 && !gezien[i + 1] && masker[i + 1]) { gezien[i + 1] = 1; wachtrij[staart++] = i + 1 }
      if (y > 0 && !gezien[i - width] && masker[i - width]) { gezien[i - width] = 1; wachtrij[staart++] = i - width }
      if (y < height - 1 && !gezien[i + width] && masker[i + width]) { gezien[i + width] = 1; wachtrij[staart++] = i + width }
    }

    if (oppervlak < minOppervlak || oppervlak > maxOppervlak) continue
    vlakken.push({ x0, y0, breedte: x1 - x0 + 1, hoogte: y1 - y0 + 1, oppervlak })
  }

  return vlakken
}

/**
 * Knipt de kaarttekst die de route raakt uit, als losse doorzichtige laag om
 * over de routelijn heen te leggen. De achtergrond blijft ongemoeid: dit
 * kopieert, het wist niets.
 *
 * @returns {{aantal: number, laag: Buffer|null}}
 */
export function tilTekstOp (beeld, route, { lijnDikte = 8, alles = false, ...opties } = {}) {
  if (!alles && (!route || route.length < 2)) return { aantal: 0, laag: null }

  const vlakken = vindTekstVlakken(beeld, opties)
  const masker = vlakken.masker
  const kanalen = beeld.kanalen ?? 3
  const laag = Buffer.alloc(beeld.width * beeld.height * 4, 0)
  let aantal = 0

  for (const vlak of vlakken) {
    // Met `alles` gaat de hele naamlaag omhoog, ook namen die de route niet
    // raakt. Dat is een keuze over stapeling en niet over botsingen: de kaart
    // onderop, de routelijn erop, de plaatsnamen bovenop. Alleen de gekruiste
    // namen optillen laat een naam vlak naast de lijn onder een gletsjer of
    // een hoogtelijn liggen, en dan leest de ene naam anders dan de andere.
    if (!alles && !raaktRoute(vlak, route, lijnDikte)) continue

    const x1 = Math.min(beeld.width, vlak.x0 + vlak.breedte)
    const y1 = Math.min(beeld.height, vlak.y0 + vlak.hoogte)

    for (let y = vlak.y0; y < y1; y++) {
      for (let x = vlak.x0; x < x1; x++) {
        const i = y * beeld.width + x
        if (masker && !masker[i]) continue

        const p = i * kanalen
        const q = i * 4
        laag[q] = beeld.data[p]
        laag[q + 1] = beeld.data[p + 1]
        laag[q + 2] = beeld.data[p + 2]
        laag[q + 3] = 255
      }
    }
    aantal++
  }

  if (aantal && opties.hertint && opties.hertint !== 'origineel') {
    hertintLaag(laag, opties.hertint)
  }

  return { aantal, laag: aantal ? laag : null }
}

/**
 * Zet de opgetilde tekst om naar licht of donker.
 *
 * Nodig zodra de kaart eronder van kleur wisselt: de namen komen uit het
 * kaartbeeld zelf, dus op een donkergemaakte Outdoors zijn ze zwart op zwart.
 *
 * De helderheid van elke pixel wordt de nieuwe doorzichtigheid. Zo blijven de
 * zachte randen van de letters zacht - hard omzetten naar één kleur zou de
 * antialiasing weggooien en dan zie je in de druk getrapte lettervormen.
 */
function hertintLaag (laag, naar) {
  const licht = naar === 'licht'

  for (let i = 0; i < laag.length; i += 4) {
    const a = laag[i + 3]
    if (!a) continue

    // hoe donker de pixel was, telt als hoe stevig de letter daar stond
    const grijs = (laag[i] * 0.299 + laag[i + 1] * 0.587 + laag[i + 2] * 0.114) / 255
    const sterkte = licht ? 1 - grijs : grijs

    const waarde = licht ? 255 : 0
    laag[i] = waarde
    laag[i + 1] = waarde
    laag[i + 2] = waarde
    laag[i + 3] = Math.round(a * Math.min(1, sterkte * 1.15))
  }
}
