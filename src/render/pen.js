/**
 * De hand: lijnen, kaders en cirkels zoals iemand ze met een pen zet.
 *
 * Een lijn die met de hand getrokken is wijkt op twee schalen af. Hij golft
 * traag over zijn hele lengte, want een arm draait om een elleboog en niet om
 * een liniaal. En hij trilt niet: bij elk punt een nieuwe willekeurige waarde
 * nemen geeft ruis, en ruis leest als een slechte scan, niet als een hand.
 *
 * Dus zetten we een handvol knikpunten uit en trekken daar een gladde kromme
 * doorheen. Dat is het hele idee, en alles hieronder is een variatie erop.
 *
 * Waarom hier en niet in de pagina die het gebruikt: net als profielvorm.js en
 * papier.js is dit rekenwerk zonder DOM. Zo is het zonder browser te testen, en
 * kan een tweede pagina er morgen bij zonder dat de functies mee moeten
 * verhuizen.
 *
 * Alles rekent in millimeters op de pagina, en alles krijgt zijn toeval via een
 * gezaaide rnd() van buiten. Nooit Math.random(): dan danst de tekening bij elke
 * hertekening weg en wijkt de export af van wat je op het scherm goedkeurde.
 */

/** Afronden op duizendsten van een millimeter; fijner ziet geen enkele pers. */
const rond = n => Math.round(n * 1000) / 1000

/**
 * Een gladde kromme door de knikpunten (Catmull-Rom), fijn genoeg om op te meten.
 *
 * Fijn genoeg is hier belangrijk: de streepjes van de stops moeten precies op de
 * lijn staan, en dat gaat via yBij() over deze punten. Een grove kromme geeft
 * streepjes die naast hun lijn zweven.
 */
export function verdicht (controle, perStuk = 14) {
  if (controle.length < 2) return controle.slice()

  const p = [controle[0], ...controle, controle.at(-1)]
  const uit = []

  for (let i = 1; i < p.length - 2; i++) {
    for (let s = 0; s < perStuk; s++) {
      const t = s / perStuk
      const t2 = t * t
      const t3 = t2 * t
      const langs = (a, b, c, d) => 0.5 * (
        2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3
      )
      uit.push({
        x: langs(p[i - 1].x, p[i].x, p[i + 1].x, p[i + 2].x),
        y: langs(p[i - 1].y, p[i].y, p[i + 1].y, p[i + 2].y)
      })
    }
  }
  uit.push(controle.at(-1))
  return uit
}

