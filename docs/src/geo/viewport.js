/**
 * De kaartuitsnede: welk stuk IJsland staat er in beeld, en waar op de pagina
 * belandt een coordinaat.
 *
 * Alles wat hier uitkomt is in millimeters op papier. De rest van de opmaak
 * rekent nergens meer met pixels, zodat het ontwerp niet verandert als je van
 * resolutie of paginaformaat wisselt.
 */

const rad = deg => (deg * Math.PI) / 180

/** Web Mercator, genormaliseerd naar een vierkant van 0 tot 1. */
function toWorld (lon, lat) {
  return {
    x: (lon + 180) / 360,
    y: (1 - Math.asinh(Math.tan(rad(lat))) / Math.PI) / 2
  }
}

function fromWorld (x, y) {
  return {
    lon: x * 360 - 180,
    lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * (180 / Math.PI)
  }
}

/** Het kleinste vak dat alle punten omsluit. */
export function boundsOf (coords) {
  let west = Infinity; let east = -Infinity
  let south = Infinity; let north = -Infinity

  for (const [lon, lat] of coords) {
    if (lon < west) west = lon
    if (lon > east) east = lon
    if (lat < south) south = lat
    if (lat > north) north = lat
  }

  // een enkel punt of een kaarsrechte lijn levert een vak zonder inhoud op;
  // geef dat een klein beetje ruimte zodat er iets te tonen valt
  const marge = 0.01
  if (east - west < marge) { west -= marge / 2; east += marge / 2 }
  if (north - south < marge) { south -= marge / 2; north += marge / 2 }

  return { west, south, east, north }
}

/** Vergroot een vak met een deel van zijn eigen afmeting. */
export function expandBounds (bounds, factor) {
  const dx = (bounds.east - bounds.west) * factor
  const dy = (bounds.north - bounds.south) * factor
  return {
    west: bounds.west - dx,
    east: bounds.east + dx,
    south: bounds.south - dy,
    north: bounds.north + dy
  }
}

export class MapView {
  constructor ({ centerWorld, scale, widthMm, heightMm, panXMm = 0, panYMm = 0 }) {
    this.centerWorld = centerWorld
    this.scale = scale // millimeters papier per wereldeenheid
    this.widthMm = widthMm
    this.heightMm = heightMm
    this.panXMm = panXMm
    this.panYMm = panYMm
  }

  // horizontaal en verticaal dezelfde schaal: anders wordt het land uitgerekt
  get scaleX () { return this.scale }
  get scaleY () { return this.scale }

  /**
   * Maakt een uitsnede waarin alle punten passen, met marge eromheen.
   * De zoom vergroot vanaf het midden; pan verschuift het beeld daarna.
   */
  static fit (coords, { widthMm, heightMm, paddingMm = 0, zoom = 1, panXMm = 0, panYMm = 0 }) {
    const b = boundsOf(coords)
    const linksboven = toWorld(b.west, b.north)
    const rechtsonder = toWorld(b.east, b.south)

    const wereldBreedte = rechtsonder.x - linksboven.x
    const wereldHoogte = rechtsonder.y - linksboven.y

    const bruikbaarBreed = Math.max(1, widthMm - 2 * paddingMm)
    const bruikbaarHoog = Math.max(1, heightMm - 2 * paddingMm)

    const scale = Math.min(bruikbaarBreed / wereldBreedte, bruikbaarHoog / wereldHoogte) * zoom

    return new MapView({
      centerWorld: {
        x: (linksboven.x + rechtsonder.x) / 2,
        y: (linksboven.y + rechtsonder.y) / 2
      },
      scale,
      widthMm,
      heightMm,
      panXMm,
      panYMm
    })
  }

  /** Coordinaat naar millimeters vanaf de linkerbovenhoek van het kaartvlak. */
  project (lon, lat) {
    const w = toWorld(lon, lat)
    return {
      x: this.widthMm / 2 + (w.x - this.centerWorld.x) * this.scale + this.panXMm,
      y: this.heightMm / 2 + (w.y - this.centerWorld.y) * this.scale + this.panYMm
    }
  }

  /** De omgekeerde weg, nodig om te weten welk gebied er in beeld staat. */
  unproject (xMm, yMm) {
    return fromWorld(
      this.centerWorld.x + (xMm - this.panXMm - this.widthMm / 2) / this.scale,
      this.centerWorld.y + (yMm - this.panYMm - this.heightMm / 2) / this.scale
    )
  }

  /** Het gebied dat het kaartvlak beslaat, om precies de juiste tegels op te halen. */
  visibleBounds () {
    const linksboven = this.unproject(0, 0)
    const rechtsonder = this.unproject(this.widthMm, this.heightMm)
    return {
      west: linksboven.lon,
      north: linksboven.lat,
      east: rechtsonder.lon,
      south: rechtsonder.lat
    }
  }

  /** Hoeveel meter grond er in een millimeter papier gaat, in het midden van de kaart. */
  metersPerMm () {
    const { lat } = fromWorld(this.centerWorld.x, this.centerWorld.y)
    const AARDOMTREK_M = 40075016.686
    return (AARDOMTREK_M * Math.cos(rad(lat))) / this.scale
  }
}
