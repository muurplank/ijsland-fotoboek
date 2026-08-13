/**
 * Rekent papiermaten om naar drukpixels.
 *
 * De hele opmaak is in millimeters gedefinieerd, want dat is wat er op papier
 * belandt. Dit bestand is de enige plek waar millimeters pixels worden.
 */

const MM_PER_INCH = 25.4

/** Grootste viewport die Chromium betrouwbaar in een keer rendert. */
const MAX_VIEWPORT = 16384

/** Millimeters naar pixels op de gegeven drukresolutie. */
export function outputPixels (mm, dpi) {
  return Math.round((mm * dpi) / MM_PER_INCH)
}

/**
 * Buitenmaat van een pagina, inclusief de afloop die aan alle vier de kanten
 * buiten de snijlijn valt.
 */
export function pageBox (page, dpi) {
  const totalWidthMm = page.widthMm + 2 * page.bleedMm
  const totalHeightMm = page.heightMm + 2 * page.bleedMm
  return {
    totalWidthMm,
    totalHeightMm,
    widthPx: outputPixels(totalWidthMm, dpi),
    heightPx: outputPixels(totalHeightMm, dpi)
  }
}

/**
 * Vertaalt een pagina naar browserinstellingen: hoe groot moet de viewport zijn,
 * met welke schaalfactor, en hoeveel css-pixels is een millimeter.
 *
 * Standaard is de viewport exact de drukmaat met schaalfactor 1, want dan kan er
 * per definitie geen afrondingsverschil ontstaan. Alleen als dat boven de
 * browserlimiet uitkomt wordt de viewport kleiner en de schaalfactor groter.
 */
export function renderPlan (page, dpi) {
  const box = pageBox(page, dpi)

  const longestPx = Math.max(box.widthPx, box.heightPx)
  const shrink = longestPx > MAX_VIEWPORT ? longestPx / MAX_VIEWPORT : 1

  const viewportWidth = Math.round(box.widthPx / shrink)
  const viewportHeight = Math.round(box.heightPx / shrink)

  return {
    ...box,
    viewportWidth,
    viewportHeight,
    deviceScaleFactor: box.widthPx / viewportWidth,
    cssPxPerMm: viewportWidth / box.totalWidthMm
  }
}
