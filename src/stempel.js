/**
 * Maakt van elke heropfoto een gesneden rubberstempel.
 *
 *   node src/stempel.js              alle dagen, slaat over wat er al staat
 *   node src/stempel.js 3            alleen dag 3
 *   node src/stempel.js 3 --opnieuw  ook als het er al staat
 *   node src/stempel.js --snel       het lichtere model, om een prompt te proberen
 *   node src/stempel.js --herzet     de bewaarde platen opnieuw sleutelen, gratis
 *   node src/stempel.js --drempel=.1 strenger het papier eraf halen
 *   node src/stempel.js --kleur=1.6  de steunkleuren voller of juist rustiger
 *
 * Wat hier gebeurt en waarom juist dit:
 *
 * Het model tekent alléén de stempel. De foto, het papier, de typografie en de
 * cijfers maakt dit project zelf, op 600 dpi en uit de echte route. Laat je het
 * model de hele poster maken, dan staan er verzonnen kilometers op en is er
 * daarna niets meer bij te stellen.
 *
 * De afdruk komt op papier terug, want dat is wat je vraagt: een stempel op een
 * vel. Maar op de pagina ligt er al papier, dus dat vel moet er weer af. Dat
 * gebeurt door de helderheid in doorzichtigheid om te zetten: waar de plaat wit
 * is wordt hij doorzichtig, waar de inkt ligt blijft hij staan, en alles
 * daartussen - de droge plekken, de korrel, de ongelijke druk - blijft
 * halfdoorzichtig. Precies dat tussengebied is waar een stempel op lijkt.
 *
 * Alles is te herhalen: draai je het nog eens, dan slaat hij over wat er al is,
 * tenzij je --opnieuw meegeeft. API-aanroepen kosten geld.
 */

import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'
import { genereerFoto, haalGoogleSleutel } from './fetch/nanobanana.js'
import {
  fotosPerDag, inktKleuren, stempelPrompt, veldnotitieConcept, versterkKleur,
  HERO_MAP, RAW_SOORTEN
} from './hero.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UIT = join(ROOT, 'data', 'hero')

/**
 * De platen zoals het model ze teruggaf, vóór het papier eraf gesleuteld is.
 *
 * Dit is het enige in dit hele project dat geld kost en niet opnieuw te maken
 * is: hetzelfde verzoek geeft een andere afdruk terug, dus een weggegooide plaat
 * is voorgoed weg. Ze blijven daarom staan, en het sleutelen gebeurt er daarna
 * uit. Wil je de drempel anders, dan is dat gratis - zie --herzet.
 */
const RUW = join(UIT, 'ruw')

/**
 * Waar de plaat van deze variant staat.
 *
 * Elke --opnieuw vraagt een volgende variant, en die krijgt zijn eigen bestand.
 * Vroeger overschreef hij gewoon de vorige, en dat is één keer te vaak bijna
 * misgegaan: verander je ook de prompt, dan zit de oude afdruk daarna alleen nog
 * in de schijfcache van nanobanana.js, achter de óude prompttekst. Onvindbaar in
 * de praktijk, en een gekochte plaat is niet opnieuw te maken.
 *
 * Variant 1 houdt zijn kale naam, want zo staan de platen er nu al op schijf.
 * Teruggaan naar een oudere afdruk is daarmee gratis: zet "variant" terug in
 * data/hero/dag-NN.json en draai --herzet.
 */
const plaatNaam = (merk, variant) => join(RUW, variant > 1 ? `${merk}-v${variant}.jpg` : `${merk}.jpg`)

/**
 * Welk model de stempels snijdt.
 *
 * Nano Banana Pro is het duurste en het enige dat de misregistratie tussen de
 * kleurlagen echt begrijpt in plaats van er een slagschaduw van te maken. Het
 * praten met Google zelf staat in src/fetch/nanobanana.js - inclusief de
 * schijfcache, dus dezelfde foto met dezelfde prompt kost maar een keer geld.
 */
const MODEL = 'nano-banana-pro'

/** Het lichtere model, voor als je alleen even een prompt wilt proberen. */
const SNEL = 'nano-banana-2'

