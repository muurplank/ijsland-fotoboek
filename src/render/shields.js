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
  maxVerhouding = 4,
  minVulgraad = 0.45
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
    if (oppervlak / (breedte * hoogte) < minVulgraad) continue

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
 * Elke lege pixel krijgt de kleur van de dichtstbijzijnde pixel die wél blijft,
 * en daarna gaat er een paar keer een zachte veeg over de naden. Zo groeit de
 * zee het gat in vanaf de zeekant en het land vanaf de landkant, en blijft een
 * kustlijn die onder een naam door liep gewoon staan.
 *
 * Uitmiddelen deed dat niet: dat trok de kleuren van beide kanten door elkaar,
 * en omdat het in leesvolgorde ging kwam er een diagonale veeg uit. Bij een
 * wegnummer-badge van veertig bij vijfentwintig zag je dat niet, bij een
 * plaatsnaam over een fjord des te meer.
 *
 * Met een masker wordt alleen ingevuld wat daarin staat; de rest van het
 * rechthoekje blijft zoals het was en doet mee als bron.
 */
function vulOp (beeld, x0, y0, breedte, hoogte, masker = null) {
  const { data, width, height } = beeld
  const kanalen = beeld.kanalen ?? 3

  // Eén pixel ruimer werken, zodat de rand eromheen als bron meedoet. Anders
  // heeft een vakje dat helemaal ingevuld moet worden nergens kleur vandaan.
  const B = breedte + 2
  const H = hoogte + 2

  const leeg = new Uint8Array(B * H)
  const kleur = new Float32Array(B * H * 3)
  const wachtrij = new Int32Array(B * H)
  let kop = 0
  let staart = 0

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < B; x++) {
      const l = y * B + x
      const gx = x0 + x - 1
      const gy = y0 + y - 1

      // Buiten het beeld is geen bron. Klemmen op de laatste rij leek onschuldig,
      // maar bij een naam die tegen de rand van de kaart aan ligt werd de tekst
      // dan zijn eigen bron: de letters groeiden als een streepjescode omhoog.
      const inBeeld = gx >= 0 && gy >= 0 && gx < width && gy < height
      const inVak = x > 0 && y > 0 && x < B - 1 && y < H - 1

      if (!inBeeld || (inVak && (!masker || masker[gy * width + gx]))) { leeg[l] = 1; continue }

      const p = (gy * width + gx) * kanalen
      kleur[l * 3] = data[p]
      kleur[l * 3 + 1] = data[p + 1]
      kleur[l * 3 + 2] = data[p + 2]
      wachtrij[staart++] = l
    }
  }

  // niets om uit te putten; dan is niets doen beter dan er zwart van maken
  if (!staart) return

  const inTeVullen = leeg.slice()

  // vanuit alle bronnen tegelijk naar binnen groeien; wie er het eerst is, wint
  while (kop < staart) {
    const l = wachtrij[kop++]
    const x = l % B
    const y = (l / B) | 0

    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue

      const n = ny * B + nx
      if (!leeg[n]) continue

      leeg[n] = 0
      kleur[n * 3] = kleur[l * 3]
      kleur[n * 3 + 1] = kleur[l * 3 + 1]
      kleur[n * 3 + 2] = kleur[l * 3 + 2]
      wachtrij[staart++] = n
    }
  }

  // De naden waar twee bronnen elkaar tegenkwamen zachtjes wegwerken. Hoe groter
  // het gat, hoe langer die naden zijn en hoe meer vegen er nodig is: bij een
  // brede plek waar de kleur alleen van boven en onder kon komen bleef er anders
  // een streepjespatroon staan, als een streepjescode over de kaart.
  const rondes = Math.min(12, 3 + Math.round(Math.min(breedte, hoogte) / 4))
  for (let ronde = 0; ronde < rondes; ronde++) {
    const vorige = Float32Array.from(kleur)
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < B - 1; x++) {
        const l = y * B + x
        if (!inTeVullen[l]) continue
        for (let k = 0; k < 3; k++) {
          kleur[l * 3 + k] = (vorige[l * 3 + k] + vorige[(l - 1) * 3 + k] +
            vorige[(l + 1) * 3 + k] + vorige[(l - B) * 3 + k] + vorige[(l + B) * 3 + k]) / 5
        }
      }
    }
  }

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < B - 1; x++) {
      const l = y * B + x
      if (!inTeVullen[l]) continue

      const p = ((y0 + y - 1) * width + (x0 + x - 1)) * kanalen
      data[p] = kleur[l * 3]
      data[p + 1] = kleur[l * 3 + 1]
      data[p + 2] = kleur[l * 3 + 2]
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
 * Twee dingen scheiden een woord van het landschap, en allebei zijn ze nodig.
 *
 * De inkt van een letter is *ingehouden van kleur*: Mapbox zet zijn namen in
 * donkergrijs, en zijn natuurgebieden in een donkergroen. Diep in een schaduw of
 * onder een gletsjerrand ligt ook iets donkers naast iets lichts, maar dat
 * donker heeft altijd een stevige kleurzweem. Op alleen helderheid toetsen
 * leverde daarom halve kustlijnen op, en die kwamen als cyane vlekken mee.
 *
 * En "licht" betekent hier helder, niet wit. Mapbox zet lang niet om elke naam
 * een witrand - op lichte landcover staat de tekst er kaal op - en waar wel een
 * rand staat neemt die de kleur van de ondergrond aan. Op bijna-wit toetsen
 * vond "Akureyri" alleen langs de wegen die er toevallig doorheen lopen, en van
 * "Breiðafjörður" bleef "Brei" staan omdat de zee eronder wel helder is maar
 * niet wit. Op de helderste kanaalwaarde toetsen vangt allebei die gevallen.
 *
 * En de vorm van een woord is *compact*: nadat de losse letters aan elkaar
 * gegroeid zijn is het een gevuld blokje van een paar regels hoog. Een kustlijn
 * groeit tot een slinger met een enorme omhullende rechthoek waar bijna niets
 * in zit, en een gletsjer tot een egale plak zonder inkt.
 *
 * @param {{data: Buffer, width: number, height: number, kanalen?: number}} beeld
 */
export function vindTekstVlakken (beeld, {
  donker = 110,
  licht = 205,
  neutraal = 70,
  venster = 5,
  minOppervlak = 120,
  maxOppervlak = 60000,
  gatDichten = 6,
  maskerGroei = 3,
  negeer = [],
  maxHoogte = Infinity,
  minVulgraad = 0.5,
  inktMin = 0.02,
  inktMax = 0.45
} = {}) {
  const { data, width, height } = beeld
  const kanalen = beeld.kanalen ?? 3

  const isDonker = new Uint8Array(width * height)
  const isLicht = new Uint8Array(width * height)

  for (let i = 0; i < width * height; i++) {
    const p = i * kanalen
    const min = Math.min(data[p], data[p + 1], data[p + 2])
    const max = Math.max(data[p], data[p + 1], data[p + 2])
    if (max <= donker && max - min <= neutraal) isDonker[i] = 1
    if (max >= licht) isLicht[i] = 1
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

  // Losse letters aan elkaar plakken tot een woord - breder dan hoog. Een naam
  // loopt horizontaal, dus horizontaal mag het gat groot zijn. Verticaal juist
  // niet: twee namen boven elkaar horen twee vlakken te blijven, anders wordt
  // hun gezamenlijke rechthoek te hoog en valt hij alsnog af.
  const gedicht = verbreed(tekst, width, height, gatDichten, Math.max(1, Math.round(gatDichten / 2)))

  // De wegnummer-schildjes uit het masker knippen, ná het dichten.
  //
  // Ervoor knippen werkte niet: het dichten groeide er gewoon overheen. En het
  // moet gebeuren, want anders groeit een naam vlakbij aan het schildje vast en
  // wordt hun gezamenlijke rechthoek te leeg om nog voor tekst door te gaan. Zo
  // bleven "Akureyri" naast de 1 en "Húsavík" onder de 85 op de kaart staan.
  //
  // De marge is ruim: het gevonden witte vlak is alleen het bínnenwerk van het
  // schildje, en daar zitten de rand, de witrand en het dichten nog omheen.
  for (const vlak of negeer) wisUitMasker(gedicht, width, height, vlak, gatDichten + 8)

  const ruw = vlakkenUitMasker(gedicht, width, height, { minOppervlak, maxOppervlak })

  const vlakken = ruw.filter(v => {
    if (v.hoogte > maxHoogte) return false
    if (v.oppervlak / (v.breedte * v.hoogte) < minVulgraad) return false

    // hoeveel van de omhullende rechthoek echt inkt is. Een woord zit rond een
    // vijfde vol; een egale donkere plak zit er ver boven en een toevallig
    // gevonden stukje landschap ver onder.
    const inkt = aandeelInkt(isDonker, width, v)
    return inkt >= inktMin && inkt <= inktMax
  })

  // Het nauwe masker meesturen: er hoeven alleen de letters en hun witrand uit,
  // niet het hele rechthoek eromheen. Bij het optillen zou er anders een blok
  // uit de routelijn vallen in plaats van dat de tekst er netjes overheen staat,
  // en bij het wissen zou er meer landschap sneuvelen dan nodig is.
  vlakken.masker = verbreed(tekst, width, height, maskerGroei, maskerGroei)
  return vlakken
}

/** Haalt een rechthoekje uit een masker, met wat marge eromheen. */
function wisUitMasker (masker, width, height, vlak, marge) {
  const x0 = Math.max(0, vlak.x0 - marge)
  const y0 = Math.max(0, vlak.y0 - marge)
  const x1 = Math.min(width, vlak.x0 + vlak.breedte + marge)
  const y1 = Math.min(height, vlak.y0 + vlak.hoogte + marge)

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) masker[y * width + x] = 0
  }
}

