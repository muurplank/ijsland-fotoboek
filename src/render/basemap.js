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
import { expandBounds } from '../geo/viewport.js'
import { metersPerPixel as gronddekking, tileToLonLat, TILE_SIZE } from '../geo/tiles.js'

/**
 * Waar een raster op de pagina belandt, gegeven waar het in de wereld ligt.
 * Zowel het relief als het satellietbeeld staat in Web Mercator, net als de
 * kaartuitsnede, dus dit is een simpele omrekening van de twee hoeken.
 */
function plaatsing (raster, view) {
  const linksboven = tileToLonLat(raster.originPx / TILE_SIZE, raster.originPy / TILE_SIZE, raster.z)
  const rechtsonder = tileToLonLat(
    (raster.originPx + raster.width) / TILE_SIZE,
    (raster.originPy + raster.height) / TILE_SIZE,
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

  const pijp = sharp(beeld.data, {
    raw: { width: beeld.width, height: beeld.height, channels: beeld.channels }
  })
    .removeAlpha()
    .modulate({ saturation: 1 - stijl['lagen.ontzadiging'] })
    .linear(1 - f, 255 * f)

  const uit = await naarPagina(pijp, plek, dpi, 0)
  return { ...uit, bronvermelding: 'Luchtfoto: Esri, Maxar, Earthstar Geographics' }
}

/**
 * Maakt de reliefachtergrond voor deze kaart.
 *
 * Geeft de afbeelding terug plus het rechthoekje in millimeters waar hij op de
 * pagina hoort te staan; de opmaak plaatst hem daar exact.
 */
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
 * De achtergrond voor de ingestelde kaartstijl.
 *
 * Waarschuwt als het hoogtemodel te grof is voor deze uitsnede: bij een dag die
 * maar een paar kilometer beslaat heeft relief geen detail meer, en is
 * satellietbeeld de betere keuze.
 */
export async function achtergrondVoorStijl ({ dem, view, stijl, dpi, onProgress }) {
  if (stijl['lagen.stijl'] === 'satelliet') {
    return satellietAchtergrond({ view, stijl, dpi, onProgress })
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
