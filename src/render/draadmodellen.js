/**
 * De acht onderwerpen: één draadmodel per dag van de reis.
 *
 * Elke dag krijgt zijn eigen ding achter de cijfers - het vliegtuig waarmee we
 * aankwamen, de kerk in Reykjavik, de gletsjer, de waterval, de vuurtoren, de
 * geiser, de auto waarin we een week rondreden, en de verkeerstoren waar het
 * ophield. Acht statistiekpagina's die verder identiek zijn worden zo acht
 * verschillende bladzijden, zonder dat er ook maar iets aan de cijfers
 * verandert.
 *
 * Alles wordt uit de bouwstenen van ruimtevormen.js samengesteld en nergens
 * met de hand uit losse punten opgeschreven. Dat houdt de onderwerpen kort
 * genoeg om na te lezen, en het maakt de fijnheidsknop overal even zinnig: één
 * getal bepaalt bij elk onderwerp hoeveel lijnen er over een rond of gebogen
 * vlak lopen.
 *
 * Hier staan de gebouwde dingen. De vier die landschap zijn - gletsjer,
 * waterval, geiser, vuurtoren - staan in draadlandschap.js, omdat ze in
 * hoogtefuncties en krommende randen worden opgeschreven in plaats van in
 * doorsneden op een rij. De registers en de dagtabel staan wél hier: dit is het
 * ene adres waar de pagina om een onderwerp vraagt.
 *
 * Geen enkele vorm gebruikt toeval. Zou een van deze modellen op Math.random
 * leunen, dan sprong de achtergrond bij elke draai aan een knop en was er van
 * twee keer dezelfde PDF geen sprake meer.
 */

import { gletsjer, waterval, geiser, vuurtoren } from './draadlandschap.js'
import {
  voegSamen, verplaats, draai, spiegel, zetOpDeVloer,
  ring, afgerondeRechthoek, loft, prisma, draaiLichaam, pad
} from './ruimtevormen.js'

export const MODELLEN = [
  'vliegtuig', 'kerk', 'gletsjer', 'waterval', 'vuurtoren', 'geiser', 'auto', 'toren'
]

/**
 * Wat de pagina van een onderwerp moet weten zonder het te bouwen.
 *
 * Elk onderwerp heeft een hoek waarop je het herkent - een vliegtuig recht van
 * opzij is een streep, en een auto pal van voren een doos. Die eigen draaiing
 * komt boven op de draaiing van de pagina. De vulling corrigeert onderwerpen
 * die van zichzelf smal en hoog zijn: die zouden anders paginahoog worden en
 * daarmee twee keer zo zwaar aanzetten als de rest.
 */
export const MODEL_INFO = {
  vliegtuig: { label: 'Vliegtuig', draaiGraden: 15, vulling: 1 },
  kerk: { label: 'Hallgrímskirkja', draaiGraden: -20, vulling: 0.82 },
  gletsjer: { label: 'Gletsjer', draaiGraden: 0, vulling: 1 },
  waterval: { label: 'Waterval', draaiGraden: -10, vulling: 1 },
  vuurtoren: { label: 'Vuurtoren', draaiGraden: 0, vulling: 0.88 },
  geiser: { label: 'Geiser', draaiGraden: 0, vulling: 0.9 },
  auto: { label: 'Dacia Duster', draaiGraden: -20, vulling: 0.9 },
  toren: { label: 'Verkeerstoren', draaiGraden: 0, vulling: 0.85 }
}

/**
 * Welk onderwerp bij welke dag hoort.
 *
 * Bewust hier en niet in de dagbestanden: dit is een ontwerpkeuze over het boek
 * als geheel en geen gegeven van die ene dag. Dag acht spiegelt dag een - heen
 * het vliegtuig, terug het vliegveld - zodat de reis rond is zonder dat er
 * twee keer hetzelfde vliegtuig in staat. Een dag die er toch van af wil zet
 * "statistieken.draadmodel" in zijn eigen stijlblok.
 */
export const MODEL_PER_DAG = {
  1: 'vliegtuig',
  2: 'kerk',
  3: 'gletsjer',
  4: 'waterval',
  5: 'vuurtoren',
  6: 'geiser',
  7: 'auto',
  8: 'toren'
}

// --------------------------------------------------------------- de gebouwde

/**
 * Romp met vleugels, staartvlakken en twee motoren onder de vleugel.
 *
 * De romp wordt liggend opgebouwd - als een stapel doorsneden van staart naar
 * neus - en daarna een kwartslag gekanteld. Dat is korter op te schrijven dan
 * hem meteen langs de x-as bouwen, en het is dezelfde stapel doorsneden die
 * ook de kerktoren en de verkeerstoren maakt.
 */
