/**
 * Alles op de pagina verslepen, schalen en de teksten ter plekke aanpassen.
 *
 * Twee dingen die je met geen enkele instelling kunt oplossen: een plaatsnaam
 * die net over je route valt, en een titel die op deze ene dag beter rechtsonder
 * staat. Daarvoor moet je gewoon kunnen slepen.
 *
 * Verschuivingen worden als afwijking bewaard, niet als absolute positie. Zo
 * blijft de standaardopmaak leidend en verschuift jouw correctie netjes mee als
 * je later van paginaformaat wisselt. Hetzelfde geldt voor de schaal: die is een
 * factor op wat de opmaak koos, geen vaste maat.
 *
 * Twee rekenstelsels naast elkaar. De opschriften zijn gewone HTML en rekenen in
 * schermpixels, dus daar wordt een millimeter `calc(1 * var(--mm))`. De tekenlaag
 * is een SVG met een viewBox in millimeters, dus daar is een gebruikerseenheid al
 * een millimeter en schrijven we gewoon `1px` - in SVG is dat precies één
 * gebruikerseenheid. Vandaar dat elke plek waar een verschuiving op een element
 * wordt gezet door `alsLengte` gaat.
 *
 * Werkt alleen in de bedieningspagina; bij het exporteren doet dit bestand niets.
 */

/** Elementen met deze eigenschap kun je verslepen. */
const SLEEP = 'data-plek'

/** Elementen met deze eigenschap kun je met dubbelklik aanpassen. */
const TEKST = 'data-tekst'

/** Elementen met deze eigenschap krijgen een greepje om ze te schalen. */
const SCHAAL = 'data-schaalbaar'

/** Elementen met deze eigenschap snappen op het midden van de pagina. */
const MIDDEN = 'data-midden'

/**
 * Elementen die met het greepje niet zichzelf maar een instelling verstellen.
 *
 * Een marker hoort niet los van zijn soortgenoten geschaald te worden: als het
 * hotel van dag 1 groter wordt, horen de tent van dag 4 en alle andere mee te
 * groeien. Vandaar dat het greepje hier de maat in het instellingenschema
 * verzet in plaats van een schaal op dit ene element.
 */
const STIJLMAAT = 'data-stijlmaat'

/** De maat die die instelling nu heeft, in millimeters. */
const STIJLNU = 'data-stijlnu'

/**
 * Onderdelen die zichzelf hertekenen maar tijdens het slepen wél mogen meegroeien.
 *
 * Normaal wacht een hertekenend onderdeel tot je loslaat: het inzetkaartje op
 * elke muisbeweging opnieuw opbouwen is te traag, en een schaalbalk die je ziet
 * uitrekken liegt over zijn kilometers.
 *
 * Bij een afdruk is dat allebei niet zo. Uitrekken is daar precies wat er gaat
 * gebeuren, dus een voorbeeld met een transform vertelt de waarheid. En zonder
 * dat voorbeeld sleep je blind: je ziet pas wat je gedaan hebt als je loslaat,
 * en dan is een stempel zomaar een kwart van zijn maat en niet meer terug te
 * vinden.
 */
const VOORBEELD = 'data-voorbeeld'

/** Elementen die je met Delete van de pagina af kunt halen. */
const WEGHAAL = 'data-weghaalbaar'

/** Snapt op het hart van het element met deze plek-naam. */
const SNAPOP = 'data-snap-op'

/** Blijft altijd minstens zoveel millimeter van de paginarand af. */
const BINNENMARGE = 'data-binnen-marge'

/** Naar welke groep in het paneel dit element verwijst. */
const KNOPPEN = 'data-knoppen'

/** Binnen zoveel schermpixels pakt een snaplijn. */
const SNAP_PX = 7

/** Grenzen aan het schalen: kleiner wordt onzichtbaar, groter is nooit bedoeld. */
const SCHAAL_MIN = 0.25
const SCHAAL_MAX = 4

/**
 * De kleinste doos waar nog iets in past, in millimeters.
 *
 * Onder deze maat wringt de tekst zich in een kolom van één woord breed en is er
 * niets meer terug te slepen omdat het greepje op de tekst zelf valt.
 */
const DOOS_MIN_MM = 20

const isSvg = node => node.namespaceURI === 'http://www.w3.org/2000/svg'

