/**
 * Terreinkaart: het landschap gekleurd naar hoogte, met het schaduwrelief
 * eroverheen.
 *
 * Dit is de klassieke atlaskaart: groen laagland dat via geel en bruin naar wit
 * toe loopt op de toppen. De kleur vertelt hóé hoog het is, de schaduw hoe het
 * eruitziet. Samen krijg je diepte die geen van beide alleen geeft.
 *
 * Het is bewust één oplopende reeks van licht naar donker naar licht-wit, geen
 * willekeurige regenboog: elke stap hoort bij een hoogte, en de lezer moet aan
 * de kleur kunnen zien of iets hoger of lager ligt.
 */

import { hexNaarRgb } from './colorize.js'

/**
 * De kleur die bij deze hoogte hoort, vloeiend gemengd tussen de steunpunten.
 * Onder het laagste en boven het hoogste steunpunt blijft de kleur staan.
 */
export function hoogteKleur (meters, trap) {
  if (meters <= trap[0].m) return hexNaarRgb(trap[0].kleur)

  for (let i = 1; i < trap.length; i++) {
    if (meters > trap[i].m) continue

    const onder = trap[i - 1]
    const boven = trap[i]
    const deel = (meters - onder.m) / (boven.m - onder.m)

    const a = hexNaarRgb(onder.kleur)
    const b = hexNaarRgb(boven.kleur)
    return [0, 1, 2].map(k => a[k] + (b[k] - a[k]) * deel)
  }

  return hexNaarRgb(trap.at(-1).kleur)
}

/** Trekt een kleur naar grijs toe. */
function ontzadig ([r, g, b], mate) {
  const grijs = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return [r + (grijs - r) * mate, g + (grijs - g) * mate, b + (grijs - b) * mate]
}

/**
 * Kleurt de kaart: hoogtekleur maal schaduw.
 *
 * De schaduw wordt als vermenigvuldiger toegepast rond de helderheid die
 * kaarsvlak land oplevert. Vlak land krijgt dus precies zijn hoogtekleur, een
 * belichte helling wordt lichter en een schaduwzijde donkerder - zonder dat de
 * kleur zelf verschuift.
 *
 * @param {Uint8ClampedArray} schaduw helderheid uit het schaduwrelief
 * @param {Float32Array} hoogtes meters per punt
 */
export function kleurTerrein (schaduw, hoogtes, {
  zeeKleur,
  trap,
  vlakkeHelderheid,
  verbleking = 0,
  ontzadiging = 0
}) {
  const zee = ontzadig(hexNaarRgb(zeeKleur), ontzadiging)
  const rgb = Buffer.alloc(schaduw.length * 3)

  // de hoogtekleuren vooraf uitrekenen: per meter is genoeg, en dat scheelt
  // miljoenen keren dezelfde interpolatie
  const maxM = Math.ceil(trap.at(-1).m)
  const tabel = new Float32Array((maxM + 1) * 3)
  for (let m = 0; m <= maxM; m++) {
    const k = ontzadig(hoogteKleur(m, trap), ontzadiging)
    tabel[m * 3] = k[0]
    tabel[m * 3 + 1] = k[1]
    tabel[m * 3 + 2] = k[2]
  }

  for (let i = 0; i < schaduw.length; i++) {
    let r, g, b

    if (hoogtes[i] < 0) {
      r = zee[0]; g = zee[1]; b = zee[2]
    } else {
      const m = Math.min(maxM, Math.round(hoogtes[i]))
      const licht = schaduw[i] / vlakkeHelderheid
      r = tabel[m * 3] * licht
      g = tabel[m * 3 + 1] * licht
      b = tabel[m * 3 + 2] * licht
    }

    r += (255 - r) * verbleking
    g += (255 - g) * verbleking
    b += (255 - b) * verbleking

    rgb[i * 3] = Math.max(0, Math.min(255, r))
    rgb[i * 3 + 1] = Math.max(0, Math.min(255, g))
    rgb[i * 3 + 2] = Math.max(0, Math.min(255, b))
  }

  return rgb
}