/** Wat er naar het model gaat: groot genoeg om detail te zien, klein genoeg om snel te zijn. */
const INVOER_PX = 1536

/** Wat er van de foto's zelf bewaard wordt, voor als je de band op 'foto' zet. */
const FOTO_PX = 2400

/**
 * De maat waarop een gesleutelde afdruk wordt weggeschreven.
 *
 * Het model levert 4096 bij 4096, en dat is voor het archief prima - maar een
 * stempel staat hooguit honderdtwintig millimeter breed op de pagina, en dat is
 * op 600 dpi nog geen 2900 beeldpunten. De volle plaat wegschrijven kostte 36 MB
 * per stempel: onbruikbaar in git, en de browser moet het ook nog inladen.
 *
 * De ruwe plaat blijft wel op volle maat in data/hero/ruw/, dus er gaat niets
 * verloren; wil je later groter, dan sleutel je hem opnieuw uit het archief.
 */
const STEMPEL_PX = 2400

const bestaat = async pad => access(pad).then(() => true, () => false)

/** ------------------------------------------------------------- de foto's */

/**
 * Een foto als JPEG in het geheugen, ongeacht waar hij vandaan komt.
 *
 * sharp kan geen Sony-RAW - libvips heeft geen RAW-decoder - maar macOS wel, via
 * ImageIO. Dus gaat een ARW eerst even door sips heen. Dat is geen omweg maar de
 * enige route die geen extra afhankelijkheid van honderden megabytes vraagt.
 */
