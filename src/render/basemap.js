/**
 * De achtergrond van de kaart als afbeelding: het schaduwrelief, in de kleuren
 * van een licht thema.
 *
 * Het hoogteraster en de kaartuitsnede staan allebei in Web Mercator, dus het
 * enige wat er hoeft te gebeuren is uitsnijden en schalen. Dat doet sharp met
 * een net resamplingfilter; de browser hoeft de afbeelding daarna alleen nog op
 * de juiste plek te zetten.
 */

import sharp from 'sharp'
import { hillshade } from './hillshade.js'
import { kleurKaart } from './colorize.js'
import { kleurTerrein } from './terrain.js'
import { fetchImagery } from '../fetch/imagery.js'
import { fetchMapboxKaart } from '../fetch/mapbox.js'
import { behandelSchilden, tilTekstOp } from './shields.js'
import { expandBounds } from '../geo/viewport.js'
import { lonLatToTile, metersPerPixel as gronddekking, tileToLonLat, TILE_SIZE } from '../geo/tiles.js'

/**
 * Waar een raster op de pagina belandt, gegeven waar het in de wereld ligt.
 * Zowel het relief als het satellietbeeld staat in Web Mercator, net als de
 * kaartuitsnede, dus dit is een simpele omrekening van de twee hoeken.
 */
function plaatsing (raster, view) {
  // Bij dubbele resolutie zijn de beeldpixels half zo groot als de tegelpixels.
  // Zonder deze deling zou de achtergrond twee keer zo groot geplaatst worden.
  const schaal = raster.schaal ?? 1

  const linksboven = tileToLonLat(raster.originPx / TILE_SIZE, raster.originPy / TILE_SIZE, raster.z)
  const rechtsonder = tileToLonLat(
    (raster.originPx + raster.width / schaal) / TILE_SIZE,
    (raster.originPy + raster.height / schaal) / TILE_SIZE,
    raster.z
  )
  const a = view.project(linksboven.lon, linksboven.lat)
  const b = view.project(rechtsonder.lon, rechtsonder.lat)
  return { xMm: a.x, yMm: a.y, breedteMm: b.x - a.x, hoogteMm: b.y - a.y }
}

/**
 * De hoogtetrap uit de instellingen: welke kleur hoort bij welke hoogte.
 * De hoogtes worden oplopend gehouden, zodat door elkaar gezette schuifjes geen
 * onzin opleveren.
 */
function hoogteTrap (stijl) {
  const punten = [
    { m: 0, kleur: stijl['terrein.kust'] },
    { m: stijl['terrein.laagM'], kleur: stijl['terrein.laag'] },
    { m: stijl['terrein.middenM'], kleur: stijl['terrein.midden'] },
    { m: stijl['terrein.hoogM'], kleur: stijl['terrein.hoog'] },
    { m: stijl['terrein.topM'], kleur: stijl['terrein.top'] }
  ]

  let vorige = -Infinity
  return punten.map(p => {
    const m = Math.max(p.m, vorige + 1)
    vorige = m
    return { m, kleur: p.kleur }
  })
}

/** Schaalt een raster naar de drukmaat en maakt er een PNG van. */
async function naarPagina (pijp, plek, dpi, zachtheid = 0) {
  const doelBreedte = Math.max(1, Math.round((plek.breedteMm / 25.4) * dpi))
  const doelHoogte = Math.max(1, Math.round((plek.hoogteMm / 25.4) * dpi))

  const png = await pijp
    .resize(doelBreedte, doelHoogte, { kernel: 'lanczos3', fit: 'fill' })
    .blur(zachtheid > 0 ? zachtheid : false)
    .png({ compressionLevel: 6 })
    .toBuffer()

  return { png, ...plek, pixels: { breedte: doelBreedte, hoogte: doelHoogte } }
}

/**
 * Satellietbeeld als achtergrond, licht verbleekt en ontzadigd zodat de
 * routelijn ervoor knalt en het niet vloekt met je eigen foto's.
 */
export async function satellietAchtergrond ({ view, stijl, dpi, onProgress }) {
  const zicht = expandBounds(view.visibleBounds(), 0.04)
  const doel = view.metersPerMm() / (dpi / 25.4)

  const beeld = await fetchImagery(zicht, { metersPerPixel: doel, onProgress })
  const plek = plaatsing(beeld, view)

  // Verbleken naar het wit van het papier is per pixel: uit = in * (1-f) + 255 * f.
  //
  // Bewust géén witte laag eroverheen samenvoegen: sharp voert resize altijd uit
  // voor composite, ongeacht de volgorde waarin je ze aanroept. De witte laag zou
  // dan groter zijn dan het inmiddels geschaalde beeld, en dat weigert sharp.
  const f = stijl['lagen.verbleking']
  const bleekDoel = verbleekDoel(stijl)

  const pijp = sharp(beeld.data, {
    raw: { width: beeld.width, height: beeld.height, channels: beeld.channels }
  })
    .removeAlpha()
    .modulate({ saturation: 1 - stijl['lagen.ontzadiging'] })
    .linear([1 - f, 1 - f, 1 - f], bleekDoel.map(k => k * f))

  const uit = await naarPagina(pijp, plek, dpi, 0)
  return { ...uit, bronvermelding: 'Luchtfoto: Esri, Maxar, Earthstar Geographics' }
}