/** Welk deel van de omhullende rechthoek van dit vlak echt inkt is. */
function aandeelInkt (isDonker, width, vlak) {
  let n = 0
  for (let y = vlak.y0; y < vlak.y0 + vlak.hoogte; y++) {
    for (let x = vlak.x0; x < vlak.x0 + vlak.breedte; x++) {
      if (isDonker[y * width + x]) n++
    }
  }
  return n / (vlak.breedte * vlak.hoogte)
}

/** Verbreedt een masker met een aantal pixels, zodat losse stukjes aan elkaar groeien. */
function verbreed (masker, width, height, straalX, straalY = straalX) {
  if (straalX <= 0 && straalY <= 0) return masker
  const uit = new Uint8Array(width * height)

  // horizontaal en verticaal apart: veel sneller dan een rond venster
  const tussen = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!masker[y * width + x]) continue
      for (let dx = -straalX; dx <= straalX; dx++) {
        const nx = x + dx
        if (nx >= 0 && nx < width) tussen[y * width + nx] = 1
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!tussen[y * width + x]) continue
      for (let dy = -straalY; dy <= straalY; dy++) {
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

/**
 * Poetst de kaarttekst uit het beeld weg, zodat wij de namen zelf kunnen zetten.
 *
 * Het spiegelbeeld van `tilTekstOp`: die tilt Mapbox' letters op om ze te
 * bewaren, deze haalt ze juist weg. De naam komt daarna als vector terug in de
 * letter van het boek, en dan hoort er geen tweede versie in de kaart te zitten.
 *
 * Wegpoetsen is vergevingsgezinder dan optillen. Een vlak dat iets te ruim
 * genomen is levert een onopvallend zachte plek op, maar een woord dat maar
 * half opgetild werd zag je meteen. Vandaar dat de gaten hier royaal gedicht
 * worden: liever een naam te veel meepakken dan een halve laten staan.
 *
 * De wegnummers blijven wel staan. Die zijn geen letter maar een schildje, ze
 * horen bij de weg, en ze verbleken straks netjes mee met de rest van de kaart.
 * Waar ze staan gaat mee terug, zodat de browser er zijn eigen namen niet
 * bovenop zet.
 *
 * @param {{data: Buffer, width: number, height: number, kanalen?: number}} beeld
 * @returns {{aantal: number, schilden: Array}} hoeveel namen er weggepoetst zijn
 */
export function wisTekst (beeld, { rand = 3, spaarSchilden = true, ...opties } = {}) {
  // Eerst de schildjes, want die bepalen mede waar de tekst gezocht wordt.
  //
  // Alleen echt schildvormige witte vlakken tellen mee: bijna helemaal gevuld,
  // niet te groot, en altijd breder dan hoog - er staat immers een nummer in.
  // Die laatste eis houdt de staande speldjes van bezienswaardigheden erbuiten.
  // Zonder die eis werd het witte speldje midden in "Breiðafjörður" voor een
  // wegnummer aangezien, en dan knipte het de naam doormidden: "Brei" en "fjö"
  // bleven staan met een gat ertussen.
  const schilden = spaarSchilden
    ? vindWitteVlakken(beeld, { minOppervlak: 150, maxOppervlak: 4000, maxVerhouding: 3, minVulgraad: 0.7 })
      .filter(s => s.breedte >= s.hoogte * 1.15)
    : []

  // Ruimer masker dan bij het optillen: de witrand om een naam dooft geleidelijk
  // uit, en wat daarvan blijft staan lees je als een lichte schim op de plek waar
  // het woord stond. Dat mag weg - de opvulling houdt de randen toch wel scherp.
  const vlakken = vindTekstVlakken(beeld, { ...opties, maskerGroei: 7, negeer: schilden })
  const masker = vlakken.masker
  const kanalen = beeld.kanalen ?? 3

  // Om het uitgeknipte schildje blijft een randje masker over - zijn eigen
  // witrand. Dat is geen naam maar een lijstje om het nummer, en dat hoort te
  // blijven. Herkenbaar doordat het niet veel groter is dan het schildje zelf.
  const speling = 2 * ((opties.gatDichten ?? 6) + 6)
  const isSchild = vlak => schilden.some(s =>
    vlak.x0 >= s.x0 - speling && vlak.y0 >= s.y0 - speling &&
    vlak.x0 + vlak.breedte <= s.x0 + s.breedte + speling &&
    vlak.y0 + vlak.hoogte <= s.y0 + s.hoogte + speling)

  let aantal = 0

  for (const vlak of vlakken) {
    if (isSchild(vlak)) continue

    const x0 = Math.max(0, vlak.x0 - rand)
    const y0 = Math.max(0, vlak.y0 - rand)
    const x1 = Math.min(beeld.width, vlak.x0 + vlak.breedte + rand)
    const y1 = Math.min(beeld.height, vlak.y0 + vlak.hoogte + rand)

    // Een schildje dat toevallig binnen deze rechthoek valt hoort te blijven.
    // Het wordt bewaard, de naam wordt weggepoetst, en daarna komt het schildje
    // terug op zijn plek - eromheen loopt de opvulling gewoon door.
    const teBewaren = schilden
      .filter(s => s.x0 < x1 && x0 < s.x0 + s.breedte && s.y0 < y1 && y0 < s.y0 + s.hoogte)
      .map(s => ({ s, pixels: knip(beeld, s, rand) }))

    vulOp(beeld, x0, y0, x1 - x0, y1 - y0, masker)
    for (const { s, pixels } of teBewaren) plak(beeld, s, rand, pixels, kanalen)

    aantal++
  }

  return { aantal, schilden }
}

/** Bewaart de pixels van een rechthoekje, met marge. */
function knip (beeld, vlak, marge) {
  const kanalen = beeld.kanalen ?? 3
  const { x0, y0, x1, y1 } = binnen(beeld, vlak, marge)
  const uit = Buffer.alloc((x1 - x0) * (y1 - y0) * kanalen)

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const bron = (y * beeld.width + x) * kanalen
      const doel = ((y - y0) * (x1 - x0) + (x - x0)) * kanalen
      for (let k = 0; k < kanalen; k++) uit[doel + k] = beeld.data[bron + k]
    }
  }

  return uit
}

/** Zet bewaarde pixels terug op hun plek. */
function plak (beeld, vlak, marge, pixels, kanalen) {
  const { x0, y0, x1, y1 } = binnen(beeld, vlak, marge)

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const doel = (y * beeld.width + x) * kanalen
      const bron = ((y - y0) * (x1 - x0) + (x - x0)) * kanalen
      for (let k = 0; k < kanalen; k++) beeld.data[doel + k] = pixels[bron + k]
    }
  }
}

/** Een rechthoekje met marge, geklemd binnen het beeld. */
function binnen (beeld, vlak, marge) {
  return {
    x0: Math.max(0, vlak.x0 - marge),
    y0: Math.max(0, vlak.y0 - marge),
    x1: Math.min(beeld.width, vlak.x0 + vlak.breedte + marge),
    y1: Math.min(beeld.height, vlak.y0 + vlak.hoogte + marge)
  }
}
