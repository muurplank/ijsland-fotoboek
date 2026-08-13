/**
 * Van helderheidswaarden naar de kleuren van de kaart.
 *
 * De zee wordt vlak ingekleurd: het hoogtemodel bevat ook dieptes, en zonder
 * deze stap zou de zeebodem als relief door de kaart heen schemeren. De grens
 * tussen nul en negatief geeft meteen een kustlijn op de nauwkeurigheid van het
 * hoogtemodel zelf, wat veel scherper is dan een kustlijn uit kaartdata.
 */

/** '#aabbcc' naar [r, g, b]. */
export function hexNaarRgb (hex) {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  ]
}

/** Trekt een kleur naar grijs toe. */
function ontzadig ([r, g, b], mate) {
  const grijs = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return [
    r + (grijs - r) * mate,
    g + (grijs - g) * mate,
    b + (grijs - b) * mate
  ]
}

/**
 * @param {Uint8ClampedArray} grijs helderheid uit het schaduwrelief
 * @param {Float32Array} hoogtes hoogte per punt, in meters
 * @param {object} stijl kleuren en sterktes
 * @returns {Buffer} drie kleurwaarden per punt
 */
export function kleurKaart (grijs, hoogtes, {
  zeeKleur,
  schaduwKleur,
  verbleking = 0,
  ontzadiging = 0
}) {
  const [zr, zg, zb] = ontzadig(hexNaarRgb(zeeKleur), ontzadiging)
  const [sr, sg, sb] = ontzadig(hexNaarRgb(schaduwKleur), ontzadiging)

  const rgb = Buffer.alloc(grijs.length * 3)

  for (let i = 0; i < grijs.length; i++) {
    let r, g, b

    if (hoogtes[i] < 0) {
      // zee: vlak, zonder relief van de zeebodem
      r = zr; g = zg; b = zb
    } else {
      // land: van de schaduwkleur in het donker naar wit in de zon
      const t = grijs[i] / 255
      r = sr + (255 - sr) * t
      g = sg + (255 - sg) * t
      b = sb + (255 - sb) * t
    }

    r += (255 - r) * verbleking
    g += (255 - g) * verbleking
    b += (255 - b) * verbleking

    rgb[i * 3] = r
    rgb[i * 3 + 1] = g
    rgb[i * 3 + 2] = b
  }

  return rgb
}