/**
 * Maakt de reliefachtergrond voor deze kaart.
 *
 * Geeft de afbeelding terug plus het rechthoekje in millimeters waar hij op de
 * pagina hoort te staan; de opmaak plaatst hem daar exact.
 */
/**
 * Waar het verbleken naartoe trekt, als drie kanaalwaarden.
 *
 * Stond hier eerst hard op wit. Dat is prima voor een gewone kaart, maar niet
 * voor een boek dat op oud papier gedrukt lijkt: een kaart die naar zuiver wit
 * verbleekt houdt zijn koele grijzen en blijft zichtbaar van een ander vel dan
 * de bladzijde eromheen. Naar de papierkleur verbleken haalt dat verschil weg -
 * de kaart en het papier komen dan uit dezelfde inktbak.
 *
 * Standaard #ffffff, dus voor wie er niet aan draait verandert er niets.
 */
function verbleekDoel (stijl) {
  const hex = stijl['lagen.verbleekNaar'] ?? '#ffffff'
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
}

export async function reliefAchtergrond ({ dem, view, stijl, dpi }) {
  const midden = tileToLonLat(
    (dem.originPx + dem.width / 2) / TILE_SIZE,
    (dem.originPy + dem.height / 2) / TILE_SIZE,
    dem.z
  )

  const grijs = hillshade(dem, {
    metersPerPixel: gronddekking(midden.lat, dem.z),
    azimuth: stijl['relief.zonRichting'],
    altitude: stijl['relief.zonHoogte'],
    exaggeration: stijl['relief.overdrijving'],
    contrast: stijl['relief.contrast']
  })

  const rgb = stijl['lagen.stijl'] === 'terrein'
    ? kleurTerrein(grijs, dem.data, {
        zeeKleur: stijl['lagen.zeeKleur'],
        trap: hoogteTrap(stijl),
        // wat het schaduwrelief op kaarsvlak land oplevert; daar draait de
        // schaduw omheen, zodat vlak land precies zijn hoogtekleur houdt
        vlakkeHelderheid: Math.cos((90 - stijl['relief.zonHoogte']) * Math.PI / 180) * 255,
        verbleking: stijl['lagen.verbleking'],
        ontzadiging: stijl['lagen.ontzadiging']
      })
    : kleurKaart(grijs, dem.data, {
        zeeKleur: stijl['lagen.zeeKleur'],
        schaduwKleur: stijl['relief.schaduwKleur'],
        verbleking: stijl['lagen.verbleking'],
        ontzadiging: stijl['lagen.ontzadiging']
      })

  const plek = plaatsing(dem, view)
  const pijp = sharp(rgb, { raw: { width: dem.width, height: dem.height, channels: 3 } })

  const uit = await naarPagina(pijp, plek, dpi, stijl['relief.zachtheid'])
  return { ...uit, bronvermelding: 'Hoogtegegevens: Terrain Tiles' }
}

/**
 * Een kant-en-klare Mapbox-stijl als achtergrond.
 *
 * Het beeld gaat door dezelfde behandeling als de andere stijlen - ontzadigen
 * en naar het wit van het papier toe verbleken - zodat het bij de rest van het
 * boek past en je routelijn ervoor knalt.
 */