/** Punten naar de d-eigenschap van een pad. */
export function padVan (punten, sluiten = false) {
  if (!punten.length) return ''
  const d = punten
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${rond(p.x)} ${rond(p.y)}`)
    .join(' ')
  return sluiten ? `${d} Z` : d
}

/**
 * Een rechte haal met de pen.
 *
 * @param {number} van        begin, langs de as waarin de lijn loopt
 * @param {number} tot        eind
 * @param {number} dwars      de andere as: de hoogte van een liggende lijn
 * @param {boolean} [staand]  true laat de lijn van boven naar beneden lopen
 */
export function penPunten (van, tot, dwars, { rnd, amplitudeMm, knikken = 7, staand = false }) {
  if (!(amplitudeMm > 0)) {
    return staand
      ? [{ x: dwars, y: van }, { x: dwars, y: tot }]
      : [{ x: van, y: dwars }, { x: tot, y: dwars }]
  }

  const controle = []
  for (let i = 0; i <= knikken; i++) {
    const deel = i / knikken
    controle.push({
      langs: van + (tot - van) * deel,
      af: dwars + (rnd() - 0.5) * amplitudeMm
    })
  }

  // een hand houdt het papier scheef: de hele lijn loopt een fractie op of af
  const helling = (rnd() - 0.5) * amplitudeMm * 0.8
  for (const [i, punt] of controle.entries()) {
    punt.af += helling * (i / knikken - 0.5)
  }

  return verdicht(controle.map(p => (
    staand ? { x: p.af, y: p.langs } : { x: p.langs, y: p.af }
  )))
}

/** Het stuk van een liggende lijn tot aan een x, met het laatste stukje uitgerekend. */
export function padTot (punten, xEind) {
  const uit = []
  for (const [i, p] of punten.entries()) {
    if (p.x <= xEind) {
      uit.push(p)
      continue
    }
    const vorige = punten[i - 1]
    if (vorige) {
      const deel = (xEind - vorige.x) / (p.x - vorige.x)
      uit.push({ x: xEind, y: vorige.y + (p.y - vorige.y) * deel })
    }
    break
  }
  return uit.length > 1 ? uit : punten.slice(0, 2)
}

/** De hoogte van een liggende lijn op een x, zodat er iets precies op kan staan. */
export function yBij (punten, x) {
  if (x <= punten[0].x) return punten[0].y
  for (let i = 1; i < punten.length; i++) {
    if (punten[i].x >= x) {
      const a = punten[i - 1]
      const b = punten[i]
      const deel = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x)
      return a.y + (b.y - a.y) * deel
    }
  }
  return punten.at(-1).y
}

/**
 * De omtrek van een afgerond vak, als punten met de klok mee.
 *
 * Begint linksboven, net voorbij de hoek. Zonder wiebel is dit gewoon een
 * afgeronde rechthoek; penKader() zet er de hand overheen.
 */
export function vakOmtrek (x, y, breedte, hoogte, hoekMm, stapMm = 0.7) {
  const r = Math.max(0, Math.min(hoekMm, breedte / 2, hoogte / 2))
  const x2 = x + breedte
  const y2 = y + hoogte
  const punten = []

  const recht = (ax, ay, bx, by) => {
    const stappen = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / stapMm))
    for (let i = 1; i <= stappen; i++) {
      punten.push({ x: ax + (bx - ax) * (i / stappen), y: ay + (by - ay) * (i / stappen) })
    }
  }

  const boog = (cx, cy, van, tot) => {
    const stappen = Math.max(2, Math.ceil((r * Math.abs(tot - van)) / stapMm))
    for (let i = 1; i <= stappen; i++) {
      const hoek = van + (tot - van) * (i / stappen)
      punten.push({ x: cx + Math.cos(hoek) * r, y: cy + Math.sin(hoek) * r })
    }
  }

  const H = Math.PI / 2
  punten.push({ x: x + r, y })
  recht(x + r, y, x2 - r, y)
  boog(x2 - r, y + r, -H, 0)
  recht(x2, y + r, x2, y2 - r)
  boog(x2 - r, y2 - r, 0, H)
  recht(x2 - r, y2, x + r, y2)
  boog(x + r, y2 - r, H, 2 * H)
  recht(x, y2 - r, x, y + r)
  boog(x + r, y + r, 2 * H, 3 * H)

  return punten
}

/**
 * Een vak met de hand getrokken: één haal die rond gaat en over zijn begin
 * heen schiet.
 *
 * Dat overschot is het hele punt. Een kader dat precies sluit is een rect met
 * ronde hoeken; een kader waarvan de staart een streepje voorbij het begin komt
 * is er eentje die iemand heeft getrokken.
 *
 * Geeft twee dingen terug: `haal` is wat je tekent, inclusief het overschot, en
 * `omtrek` is dezelfde vorm netjes gesloten. Die tweede is nodig om de vulling
 * op af te knippen - met de haal erbij zou de staart een flintertje inkt buiten
 * het vak laten liggen.
 */
export function penKader (x, y, breedte, hoogte, { rnd, amplitudeMm, hoekMm = 1.2, overschot = 0.06 }) {
  const ideaal = vakOmtrek(x, y, breedte, hoogte, hoekMm)
  const n = ideaal.length
  if (!(amplitudeMm > 0)) {
    return { omtrek: ideaal, haal: [...ideaal, ideaal[0], ideaal[1]] }
  }

  // een handvol golfwaarden, rond sluitend, en daartussen zacht overlopen
  const knikken = 9
  const golf = []
  for (let i = 0; i < knikken; i++) golf.push((rnd() - 0.5) * amplitudeMm)
  const golfBij = deel => {
    const plek = deel * knikken
    const i = Math.floor(plek)
    const t = plek - i
    const a = golf[((i % knikken) + knikken) % knikken]
    const b = golf[((i + 1) % knikken + knikken) % knikken]
    const zacht = (1 - Math.cos(t * Math.PI)) / 2
    return a + (b - a) * zacht
  }

  // elk punt loodrecht op zijn eigen richting opzij zetten
  const omtrek = ideaal.map((p, i) => {
    const vorige = ideaal[(i - 1 + n) % n]
    const volgende = ideaal[(i + 1) % n]
    const dx = volgende.x - vorige.x
    const dy = volgende.y - vorige.y
    const lengte = Math.hypot(dx, dy) || 1
    const af = golfBij(i / n)
    return { x: p.x + (dy / lengte) * af, y: p.y - (dx / lengte) * af }
  })

  // en dan nog een stukje door, voorbij het begin
  const extra = Math.max(2, Math.round(n * overschot))
  return { omtrek, haal: [...omtrek, ...omtrek.slice(0, extra)] }
}

/**
 * Een cirkel met de pen: begint ergens links, loopt door voorbij het begin.
 *
 * Zelfde reden als bij het kader. Een cirkel die precies sluit is een ellips uit
 * een tekenprogramma; een cirkel waarvan de staart over het begin heen schiet is
 * er eentje die iemand om een woord heeft gezet.
 */
export function penCirkel (cx, cy, rx, ry, { rnd, wiebel = 0.5 }) {
  const van = Math.PI * (0.8 + rnd() * 0.3)
  const tot = van + Math.PI * 2 + 0.4 + rnd() * 0.5
  const stappen = 44
  const punten = []

  for (let i = 0; i <= stappen; i++) {
    const hoek = van + (tot - van) * (i / stappen)
    const rek = 1 + (rnd() - 0.5) * wiebel * 0.22
    punten.push({ x: cx + Math.cos(hoek) * rx * rek, y: cy + Math.sin(hoek) * ry * rek })
  }
  return punten
}

/**
 * De omtrek van een strookje dat uit een blaadje is gescheurd.
 *
 * Alleen boven en onder gescheurd: het strookje is paginabreed, dus links en
 * rechts loopt het gewoon de afloop in. Een scheur die aan vier kanten rondloopt
 * zou het een kaartje maken in plaats van een strook.
 */
export function scheurPad (breedte, boven, onder, rnd) {
  const stap = 2.4

  const rand = (y, naarBinnen) => {
    const punten = []
    for (let x = 0; x <= breedte - stap; x += stap) {
      // af en toe een grotere hap: een scheur is niet gelijkmatig
      const hap = rnd() < 0.14 ? 0.55 : 0
      punten.push({ x, y: y + naarBinnen * ((rnd() - 0.3) * 0.75 + hap) })
    }
    punten.push({ x: breedte, y: y + naarBinnen * (rnd() - 0.3) * 0.75 })
    return punten
  }

  return [...rand(boven, 1), ...rand(onder, -1).reverse()]
}