/**
 * Een maat in millimeters, uitgedrukt in het stelsel van dit element.
 *
 * HTML rekent in schermpixels en heeft var(--mm) nodig; in de SVG is een
 * gebruikerseenheid al een millimeter.
 */
const alsLengte = (node, mm) => isSvg(node) ? `${mm}px` : `calc(${mm} * var(--mm))`

const round2 = n => Math.round(n * 100) / 100

/**
 * Hoe ver dit element verschoven mag worden zonder tegen de rand te komen.
 *
 * Alleen voor de opschriften: die zijn gewone HTML en hebben offsetLeft en
 * offsetWidth, waarmee je de plek meet zoals hij zonder verschuiving zou zijn.
 * In de tekenlaag zit die informatie niet, en daar is het ook niet nodig.
 *
 * @returns {{dxMin, dxMax, dyMin, dyMax}|null} millimeters, of null als dit
 *   element vrij mag staan
 */
function grenzenVan (node, laag) {
  // Let op de expliciete null-controle: Number(null) is nul, en zonder dit zou
  // elk element geklemd worden op een marge van nul. Dan schuift een plaatsnaam
  // die net buiten de pagina hangt naar binnen, en het inzetkaartje van dag 8
  // dat daar bewust weggeparkeerd staat ook.
  const attr = node.getAttribute(BINNENMARGE)
  if (attr === null || isSvg(node) || !node.offsetParent) return null

  const marge = Number(attr)
  if (!Number.isFinite(marge)) return null

  const stijl = getComputedStyle(node)
  const mmPx = parseFloat(stijl.getPropertyValue('--mm')) || 1
  const s = parseFloat(stijl.getPropertyValue('--s')) || 1

  // Schalen draait om het midden, dus wat er aan maat bijkomt steekt half naar
  // links en half naar rechts uit.
  const kaalBreedte = node.offsetWidth / mmPx
  const kaalHoogte = node.offsetHeight / mmPx
  const breedte = kaalBreedte * s
  const hoogte = kaalHoogte * s
  const links = node.offsetLeft / mmPx - (breedte - kaalBreedte) / 2
  const boven = node.offsetTop / mmPx - (hoogte - kaalHoogte) / 2

  // Past het element niet tussen de marges, dan wint de bovenrand: liever
  // bovenaan afgekapt dan onderaan van de pagina af.
  const paar = (start, maat, totaal) => {
    const min = marge - start
    const max = totaal - marge - maat - start
    return max < min ? [min, min] : [min, max]
  }

  const [dxMin, dxMax] = paar(links, breedte, laag.clientWidth / mmPx)
  const [dyMin, dyMax] = paar(boven, hoogte, laag.clientHeight / mmPx)
  return { dxMin, dxMax, dyMin, dyMax }
}

const klemIn = (waarde, min, max) => Math.min(max, Math.max(min, waarde))

/** Onder deze maat wordt tekst in de druk lastig leesbaar; zie build.js. */
const KLEINSTE_TEKST_MM = 1.8

/**
 * De tekst binnen zijn vak houden door de letter te laten krimpen.
 *
 * Maak je het vak kleiner dan wat erin past, dan moet er iets wijken. Tekst
 * eronderuit laten lopen is het slechtste van de drie mogelijkheden: hij komt
 * dan over de stempels en de bronvermelding heen te staan en je ziet pas op de
 * drukproef dat het misging. Afkappen is nog erger, want dan verdwijnt er
 * stilletjes een stuk van je dagverhaal.
 *
 * Dus krimpt de letter, net als de autofit van een presentatieprogramma: alles
 * blijft leesbaar en alles blijft er. Tot 1,8 millimeter, want daaronder klaagt
 * de drukcontrole terecht - wordt het vak nóg kleiner, dan is overflow: hidden
 * in het stijlblad de laatste stop.
 *
 * Krimpen gebeurt alleen als het nodig is. Past de tekst gewoon, dan blijft het
 * corps precies wat de instelling zegt.
 */
