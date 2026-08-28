/**
 * De stempels op de pagina: de band onderaan de cijferpagina, en de losse
 * afdruk in een hoek van de kaart.
 *
 * De afdrukken zelf komen van `node src/stempel.js` en staan in data/hero/. Hier
 * gaat het alleen over hoe ze op het vel terechtkomen.
 *
 * Waarom een eigen bestand: de cijferpagina en de kaartpagina zetten allebei
 * een stempel neer. Stond dit in een van de twee, dan bestond het binnen een
 * maand twee keer en liepen ze uiteen - net als bij statsdelen.js.
 *
 * Vormkeuzes:
 *   - de band is één blok en niet een stel losse stempels. Je verzet een rij,
 *     niet vier zegels apart; en een flexrij regelt de breedtes zelf, wat nodig
 *     is omdat een stempel vierkant is en een foto liggend.
 *   - de band hangt aan de ónderrand van de pagina en niet aan de tekst erboven.
 *     Anders schuift hij bij een lang dagverhaal van het blad af.
 *   - elke afdruk krijgt zijn eigen hoek, gezaaid op de dag. Kaarsrecht naast
 *     elkaar verraadt meteen dat er geen hand aan te pas kwam.
 */

import { zaadje } from '../render/papier.js'
import { mm, tekenVeldnotitie } from './statsdelen.js'
import { stempelNummer } from '../hero.js'

/**
 * Waar de gebakken bestanden staan.
 *
 * Relatief, en met opzet: op de previewserver komt dit uit op /api/hero/…, en op
 * GitHub Pages - waar de site in een map met de repo-naam staat - op
 * <repo>/api/hero/…. Eén adres dat het in allebei de gevallen goed doet, zodat
 * de statische schil er niets voor hoeft te onderscheppen.
 */
const heroPad = bestand => new URL(`api/hero/${bestand}`, document.baseURI).href

/**
 * Welk bestand er in de band komt.
 *
 * De plaat is de afdruk zoals het model hem gaf, met alleen zijn eigen papier
 * naar wit teruggerekend. Die gaat er met vermenigvuldigen op: wit
 * vermenigvuldigt tot niets, dus het vel van het model verdwijnt en de inkt
 * gedraagt zich als inkt op het papier van de pagina. Geen uitgeknipte rand, en
 * de korrel en de droge plekken blijven heel.
 *
 * De gesleutelde PNG is het alternatief voor wie een scherper uitgeknipte vorm
 * wil; die heeft echte doorzichtigheid en dus geen vermenigvuldiging nodig.
 */
function afdrukBron (afdruk, stijl) {
  if (stijl['postzegel.inhoud'] === 'foto') return heroPad(afdruk.foto)
  const alsPlaat = stijl['postzegel.inkt'] === 'vermenigvuldigen' && afdruk.plaat
  return heroPad(alsPlaat ? afdruk.plaat : afdruk.stempel)
}

/**
 * Of de afdrukken optisch op het papier gedrukt moeten worden.
 *
 * Dit moet op het buitenste blok gezet worden en niet op de afbeelding zelf.
 * mix-blend-mode mengt met wat eronder in dezelfde stapelcontext ligt, en zowel
 * de gedraaide zegel als de band met zijn verschuiving maken er een. Zet je het
 * op de afbeelding, dan mengt hij dus met het lege blokje eromheen in plaats van
 * met de pagina, en zie je precies wat je niet wilt: een grijs vlak.
 */
function vermenigvuldigt (stijl) {
  return stijl['postzegel.inkt'] === 'vermenigvuldigen' &&
    stijl['postzegel.inhoud'] !== 'foto'
}

/**
 * Eén afdruk, eventueel in een postzegel.
 *
 * De kartelrand is geen plaatje maar een masker van rondjes langs de vier
 * kanten: dan blijft hij scherp op elke resolutie en schaalt hij mee met de
 * maat, wat een gekartelde PNG geen van beide doet.
 */
