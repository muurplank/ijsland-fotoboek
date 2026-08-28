/**
 * De export naar drukklare bestanden.
 *
 * Chromium gaat via Playwright naar dezelfde previewpagina die je zojuist op het
 * scherm bediende, maar dan op de drukmaat en zonder paneel, en levert de bytes
 * terug. Wat er daarna mee gebeurt is aan de aanroeper: `src/build.js` schrijft
 * ze naar `out/`, de server stuurt ze naar de knop in de preview zodat je zelf
 * kiest waar ze landen.
 *
 * Dit staat hier en niet in build.js omdat het anders twee keer zou bestaan, en
 * dan is het een kwestie van tijd voordat de knop iets anders oplevert dan de
 * opdrachtregel - en juist daar valt het pas op als het al gedrukt is.
 */

import { chromium } from 'playwright'
import sharp from 'sharp'

import { renderPlan } from './geo/print.js'
import { paginaMaat, voortgangMaat } from './render/layout.js'

/** Onder deze maten wordt het op papier onbetrouwbaar. */
export const KLEINSTE_TEKST_MM = 1.8
export const DUNSTE_LIJN_MM = 0.09

/**
 * Hoe de JPG geperst wordt.
 *
 * 95 is hoog genoeg om geen blokjes te zien op een vel van dertig centimeter, en
 * 4:4:4 laat de kleur op volle resolutie staan. Dat laatste is hier geen luxe:
 * bij de gebruikelijke 4:2:0 wordt de kleurinformatie gehalveerd, en juist een
 * dunne gekleurde routelijn op een grijzige kaart gaat daar zichtbaar van bloeden.
 */
const JPG = { quality: 95, chromaSubsampling: '4:4:4' }

/** Welke bladen er zijn; dezelfde namen als de tabs in het paneel. */
export const PAGINA_TYPES = ['voorblad', 'kaart', 'stats', 'overzicht', 'reiscijfers', 'voortgang']

/**
 * De maten van dit blad: hoe groot het op papier is, en hoeveel pixels dat wordt.
 *
 * Het voortgangsstrookje is paginabreed maar veel lager - geen bladzijde maar
 * iets wat je over een foto legt - en heeft daarom een eigen buitenmaat.
 */
export function exportMaten (stijl, paginaType) {
  const strookje = paginaType === 'voortgang'
  const maat = strookje ? voortgangMaat(stijl) : paginaMaat(stijl)

  // Doorzichtig is iets anders dan strookje. Het strookje heeft een eigen
  // buitenmaat; het voorblad is een gewone bladzijde die alleen geen vel onder
  // zich hoeft. Wat ze delen is dat er geen paginakleur achter komt en dat er
  // dus ook geen PDF van gemaakt wordt.
  const doorzichtig = strookje ||
    (paginaType === 'voorblad' && !!stijl['voorblad.doorzichtig'])

  const plan = renderPlan(
    {
      widthMm: stijl['pagina.breedteMm'],
      heightMm: strookje ? stijl['voortgang.hoogteMm'] : stijl['pagina.hoogteMm'],
      bleedMm: stijl['pagina.afloopMm']
    },
    stijl['pagina.dpi']
  )

  return { strookje, doorzichtig, maat, plan }
}

/** Loopt na of het bestand echt drukklaar is. */
export function controleer (stijl, plan, echteBreedte, echteHoogte) {
  const punten = []
  const zeg = (goed, tekst) => punten.push({ goed, tekst })

  zeg(echteBreedte === plan.widthPx && echteHoogte === plan.heightPx,
    `pixelmaat exact ${plan.widthPx} × ${plan.heightPx} (gekregen ${echteBreedte} × ${echteHoogte})`)

  zeg(stijl['pagina.dpi'] >= 300,
    `resolutie ${stijl['pagina.dpi']} dpi (drukkerijen vragen 300)`)

  zeg(stijl['pagina.afloopMm'] >= 3,
    `afloop ${stijl['pagina.afloopMm']} mm (3 mm is de norm)`)

  const teksten = [
    ['bronvermelding', stijl['bron.grootteMm']],
    ['labels', stijl['labels.grootteMm']],
    ['bekende plaatsen', stijl['labels.omgevingGrootteMm']],
    ['statistiek-labels', stijl['statistieken.labelMm']],
    ['veldnotitie', stijl['veldnotitie.grootteMm']]
  ]
  for (const [naam, mm] of teksten) {
    zeg(mm >= KLEINSTE_TEKST_MM, `${naam} ${mm} mm (onder ${KLEINSTE_TEKST_MM} mm wordt het lastig lezen)`)
  }

  const lijnen = [
    ['routelijn', stijl['route.dikteMm']],
    ['eerdere dagen', stijl['eerdere.dikteMm']],
    ['wegen', stijl['lagen.wegenDikteMm']],
    // de dunste lijn op het inzetkaartje is de hele reis, half zo dik als de dag
    ['inzetkaartje: hele reis', stijl['inzet.lijnMm'] * 0.5],
    // de vezels van het papier zijn met opzet haarfijn: die horen weg te vallen
    // waar de pers ze niet aankan, en zijn dus geen punt om over te klagen
    ['draadmodel', stijl['statistieken.draadmodelLijnMm']]
  ]
  for (const [naam, mm] of lijnen) {
    zeg(mm >= DUNSTE_LIJN_MM, `${naam} ${mm} mm dik (onder ${DUNSTE_LIJN_MM} mm valt het weg in de druk)`)
  }

  return punten
}