function pasTekstInVak (node, mmPx) {
  if (!node.clientHeight) return

  const basis = parseFloat(getComputedStyle(node).fontSize)
  if (!basis) return

  // Let op de breedte, niet alleen de hoogte.
  //
  // Dit vak staat in kolommen, en dan loopt te veel tekst niet naar beneden maar
  // opzij: de browser maakt er gewoon een kolom bij, buiten het vak. De hoogte
  // blijft dan keurig kloppen terwijl er een halve alinea naast staat. Alleen op
  // scrollHeight letten liet het daardoor stil misgaan.
  const past = () =>
    node.scrollHeight <= node.clientHeight + 1 &&
    node.scrollWidth <= node.clientWidth + 1

  // Het aanwijskadertje telt mee in die maten - het ligt een paar pixels buiten
  // het element - en dan past de tekst per definitie nooit. Dus even weg.
  node.classList.add('meten')
  try {
    if (past()) return

    let laag = KLEINSTE_TEKST_MM * mmPx
    let hoog = basis

    // Halveren in plaats van stapje voor stapje: elke poging kost een
    // herberekening van de opmaak, en tien halveringen zijn nauwkeuriger dan
    // dertig stapjes.
    for (let i = 0; i < 12 && hoog - laag > 0.1; i++) {
      const midden = (laag + hoog) / 2
      node.style.fontSize = `${midden}px`
      if (past()) laag = midden
      else hoog = midden
    }
    node.style.fontSize = `${laag}px`
  } finally {
    node.classList.remove('meten')
  }
}

/**
 * Zet de bewaarde verschuivingen en schalen op de elementen.
 * De opmaakcode hoeft hier niets van te weten: die tekent gewoon op de
 * standaardplek, en dit legt de correctie eroverheen.
 */
export function pasPlaatsingToe (laag, plaatsing) {
  // De tekstvakken die nog moeten krimpen, om ze in één keer af te handelen
  // nadat alle maten staan. Meten dwingt de browser tot herberekenen, en dat
  // wil je niet halverwege het zetten van de rest.
  const krimpers = []

  for (const node of laag.querySelectorAll(`[${SLEEP}]`)) {
    const id = node.getAttribute(SLEEP)
    const p = plaatsing?.[id]

    // De schaal eerst, want de grenzen hieronder meten mee hoe groot het
    // element met die schaal wordt.
    //
    // Onderdelen die op hun eigen maat hertekend worden krijgen geen
    // beeldschaal: een schaalbalk die je uitrekt liegt over zijn kilometers,
    // en een uitgerekt inzetkaartje wordt wazig in de export. Die lezen hun
    // schaal uit de plaatsing en bouwen zichzelf opnieuw op.
    // Een tekstvak wordt niet geschaald maar verruimd: de doos verandert van
    // maat en de tekst herwikkelt zich erin, zoals in een presentatieprogramma.
    // De letter blijft dus even groot, en dat is precies het verschil - schalen
    // maakt de letter mee groot en dan klopt de typografie van de pagina niet
    // meer.
    const soort = node.getAttribute(SCHAAL)
    if (soort === 'doos') {
      node.style.setProperty('--s', '1')
      if (Number.isFinite(p?.breedteMm)) node.style.width = alsLengte(node, p.breedteMm)
      if (Number.isFinite(p?.hoogteMm)) {
        node.style.height = alsLengte(node, p.hoogteMm)
        // pas nadat de hoogte staat, anders meet hij tegen het oude vak
        krimpers.push(node)
      }
    } else if (soort === 'hertekenen') {
      // Deze bouwen zichzelf al op de goede maat op, dus de transform hoort op
      // een te staan. Expliciet zetten en niet overslaan: na een voorbeeld
      // tijdens het slepen staat er anders nog een schaal van dat slepen op, en
      // dan is het onderdeel twee keer zo groot als het zou moeten zijn.
      node.style.setProperty('--s', '1')
    } else {
      node.style.setProperty('--s', String(p?.schaal ?? 1))
    }

    let dx = p?.dxMm ?? 0
    let dy = p?.dyMm ?? 0

    // Wat nooit tegen de rand mag, gaat er ook niet tegenaan staan doordat er
    // van eerder nog zo'n verschuiving bewaard is.
    const grenzen = grenzenVan(node, laag)
    if (grenzen) {
      dx = klemIn(dx, grenzen.dxMin, grenzen.dxMax)
      dy = klemIn(dy, grenzen.dyMin, grenzen.dyMax)
    }

    node.style.setProperty('--dx', alsLengte(node, round2(dx)))
    node.style.setProperty('--dy', alsLengte(node, round2(dy)))
  }

  if (krimpers.length) {
    const mmPx = parseFloat(getComputedStyle(laag).getPropertyValue('--mm')) || 1
    for (const node of krimpers) pasTekstInVak(node, mmPx)
  }
}