function eenAfdruk (afdruk, { stijl, hoogteMm, nummer, hoek }) {
  const doos = document.createElement('div')
  doos.className = 'postzegel'

  const beeld = document.createElement('img')
  beeld.className = 'postzegel-afdruk'
  beeld.alt = ''
  beeld.src = afdrukBron(afdruk, stijl)
  beeld.style.height = mm(hoogteMm)
  // De scheefte op de afbeelding en niet op het blokje eromheen: dat blokje is
  // nu zelf het onderdeel dat je versleept, en de sleepcode zet daar zijn eigen
  // transform op. Twee transforms op één element betekent dat de laatste wint,
  // en dan stond alles ineens weer kaarsrecht.
  beeld.style.transform = `rotate(${hoek.toFixed(2)}deg)`

  // De dekking is letterlijk hoe hard er is aangedrukt. Bij vermenigvuldigen
  // mengt hij tussen "geen inkt" en "volle inkt" - precies wat een lichtere
  // aandruk op papier ook doet. Bij de gesleutelde versie werkt hij gewoon als
  // doorzichtigheid.
  //
  // De vermenigvuldiging zelf zit níét hier maar op de band. Zie vermenigvuldigt().
  beeld.style.opacity = String(stijl['postzegel.dekking'])

  if (stijl['postzegel.kartelrand']) {
    const vel = document.createElement('div')
    vel.className = 'postzegel-vel'
    vel.style.padding = mm(stijl['inzet.biesMm'] ?? 2)
    vel.style.background = stijl['papier.kleur']
    vel.style.setProperty('--tand', mm(stijl['inzet.tandMm'] ?? 1.9))
    vel.append(beeld)
    doos.append(vel)
  } else {
    doos.append(beeld)
  }

  if (nummer) doos.dataset.nummer = nummer
  return doos
}

/** Hoeveel er van de dag bekend is, met lege dagen er alvast uit. */
export function heeftAfdrukken (hero) {
  return Boolean(hero?.afdrukken?.length)
}

/**
 * De stempels onderaan de cijferpagina.
 *
 * Losse afdrukken, geen rij.
 *
 * Eerst zaten ze in een flexrij die de breedtes voor je uitrekende. Netjes, maar
 * verkeerd: een rij bepaalt waar zijn onderdelen staan, dus je kon er geen los
 * verslepen zonder dat de anderen mee opschoven, en er lag een vlak achter de
 * hele groep. Een afdruk op papier is niet uitgelijnd - hij ligt waar je hem
 * hebt neergedrukt. Dus staat elke stempel nu op zichzelf, met een eigen plek
 * die je verzet en een eigen maat die je sleept.
 *
 * De standaardplekken lopen van links naar rechts langs de onderrand, zodat het
 * er meteen goed uitziet zonder dat je iets hoeft te verslepen.
 *
 * @param {HTMLElement} opschriften
 * @param {object} hero        uit data/hero/dag-NN.json
 * @param {object} stijl
 * @param {object} maat        uit paginaMaat()
 * @param {number} marge       afloop plus veilige marge
 * @param {object} plaatsing   de bewaarde verschuivingen en maten per afdruk
 */