/**
 * Rendert één blad en geeft de bytes terug, als PNG of als JPG.
 *
 * @param {object} o
 * @param {string} o.basis      adres van de draaiende previewserver
 * @param {number} o.dag        welke dag
 * @param {string} o.paginaType kaart, stats, overzicht, reiscijfers of voortgang
 * @param {number|null} o.stopIndex tot welke stop het voortgangsstrookje gevuld is
 * @param {object} o.stijl      de instellingen waarop gerekend wordt
 * @param {string|null} o.stijlToken  waarmee de pagina diezelfde instellingen ophaalt
 * @param {'png'|'jpg'} o.formaat  waarin het beeld terugkomt
 * @param {boolean} o.pdf       ook een PDF maken
 * @param {(bericht: string) => void} o.melden
 */
export async function exporteer ({
  basis, dag, paginaType = 'kaart', stopIndex = null,
  stijl, stijlToken = null, formaat = 'png', pdf: wilPdf = true, melden = () => {}
}) {
  const { strookje, doorzichtig, maat, plan } = exportMaten(stijl, paginaType)

  // De pagina rekent zelf niet uit welke instellingen jij op het scherm had
  // staan; die krijgt hij via dit kaartje terug van de server. Zonder token
  // pakt hij gewoon wat er in de dagbestanden staat, en dat is precies wat de
  // opdrachtregel wil.
  const token = stijlToken ? `&stijlToken=${encodeURIComponent(stijlToken)}` : ''
  const totStop = stopIndex === null ? '' : `&stop=${stopIndex}`

  const browser = await chromium.launch()

  try {
    // ------------------------------------------------------------------ PNG
    melden('PNG renderen…')
    const png = await browser.newPage({
      viewport: { width: plan.viewportWidth, height: plan.viewportHeight },
      deviceScaleFactor: plan.deviceScaleFactor
    })

    const mmInCssPx = plan.viewportWidth / maat.breedteMm
    await png.goto(
      `${basis}/?export=png&pagina=${paginaType}&dag=${dag}&mm=${mmInCssPx}${totStop}${token}`,
      { waitUntil: 'load' }
    )
    await png.waitForFunction(() => window.klaarVoorExport === true, null, { timeout: 180000 })

    // omitBackground haalt het witte vel onder de pagina weg. Dat werkt alleen
    // omdat de exportstand ook body en werkblad kleurloos zet; een enkele
    // achtergrondkleur ergens in die stapel zou er alsnog doorheen komen.
    const plaat = await png.locator('#pagina').screenshot({ type: 'png', omitBackground: doorzichtig })
    const info = await sharp(plaat).metadata()
    await png.close()

    // ---------------------------------------------------------- png of jpg
    //
    // De schermafdruk is altijd een PNG, want dat is het enige waarin Chromium
    // exact levert wat er staat. Daarna pas persen, als je dat vraagt.
    //
    // Wat doorzichtig hoort te zijn kan niet mee: JPG kent geen doorzichtigheid,
    // en daar draait het voortgangsstrookje - en een doorzichtig voorblad - nou
    // juist om. Dat blijft dus een PNG, ook als je om een JPG vroeg, en dat
    // staat in wat er teruggaat zodat de knop het bestand niet alsnog .jpg
    // noemt.
    const alsJpg = formaat === 'jpg' && !doorzichtig
    const beeld = alsJpg
      // de dpi gaat als kop mee: fotoboekprogramma's zetten het vel dan meteen
      // op de goede maat in plaats van op de 72 dpi die ze anders aannemen
      ? await sharp(plaat).jpeg(JPG).withMetadata({ density: stijl['pagina.dpi'] }).toBuffer()
      : plaat

    // ------------------------------------------------------------------ PDF
    // In de PDF blijven route, pijltjes, markers en tekst vectoren. Daarvoor moet
    // een millimeter precies 96/25.4 css-pixels zijn, want zo rekent PDF ook.
    //
    // Alles wat doorzichtig hoort te zijn slaat dit over: een PDF kent geen
    // doorzichtige achtergrond die een fotoboekprogramma begrijpt, en juist
    // daar draait het strookje - en een doorzichtig voorblad - om.
    let pdf = null
    if (!doorzichtig && wilPdf) {
      melden('PDF renderen…')
      const pdfPagina = await browser.newPage()
      await pdfPagina.goto(
        `${basis}/?export=pdf&pagina=${paginaType}&dag=${dag}&mm=${96 / 25.4}${totStop}${token}`,
        { waitUntil: 'load' }
      )
      await pdfPagina.waitForFunction(() => window.klaarVoorExport === true, null, { timeout: 180000 })

      pdf = await pdfPagina.pdf({
        width: `${maat.breedteMm}mm`,
        height: `${maat.hoogteMm}mm`,
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        pageRanges: '1'
      })
      await pdfPagina.close()
    }

    return {
      beeld,
      formaat: alsJpg ? 'jpg' : 'png',
      mime: alsJpg ? 'image/jpeg' : 'image/png',
      pdf,
      plan,
      maat,
      strookje,
      controle: controleer(stijl, plan, info.width, info.height)
    }
  } finally {
    await browser.close()
  }
}