export async function mapboxAchtergrond ({ view, stijl, dpi, mapboxStijl, route, onProgress }) {
  const zicht = expandBounds(view.visibleBounds(), 0.04)
  const mPerMm = view.metersPerMm()

  // Hun plaatsnamen zitten met een vaste pixelgrootte in het beeld (ongeveer 14
  // pixels hoog). Zouden we het zoomniveau kiezen op de drukresolutie, dan werd
  // die tekst op 600 dpi nog geen millimeter hoog en dus onleesbaar. Daarom
  // bepaalt de gewenste tekstgrootte op papier welk niveau we ophalen, en wordt
  // het beeld daarna opgeschaald naar de drukmaat.
  const LABEL_PX = 14
  const doel = (mPerMm * stijl['lagen.mapboxLabelMm']) / LABEL_PX

  const beeld = await fetchMapboxKaart(zicht, { stijl: mapboxStijl, metersPerPixel: doel, onProgress })

  // De witte wegnummer-badges die onder de route vallen zeggen niets - die weg
  // volg je juist - en ze ogen rommelig. Ze worden weggepoetst of juist
  // uitgeknipt om over de routelijn heen te leggen.
  let bovenlaag = null
  if (route?.length) {
    const inPixels = routeInRaster(route, beeld, view)

    // hoe breed de routelijn in dit raster is: millimeters op papier maal het
    // aantal rasterpixels dat op een millimeter gaat
    const rasterPxPerMm = mPerMm / beeld.metersPerPixel
    const breedteMm = stijl['route.dikteMm'] + 2 * stijl['route.buitenExtraMm']
    const dikteInPixels = Math.max(6, (breedteMm * rasterPxPerMm) / 2 + 4)

    const raster = { ...beeld, kanalen: beeld.channels }

    // Wegnummers weg: die weg volg je nu juist, dus het nummer zegt niets.
    if (stijl['lagen.badgesWeg']) {
      const uit = behandelSchilden(raster, inPixels, { wat: 'wissen', lijnDikte: dikteInPixels })
      if (uit.aantal) onProgress?.(`${uit.aantal} wegnummer(s) onder de route weggehaald`)
    }

    // Plaatsnamen juist optillen: die wil je lezen, dus die horen boven de lijn.
    if (stijl['lagen.tekstBoven']) {
      const uit = tilTekstOp(raster, inPixels, {
        lijnDikte: dikteInPixels,
        alles: true,
        hertint: stijl['lagen.tekstKleur']
      })
      if (uit.aantal) onProgress?.(`${uit.aantal} plaatsnaam/namen boven de route getild`)
      bovenlaag = uit.laag
    }
  }

  const opschaling = beeld.metersPerPixel / (mPerMm / (dpi / 25.4))
  if (opschaling > 3) {
    onProgress?.(
      `achtergrond wordt ${opschaling.toFixed(1)}x opgeschaald en dus zacht; ` +
      'zet "Mapbox: tekstgrootte" lager voor een scherpere kaart met kleinere plaatsnamen'
    )
  }
  const plek = plaatsing(beeld, view)

  // Verbleken trekt naar wit (a<1, b>0), verdonkeren naar zwart (a<1, b=0).
  // Ze staan als aparte knoppen omdat ze allebei bruikbaar zijn, maar ze werken
  // op dezelfde lineaire schaling en horen elkaar dus niet tegen te werken.
  const f = stijl['lagen.verbleking']
  const d = stijl['lagen.verdonkering'] ?? 0
  const bleekDoel = verbleekDoel(stijl)

  const pijp = sharp(beeld.data, {
    raw: { width: beeld.width, height: beeld.height, channels: beeld.channels }
  })
    .removeAlpha()
    .modulate({ saturation: 1 - stijl['lagen.ontzadiging'] })
    .linear(
      [0, 1, 2].map(() => (1 - f) * (1 - d)),
      bleekDoel.map(k => k * f * (1 - d))
    )

  const uit = await naarPagina(pijp, plek, dpi, 0)

  // de opgetilde badges als losse doorzichtige laag, om boven de route te leggen
  let bovenPng = null
  if (bovenlaag) {
    bovenPng = await sharp(bovenlaag, {
      raw: { width: beeld.width, height: beeld.height, channels: 4 }
    })
      .resize(uit.pixels.breedte, uit.pixels.hoogte, { kernel: 'lanczos3', fit: 'fill' })
      .png({ compressionLevel: 9 })
      .toBuffer()
  }

  return { ...uit, bovenPng, bronvermelding: '© Mapbox, © OpenStreetMap' }
}

/** De route omgerekend naar pixels binnen dit achtergrondraster. */
function routeInRaster (route, raster, view) {
  const schaal = raster.schaal ?? 1
  return route.map(([lon, lat]) => {
    const t = lonLatToTile(lon, lat, raster.z)
    return {
      x: (t.x * TILE_SIZE - raster.originPx) * schaal,
      y: (t.y * TILE_SIZE - raster.originPy) * schaal
    }
  })
}

/**
 * De achtergrond voor de ingestelde kaartstijl.
 *
 * Waarschuwt als het hoogtemodel te grof is voor deze uitsnede: bij een dag die
 * maar een paar kilometer beslaat heeft relief geen detail meer, en is
 * satellietbeeld de betere keuze.
 */
export async function achtergrondVoorStijl ({ dem, view, stijl, dpi, route, onProgress }) {
  const gekozen = stijl['lagen.stijl']

  if (gekozen === 'satelliet') {
    return satellietAchtergrond({ view, stijl, dpi, onProgress })
  }

  if (gekozen.startsWith('mapbox-')) {
    return mapboxAchtergrond({
      view, stijl, dpi, route, onProgress,
      mapboxStijl: gekozen.slice('mapbox-'.length)
    })
  }

  const nodigPerPixel = view.metersPerMm() / (dpi / 25.4)
  const kanBron = gronddekking(
    tileToLonLat((dem.originPx + dem.width / 2) / TILE_SIZE, (dem.originPy + dem.height / 2) / TILE_SIZE, dem.z).lat,
    dem.z
  )
  if (kanBron > nodigPerPixel * 3) {
    onProgress?.(
      `het hoogtemodel is ${Math.round(kanBron / nodigPerPixel)}x te grof voor deze uitsnede; ` +
      'satellietbeeld geeft hier een veel scherper resultaat'
    )
  }

  return reliefAchtergrond({ dem, view, stijl, dpi })
}
