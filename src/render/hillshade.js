/**
 * Schaduwrelief: het landschap plastisch maken door er virtueel licht op te
 * laten vallen.
 *
 * Voor elk punt wordt bepaald hoe steil en welke kant op het terrein daar helt,
 * en hoeveel licht zo'n vlakje vangt van een zon die op een instelbare hoek
 * staat. Cartografen zetten die zon vrijwel altijd linksboven: bij licht van
 * rechtsonder ziet je oog bergen aan voor dalen.
 */

const rad = deg => (deg * Math.PI) / 180

/**
 * @param {{data: Float32Array, width: number, height: number}} dem hoogtes in meters
 * @param {object} opties
 * @param {number} opties.metersPerPixel hoeveel grond een meetpunt beslaat
 * @param {number} opties.azimuth waar de zon vandaan komt, in graden vanaf noord
 * @param {number} opties.altitude hoe hoog de zon staat, in graden boven de horizon
 * @param {number} opties.exaggeration hoogtes uitvergroten; IJsland oogt vlak op ware schaal
 * @param {number} opties.contrast 0 is vlak grijs, 1 is het echte relief
 * @returns {Uint8ClampedArray} helderheid per punt, 0 tot 255
 */
export function hillshade (dem, {
  metersPerPixel,
  azimuth = 315,
  altitude = 45,
  exaggeration = 1,
  contrast = 1
}) {
  const { data, width, height } = dem
  const uit = new Uint8ClampedArray(width * height)

  const zenith = rad(90 - altitude)
  // de zon komt uit het azimut, dus het licht schijnt de andere kant op
  const zonRichting = rad(360 - azimuth + 90)

  const cosZenith = Math.cos(zenith)
  const sinZenith = Math.sin(zenith)

  // de helderheid van kaarsvlak land; daar wordt het contrast omheen gedraaid
  const vlak = cosZenith

  // afstand tussen de twee meetpunten waar we de helling uit afleiden
  const stap = 2 * metersPerPixel

  for (let y = 0; y < height; y++) {
    // op de randen bestaat de buur niet; gebruik dan het punt zelf
    const yBoven = y > 0 ? y - 1 : y
    const yOnder = y < height - 1 ? y + 1 : y

    for (let x = 0; x < width; x++) {
      const xLinks = x > 0 ? x - 1 : x
      const xRechts = x < width - 1 ? x + 1 : x

      const links = data[y * width + xLinks]
      const rechts = data[y * width + xRechts]
      const boven = data[yBoven * width + x]
      const onder = data[yOnder * width + x]

      // hoe hard het terrein stijgt in oost-west en noord-zuid richting
      const dzdx = ((rechts - links) / stap) * exaggeration
      const dzdy = ((onder - boven) / stap) * exaggeration

      const slope = Math.atan(Math.hypot(dzdx, dzdy))
      const aspect = Math.atan2(dzdy, -dzdx)

      const licht =
        cosZenith * Math.cos(slope) +
        sinZenith * Math.sin(slope) * Math.cos(zonRichting - aspect)

      // rond het vlakke grijs heen naar het contrast toe of ervan af
      uit[y * width + x] = (vlak + (licht - vlak) * contrast) * 255
    }
  }

  return uit
}
