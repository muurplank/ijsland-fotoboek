/**
 * Het hoogtemodel.
 *
 * De hoogtes komen binnen als gewone plaatjes waarin de kleur de hoogte codeert
 * (het "terrarium"-formaat). Uit dezelfde gegevens komen straks zowel het
 * hoogteprofiel van de dag als het schaduwrelief van de kaart.
 *
 * Let op: de veelgebruikte SRTM-data stopt bij 60 graden noorderbreedte en dekt
 * IJsland dus niet. Deze bron wel.
 */

import { lonLatToTile, TILE_SIZE } from './tiles.js'

/** Zet een pixelkleur om in meters boven zeeniveau. */
export function decodeTerrarium (r, g, b) {
  return r * 256 + g + b / 256 - 32768
}

/**
 * Een aaneengesloten lap hoogtegegevens over een gebied, opgebouwd uit tegels.
 * Vraagt op elke coordinaat de hoogte op, met vloeiende overgang tussen de
 * meetpunten zodat het relief geen trapjes vertoont.
 */
export class DemGrid {
  constructor ({ data, width, height, z, originTileX, originTileY }) {
    this.data = data
    this.width = width
    this.height = height
    this.z = z
    // pixelpositie van de linkerbovenhoek binnen het wereldwijde raster
    this.originPx = originTileX * TILE_SIZE
    this.originPy = originTileY * TILE_SIZE
  }

  /** Hoogte in meters, of null als de coordinaat buiten het opgehaalde gebied valt. */
  elevationAt (lon, lat) {
    const t = lonLatToTile(lon, lat, this.z)
    const px = t.x * TILE_SIZE - this.originPx - 0.5
    const py = t.y * TILE_SIZE - this.originPy - 0.5

    if (px < -0.5 || py < -0.5 || px > this.width - 0.5 || py > this.height - 0.5) return null

    // vier omliggende meetpunten, geklemd op de rand zodat de laatste pixel meedoet
    const x0 = Math.max(0, Math.min(this.width - 1, Math.floor(px)))
    const y0 = Math.max(0, Math.min(this.height - 1, Math.floor(py)))
    const x1 = Math.min(this.width - 1, x0 + 1)
    const y1 = Math.min(this.height - 1, y0 + 1)

    const fx = Math.max(0, Math.min(1, px - x0))
    const fy = Math.max(0, Math.min(1, py - y0))

    const d = this.data
    const w = this.width
    const boven = d[y0 * w + x0] * (1 - fx) + d[y0 * w + x1] * fx
    const onder = d[y1 * w + x0] * (1 - fx) + d[y1 * w + x1] * fx
    return boven * (1 - fy) + onder * fy
  }

  /** De hoogtes op een reeks coordinaten, in dezelfde volgorde. */
  profile (coords) {
    return coords.map(([lon, lat]) => this.elevationAt(lon, lat))
  }
}
