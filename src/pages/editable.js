/**
 * Alles op de pagina verslepen en de teksten ter plekke aanpassen.
 *
 * Twee dingen die je met geen enkele instelling kunt oplossen: een plaatsnaam
 * die net over je route valt, en een titel die op deze ene dag beter rechtsonder
 * staat. Daarvoor moet je gewoon kunnen slepen.
 *
 * Verschuivingen worden als afwijking bewaard, niet als absolute positie. Zo
 * blijft de standaardopmaak leidend en verschuift jouw correctie netjes mee als
 * je later van paginaformaat wisselt.
 *
 * Werkt alleen in de bedieningspagina; bij het exporteren doet dit bestand niets.
 */

/** Elementen met deze eigenschap kun je verslepen. */
const SLEEP = 'data-plek'

/** Elementen met deze eigenschap kun je met dubbelklik aanpassen. */
const TEKST = 'data-tekst'

/**
 * Zet de bewaarde verschuivingen op de elementen.
 * De opmaakcode hoeft hier niets van te weten: die tekent gewoon op de
 * standaardplek, en dit legt de correctie eroverheen.
 */
export function pasPlaatsingToe (laag, plaatsing) {
  for (const node of laag.querySelectorAll(`[${SLEEP}]`)) {
    const id = node.getAttribute(SLEEP)
    const p = plaatsing?.[id]
    node.style.setProperty('--dx', `calc(${p?.dxMm ?? 0} * var(--mm))`)
    node.style.setProperty('--dy', `calc(${p?.dyMm ?? 0} * var(--mm))`)
  }
}

/**
 * Maakt de pagina bewerkbaar.
 *
 * @param {HTMLElement} pagina
 * @param {() => object} huidigePlaatsing geeft het actuele verschuivingen-object
 * @param {(id: string, dxMm: number, dyMm: number) => void} bijVerschuiven
 * @param {(id: string, tekst: string) => void} bijTekst
 */
export function maakBewerkbaar (pagina, { huidigePlaatsing, bijVerschuiven, bijTekst }) {
  let bezig = null

  /** Hoeveel schermpixels een millimeter is, nu. */
  const mmInPx = () => parseFloat(getComputedStyle(pagina).getPropertyValue('--mm')) || 1

  pagina.addEventListener('pointerdown', e => {
    // tijdens het typen niet slepen
    if (e.target.isContentEditable) return

    const node = e.target.closest(`[${SLEEP}]`)
    if (!node) return

    const id = node.getAttribute(SLEEP)
    const start = huidigePlaatsing()?.[id] ?? { dxMm: 0, dyMm: 0 }

    bezig = {
      node,
      id,
      pointerId: e.pointerId,
      muisX: e.clientX,
      muisY: e.clientY,
      beginDx: start.dxMm ?? 0,
      beginDy: start.dyMm ?? 0,
      versleept: false
    }

    // Hier bewust nog niets doen. Zowel preventDefault als setPointerCapture
    // breken de dubbelklik waarmee je de tekst aanpast: de eerste onderdrukt de
    // standaardafhandeling, de tweede vangt de muis af tussen de twee klikken
    // door. Beide gebeuren pas zodra er echt gesleept wordt.
  })

  pagina.addEventListener('pointermove', e => {
    if (!bezig) return

    const schaal = mmInPx()
    const dx = bezig.beginDx + (e.clientX - bezig.muisX) / schaal
    const dy = bezig.beginDy + (e.clientY - bezig.muisY) / schaal

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

    bezig.node.style.setProperty('--dx', `calc(${dx.toFixed(2)} * var(--mm))`)
    bezig.node.style.setProperty('--dy', `calc(${dy.toFixed(2)} * var(--mm))`)
    bezig.laatste = { dx, dy }
  })

  const stop = () => {
    if (!bezig) return
    bezig.node.classList.remove('sleept')

    if (bezig.versleept && bezig.laatste) {
      bijVerschuiven(bezig.id, round2(bezig.laatste.dx), round2(bezig.laatste.dy))
    }
    bezig = null
  }

  pagina.addEventListener('pointerup', stop)
  pagina.addEventListener('pointercancel', stop)

  // ------------------------------------------------------- tekst aanpassen
  pagina.addEventListener('dblclick', e => {
    const node = e.target.closest(`[${TEKST}]`)
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

      if (bewaren && node.textContent !== origineel) bijTekst(id, node.textContent)
      else node.textContent = bewaren ? node.textContent : origineel
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

const round2 = n => Math.round(n * 100) / 100

/** Zet alle verschuivingen van deze pagina terug op nul. */
export function resetPlaatsing (laag) {
  for (const node of laag.querySelectorAll(`[${SLEEP}]`)) {
    node.style.removeProperty('--dx')
    node.style.removeProperty('--dy')
  }
}
