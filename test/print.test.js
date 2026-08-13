import test from 'node:test'
import assert from 'node:assert/strict'
import { outputPixels, pageBox, renderPlan } from '../src/geo/print.js'

test('rekent millimeters om naar drukpixels op de gevraagde resolutie', () => {
  // 300 mm = 11,811 inch; op 600 dpi is dat 7086,6 pixels
  assert.equal(outputPixels(300, 600), 7087)
  assert.equal(outputPixels(300, 300), 3543)
  assert.equal(outputPixels(210, 300), 2480)
})

test('telt de afloop aan beide zijden mee in het paginaformaat', () => {
  const box = pageBox({ widthMm: 300, heightMm: 300, bleedMm: 3 }, 600)
  assert.equal(box.totalWidthMm, 306) // 300 + 3 links + 3 rechts
  assert.equal(box.totalHeightMm, 306)
  assert.equal(box.widthPx, outputPixels(306, 600))
})

test('zonder afloop is het totaalformaat gelijk aan het paginaformaat', () => {
  const box = pageBox({ widthMm: 300, heightMm: 300, bleedMm: 0 }, 600)
  assert.equal(box.totalWidthMm, 300)
  assert.equal(box.widthPx, 7087)
})

test('levert een renderplan waarvan viewport x schaalfactor exact de drukpixels geeft', () => {
  const plan = renderPlan({ widthMm: 300, heightMm: 300, bleedMm: 3 }, 600)

  // Playwright accepteert alleen hele pixels als viewport
  assert.ok(Number.isInteger(plan.viewportWidth), 'viewportbreedte moet heel zijn')
  assert.ok(Number.isInteger(plan.viewportHeight), 'viewporthoogte moet heel zijn')

  // en na vermenigvuldiging moet je exact op de drukmaat uitkomen
  assert.equal(Math.round(plan.viewportWidth * plan.deviceScaleFactor), plan.widthPx)
  assert.equal(Math.round(plan.viewportHeight * plan.deviceScaleFactor), plan.heightPx)
})

test('geeft een millimeter-in-css-pixels die de pagina precies vult', () => {
  // let op: bij sommige formaten (bv. 303 mm) rekent px/mm niet bit-exact terug in
  // floating point. De eis is dat er geen zichtbare afwijking ontstaat, niet dat de
  // floats identiek zijn - vandaar afronden.
  for (const widthMm of [300, 297, 210, 400]) {
    const plan = renderPlan({ widthMm, heightMm: widthMm, bleedMm: 3 }, 600)
    assert.equal(Math.round(plan.cssPxPerMm * (widthMm + 6)), plan.viewportWidth,
      `pagina vult viewport niet bij ${widthMm} mm`)
  }
})

test('schaalt de viewport terug als de drukmaat boven de browserlimiet komt', () => {
  // 300 mm op 1200 dpi = 14173 px; met afloop erbij komt dat boven wat Chromium
  // betrouwbaar in een viewport kan renderen
  const plan = renderPlan({ widthMm: 300, heightMm: 300, bleedMm: 3 }, 1200)
  assert.ok(plan.viewportWidth <= 16384, 'viewport moet binnen de browserlimiet blijven')
  assert.ok(plan.deviceScaleFactor >= 1)
  assert.equal(Math.round(plan.viewportWidth * plan.deviceScaleFactor), plan.widthPx)
})

test('houdt de drukmaat gelijk ongeacht welke viewport gekozen wordt', () => {
  for (const dpi of [300, 600, 1200]) {
    const plan = renderPlan({ widthMm: 300, heightMm: 300, bleedMm: 3 }, dpi)
    assert.equal(plan.widthPx, outputPixels(306, dpi), `fout bij ${dpi} dpi`)
  }
})
