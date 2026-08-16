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

/** Naar welke groep in het paneel dit element verwijst. */
const KNOPPEN = 'data-knoppen'

/** Binnen zoveel schermpixels pakt een snaplijn. */
const SNAP_PX = 7

/** Grenzen aan het schalen: kleiner wordt onzichtbaar, groter is nooit bedoeld. */
const SCHAAL_MIN = 0.25
const SCHAAL_MAX = 4

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
 * Zet de bewaarde verschuivingen en schalen op de elementen.
 * De opmaakcode hoeft hier niets van te weten: die tekent gewoon op de
 * standaardplek, en dit legt de correctie eroverheen.
 */
export function pasPlaatsingToe (laag, plaatsing) {
  for (const node of laag.querySelectorAll(`[${SLEEP}]`)) {
    const id = node.getAttribute(SLEEP)
    const p = plaatsing?.[id]

    node.style.setProperty('--dx', alsLengte(node, p?.dxMm ?? 0))
    node.style.setProperty('--dy', alsLengte(node, p?.dyMm ?? 0))

    // Onderdelen die op hun eigen maat hertekend worden krijgen geen
    // beeldschaal: een schaalbalk die je uitrekt liegt over zijn kilometers,
    // en een uitgerekt inzetkaartje wordt wazig in de export. Die lezen hun
    // schaal uit de plaatsing en bouwen zichzelf opnieuw op.
    if (node.getAttribute(SCHAAL) === 'hertekenen') continue
    node.style.setProperty('--s', String(p?.schaal ?? 1))
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
 * @param {(id: string, tekst: string) => void} haken.bijTekst
 * @param {(groep: string|null, id: string) => void} haken.bijKlik
 * @param {(tekst: string) => void} haken.bijMelding
 */
export function maakBewerkbaar (pagina, {
  huidigePlaatsing,
  bijVerschuiven,
  bijSchalen,
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
  greep.title = 'slepen om te schalen, dubbelklik zet hem terug'
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

    schalen = {
      node: greepDoel,
      id,
      pointerId: e.pointerId,
      midX,
      midY,
      begin: begin || 1,
      beginSchaal: schaalVan(huidigePlaatsing(), id),
      hertekenen: greepDoel.getAttribute(SCHAAL) === 'hertekenen',
      laatste: null
    }
    greep.setPointerCapture(e.pointerId)
  })

  greep.addEventListener('dblclick', e => {
    e.preventDefault()
    e.stopPropagation()
    if (!greepDoel) return
    bijSchalen?.(greepDoel.getAttribute(SLEEP), 1)
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
      middenDy: node.hasAttribute(MIDDEN) ? (paginaVak.height / 2 - kaalY) / schaal : null
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
    if (schalen) {
      const afstand = Math.hypot(e.clientX - schalen.midX, e.clientY - schalen.midY)
      const s = Math.min(SCHAAL_MAX, Math.max(SCHAAL_MIN,
        schalen.beginSchaal * (afstand / schalen.begin)))

      schalen.laatste = round2(s)
      // onderdelen die zichzelf hertekenen kunnen niet live meebewegen; die
      // wachten tot je loslaat, anders herbouwen we het inzetkaartje bij elke
      // muisbeweging
      if (!schalen.hertekenen) schalen.node.style.setProperty('--s', String(schalen.laatste))
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
      ;[dy, pakY] = snap(dy, [bezig.middenDy, 0], schaal)
    }

    lijnX.hidden = !(pakX && dx === bezig.middenDx)
    lijnY.hidden = !(pakY && dy === bezig.middenDy)

    bezig.node.style.setProperty('--dx', alsLengte(bezig.node, round2(dx)))
    bezig.node.style.setProperty('--dy', alsLengte(bezig.node, round2(dy)))
    bezig.laatste = { dx, dy }
  })

  const stop = () => {
    if (schalen) {
      if (schalen.laatste !== null && schalen.laatste !== schalen.beginSchaal) {
        bijSchalen?.(schalen.id, schalen.laatste)
      }
      schalen = null
      return
    }

    if (!bezig) return
    bezig.node.classList.remove('sleept')
    lijnX.hidden = true
    lijnY.hidden = true

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