function vliegtuig ({ zijden, tussen }) {
  const doorsnede = ring(1, zijden)
  const romp = verplaats(draai(
    loft([
      { omtrek: doorsnede, z: 0, schaal: 0.2 },
      { omtrek: doorsnede, z: 1.3, schaal: 0.8 },
      { omtrek: doorsnede, z: 3.6, schaal: 1 },
      { omtrek: doorsnede, z: 6.8, schaal: 0.95 },
      { omtrek: doorsnede, z: 9.2, schaal: 0.6 },
      { omtrek: doorsnede, z: 10.5, schaal: 0.22 }
    ], { tussen }),
    -90, 'y'
  ), { x: 5.25 })

  // De draagvlakken blijven twee doorsneden dik, ook op de hoogste fijnheid:
  // een vleugel van 0,24 dik in tien laagjes snijden geeft geen vorm maar
  // streepjes. Naar achteren geveegd, dus de tip staat dichter bij de staart
  // dan de wortel.
  const vleugel = verplaats(prisma([
    { x: -1.4, y: 0.7 }, { x: 1.6, y: 0.7 }, { x: 3.4, y: 5.2 }, { x: 1.9, y: 5.2 }
  ], -0.12, 0.12), { x: -1.4 })

  const stabilo = verplaats(prisma([
    { x: -0.9, y: 0.5 }, { x: 0.9, y: 0.5 }, { x: 1.8, y: 2.3 }, { x: 0.9, y: 2.3 }
  ], -0.1, 0.1), { x: 3.3 })

  const vin = verplaats(draai(prisma([
    { x: -0.6, y: 0 }, { x: 1.4, y: 0 }, { x: 1.9, y: 2.6 }, { x: 0.7, y: 2.6 }
  ], -0.1, 0.1), 90, 'x'), { x: 3.2 })

  const motor = draai(draaiLichaam([
    { r: 0.4, z: -0.9 }, { r: 0.48, z: -0.5 }, { r: 0.48, z: 0.5 }, { r: 0.38, z: 0.9 }
  ], Math.max(4, Math.round(zijden * 0.6)), { tussen }), -90, 'y')

  const romplijn = pad([{ x: -5, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }], 2)

  return voegSamen(
    romp,
    spiegel(vleugel, 'y'),
    spiegel(stabilo, 'y'),
    vin,
    spiegel(verplaats(motor, { x: -0.9, y: 2.6, z: -0.95 }), 'y'),
    romplijn
  )
}

/** De toren met zijn getrapte flanken, en het schip erachter. */
function kerk ({ zijden, tussen }) {
  const vlak = afgerondeRechthoek(2.6, 2.2, 0.2, 1)

  const toren = loft([
    { omtrek: vlak, z: 0 },
    { omtrek: vlak, z: 5.4, schaal: 0.92 },
    { omtrek: vlak, z: 6.6, schaal: 0.8 },
    { omtrek: vlak, z: 11.5, schaal: 0 }
  ], { tussen })

  // de beroemde flanken: platen die naar buiten toe steeds lager worden, als
  // basaltzuilen die uit de toren groeien
  const platen = []
  for (let i = 0; i < 5; i++) {
    const breedte = 0.85
    const hoogte = 4.8 - i * 0.85
    platen.push(prisma(
      afgerondeRechthoek(breedte, 1.9 - i * 0.12, 0, 1),
      0,
      hoogte,
      { tussen }
    ))
    platen[i] = verplaats(platen[i], { x: 1.75 + i * 0.95 })
  }

  const schip = verplaats(prisma(afgerondeRechthoek(2.2, 5.4, 0.2, 1), 0, 2.4, { tussen }), { y: -3.6 })

  const nokken = pad([
    { x: -1.3, y: 0, z: 6.6 }, { x: -1.3, y: 0, z: 0 }
  ], 2)
  const nokken2 = pad([
    { x: 1.3, y: 0, z: 6.6 }, { x: 1.3, y: 0, z: 0 }
  ], 2)

  return voegSamen(
    toren,
    spiegel(voegSamen(...platen), 'x'),
    schip,
    nokken,
    nokken2,
    // een enkele band hoog in de spits, anders leest de naald als één streep
    prisma(ring(0.42, Math.max(4, Math.round(zijden * 0.5))), 8.2, 8.35)
  )
}

/**
 * Duster: het zijsilhouet over de breedte uitgetrokken, plus vier wielen.
 *
 * Bewust het silhouet en niet een stapel doorsneden zoals bij de romp van het
 * vliegtuig. Een auto als stapel horizontale doorsneden wordt een bak met een
 * blokje erin: je ziet de bovenrand van de carrosserie én de cabine als twee
 * losse ringen. Het silhouet van opzij - motorkap, voorruit, dak, achterruit -
 * is precies de lijn waaraan je een auto herkent, en die ene lijn doet al het
 * werk.
 */
