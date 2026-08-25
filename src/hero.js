/**
 * Wat er nodig is om van een heropfoto een stempel te maken - zonder netwerk,
 * zonder schijf, zonder sharp.
 *
 * Het uitvoerende werk staat in src/stempel.js: die praat met Google, draait
 * sips over de RAW-bestanden en schrijft de PNG's weg. Hier staat alleen wat je
 * kunt nakijken zonder dat er iets gebeurt - welke foto bij welke dag hoort, wat
 * er precies aan het model gevraagd wordt, en welke inkten er uit een afdruk
 * komen. Dat is ook precies het deel waar een fout stil doorwerkt: een verkeerd
 * gekoppelde foto merk je pas als er een gletsjer onder een vliegveld staat.
 */

/** De map met de foto's, naast de projectmap. */
export const HERO_MAP = 'Hero'

/**
 * Hoeveel de nummering in de map afwijkt van de reisdagen.
 *
 * "Dag 1.jpg" in de map is de eerste dag waarvan er een heropfoto is, en dat is
 * de tweede dag van de reis. Dag 1 was de aankomst in Keflavík - autoverhuur,
 * boodschappen, hotel - en daar is geen foto van die het waard is.
 *
 * Dit staat er als een genoemde constante en niet als een plus-een ergens in de
 * code, want het is precies het soort verschuiving dat je een halfjaar later
 * niet meer terugvindt: de stempels staan dan gewoon bij de verkeerde dag en
 * niets meldt dat.
 */
export const DAG_VERSCHUIVING = 1

/**
 * De bestandsnamen die we herkennen: "Dag 3.jpg", "Dag 5-2.ARW", "Dag 6-2.JPG".
 *
 * Het cijfer achter het streepje is de volgorde binnen die dag, niet een tweede
 * dagnummer. Zonder streepje is het de eerste.
 */
const NAAMPATROON = /^Dag[ _-]?(\d{1,2})(?:-(\d{1,2}))?\.(jpe?g|arw|png|tiff?|heic)$/i

/** Bestanden die sharp niet zelf openkrijgt en die dus eerst door sips moeten. */
export const RAW_SOORTEN = new Set(['arw', 'heic'])

/**
 * Welke foto's er bij welke dag horen, op volgorde.
 *
 * Let op DAG_VERSCHUIVING: "Dag 3.jpg" in de map hoort bij reisdag 4.
 *
 * @param {string[]} bestandsnamen  kale namen uit de map, niet gesorteerd
 * @returns {Map<number, Array<{naam: string, index: number, soort: string}>>}
 */
export function fotosPerDag (bestandsnamen) {
  const perDag = new Map()

  for (const naam of bestandsnamen) {
    const m = NAAMPATROON.exec(naam)
    if (!m) continue

    const dag = Number(m[1]) + DAG_VERSCHUIVING
    const index = m[2] ? Number(m[2]) : 1
    const soort = m[3].toLowerCase()

    if (!perDag.has(dag)) perDag.set(dag, [])
    perDag.get(dag).push({ naam, index, soort })
  }

  for (const lijst of perDag.values()) {
    lijst.sort((a, b) => a.index - b.index || a.naam.localeCompare(b.naam))
  }

  return new Map([...perDag.entries()].sort((a, b) => a[0] - b[0]))
}

/** Het nummer onder een stempel: "No. 03" bij één foto, "No. 03·2" bij meer. */
export function stempelNummer (dag, index, totaal) {
  const basis = `No. ${String(dag).padStart(2, '0')}`
  return totaal > 1 ? `${basis}·${index}` : basis
}

/**
 * Een eerste versie van de veldnotitie, om zelf bij te schaven.
 *
 * De plaatsnaam en het jaar staan in het dagbestand, dus die kunnen kloppen. De
 * drie trefwoorden blijven bewust leeg: dat zijn de regels die de pagina zijn
 * toon geven, en juist daar verzint een model iets dat aannemelijk klinkt en
 * niet waar is. Beter een lege regel die je zelf invult dan een verkeerde die er
 * geloofwaardig uitziet.
 */