async function leesFoto (pad) {
  const soort = extname(pad).slice(1).toLowerCase()
  if (!RAW_SOORTEN.has(soort)) return readFile(pad)

  const doel = join(await mkdtempScratch(), 'raw.jpg')
  await draai('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '95', pad, '--out', doel])
  return readFile(doel)
}

let scratch = null
async function mkdtempScratch () {
  if (!scratch) {
    scratch = join(tmpdir(), `ijsland-stempel-${process.pid}`)
    await mkdir(scratch, { recursive: true })
  }
  return scratch
}

function draai (commando, argumenten) {
  return new Promise((klaar, stuk) => {
    const kind = spawn(commando, argumenten, { stdio: ['ignore', 'ignore', 'pipe'] })
    let fout = ''
    kind.stderr.on('data', d => { fout += d })
    kind.on('error', stuk)
    kind.on('close', code => code === 0
      ? klaar()
      : stuk(new Error(`${commando} gaf ${code}: ${fout.trim().slice(0, 200)}`)))
  })
}

/** ------------------------------------------------- de plaat op de pagina */

/**
 * Waar het papier van het model ligt, per kanaal.
 *
 * Dit is het getal waar alles om draait: hoger dan het echte papier en er blijft
 * een grijzige rechthoek om de afdruk staan, lager en de lichtste inkt verdwijnt.
 *
 * Gemeten als percentiel over de héle plaat, en niet over de buitenrand. De rand
 * lijkt logischer - daar hoort papier te liggen - maar bij een afdruk die tot in
 * de hoek doorloopt zit die rand vol inkt, en dan meet je het papier te donker.
 * Precies dat gebeurde bij twee van de twaalf. Over de hele plaat gemeten maakt
 * het niet uit waar de tekening staat: deze afdrukken zijn maar zes tot dertien
 * procent inkt, dus het vijfenzestigste percentiel ligt altijd ruim in het papier.
 *
 * Per kanaal apart, want het vel is warm: rood ligt hoger dan blauw. Met één
 * grijswaarde zou de hele afdruk koeler worden.
 *
 * De marge van drie procent eronder is er zodat de korrel van het vel ook
 * dichtklapt. Zonder die marge blijft de helft van het papier net onder wit
 * hangen, en dat zie je op een witte pagina als een vlek - op het papier van de
 * veldnotitie-stijl viel het weg, en dus was het precies het soort fout dat pas
 * op de drukproef opvalt.
 */
const PAPIER_PERCENTIEL = 0.65
const PAPIER_MARGE = 0.97

function witpuntVan (data, kanalen) {
  const punten = data.length / kanalen

  return [0, 1, 2].map(k => {
    const telling = new Uint32Array(256)
    for (let i = k; i < data.length; i += kanalen) telling[data[i]]++

    let opgeteld = 0
    for (let v = 0; v < 256; v++) {
      opgeteld += telling[v]
      if (opgeteld >= punten * PAPIER_PERCENTIEL) {
        return Math.max(v * PAPIER_MARGE, 140)
      }
    }
    return 255
  })
}

/**
 * Waar de inkt staat, als rechthoek om uit te snijden.
 *
 * Het model levert een vierkante plaat met het motief ergens in het midden en
 * een brede rand papier eromheen. Die rand hoort er in de afdruk niet bij: op de
 * pagina is het element net zo groot als de plaat, dus je sleept en schaalt aan
 * een vak dat twee keer zo groot is als wat je ziet, en er is niet aan te wijzen
 * waar de stempel nou eigenlijk zit.
 *
 * Het kader ligt om de buitenste zichtbare inkt, zonder papier eromheen. Dat is
 * precies wat je op de pagina wilt kunnen pakken: het vak dat je versleept valt
 * samen met wat je ziet staan.
 *
 * Zichtbaar is hier het woord dat telt, en daarom rekent dit met dezelfde
 * drempel als de stempel zelf. Onder die drempel wordt een pixel straks
 * doorzichtig gemaakt, dus een flauwe waas die nu nog meetelt is op het vel
 * niets - en een kader dat daar toch omheen loopt geeft precies de lege rand
 * terug die we eraf wilden hebben. Dat scheelde op een geiser een derde van de
 * breedte aan leeg papier.
 */

/**
 * Hoe vol een pixel moet zijn om de rand van het kader te mogen zetten.
 *
 * Niet elke pixel die nét boven de drempel uitkomt: dan zet één korrel in de
 * hoek het kader alsnog op de hele plaat. Een vijfde dekking is een streek van
 * de pen of een rand van een wassing, en dat is wat we zoeken.
 */
const RAND_DEKKING = 0.2

/**
 * Hoeveel inkt er in een cel moet liggen voordat die cel bij de tekening hoort.
 *
 * Eerst grof kijken, dan pas fijn. Het vel van het model heeft losse donkere
 * korrels tot in de hoeken, en op één zo'n korrel afgaan rekt het kader meteen
 * weer op tot de hele plaat - wat precies gebeurde: nul tot zes procent eraf,
 * terwijl de afdruk maar de helft van het vel beslaat.
 *
 * Dus wordt de plaat eerst in cellen van ongeveer een honderdtwintigste
 * verdeeld, en telt een cel pas mee als er gemiddeld twee procent inkt in ligt.
 * Een korrel haalt dat niet, de dunste arcering ruim wel. Binnen de cellen die
 * overblijven wordt daarna alsnog op de pixel gezocht, zodat het kader strak om
 * de tekening ligt en niet om een raster.
 */
const RASTER = 128
const CEL_DEKKING = 0.02

function inktKader (rgba, width, height, papier, drempel) {
  const cel = Math.max(8, Math.round(Math.max(width, height) / RASTER))
  const kolommen = Math.ceil(width / cel)
  const rijen = Math.ceil(height / cel)

  // De dekking van elke pixel zoals de stempel hem straks krijgt: hoe donker
  // ten opzichte van het papier, met de drempel er alvast af.
  const dekking = new Float32Array(width * height)
  const perCel = new Float64Array(kolommen * rijen)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const licht = rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114
      const rauw = 1 - licht / papier
      const d = rauw <= drempel ? 0 : (rauw - drempel) / (1 - drempel)
      dekking[y * width + x] = d
      perCel[((y / cel) | 0) * kolommen + ((x / cel) | 0)] += d
    }
  }

  let celLinks = kolommen
  let celRechts = -1
  let celBoven = rijen
  let celOnder = -1

  for (let j = 0; j < rijen; j++) {
    for (let i = 0; i < kolommen; i++) {
      const pixels = Math.min(cel, width - i * cel) * Math.min(cel, height - j * cel)
      if (perCel[j * kolommen + i] / pixels < CEL_DEKKING) continue
      if (i < celLinks) celLinks = i
      if (i > celRechts) celRechts = i
      if (j < celBoven) celBoven = j
      if (j > celOnder) celOnder = j
    }
  }

  // Geen afdruk gevonden - dan maar de hele plaat, dat is beter dan niets.
  if (celRechts < 0) return { left: 0, top: 0, width, height }

  // Eén cel speling eromheen, zodat de fijne zoektocht ook de uitlopers pakt
  // die net buiten de laatste volle cel vallen.
  const x0 = Math.max(0, (celLinks - 1) * cel)
  const x1 = Math.min(width - 1, (celRechts + 2) * cel - 1)
  const y0 = Math.max(0, (celBoven - 1) * cel)
  const y1 = Math.min(height - 1, (celOnder + 2) * cel - 1)

  let links = x1
  let rechts = x0
  let boven = y1
  let onder = y0

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (dekking[y * width + x] < RAND_DEKKING) continue
      if (x < links) links = x
      if (x > rechts) rechts = x
      if (y < boven) boven = y
      if (y > onder) onder = y
    }
  }

  // Wel cellen met inkt, maar geen enkele pixel die vol genoeg is: dan is het
  // raster het beste antwoord dat er is.
  if (rechts < links || onder < boven) {
    return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
  }

  return {
    left: links,
    top: boven,
    width: rechts - links + 1,
    height: onder - boven + 1
  }
}