function auto ({ zijden, tussen }) {
  const wielZijden = Math.max(5, Math.round(zijden * 0.8))

  // van opzij gezien, met de neus links. De tweede waarde wordt straks de hoogte
  const silhouet = [
    { x: -4.5, y: 0.6 }, { x: -4.5, y: 1.35 }, { x: -3.7, y: 1.8 },
    { x: -1.7, y: 2 }, { x: -0.6, y: 3.45 }, { x: 1.8, y: 3.55 },
    { x: 2.8, y: 2.15 }, { x: 4.25, y: 1.95 }, { x: 4.5, y: 1.35 },
    { x: 4.5, y: 0.6 }
  ]

  // uitgetrokken over de breedte en dan rechtop gezet. De maten zijn die van
  // een echte Duster, teruggerekend op een lengte van negen eenheden: 4,34 bij
  // 1,80 bij 1,69 meter, op wielen van zeventig centimeter.
  const carrosserie = draai(prisma(silhouet, -1.85, 1.85, { tussen }), 90, 'x')

  const wiel = draai(draaiLichaam([
    { r: 0.64, z: -0.3 }, { r: 0.73, z: -0.18 }, { r: 0.73, z: 0.18 }, { r: 0.64, z: 0.3 }
  ], wielZijden, { tussen }), 90, 'x')

  const wielen = spiegel(spiegel(verplaats(wiel, { x: 2.75, y: 1.62, z: 0.73 }), 'y'), 'x')

  // de rails maken er een Duster van in plaats van zomaar een auto
  const rail = pad([
    { x: -0.4, y: 1.15, z: 3.62 }, { x: 1.6, y: 1.15, z: 3.62 }
  ], 2)

  return voegSamen(carrosserie, wielen, spiegel(rail, 'y'))
}

/** Schacht, schuin naar buiten hellende kanselramen, plat dak en een mast. */
function toren ({ zijden, tussen }) {
  const schacht = draaiLichaam([
    { r: 1, z: 0 }, { r: 0.78, z: 3 }, { r: 0.68, z: 6.4 }
  ], zijden, { tussen })

  const achthoek = ring(1, Math.max(6, Math.round(zijden)))
  const kansel = loft([
    { omtrek: achthoek, z: 6.4, schaal: 0.85 },
    { omtrek: achthoek, z: 8.3, schaal: 1.85 },
    { omtrek: achthoek, z: 8.7, schaal: 1.7 }
  ], { tussen })

  const mast = pad([{ x: 0, y: 0, z: 8.7 }, { x: 0, y: 0, z: 11 }], 2)
  const terminal = verplaats(
    prisma(afgerondeRechthoek(5.4, 3.2, 0.4, 2), 0, 1.5, { tussen }),
    { x: 4.6, y: 1.2 }
  )

  return voegSamen(schacht, kansel, mast, terminal)
}

const BOUWERS = { vliegtuig, kerk, gletsjer, waterval, vuurtoren, geiser, auto, toren }

/**
 * Het draadmodel van één onderwerp.
 *
 * De fijnheid werkt in twee richtingen tegelijk, en dat is het hele punt van
 * één knop: "zijden" maakt elk rond vlak ronder, en "tussen" schuift extra
 * doorsneden tussen de bestaande. Alleen het eerste geeft een vuurtoren met
 * zestig kanten die nog steeds acht ringen hoog is - een lampionnetje. Pas
 * samen wordt het een fijnmazig gaas dat er van dichtbij uitziet als een echt
 * draadmodel.
 *
 * Een onbekende naam wordt de gletsjer, in plaats van een lege bladzijde.
 *
 * Het op de vloer zetten gebeurt hier en niet in de acht bouwers: dan hoeft
 * geen van hen zijn eigen zwaartepunt uit te rekenen, en staat het toch
 * gegarandeerd goed.
 */
export function bouwDraadmodel (naam, { dichtheid = 24 } = {}) {
  const zijden = Math.max(4, Math.round(dichtheid))
  const tussen = Math.max(0, Math.round(zijden / 6) - 1)
  const bouw = BOUWERS[naam] ?? gletsjer
  return zetOpDeVloer(bouw({ zijden, tussen, nx: zijden + 1, ny: zijden + 1 }))
}

/** Het gekozen onderwerp, of dat van de dag als de keuze op automatisch staat. */
export function kiesModel (keuze, dagnummer) {
  if (MODELLEN.includes(keuze)) return keuze
  const dag = Number(dagnummer)
  if (MODEL_PER_DAG[dag]) return MODEL_PER_DAG[dag]
  return MODELLEN[(Math.max(1, dag || 1) - 1) % MODELLEN.length]
}