export function veldnotitieConcept (dag) {
  const stops = (dag.waypoints ?? []).filter(w => w.type === 'stop' && w.name)
  const laatste = stops.at(-1)

  return {
    plaats: laatste?.name ?? dag.titel ?? '',
    jaar: String(dag.datum ?? '').slice(0, 4),
    trefwoorden: []
  }
}

/**
 * Wat er van deze dag in de foto te zien zou moeten zijn.
 *
 * Gaat als korte notitie mee met de foto. Het model heeft de foto zelf al, dus
 * dit is alleen om de plaats te kunnen benoemen - een gletsjerlagune en een
 * kratermeer lijken van een afstand op elkaar, en het scheelt of het model weet
 * dat het IJsland is.
 */
export function dagNotitie (dag) {
  const namen = (dag.waypoints ?? [])
    .filter(w => (w.type === 'stop' || w.type === 'overnight') && w.name)
    .map(w => w.name)
  const fweg = (dag.waypoints ?? []).some(w => w.fweg)

  const regels = [`Iceland, ${dag.datum}. Day ${dag.dag}: ${dag.titel}.`]
  if (namen.length) regels.push(`Places on this day: ${namen.join(', ')}.`)
  if (fweg) regels.push('Part of the day was on an unpaved highland F-road.')

  return regels.join(' ')
}

/**
 * De opdracht aan het model.
 *
 * Alleen de stempel, niet de hele poster. De foto, het papier, de typografie en
 * de cijfers maakt dit project zelf op 600 dpi; laat je het model de hele plaat
 * maken, dan zijn de kilometers verzonnen en is er niets meer bij te stellen.
 *
 * De laatste alinea is er na schade en schande: zonder een uitgeschreven lijst
 * van wat er níét in mag, levert vrijwel elk beeldmodel er een kadertje, een
 * onderschrift of een slagschaduw bij.
 */
export function stempelPrompt (dag) {
  return `Cut a small travel stamp from this photograph and press it once, by hand, onto blank warm off-white paper.

HOW IT SITS ON THE PAPER
The mark floats free on bare paper. There is no square field, no filled background, no panel, no border, no frame, no vignette, no ground line. The outer edge of the motif is open and ragged and follows the subject itself, so it is never a rectangle. Bare paper shows all around it and also everywhere between the strokes inside it. Roughly a third of the area inside the motif is untouched paper.

THE KEY INK
One dark ink carries all the drawing: near-black, or a very dark green-black or brown-black. It is cut with a fine gouge, so it is made of small strokes - short broken parallel hatching, fine contour lines, little nicks and slips - and never of large solid areas. Read it as a finely engraved stamp, not as a lino block with big cleared fields and white lines carved out of solid colour.
Draw sky, water, distant hills and haze as rows of short broken horizontal dashes with clear paper between the rows, thinning out towards the edges until they stop. Never as a solid wash.

THE COLOUR INKS
Two or three flat spot colours sit UNDER the key ink. Pull them from this photograph and keep them desaturated: brick red, ochre, slate blue, deep green, taupe, warm stone. Only a small area carries the strongest colour; the rest of the motif is the key ink on bare paper.
The colour blocks are loose and flat. They do not fit the linework: each colour sits 1 to 2 mm out of register, overshoots some edges and falls short of others, and leaves paper bare in patches. That misalignment between the passes is the whole point - do not correct it.

WHAT TO KEEP AND WHAT TO THROW AWAY
Study the photograph and keep only what makes this exact place recognisable: the main outline, the roof or dome or tower, the terrain contour, the shoreline, the road, the shape of the trees. Throw away the crowds, the vehicles, the rows of windows, the repeated buildings, the scattered scrub, the decoration and the empty background.
Organise it according to what the photograph actually is:
- iconic building: keep the outer contour, the roof, the dome, the arch, the tower
- settlement on a slope: compress the houses into a few terraced blocks of colour that step down along the terrain
- coast: keep the mountain contour, the layer of houses, the shoreline, and a few broken rows of water
- panorama: keep the skyline, one building you would recognise, one or two ridges behind it
- landscape: keep the main mountain form, the trees, the shoreline or the direction of the road
- if something stands close to the camera - a tree, a post, a rock, a lamp - keep it at one side as a solid dark silhouette in the key ink, overlapping the subject behind it

THE PRESS
Every ink is a separate hand-pressed pass. Real carved rubber or wood: uneven line weight, notched contours, fractured edges, dry patches where the ink starved, paper grain showing through the pigment, granular ink, uneven pressure, a little ghosting. Nothing is smoothed. It must look pressed by hand onto old paper - not a filtered photograph, not a smooth vector illustration, not a line-art logo, not a 3D render.

WHAT MUST NOT BE IN THE IMAGE
No text, no letters, no numbers, no caption. No border, no frame, no square block of colour, no rectangular field of ink, no background fill, no postmark, no circular seal, no perforations, no drop shadow, no signature, no watermark, no colour swatches. Nothing but the motif on bare paper.

THIS PHOTOGRAPH
${dagNotitie(dag)}
The photograph is the authority. Where these notes and the photograph disagree, follow the photograph.`
}

