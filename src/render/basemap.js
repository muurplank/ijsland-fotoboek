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
import { metersPerPixel as gronddekking, tileToLonLat, TILE_SIZE } from '../geo/tiles.js'

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

  const rgb = kleurKaart(grijs, dem.data, {
    zeeKleur: stijl['lagen.zeeKleur'],
    schaduwKleur: stijl['relief.schaduwKleur'],
    verbleking: stijl['lagen.verbleking'],
    ontzadiging: stijl['lagen.ontzadiging']
  })

  // waar de hoeken van het hoogteraster op de pagina belanden
  const linksboven = tileToLonLat(dem.originPx / TILE_SIZE, dem.originPy / TILE_SIZE, dem.z)
  const rechtsonder = tileToLonLat(
    (dem.originPx + dem.width) / TILE_SIZE,
    (dem.originPy + dem.height) / TILE_SIZE,
    dem.z
  )
  const a = view.project(linksboven.lon, linksboven.lat)
  const b = view.project(rechtsonder.lon, rechtsonder.lat)

  const breedteMm = b.x - a.x
  const hoogteMm = b.y - a.y

  // schaal alvast naar de drukmaat, zodat de browser alleen nog hoeft te plaatsen
  const doelBreedte = Math.max(1, Math.round((breedteMm / 25.4) * dpi))
  const doelHoogte = Math.max(1, Math.round((hoogteMm / 25.4) * dpi))

  const afbeelding = await sharp(rgb, {
    raw: { width: dem.width, height: dem.height, channels: 3 }
  })
    .resize(doelBreedte, doelHoogte, { kernel: 'lanczos3', fit: 'fill' })
    .blur(stijl['relief.zachtheid'] > 0 ? stijl['relief.zachtheid'] : false)
    .png({ compressionLevel: 6 })
    .toBuffer()

  return {
    png: afbeelding,
    xMm: a.x,
    yMm: a.y,
    breedteMm,
    hoogteMm,
    pixels: { breedte: doelBreedte, hoogte: doelHoogte }
  }
}