/** Zet alle verschuivingen en schalen van deze pagina terug op nul. */
export function resetPlaatsing (laag) {
  for (const node of laag.querySelectorAll(`[${SLEEP}]`)) {
    node.style.removeProperty('--dx')
    node.style.removeProperty('--dy')
    node.style.removeProperty('--s')
  }
}

/** De schaal die voor dit onderdeel bewaard is, of 1. */
export function schaalVan (plaatsing, id) {
  const s = plaatsing?.[id]?.schaal
  return Number.isFinite(s) && s > 0 ? s : 1
}

/**
 * Maakt de pagina bewerkbaar.
 *
 * @param {HTMLElement} pagina
 * @param {object} haken
 * @param {() => object} haken.huidigePlaatsing geeft het actuele verschuivingen-object
 * @param {(id: string, dxMm: number, dyMm: number) => void} haken.bijVerschuiven
 * @param {(id: string, schaal: number) => void} haken.bijSchalen
 * @param {(key: string, mm: number|null) => void} haken.bijStijlMaat een maat uit
 *   het schema verzetten; null betekent terug naar de standaard
 * @param {(id: string) => void} haken.bijWeghalen
 * @param {(id: string, tekst: string) => void} haken.bijTekst
 * @param {(groep: string|null, id: string) => void} haken.bijKlik
 * @param {(tekst: string) => void} haken.bijMelding
 */