/** Een kanaalwaarde 0-255 als twee hexcijfers. */
const hex2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')

/** Hoe ver twee kleuren uit elkaar liggen, plat in RGB. Goed genoeg om te ontdubbelen. */
const afstand = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/**
 * De steunkleuren uit een gestempelde afdruk halen.
 *
 * Werkt op kale RGBA-pixels, dus zonder sharp - dan is het te testen met een
 * verzonnen plaatje in plaats van met een echte afdruk.
 *
 * Twee dingen maken het lastig. Ten eerste is een stempel voor het grootste deel
 * papier, dus alles wat bijna doorzichtig is telt niet mee. Ten tweede bestaat
 * één inkt uit honderden tinten door de ongelijke druk; zonder afronden op een
 * grof raster krijg je vier keer bijna hetzelfde zwart terug in plaats van de
 * vier inkten die er echt liggen.
 *
 * @param {Uint8Array|Buffer|number[]} pixels  RGBA achter elkaar
 * @param {object} opties
 * @param {number} [opties.hoeveel]      hoeveel inkten je maximaal wilt
 * @param {number} [opties.minAlpha]     hoe dekkend een pixel moet zijn om te tellen
 * @param {number} [opties.minAfstand]   hoe ver twee inkten uit elkaar moeten liggen
 * @returns {string[]} hexkleuren, meest voorkomend eerst
 */
export function inktKleuren (pixels, {
  hoeveel = 4, minAlpha = 150, minAfstand = 60
} = {}) {
  const bakken = new Map()

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < minAlpha) continue

    // afronden op stappen van 24: fijn genoeg om brick red van ochre te
    // onderscheiden, grof genoeg om één inkt één bak te laten zijn
    const r = Math.round(pixels[i] / 24) * 24
    const g = Math.round(pixels[i + 1] / 24) * 24
    const b = Math.round(pixels[i + 2] / 24) * 24

    const sleutel = `${r},${g},${b}`
    const bak = bakken.get(sleutel)
    if (bak) {
      bak.n++
      bak.som[0] += pixels[i]
      bak.som[1] += pixels[i + 1]
      bak.som[2] += pixels[i + 2]
    } else {
      bakken.set(sleutel, { n: 1, som: [pixels[i], pixels[i + 1], pixels[i + 2]] })
    }
  }

  const gesorteerd = [...bakken.values()]
    .sort((a, b) => b.n - a.n)
    .map(bak => bak.som.map(s => s / bak.n))

  const uit = []
  for (const kleur of gesorteerd) {
    if (uit.length >= hoeveel) break
    if (uit.some(gekozen => afstand(gekozen, kleur) < minAfstand)) continue
    uit.push(kleur)
  }

  return uit.map(([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`)
}
