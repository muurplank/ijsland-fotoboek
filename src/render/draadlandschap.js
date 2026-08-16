/**
 * De vier onderwerpen die landschap zijn: gletsjer, waterval, geiser, vuurtoren.
 *
 * Waarom apart van de gebouwde dingen in draadmodellen.js: landschap wordt
 * anders opgeschreven dan een auto of een kerk. Hier gaat het over
 * hoogtefuncties, krommende randen en strengen water, en niet over doorsneden
 * op een rij. Samen in één bestand werd het vierhonderd regels waarin je de
 * ene soort denken door de andere heen moest lezen.
 *
 * De registers en de dagtabel blijven in draadmodellen.js: dat is het ene
 * adres waar de pagina om een onderwerp vraagt.
 */

import {
  voegSamen, verplaats, ring, prisma, draaiLichaam, hoogteVeld, pad
} from './ruimtevormen.js'

/** Een heuvel rond een punt, die naar de rand toe netjes op nul uitkomt. */
const bult = (u, v, mu, mv, breedte, hoogte) =>
  hoogte * Math.max(0, 1 - ((u - mu) ** 2 + (v - mv) ** 2) / breedte ** 2) ** 2

/** IJskoepel met twee nunataks, een aflopende tong en schotsen ervoor. */
export function gletsjer ({ nx, ny }) {
  const veld = hoogteVeld((u, v) => {
    const koepel = bult(u, v, 0.62, 0.5, 0.52, 4.2)
    const nunatak = bult(u, v, 0.34, 0.28, 0.14, 1.5) + bult(u, v, 0.42, 0.74, 0.12, 1.1)
    // de tong loopt naar voren uit en krijgt daar zijn spleten
    const tong = bult(u, v, 0.12, 0.5, 0.34, 1.4)
    const spleten = tong > 0.05 ? 0.18 * Math.max(0, Math.sin(v * 22)) : 0
    return Math.max(0, koepel + nunatak + tong - spleten)
  }, { nx, ny, van: { x: -5.5, y: -4.5 }, tot: { x: 5.5, y: 4.5 } })

  // schotsen in de lagune: plat en breed, want een blokje leest als een kist
  const schots = (x, y, maat) => verplaats(
    prisma(
      [{ x: maat, y: 0 }, { x: 0, y: maat * 0.8 }, { x: -maat, y: 0 }, { x: 0, y: -maat * 0.8 }],
      0, maat * 0.22
    ),
    { x, y }
  )

  // In de hoek waar het veld op nul ligt, anders steken ze door de helling heen
  return voegSamen(
    veld,
    schots(-4.4, -3.6, 0.95),
    schots(-2.9, -4.1, 0.7),
    schots(-5.1, -2.4, 0.55)
  )
}

/**
 * De hoefijzerlip van Godafoss, strengen omlaag en een rimpelend bekken.
 *
 * De lip buigt naar de kijker toe, want dat hoefijzer is het enige waaraan je
 * deze waterval van elke andere onderscheidt.
 */
export function waterval ({ zijden }) {
  const HOOG = 6.2

  // Het gordijn is uit losse paden opgebouwd en niet uit een draailichaam, dus
  // het moet zijn eigen fijnheid regelen - anders blijft deze ene dag grof
  // terwijl de andere zeven meeschalen met de knop.
  const KOLOMMEN = Math.max(9, Math.round(zijden * 1.5))
  const TREDEN = Math.max(7, Math.round(zijden / 2))

  // De lip ligt in het midden het verst weg en aan de zijkanten het dichtst
  // bij, zodat de val om het bekken heen krult - naar de kijker toe. Andersom
  // is het een rechte rand met een deuk erin.
  const lipPunt = u => ({
    x: -4 + u * 8,
    y: 0.6 + 1.2 * Math.cos((u - 0.5) * Math.PI * 1.7)
  })

  const lip = []
  for (let i = 0; i < KOLOMMEN; i++) lip.push(lipPunt(i / (KOLOMMEN - 1)))

  // Alleen het wateroppervlak bovenop de rand, niet de rots eronder. Teken je
  // die er als blok bij, dan wint de doos het van de val - en de wand die je
  // wilt zien is het gordijn zelf, niet het steen erachter.
  const bovenrand = [...lip, { x: 4, y: 5.4 }, { x: -4, y: 5.4 }]
  const rivier = pad([...bovenrand, bovenrand[0]].map(p => ({ ...p, z: HOOG })))

  // een paar stroomlijnen naar de rand toe, zodat het als rivier leest
  const stroom = [-2.4, -0.8, 0.8, 2.4].map(x => pad([
    { x, y: 5.2, z: HOOG },
    { x, y: lipPunt((x + 4) / 8).y, z: HOOG }
  ]))

  // Het gordijn: verticale strengen met schuimlijnen eroverheen. Strengen
  // alleen lezen als regen; de dwarslijnen maken er een vlak water van.
  const voor = (p, t) => ({ x: p.x, y: p.y - 0.25 - t * t * 0.8, z: HOOG * (1 - t) })

  const strengen = lip.map((p, i) => pad(
    Array.from({ length: TREDEN + 1 }, (_, s) => voor(p, s / TREDEN)),
    i % 6 === 0 ? 2 : 1
  ))

  const schuimlijnen = Array.from({ length: TREDEN - 1 }, (_, i) =>
    pad(lip.map(p => voor(p, (i + 1) / TREDEN)))
  )

  // Rimpels in het bekken als losse ringen. Een draailichaam zou er meridianen
  // doorheen trekken, en op vlak water is dat een spinnenweb in plaats van een
  // rimpeling.
  const rimpels = Array.from({ length: Math.max(3, Math.round(zijden / 4)) }, (_, i) => {
    const r = 0.7 + i * (2.2 / Math.max(3, Math.round(zijden / 4)))
    const omtrek = ring(r, Math.max(12, zijden * 2))
    return pad([...omtrek, omtrek[0]].map(p => ({ x: p.x, y: p.y * 0.65 - 1.6, z: 0.03 })))
  })

  return voegSamen(rivier, ...stroom, ...strengen, ...schuimlijnen, ...rimpels)
}