/**
 * De twee bruikbare versies van een plaat, in één keer.
 *
 * Ze delen het witpunt en het uitsnijkader, en dat moet ook: anders staan de
 * afdruk-met-papier en de uitgesleutelde versie niet even groot en verspringt de
 * stempel zodra je in het paneel van de een naar de ander wisselt.
 *
 * `plaat` is de afdruk zoals het model hem gaf, met alleen zijn papier naar wit
 * teruggerekend. Wit vermenigvuldigt tot niets, dus die kun je optisch op het
 * papier van de pagina drukken zonder dat er een vel onder blijft liggen.
 *
 * `stempel` heeft echte doorzichtigheid: de helderheid is omgezet in dekking, dus
 * volle inkt blijft staan, papier verdwijnt, en alles daartussen - de droge
 * plekken, de korrel, de ongelijke druk - blijft halfdoorzichtig. Juist dat
 * tussengebied is waar een stempel op lijkt; een harde drempel maakt er een
 * uitgeknipt silhouet van.
 */
async function bewerkPlaat (plaat, { drempel, kleur }) {
  const beeld = sharp(plaat).ensureAlpha()
  const { width, height } = await beeld.metadata()
  const rgba = await beeld.raw().toBuffer()

  const witpunt = witpuntVan(rgba, 4)
  const papier = witpunt[0] * 0.299 + witpunt[1] * 0.587 + witpunt[2] * 0.114
  const kader = inktKader(rgba, width, height, papier, drempel)

  // --- de plaat: papier naar wit, doorzichtigheid weg
  //
  // De kleurversterking gaat er na de witpuntcorrectie overheen en niet ervoor:
  // pas dan liggen de steunkleuren op hun uiteindelijke helderheid, en die
  // helderheid bepaalt hoe zwaar versterkKleur ze aanpakt.
  const rgb = Buffer.allocUnsafe(width * height * 3)
  for (let p = 0, q = 0; p < rgba.length; p += 4, q += 3) {
    const [r, g, b] = versterkKleur(
      Math.min(255, Math.round((rgba[p] * 255) / witpunt[0])),
      Math.min(255, Math.round((rgba[p + 1] * 255) / witpunt[1])),
      Math.min(255, Math.round((rgba[p + 2] * 255) / witpunt[2])),
      kleur)
    rgb[q] = r
    rgb[q + 1] = g
    rgb[q + 2] = b
  }

  const plaatJpeg = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .extract(kader)
    .resize({ width: STEMPEL_PX, height: STEMPEL_PX, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
    .toBuffer()

  // --- de stempel: helderheid wordt dekking
  //
  // De dekking komt uit de helderheid zoals het model hem gaf, dus die wordt
  // eerst uitgerekend en pas daarna mag de kleur eroverheen. Andersom zou een
  // voller kleurvlak ook dekkender worden, en dan staan de plaat en de stempel
  // niet meer even zwaar op de pagina.
  for (let i = 0; i < rgba.length; i += 4) {
    const licht = rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114
    const dekking = 1 - licht / papier
    // onder de drempel is het papier en niet flauwe inkt; zonder dit houdt de
    // hele plaat een grauwe waas die op het vel als een vies vlak leest
    const uit = dekking <= drempel ? 0 : (dekking - drempel) / (1 - drempel)
    rgba[i + 3] = Math.round(Math.max(0, Math.min(1, uit)) * 255)

    const [r, g, b] = versterkKleur(rgba[i], rgba[i + 1], rgba[i + 2], kleur)
    rgba[i] = r
    rgba[i + 1] = g
    rgba[i + 2] = b
  }

  // Een PNG van korrelige inkt met zachte doorzichtigheid comprimeert vreselijk:
  // elke korrel is een eigen kleur. Een stempel heeft twee tot vier inkten, dus
  // 256 kleuren zijn ruim genoeg, en dat scheelt een orde van grootte. De
  // doorzichtigheid blijft daarbij gewoon overeind.
  const stempelPng = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract(kader)
    .resize({ width: STEMPEL_PX, height: STEMPEL_PX, fit: 'inside', withoutEnlargement: true })
    .png({ palette: true, colours: 256, compressionLevel: 9, effort: 10 })
    .toBuffer()

  return { plaatJpeg, stempelPng, rgba, kader }
}

/** ------------------------------------------------------------- per dag */

async function dagBestand (nummer) {
  const naam = `day-${String(nummer).padStart(2, '0')}.json`
  return JSON.parse(await readFile(join(ROOT, 'data', 'days', naam), 'utf8'))
}

async function doeDag (dag, fotos, { model, opnieuw, herzet, drempel, kleur }) {
  const nummer = String(dag.dag).padStart(2, '0')
  const notitie = {
    dag: dag.dag,
    ...veldnotitieConcept(dag),
    afdrukken: []
  }

  const bestaandPad = join(UIT, `dag-${nummer}.json`)
  const bestaand = await bestaat(bestaandPad)
    ? JSON.parse(await readFile(bestaandPad, 'utf8'))
    : null

  // wat er met de hand is bijgeschaafd blijft staan; alleen de afdrukken zelf
  // worden opnieuw gemaakt
  if (bestaand) {
    notitie.plaats = bestaand.plaats ?? notitie.plaats
    notitie.jaar = bestaand.jaar ?? notitie.jaar
    notitie.trefwoorden = bestaand.trefwoorden ?? notitie.trefwoorden
  }

  for (const [i, foto] of fotos.entries()) {
    const merk = `dag-${nummer}-${i + 1}`
    const stempelPad = join(UIT, `stempel-${merk}.png`)
    const plaatPad = join(UIT, `plaat-${merk}.jpg`)
    const fotoPad = join(UIT, `foto-${merk}.jpg`)
    const oud = bestaand?.afdrukken?.[i]
    // Elke --opnieuw vraagt een volgende variant, zodat je echt een nieuwe
    // afdruk krijgt en de vorige blijft staan voor het geval je hem toch mooier
    // vond.
    const variant = (oud?.variant ?? 1) + (opnieuw ? 1 : 0)
    const ruwPad = plaatNaam(merk, variant)

    // Wat er met de hand bij deze ene afdruk is gezet, en wat dus niet uit de
    // dag zelf af te leiden is: de regel die het model vertelt waar het bij
    // juist deze foto op moet letten.
    const nadruk = oud?.nadruk ?? ''

    if (!opnieuw && !herzet && await bestaat(plaatPad) && oud) {
      console.log(`  ${merk}  staat er al`)
      notitie.afdrukken.push(oud)
      continue
    }

    process.stdout.write(`  ${merk}  ${foto.naam} … `)

    // De plaat die er al ligt opnieuw sleutelen in plaats van hem opnieuw te
    // kopen. Hetzelfde verzoek geeft nooit exact dezelfde afdruk terug, dus dit
    // is niet alleen goedkoper - het is ook de enige manier om aan de drempel te
    // draaien zonder de afdruk kwijt te raken die je mooi vond.
    let plaat = null
    if (!opnieuw && await bestaat(ruwPad)) {
      plaat = await readFile(ruwPad)
      process.stdout.write('uit de bewaarde plaat … ')
    } else if (herzet) {
      console.log('geen bewaarde plaat, overgeslagen')
      if (oud) notitie.afdrukken.push(oud)
      continue
    }

    const bron = await leesFoto(join(ROOT, HERO_MAP, foto.naam))

    // de foto zelf bewaren: ingehouden gegradeerd, met fijne filmkorrel
    if (opnieuw || !await bestaat(fotoPad)) {
      await writeFile(fotoPad, await gradeer(bron))
    }

    if (!plaat) {
      // de invoer voor het model, kleiner
      const invoer = await sharp(bron).rotate()
        .resize({ width: INVOER_PX, height: INVOER_PX, fit: 'inside' })
        .jpeg({ quality: 92 }).toBuffer()

      plaat = await genereerFoto({
        prompt: stempelPrompt(dag, nadruk),
        model,
        verhouding: '1:1',
        formaat: '4K',
        // Bij --opnieuw een volgende variant vragen, anders geeft de schijfcache
        // van nanobanana.js keurig dezelfde afdruk terug en verandert er niets.
        variant,
        beelden: [{ data: invoer, mimeType: 'image/jpeg' }]
      })
      // eerst wegschrijven, dán bewerken: gaat het sleutelen mis, dan is de
      // gekochte plaat in elk geval binnen
      await writeFile(ruwPad, plaat)
    }

    // Allebei de versies in één keer, zodat ze hetzelfde witpunt en hetzelfde
    // uitsnijkader delen en dus even groot zijn.
    const { plaatJpeg, stempelPng, rgba, kader } = await bewerkPlaat(plaat, { drempel, kleur })
    await writeFile(plaatPad, plaatJpeg)
    await writeFile(stempelPad, stempelPng)

    const inkten = inktKleuren(rgba)
    const bijgesneden = Math.round(100 * (1 - (kader.width * kader.height) /
      ((await sharp(plaat).metadata()).width * (await sharp(plaat).metadata()).height)))
    console.log(`${(stempelPng.length / 1024).toFixed(0)} KB · ` +
      `${bijgesneden}% rand eraf · ${inkten.join(' ')}`)

    notitie.afdrukken.push({
      bron: foto.naam,
      variant,
      // meeschrijven, want dit blok wordt vers opgebouwd en zou de met de hand
      // bijgezette regel anders elke run kwijtraken
      ...(nadruk ? { nadruk } : {}),
      // Hoe breed de afdruk is ten opzichte van zijn hoogte. De pagina heeft dit
      // nodig vóórdat het plaatje geladen is: zonder de verhouding zou hij bij
      // het uitrekenen van de standaardplekken van vierkant uitgaan, en dan
      // schuiven liggende afdrukken over hun buurman heen.
      verhouding: Math.round((kader.width / kader.height) * 1000) / 1000,
      plaat: `plaat-${merk}.jpg`,
      stempel: `stempel-${merk}.png`,
      foto: `foto-${merk}.jpg`,
      inkten
    })
  }

  await writeFile(bestaandPad, JSON.stringify(notitie, null, 2) + '\n')
  return notitie
}

/**
 * De foto zoals hij in de band komt te staan.
 *
 * Ingehouden: een tikje warmte, een tikje uit de verzadiging, en fijne korrel
 * eroverheen. Niet meer dan dat - de foto is het feitelijke verslag van die dag
 * en hoort er niet uit te zien alsof er een filter overheen is gehaald.
 */
async function gradeer (ruw) {
  // Eerst echt uitrekenen, dan pas de korrel maken.
  //
  // metadata() op een pijplijn met een resize erin geeft de maat van de bron
  // terug en niet die van het resultaat - het beeld is op dat moment immers nog
  // niet gemaakt. De korrellaag werd daardoor zo groot als de originele foto, en
  // sharp weigert een laag die groter is dan waar hij op moet.
  const { data, info } = await sharp(ruw).rotate()
    .resize({ width: FOTO_PX, height: FOTO_PX, fit: 'inside' })
    .modulate({ saturation: 0.92, brightness: 1.02 })
    .linear(1.04, -4)
    .toBuffer({ resolveWithObject: true })

  const korrel = await sharp({
    create: {
      width: info.width,
      height: info.height,
      channels: 3,
      background: '#808080',
      noise: { type: 'gaussian', mean: 128, sigma: 7 }
    }
  }).png().toBuffer()

  return sharp(data)
    .composite([{ input: korrel, blend: 'overlay' }])
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toBuffer()
}

/** --------------------------------------------------------------- main */

const argumenten = process.argv.slice(2)
const opnieuw = argumenten.includes('--opnieuw')
const snel = argumenten.includes('--snel')
const herzet = argumenten.includes('--herzet')
const drempel = Number(argumenten.find(a => a.startsWith('--drempel='))?.split('=')[1] ?? 0.06)
/**
 * Hoe hard de steunkleuren worden bijgesteld.
 *
 * Dit getal is een keer van kant gewisseld en dat is het onthouden waard. Zolang
 * de prompt "keep them desaturated" zei kwamen de platen te bleek uit het model
 * en moest deze knop de kleur juist ophalen - 1,35 stond hier. Nu de prompt om
 * volle inkt vraagt komen ze er andersom uit: fel genoeg voor een reisposter,
 * en dat is niet waar dit boek op lijkt. Dus houdt hij ze nu in.
 *
 * Onder de 1 is dus geen fout maar het antwoord op een prompt die zijn werk te
 * goed doet. Zet je hem op 1, dan zie je de plaat precies zoals het model hem
 * gaf.
 */
const kleur = Number(argumenten.find(a => a.startsWith('--kleur='))?.split('=')[1] ?? 0.75)
const alleenDag = Number(argumenten.find(a => /^\d+$/.test(a)) ?? 0)

// Bij --herzet komt er geen enkele aanroep aan te pas, dus dan hoeft er ook geen
// sleutel te zijn. Anders meteen controleren: liever nu een duidelijke uitleg
// dan halverwege een rij foto's een 401.
if (!herzet) {
  try {
    await haalGoogleSleutel()
  } catch (fout) {
    console.error(`\n  ${fout.message}\n`)
    process.exit(1)
  }
}

const bestanden = await readdir(join(ROOT, HERO_MAP)).catch(() => [])
const perDag = fotosPerDag(bestanden)

if (!perDag.size) {
  console.error(`  Geen foto's gevonden in ${HERO_MAP}/. Verwacht namen als "Dag 3.jpg" of "Dag 5-2.ARW".`)
  process.exit(1)
}

await mkdir(RUW, { recursive: true })

const model = snel ? SNEL : MODEL
console.log(herzet
  ? `\nDe bewaarde platen opnieuw sleutelen, zonder het model - kleur ${kleur}, drempel ${drempel}\n`
  : `\nStempels maken met ${model} - kleur ${kleur}, drempel ${drempel}\n`)

for (const [dagNummer, fotos] of perDag) {
  if (alleenDag && dagNummer !== alleenDag) continue

  const dag = await dagBestand(dagNummer).catch(() => null)
  if (!dag) {
    console.log(`  dag ${dagNummer} heeft wel foto's maar geen dagbestand - overgeslagen`)
    continue
  }

  console.log(`Dag ${dagNummer}: ${dag.titel}`)
  try {
    await doeDag(dag, fotos, { model, opnieuw, herzet, drempel, kleur })
  } catch (fout) {
    console.error(`  mislukt: ${fout.message}`)
  }
  console.log()
}

const zonder = [...perDag.keys()]
console.log(`Klaar. Foto's gevonden voor dag ${zonder.join(', ')}.`)
console.log('De platen zoals het model ze gaf staan in data/hero/ruw/ - gooi die niet weg,')
console.log('want daarmee kun je gratis aan de drempel draaien: node src/stempel.js --herzet\n')