export function tekenStempelband (opschriften, hero, stijl, maat, marge, plaatsing = {}) {
  if (!stijl['postzegel.aan'] || !heeftAfdrukken(hero)) return null

  const rnd = zaadje(hero.dag * 31 + 7)
  const scheef = stijl['postzegel.scheefGraden']
  const totaal = hero.afdrukken.length
  const tussen = stijl['postzegel.tussenruimteMm']

  // Hoe hoog elke afdruk wordt: de basismaat maal wat je er zelf van gemaakt hebt.
  const maten = hero.afdrukken.map((_, i) =>
    stijl['postzegel.hoogteMm'] * (plaatsing?.[`postzegel:${i + 1}`]?.schaal ?? 1))

  // En hoe breed. De afdrukken zijn op hun inkt bijgesneden en dus niet vierkant;
  // de verhouding staat in het dagbestand omdat de plaatjes hier nog niet
  // geladen zijn en we de plekken al moeten weten.
  const verhoudingen = hero.afdrukken.map(a => a.verhouding ?? 1)

  // De standaardplekken worden op de bázismaat uitgerekend en niet op de maat
  // die de afdrukken nu hebben.
  //
  // Dat is het verschil tussen drie losse zegels en een rij. Rekende je de
  // plekken op de echte maten, dan verschuift de tweede zodra je de eerste
  // groter sleept - je verzet er dan één en er bewegen er drie. Nu heeft elke
  // afdruk zijn eigen vaste uitgangsplek, en groeit hij vanaf die plek naar
  // rechts. Waar je hem daarna zelf neerzet staat los van alle andere.
  const basis = stijl['postzegel.hoogteMm']
  const basisBreedtes = verhoudingen.map(v => basis * v)
  const basisSamen = basisBreedtes.reduce((s, b) => s + b, 0)
  const beschikbaar = maat.breedteMm - 2 * marge
  const samen = basisSamen + tussen * (totaal - 1)

  const beginX = {
    links: marge,
    midden: marge + (beschikbaar - samen) / 2,
    rechts: marge + beschikbaar - samen,
    gespreid: marge
  }[stijl['postzegel.uitlijning']] ?? marge

  // gespreid zet de eerste tegen links en de laatste tegen rechts
  const gat = stijl['postzegel.uitlijning'] === 'gespreid' && totaal > 1
    ? (beschikbaar - basisSamen) / (totaal - 1)
    : tussen

  const uit = []
  let x = beginX

  for (const [i, afdruk] of hero.afdrukken.entries()) {
    const nummer = stempelNummer(hero.dag, i + 1, totaal)
    const plek = `postzegel:${i + 1}`

    // Elke afdruk heeft zijn eigen maat, als echte hoogte in millimeters en niet
    // als beeldschaling. Vandaar 'hertekenen': dat vertelt de sleepcode dat dit
    // onderdeel zichzelf op zijn nieuwe maat opbouwt in plaats van uitgerekt te
    // worden - uitrekken maakt een afdruk van 600 dpi zichtbaar wazig.
    const zegel = eenAfdruk(afdruk, {
      stijl,
      hoogteMm: maten[i],
      nummer,
      hoek: (rnd() - 0.5) * 2 * scheef
    })
    zegel.setAttribute('data-plek', plek)
    zegel.setAttribute('data-schaalbaar', 'hertekenen')
    // Wel meegroeien onder je vinger: zonder voorbeeld sleep je blind en is een
    // afdruk zomaar een kwart van zijn maat zonder dat je het zag gebeuren.
    zegel.setAttribute('data-voorbeeld', '')
    zegel.setAttribute('data-knoppen', 'postzegel')
    // En hij blijft op de bladzijde. Een afdruk die je per ongeluk over de rand
    // sleept is weg: er is niets meer om aan te wijzen en terug te halen.
    zegel.setAttribute('data-binnen-marge', String(stijl['pagina.veiligeMargeMm']))
    zegel.style.left = mm(x)
    zegel.style.bottom = mm(marge + stijl['postzegel.onderMm'])

    // De vermenigvuldiging op de afdruk zelf, nu er geen rij meer omheen zit.
    // mix-blend-mode mengt met wat eronder in dezelfde stapelcontext ligt, en
    // dat is hier de pagina - precies wat we willen.
    if (vermenigvuldigt(stijl)) zegel.style.mixBlendMode = 'multiply'

    opschriften.append(zegel)
    uit.push(zegel)
    x += basisBreedtes[i] + gat
  }

  return { elementen: uit, hoogteMm: Math.max(...maten) + stijl['postzegel.onderMm'] }
}

/**
 * De eerste afdruk van de dag, klein in een hoek van de kaartpagina.
 *
 * Zodat de kaart en de cijfers van dezelfde dag bij elkaar horen zonder dat er
 * een kop boven hoeft.
 */
export function tekenStempelOpKaart (opschriften, hero, stijl, maat, marge) {
  if (!stijl['postzegel.opKaart'] || !heeftAfdrukken(hero)) return null

  const hoek = stijl['postzegel.opKaartHoek']
  const doos = document.createElement('div')
  doos.className = 'postzegel-kolom postzegel-opkaart'
  doos.setAttribute('data-plek', 'postzegelkaart')
  doos.setAttribute('data-schaalbaar', 'css')
  doos.setAttribute('data-knoppen', 'postzegel')

  doos.style[hoek.includes('links') ? 'left' : 'right'] = mm(marge)
  doos.style[hoek.includes('boven') ? 'top' : 'bottom'] = mm(marge)
  if (vermenigvuldigt(stijl)) doos.style.mixBlendMode = 'multiply'

  const rnd = zaadje(hero.dag * 31 + 7)
  doos.append(eenAfdruk(hero.afdrukken[0], {
    stijl,
    hoogteMm: stijl['postzegel.opKaartMm'],
    nummer: stempelNummer(hero.dag, 1, 1),
    hoek: (rnd() - 0.5) * 2 * stijl['postzegel.scheefGraden']
  }))

  tekenVeldnotitie(doos, {
    plaats: '',
    nummer: stempelNummer(hero.dag, 1, 1),
    jaar: '',
    trefwoorden: []
  }, stijl, hero.dag)

  opschriften.append(doos)
  return doos
}