/**
 * De straal die eruit klapt, de sinterkom eromheen en de spatten.
 *
 * De straal loopt bovenaan wijd open uit en wordt daar niet dichtgemaakt. Zodra
 * je hem tot een punt laat sluiten is het een ballon of een gloeilamp; open
 * gaat hij nog steeds omhoog, en dat is precies wat een geiser doet.
 */
export function geiser ({ zijden, tussen }) {
  const straal = draaiLichaam([
    { r: 0.34, z: 0 }, { r: 0.3, z: 1.3 }, { r: 0.42, z: 2.9 },
    { r: 0.72, z: 4.4 }, { r: 1.15, z: 5.8 }, { r: 1.55, z: 7.2 }
  ], zijden, { tussen })

  // de kom loopt van de rand naar de bron toe af, maar blijft op de vloer staan
  const kom = draaiLichaam([
    { r: 3.6, z: 0.62 }, { r: 2.5, z: 0.32 }, { r: 1.5, z: 0.1 }, { r: 0.6, z: 0 }
  ], zijden, { tussen })

  const spatten = []
  const aantal = 12
  for (let i = 0; i < aantal; i++) {
    const hoek = (i / aantal) * Math.PI * 2
    const ver = 2.4 + (i % 3) * 0.8
    const punten = []
    for (let s = 0; s <= 6; s++) {
      const t = s / 6
      punten.push({
        x: Math.cos(hoek) * ver * t,
        y: Math.sin(hoek) * ver * t,
        z: 5.4 + (i % 2) * 0.8 + 1.6 * t - 4 * t * t
      })
    }
    spatten.push(pad(punten))
  }

  return voegSamen(kom, straal, ...spatten)
}

/** De toren op zijn basaltzuilen; die zuilen zijn wat die plek onderscheidt. */
export function vuurtoren ({ zijden, tussen }) {
  const romp = draaiLichaam([
    { r: 1.05, z: 0 }, { r: 0.95, z: 0.5 }, { r: 0.62, z: 5.2 },
    { r: 0.85, z: 5.5 }, { r: 0.8, z: 5.8 }, { r: 0.62, z: 5.95 },
    { r: 0.62, z: 7.1 }, { r: 0.78, z: 7.3 }, { r: 0, z: 8.3 }
  ], zijden, { tussen })

  const zuilen = []
  const aantal = 8
  for (let i = 0; i < aantal; i++) {
    const hoek = (i / aantal) * Math.PI * 2
    const afstand = 3.1 + (i % 2) * 0.5
    const hoogte = 1.1 + ((i * 7) % 5) * 0.34
    zuilen.push(verplaats(
      prisma(ring(0.52, 6, (i * 23) % 60), 0, hoogte, { tussen }),
      { x: Math.cos(hoek) * afstand, y: Math.sin(hoek) * afstand }
    ))
  }

  const lichtbundel = pad([
    { x: 0, y: 0, z: 6.5 }, { x: 5.2, y: 1.4, z: 5.4 }
  ], 2)

  return voegSamen(romp, ...zuilen, lichtbundel)
}