export function maakBewerkbaar (pagina, {
  huidigePlaatsing,
  bijVerschuiven,
  bijSchalen,
  bijDoos,
  bijStijlMaat,
  bijWeghalen,
  bijTekst,
  bijKlik,
  bijMelding
}) {
  let bezig = null
  let schalen = null

  /** Hoeveel schermpixels een millimeter is, nu. */
  const mmInPx = () => parseFloat(getComputedStyle(pagina).getPropertyValue('--mm')) || 1

  // ------------------------------------------------------- hulplijnen en greep
  const maakHulp = klasse => {
    const n = document.createElement('div')
    n.className = klasse
    n.hidden = true
    pagina.append(n)
    return n
  }

  const lijnX = maakHulp('snaplijn snaplijn-x')
  const lijnY = maakHulp('snaplijn snaplijn-y')

  const greep = document.createElement('div')
  greep.className = 'schaalgreep'
  greep.hidden = true
  greep.title = 'slepen om te schalen of het vak te verruimen, dubbelklik zet hem terug'
  pagina.append(greep)

  let greepDoel = null

  /** Zet het greepje rechtsonder tegen dit element aan. */
  function toonGreep (node) {
    greepDoel = node
    if (!node) { greep.hidden = true; return }

    const p = pagina.getBoundingClientRect()
    const r = node.getBoundingClientRect()
    greep.style.left = `${r.right - p.left}px`
    greep.style.top = `${r.bottom - p.top}px`
    greep.hidden = false
  }

  pagina.addEventListener('pointerover', e => {
    if (bezig || schalen) return

    // Het greepje zelf telt niet als "je wijst iets anders aan". Zonder deze
    // regel verdween het op het moment dat je je muis erheen bewoog: het ligt
    // buiten het element waar het bij hoort, dus die beweging las als het
    // verlaten van dat element - en dan was er niets meer om vast te pakken.
    if (e.target === greep) return

    const node = e.target.closest?.(`[${SCHAAL}]`)
    if (node !== greepDoel) toonGreep(node ?? null)
  })

  pagina.addEventListener('pointerleave', () => {
    if (!bezig && !schalen) toonGreep(null)
  })

  // ------------------------------------------------------------------ schalen
  greep.addEventListener('pointerdown', e => {
    if (!greepDoel) return
    e.preventDefault()
    e.stopPropagation()

    const id = greepDoel.getAttribute(SLEEP)
    const r = greepDoel.getBoundingClientRect()
    const midX = r.left + r.width / 2
    const midY = r.top + r.height / 2
    const begin = Math.hypot(e.clientX - midX, e.clientY - midY)

    const stijlKey = greepDoel.getAttribute(STIJLMAAT)
    const soort = greepDoel.getAttribute(SCHAAL)
    const mmPx = mmInPx()

    schalen = {
      node: greepDoel,
      id,
      pointerId: e.pointerId,
      midX,
      midY,
      begin: begin || 1,
      beginSchaal: schaalVan(huidigePlaatsing(), id),
      hertekenen: soort === 'hertekenen',
      voorbeeld: greepDoel.hasAttribute(VOORBEELD),
      // Een tekstvak volgt de muis met zijn hoek in plaats van met een factor
      // vanaf zijn hart: je pakt de hoek van een doos vast en zet hem waar je
      // hem hebben wilt, en dan hoort die hoek onder je vinger te blijven.
      doos: soort === 'doos',
      muisX: e.clientX,
      muisY: e.clientY,
      beginBreedte: r.width / mmPx,
      beginHoogte: r.height / mmPx,
      laatsteDoos: null,
      // een maat uit het schema in plaats van een schaal op dit ene element
      stijlKey,
      beginMaat: stijlKey ? Number(greepDoel.getAttribute(STIJLNU)) : null,
      laatste: null
    }
    greep.setPointerCapture(e.pointerId)
  })

  greep.addEventListener('dblclick', e => {
    e.preventDefault()
    e.stopPropagation()
    if (!greepDoel) return

    const stijlKey = greepDoel.getAttribute(STIJLMAAT)
    if (greepDoel.getAttribute(SCHAAL) === 'doos') bijDoos?.(greepDoel.getAttribute(SLEEP), null)
    else if (stijlKey) bijStijlMaat?.(stijlKey, null)
    else bijSchalen?.(greepDoel.getAttribute(SLEEP), 1)
  })

  // ------------------------------------------------------------------ slepen
  pagina.addEventListener('pointerdown', e => {
    // tijdens het typen niet slepen
    if (e.target.isContentEditable) return

    const node = e.target.closest?.(`[${SLEEP}]`)
    if (!node) return

    const id = node.getAttribute(SLEEP)
    const start = huidigePlaatsing()?.[id] ?? { dxMm: 0, dyMm: 0 }
    const beginDx = start.dxMm ?? 0
    const beginDy = start.dyMm ?? 0

    const schaal = mmInPx()
    const paginaVak = pagina.getBoundingClientRect()
    const vak = node.getBoundingClientRect()

    // Waar het midden van dit element ligt als er niets verschoven was. De
    // snaplijnen rekenen daarvandaan, zodat "gecentreerd" ook echt gecentreerd
    // is en niet gecentreerd-plus-wat-er-al-stond.
    const kaalX = vak.left + vak.width / 2 - paginaVak.left - beginDx * schaal
    const kaalY = vak.top + vak.height / 2 - paginaVak.top - beginDy * schaal

    // De verschuiving die dit element op dezelfde hoogte zet als een ander.
    //
    // Hier live gemeten en niet in de opmaak uitgerekend: dan klopt het ook als
    // dat andere element zelf versleept, geschaald of tegen de marge geklemd is.
    // Wat je op het scherm ziet is waar het op snapt.
    let samenDy = null
    const samenMet = node.getAttribute(SNAPOP)
    if (samenMet) {
      const doel = pagina.querySelector(`[${SLEEP}="${samenMet}"]`)
      if (doel && doel !== node) {
        const dv = doel.getBoundingClientRect()
        samenDy = (dv.top + dv.height / 2 - paginaVak.top - kaalY) / schaal
      }
    }

    bezig = {
      node,
      id,
      pointerId: e.pointerId,
      muisX: e.clientX,
      muisY: e.clientY,
      beginDx,
      beginDy,
      versleept: false,
      // de verschuiving die dit element precies op het midden van de pagina zet
      middenDx: node.hasAttribute(MIDDEN) ? (paginaVak.width / 2 - kaalX) / schaal : null,
      middenDy: node.hasAttribute(MIDDEN) ? (paginaVak.height / 2 - kaalY) / schaal : null,
      samenDy,
      kaalYmm: kaalY / schaal,
      grenzen: grenzenVan(node, pagina)
    }

    // Hier bewust nog niets doen. Zowel preventDefault als setPointerCapture
    // breken de dubbelklik waarmee je de tekst aanpast: de eerste onderdrukt de
    // standaardafhandeling, de tweede vangt de muis af tussen de twee klikken
    // door. Beide gebeuren pas zodra er echt gesleept wordt.
  })

  /**
   * Trekt een waarde naar een snaplijn toe als hij dichtbij genoeg is.
   * Geeft de aangepaste waarde terug en of hij gepakt heeft.
   */
  function snap (waarde, lijnen, schaal) {
    for (const lijn of lijnen) {
      if (lijn === null || lijn === undefined) continue
      if (Math.abs(waarde - lijn) * schaal < SNAP_PX) return [lijn, true]
    }
    return [waarde, false]
  }

  pagina.addEventListener('pointermove', e => {
    // ---- schalen gaat voor: als je aan het greepje trekt sleep je niet
    if (schalen?.doos) {
      const mmPx = mmInPx()
      const breedte = Math.max(DOOS_MIN_MM,
        schalen.beginBreedte + (e.clientX - schalen.muisX) / mmPx)
      const hoogte = Math.max(DOOS_MIN_MM,
        schalen.beginHoogte + (e.clientY - schalen.muisY) / mmPx)

      schalen.laatsteDoos = { breedteMm: round2(breedte), hoogteMm: round2(hoogte) }
      schalen.node.style.width = alsLengte(schalen.node, schalen.laatsteDoos.breedteMm)
      schalen.node.style.height = alsLengte(schalen.node, schalen.laatsteDoos.hoogteMm)
      // meteen meekrimpen, zodat je onder je vinger ziet wat er gebeurt in
      // plaats van pas als je loslaat
      schalen.node.style.removeProperty('font-size')
      pasTekstInVak(schalen.node, mmPx)
      toonGreep(schalen.node)
      return
    }

    if (schalen) {
      const afstand = Math.hypot(e.clientX - schalen.midX, e.clientY - schalen.midY)
      const s = Math.min(SCHAAL_MAX, Math.max(SCHAAL_MIN,
        schalen.beginSchaal * (afstand / schalen.begin)))

      schalen.laatste = round2(s)

      if (schalen.stijlKey) {
        // alles van dezelfde soort meteen mee laten groeien, zodat je onder het
        // slepen al ziet dat het één maat voor allemaal is
        for (const n of pagina.querySelectorAll(`[${STIJLMAAT}="${schalen.stijlKey}"]`)) {
          n.style.setProperty('--s', String(schalen.laatste))
        }
      } else if (!schalen.hertekenen || schalen.voorbeeld) {
        // Onderdelen die zichzelf hertekenen bewegen normaal niet mee - dan
        // zouden we het inzetkaartje bij elke muisbeweging herbouwen. Met
        // data-voorbeeld erop mag het wel: dan is een transform tijdens het
        // slepen een eerlijk voorbeeld van wat er komt, en bij het loslaten
        // bouwt het onderdeel zich alsnog scherp op zijn nieuwe maat op.
        schalen.node.style.setProperty('--s', String(schalen.laatste))
      }
      toonGreep(schalen.node)
      return
    }

    if (!bezig) return

    const schaal = mmInPx()
    let dx = bezig.beginDx + (e.clientX - bezig.muisX) / schaal
    let dy = bezig.beginDy + (e.clientY - bezig.muisY) / schaal

    // pas vanaf een halve millimeter is het een sleep en geen klik
    if (Math.abs(dx - bezig.beginDx) > 0.5 || Math.abs(dy - bezig.beginDy) > 0.5) {
      if (!bezig.versleept) {
        bezig.versleept = true
        bezig.node.classList.add('sleept')
        // nu pas de muis vastpakken, zodat je buiten het element door kunt slepen
        bezig.node.setPointerCapture(bezig.pointerId)
      }
      // en voorkomen dat de browser er tekstselectie van maakt
      e.preventDefault()
    }
    if (!bezig.versleept) return

    // Met alt ingedrukt geen snapping: soms wil je er net naast.
    let pakX = false
    let pakY = false
    if (!e.altKey) {
      ;[dx, pakX] = snap(dx, [bezig.middenDx, 0], schaal)
      ;[dy, pakY] = snap(dy, [bezig.middenDy, bezig.samenDy, 0], schaal)
    }

    // en dan alsnog binnen de marge blijven, ook als een snaplijn eroverheen wees
    if (bezig.grenzen) {
      dx = klemIn(dx, bezig.grenzen.dxMin, bezig.grenzen.dxMax)
      dy = klemIn(dy, bezig.grenzen.dyMin, bezig.grenzen.dyMax)
    }

    lijnX.hidden = !(pakX && dx === bezig.middenDx)

    if (pakY && bezig.samenDy !== null && dy === bezig.samenDy) {
      // de hulplijn op de hoogte waar hij pakt, niet op het midden van de pagina
      lijnY.style.top = `${(bezig.kaalYmm + dy) * schaal}px`
      lijnY.hidden = false
    } else {
      lijnY.style.removeProperty('top')
      lijnY.hidden = !(pakY && dy === bezig.middenDy)
    }

    bezig.node.style.setProperty('--dx', alsLengte(bezig.node, round2(dx)))
    bezig.node.style.setProperty('--dy', alsLengte(bezig.node, round2(dy)))
    bezig.laatste = { dx, dy }
  })

  const stop = () => {
    if (schalen?.doos) {
      if (schalen.laatsteDoos) bijDoos?.(schalen.id, schalen.laatsteDoos)
      schalen = null
      return
    }

    if (schalen) {
      if (schalen.laatste !== null && schalen.laatste !== schalen.beginSchaal) {
        // Een maat uit het schema krijgt de nieuwe millimeters; de factor waarmee
        // je sleepte is alleen het rekenmiddel ernaartoe.
        if (schalen.stijlKey && Number.isFinite(schalen.beginMaat)) {
          bijStijlMaat?.(schalen.stijlKey, round2(schalen.beginMaat * schalen.laatste))
        } else {
          bijSchalen?.(schalen.id, schalen.laatste)
        }
      }
      schalen = null
      return
    }

    if (!bezig) return
    bezig.node.classList.remove('sleept')
    lijnX.hidden = true
    lijnY.hidden = true
    lijnY.style.removeProperty('top')

    if (bezig.versleept && bezig.laatste) {
      bijVerschuiven(bezig.id, round2(bezig.laatste.dx), round2(bezig.laatste.dy))
    } else {
      // geen sleep maar een klik: het paneel mag naar de bijbehorende knoppen
      bijKlik?.(bezig.node.getAttribute(KNOPPEN), bezig.id)
    }
    bezig = null
  }

  pagina.addEventListener('pointerup', stop)
  pagina.addEventListener('pointercancel', stop)

  // --------------------------------------------------------- iets weghalen
  //
  // Wat je aanwijst heeft het greepje, en dat is hier ook de selectie: wijs een
  // icoontje aan en haal het met Delete van de kaart. Via de stoppenlijst kan het
  // ook, maar daar staat een rij "(naamloos)" waarin je niet ziet welke je hebt.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return
    if (bezig || schalen) return

    // niet terwijl je in een tekst of een invulveld bezig bent
    const doel = e.target
    if (doel?.isContentEditable) return
    if (doel instanceof HTMLInputElement ||
        doel instanceof HTMLTextAreaElement ||
        doel instanceof HTMLSelectElement) return

    if (!greepDoel?.hasAttribute(WEGHAAL)) return

    e.preventDefault()
    bijWeghalen?.(greepDoel.getAttribute(SLEEP))
    toonGreep(null)
  })

  // ------------------------------------------------------- tekst aanpassen
  pagina.addEventListener('dblclick', e => {
    const node = e.target.closest?.(`[${TEKST}]`)
    if (!node) return

    const id = node.getAttribute(TEKST)
    const origineel = node.textContent

    node.contentEditable = 'plaintext-only'
    node.classList.add('bewerkt')
    node.focus()

    // de hele tekst selecteren, zodat je meteen kunt overtypen
    const bereik = document.createRange()
    bereik.selectNodeContents(node)
    const selectie = getSelection()
    selectie.removeAllRanges()
    selectie.addRange(bereik)

    const klaar = bewaren => {
      node.contentEditable = 'false'
      node.classList.remove('bewerkt')
      node.removeEventListener('blur', opBlur)
      node.removeEventListener('keydown', opToets)

      if (!bewaren) { node.textContent = origineel; return }
      if (node.textContent === origineel) return

      // Wat een lege tekst betekent, beslist de pagina zelf: een plaatsnaam
      // weghalen is een manier om hem even kwijt te willen, maar een dagverhaal
      // van duizend tekens weghalen is bijna altijd een misplaatste backspace.
      // Neemt hij de wijziging niet aan, dan zetten we de oude tekst terug.
      if (bijTekst(id, node.textContent) === false) node.textContent = origineel
    }

    const opBlur = () => klaar(true)
    const opToets = t => {
      if (t.key === 'Enter' && !t.shiftKey) { t.preventDefault(); node.blur() }
      if (t.key === 'Escape') { t.preventDefault(); klaar(false); node.blur() }
    }

    node.addEventListener('blur', opBlur)
    node.addEventListener('keydown', opToets)
  })
}
