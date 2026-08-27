/**
 * De statistiekpagina: hoogteprofiel, kerncijfers en je eigen tekst.
 *
 * Wat deze pagina deelt met de reiscijferpagina staat in statsdelen.js.
 *
 * Vormkeuzes bewust gemaakt en niet op gevoel:
 *   - het hoogteprofiel is een oppervlaktegrafiek over de afgelegde kilometers,
 *     want de vraag is "hoe liep de dag", niet "hoe hoog was punt X"
 *   - één verticale as, nooit twee: twee assen op één grafiek laat je van alles
 *     lezen wat er niet staat
 *   - kerncijfers zijn grote getallen, geen grafiekjes; een enkel getal is geen
 *     verdeling en verdient geen assenstelsel
 *   - alleen het hoogste punt krijgt een label, niet elk meetpunt
 *   - geen hover of donkere modus: dit gaat naar papier
 *   - de stempelband hangt aan de onderrand en niet aan de tekst erboven, zodat
 *     een lang dagverhaal hem niet van het blad duwt
 */

import { paginaMaat } from '../render/layout.js'
import { bouwSvg, profielVorm, vormSchaal, VORM_INFO } from '../render/profielvorm.js'
import { weerTekenKnoop } from '../render/weertekens.js'
import {
  maakSvg, mm, asStap, leesbareDatum, weerTeken,
  dagCijfers, stopAfstanden, tekenAchtergrond, tekenBron, tekenCijferrij, tekenTitelblok
} from './statsdelen.js'
import { tekenStempelband } from './postzegel.js'

export { weerTeken }

/**
 * Het temperatuurverloop van de dag, naast het hoogteprofiel.
 *
 * Dezelfde vorm als het hoogteprofiel - een oppervlaktegrafiek met de tijd
 * langs de onderkant - want het is dezelfde soort vraag: hoe liep de dag. Twee
 * grafieken die hetzelfde werken lees je in één beweging; twee die elk hun
 * eigen taal spreken kosten twee keer nadenken.
 *
 * De verticale as begint bewust niet bij nul. Bij hoogte is nul zeeniveau en
 * dus betekenisvol, maar bij temperatuur is nul niets bijzonders: een dag van
 * 9 tot 12 graden zou als een vlakke streep onderin verdwijnen terwijl juist
 * die drie graden het verhaal zijn. Wel staat de nullijn erbij zodra het
 * gevroren heeft, want dan is die grens wél iets.
 */
function tekenTemperatuur (svg, opschriften, uren, vak, stijl) {
  const { links, rechts, boven, onder } = vak
  const breedte = rechts - links
  const hoogte = onder - boven

  const graden = uren.map(u => u.tempC)
  const laagste = Math.min(...graden)
  const hoogste = Math.max(...graden)

  // altijd wat lucht, en bij een vlakke dag een minimale spanwijdte zodat de
  // lijn niet als een kaarsrechte streep in het midden komt te liggen
  const midden = (laagste + hoogste) / 2
  const spanwijdte = Math.max(hoogste - laagste, 4)
  const onderGrens = Math.floor(midden - spanwijdte * 0.75)
  const bovenGrens = Math.ceil(midden + spanwijdte * 0.75)

  const xVan = uur => links + (uur / 24) * breedte
  const yVan = t => onder - ((t - onderGrens) / (bovenGrens - onderGrens)) * hoogte

  // --- raster met de gradenschaal
  const stap = asStap(bovenGrens - onderGrens, 4)
  for (let t = Math.ceil(onderGrens / stap) * stap; t <= bovenGrens; t += stap) {
    const nul = t === 0
    svg.append(maakSvg('line', {
      x1: links, x2: rechts, y1: yVan(t), y2: yVan(t),
      stroke: nul ? '#b9b2a8' : '#e0dcd5',
      'stroke-width': nul ? 0.25 : 0.12
    }))
    const label = maakSvg('text', {
      x: links - 2, y: yVan(t) + 0.9,
      'text-anchor': 'end', 'font-size': 2.4, fill: stijl['statistieken.labelKleur']
    })
    label.textContent = `${t}`
    svg.append(label)
  }

  const eenheid = maakSvg('text', {
    x: links - 2, y: boven - 3,
    'text-anchor': 'end', 'font-size': 2.2, fill: stijl['statistieken.labelKleur']
  })
  eenheid.textContent = '°C'
  svg.append(eenheid)

  // --- het vlak onder de lijn
  //
  // Het laatste meetpunt is 23:00, maar de as loopt tot 24. Zonder deze
  // verlenging houdt het vlak een uur voor de rechterrand op en lijkt het alsof
  // de dag daar ophield.
  const punten = uren.map(u => ({ x: xVan(u.uur), y: yVan(u.tempC) }))
  if (uren.at(-1).uur < 24) {
    punten.push({ x: xVan(24), y: yVan(uren.at(-1).tempC) })
  }

  const lijn = punten.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')

  // Een verloop dat naar onderen wegvalt, zoals het hoogteprofiel er ook een
  // heeft. Een egaal vlak wordt een oranje blok naast een zachte groene berg,
  // en dan lijken de twee grafieken van verschillende pagina's te komen.
  const defs = maakSvg('defs')
  const verloop = maakSvg('linearGradient', {
    id: 'tempverloop', x1: '0', y1: '0', x2: '0', y2: '1'
  })
  verloop.append(maakSvg('stop', {
    offset: '0',
    'stop-color': stijl['profiel.tempVulKleur'],
    'stop-opacity': stijl['profiel.verloopDekking']
  }))
  verloop.append(maakSvg('stop', {
    offset: '1',
    'stop-color': stijl['profiel.tempVulKleur'],
    'stop-opacity': stijl['profiel.verloopDekking'] * 0.18
  }))
  defs.append(verloop)
  svg.append(defs)

  svg.append(maakSvg('path', {
    d: `${lijn} L ${punten.at(-1).x.toFixed(2)} ${onder} L ${punten[0].x.toFixed(2)} ${onder} Z`,
    fill: 'url(#tempverloop)'
  }))

  svg.append(maakSvg('path', {
    d: lijn,
    fill: 'none',
    stroke: stijl['profiel.tempLijnKleur'],
    'stroke-width': stijl['profiel.lijnDikteMm'],
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round'
  }))

  // --- de uren langs de onderkant, om de zes
  for (let uur = 0; uur <= 24; uur += 6) {
    const x = xVan(uur)
    svg.append(maakSvg('line', {
      x1: x, x2: x, y1: onder, y2: onder + 1.4,
      stroke: '#c9c2b6', 'stroke-width': 0.2
    }))
    const t = maakSvg('text', {
      x, y: onder + 4.4,
      'text-anchor': uur === 0 ? 'start' : uur === 24 ? 'end' : 'middle',
      'font-size': 2.4, fill: stijl['statistieken.labelKleur']
    })
    t.textContent = uur === 24 ? '24u' : `${uur}`
    svg.append(t)
  }

  // --- de weertekens, om de twee uur
  //
  // Als notatie en niet als emoji: een open rondje is een heldere hemel, een
  // dichtgemaakt rondje een gesloten wolkendek, drie liggende streepjes mist,
  // twee stippen regen, een sterretje sneeuw. Dat is de notatie waarmee
  // weerwaarnemers het al anderhalve eeuw op hun kaarten zetten, en daarmee het
  // enige tekentje op deze bladzijde dat iemand met een schrift ook echt zo zou
  // hebben gezet. Wat de tekens zijn staat in render/weertekens.js; de emoji
  // blijven als keuze bestaan.
  //
  // In een strook langs de bovenkant en niet op de lijn zelf: op de lijn
  // zouden ze op een koude ochtend onderin plakken en op een warme middag
  // bovenin, waardoor het rijtje gaat golven en je het als een tweede grafiek
  // gaat lezen. Op één hoogte lees je ze als wat ze zijn - een tijdlijn van het
  // weer, boven de temperatuur die eronder loopt.
  if (stijl['profiel.weertekensAan']) {
    const tekenMaat = stijl['profiel.weertekenMm']
    const vorm = stijl['profiel.weertekenVorm']
    const getekend = vorm === 'notatie' || vorm === 'gekleurd'
    const tekenY = boven + tekenMaat * (getekend ? 0.55 : 0.85)
    const palet = {
      zon: stijl['profiel.weerZon'],
      wolk: stijl['profiel.weerWolk'],
      neerslag: stijl['profiel.weerNeerslag'],
      sneeuw: stijl['profiel.weerSneeuw']
    }

    for (const u of uren) {
      if (u.uur % 2 !== 0) continue
      if (u.code === null || u.code === undefined) continue

      const x = xVan(u.uur + 1)   // midden van het blok van twee uur

      if (getekend) {
        const knoop = weerTekenKnoop(u.code, {
          x, y: tekenY, maatMm: tekenMaat, vorm, palet,
          kleur: stijl['profiel.weertekenKleur']
        })
        if (knoop) svg.append(bouwSvg(knoop))
        continue
      }

      const teken = maakSvg('text', {
        x, y: tekenY, 'text-anchor': 'middle', 'font-size': tekenMaat
      })
      teken.textContent = weerTeken(u.code)
      svg.append(teken)
    }
  }

  // --- het hoogste punt benoemen, net als bij het hoogteprofiel
  const top = uren.reduce((a, b) => b.tempC > a.tempC ? b : a)
  const merk = maakSvg('text', {
    x: xVan(top.uur), y: yVan(top.tempC) - 2,
    'text-anchor': 'middle', 'font-size': 2.6, 'font-weight': 650,
    fill: stijl['statistieken.getalKleur']
  })
  merk.textContent = `${top.tempC.toFixed(0)}°`
  svg.append(merk)
}

export function tekenStatistieken (svg, opschriften, gegevens, stijl) {
  const maat = paginaMaat(stijl)
  const marge = maat.afloopMm + stijl['pagina.veiligeMargeMm']

  svg.setAttribute('viewBox', `0 0 ${maat.breedteMm} ${maat.hoogteMm}`)
  svg.replaceChildren()
  opschriften.replaceChildren()

  tekenAchtergrond(svg, stijl, maat, {
    profiel: gegevens.profiel ?? [], zaad: gegevens.dag.dag, id: 'stats'
  })

  // ------------------------------------------------------------- titelblok
  tekenTitelblok(opschriften, stijl, {
    marge,
    boven: `Dag ${gegevens.dag.dag} · ${leesbareDatum(gegevens.dag.datum)}`,
    titel: gegevens.dag.titel,
    tekstSleutel: 'titel'
  })

  // ------------------------------------------- hoogteprofiel en temperatuur
  //
  // Staat de temperatuurgrafiek aan, dan delen de twee de breedte gelijk: allebei
  // de helft, met een gang ertussen en elk een eigen strook voor zijn aslabels.
  // Zonder temperatuur houdt het hoogteprofiel de hele breedte, zoals eerst.
  const profiel = (gegevens.profiel ?? []).filter(p => p.hoogteM !== null)
  const uren = stijl['profiel.temperatuurAan'] ? (gegevens.weer?.uren ?? []) : []
  const tweeGrafieken = uren.length > 1

  const AS_STROOK = 12   // ruimte links van een grafiek voor zijn getallen
  const GANG = 12        // ruimte tussen de twee grafieken

  const grafiekBoven = marge + stijl['typografie.titelMm'] + stijl['typografie.datumMm'] + 18
  const grafiekHoogte = stijl['profiel.hoogteMm']
  const grafiekOnder = grafiekBoven + grafiekHoogte

  const beschikbaar = maat.breedteMm - 2 * marge
  const vakBreedte = tweeGrafieken
    ? (beschikbaar - GANG - 2 * AS_STROOK) / 2
    : beschikbaar - AS_STROOK

  const grafiekLinks = marge + AS_STROOK       // ruimte voor de hoogtes langs de as
  const grafiekRechts = grafiekLinks + vakBreedte
  const grafiekBreedte = vakBreedte

  const tempLinks = grafiekRechts + GANG + AS_STROOK
  const tempRechts = tempLinks + vakBreedte

  const naamBandMm = 22

  if (tweeGrafieken) {
    tekenTemperatuur(svg, opschriften, uren, {
      links: tempLinks, rechts: tempRechts, boven: grafiekBoven, onder: grafiekOnder
    }, stijl)
  }

  if (profiel.length > 1) {
    const maxKm = profiel.at(-1).afstandKm
    const hoogtes = profiel.map(p => p.hoogteM)
    const hoogste = Math.max(...hoogtes)

    // altijd vanaf zeeniveau: anders lijkt elke dag een bergetappe
    const bovenGrens = Math.max(50, hoogste * 1.12 * stijl['profiel.overdrijving'])

    const xVan = km => grafiekLinks + (km / maxKm) * grafiekBreedte
    const yVan = m => grafiekOnder - (m / bovenGrens) * grafiekHoogte

    const vorm = stijl['profiel.vorm']
    const hoogteAs = VORM_INFO[vorm]?.hoogteAs ?? true

    // --- raster: terughoudend, alleen horizontaal
    //
    // Bij een vorm die zijn eigen schaal gebruikt blijft de hoogteas weg: een
    // streepje bij 400 m dat niet naar 400 m wijst leest erger dan geen as.
    if (stijl['profiel.rasterAan'] && hoogteAs) {
      const stap = asStap(bovenGrens, Math.round(stijl['profiel.rasterFijnheid'] * 0.6))
      for (let h = 0; h <= bovenGrens; h += stap) {
        svg.append(maakSvg('line', {
          x1: grafiekLinks, x2: grafiekRechts, y1: yVan(h), y2: yVan(h),
          stroke: '#e0dcd5', 'stroke-width': h === 0 ? 0.25 : 0.12
        }))
        const t = maakSvg('text', {
          x: grafiekLinks - 2, y: yVan(h) + 0.9,
          'text-anchor': 'end', 'font-size': 2.4, fill: stijl['statistieken.labelKleur']
        })
        t.textContent = `${h}`
        svg.append(t)
      }
      const eenheid = maakSvg('text', {
        x: grafiekLinks - 2, y: yVan(bovenGrens) - 3,
        'text-anchor': 'end', 'font-size': 2.2, fill: stijl['statistieken.labelKleur']
      })
      eenheid.textContent = 'meter'
      svg.append(eenheid)
    }

    // --- het vlak onder de lijn, in de vorm die in het paneel gekozen is
    //
    // Welke vorm dat ook is: de kleur volgt de hoogte, met stops op de echte
    // hoogtes. Zo blijft het dal rustig en springt een klim er meteen uit.
    // Wat per vorm verschilt staat in render/profielvorm.js.
    for (const knoop of profielVorm(vorm, {
      punten: profiel.map(p => ({ km: p.afstandKm, m: p.hoogteM })),
      xVan,
      yVan,
      links: grafiekLinks,
      rechts: grafiekRechts,
      boven: grafiekBoven,
      onder: grafiekOnder,
      bovenGrens,
      stijl,
      lijnMm: stijl['profiel.lijnDikteMm'],
      id: 'dagprofiel'
    })) {
      svg.append(bouwSvg(knoop))
    }

    // --- stops als merktekens langs de onderkant
    //
    // De namen staan rechtop in een eigen band onder de grafiek. Namen die te
    // dicht op elkaar zouden vallen krijgen alleen een streepje: twee namen over
    // elkaar heen is onleesbaarder dan een naam missen, en welke stop het was
    // staat toch op de kaartpagina.
    if (stijl['profiel.stopsAan']) {
      let vorigeNaamX = -Infinity

      for (const stop of stopAfstanden(gegevens)) {
        if (stop.type === 'via') continue
        const x = xVan(stop.km)

        svg.append(maakSvg('line', {
          x1: x, x2: x, y1: grafiekOnder, y2: grafiekOnder + 1.8,
          stroke: stijl['route.kleur'], 'stroke-width': 0.3
        }))

        if (!stop.naam) continue
        if (x - vorigeNaamX < 3.2) continue
        vorigeNaamX = x

        const naam = document.createElement('div')
        naam.className = 'profiel-stop'
        naam.setAttribute('data-plek', `profielstop:${stop.naam}`)
        naam.setAttribute('data-knoppen', 'profiel')
        naam.style.left = mm(x)
        naam.style.top = mm(grafiekOnder + 2.6)
        naam.style.maxHeight = mm(naamBandMm)
        naam.style.fontSize = mm(2.3)
        naam.style.color = stijl['statistieken.labelKleur']
        naam.textContent = stop.naam
        opschriften.append(naam)
      }
    }

    // --- alleen het hoogste punt krijgt een label
    if (stijl['profiel.topLabelAan']) {
      const i = hoogtes.indexOf(hoogste)
      const x = xVan(profiel[i].afstandKm)
      // de spiegel tekent op halve schaal, dus niet zomaar yVan
      const y = vormSchaal(vorm, {
        yVan, boven: grafiekBoven, onder: grafiekOnder, bovenGrens
      })(hoogste)

      svg.append(maakSvg('circle', {
        cx: x, cy: y, r: 0.8,
        fill: stijl['route.kleur'], stroke: '#ffffff', 'stroke-width': 0.3
      }))

      const label = document.createElement('div')
      label.className = 'profiel-top'
      label.style.left = mm(x)
      label.style.top = mm(y - 6)
      label.style.fontSize = mm(2.8)
      label.style.color = stijl['statistieken.getalKleur']
      label.textContent = `${hoogste.toFixed(0)} m`
      opschriften.append(label)
    }

    // --- kilometerschaal, onder de namenband door zodat er niets overlapt
    const kmY = grafiekOnder + naamBandMm + 4
    svg.append(maakSvg('line', {
      x1: grafiekLinks, x2: grafiekRechts, y1: kmY - 2.6, y2: kmY - 2.6,
      stroke: '#e0dcd5', 'stroke-width': 0.15
    }))

    // verticale rasterlijnen op dezelfde plek als de kilometerschaal
    if (stijl['profiel.rasterAan'] && stijl['profiel.rasterVerticaal']) {
      const stap = asStap(maxKm, stijl['profiel.rasterFijnheid'])
      for (let km = stap; km < maxKm; km += stap) {
        svg.append(maakSvg('line', {
          x1: xVan(km), x2: xVan(km), y1: grafiekBoven, y2: grafiekOnder,
          stroke: '#e0dcd5', 'stroke-width': 0.1
        }))
      }
    }

    const kmStap = asStap(maxKm, 5)
    for (let km = 0; km <= maxKm; km += kmStap) {
      svg.append(maakSvg('line', {
        x1: xVan(km), x2: xVan(km), y1: kmY - 2.6, y2: kmY - 1.4,
        stroke: '#cfc9c0', 'stroke-width': 0.15
      }))
      const t = maakSvg('text', {
        x: xVan(km), y: kmY,
        'text-anchor': 'middle', 'font-size': 2.4, fill: stijl['statistieken.labelKleur']
      })
      t.textContent = km === 0 ? '0 km' : `${km}`
      svg.append(t)
    }
  }

  // ------------------------------------------------------------ kerncijfers
  //
  // Geen weertegel ertussen. Het temperatuurbereik staat nu uur voor uur in de
  // grafiek, en de weertekens ook - allebei op de plek waar ze bij een tijdstip
  // horen in plaats van platgeslagen tot één getal per dag.
  //
  // Gespreid over de volle breedte: de kilometers tegen de linkermarge, de klim
  // tegen de rechter, en de tijd en het hoogste punt met gelijke tussenruimtes
  // ertussenin. In gelijke kolommen begon elk getal aan het begin van zijn
  // kolom, en bleef er rechts van het laatste getal een gat van bijna een
  // kolom over.
  //
  // Alleen zolang ze met z'n vieren op één regel passen: zet iemand het aantal
  // kolommen lager, dan is het weer een raster dat mag afbreken.
  const dag = dagCijfers(gegevens)
  const kolommen = stijl['statistieken.kolommen']

  tekenCijferrij(opschriften, dag, stijl, {
    plek: 'cijferrij',
    links: marge,
    boven: grafiekOnder + naamBandMm + 16,
    breedte: maat.breedteMm - 2 * marge,
    kolommen,
    lijntjes: stijl['statistieken.lijntjes'],
    gespreid: kolommen >= dag.length
  })

  // ------------------------------------------------------------- eigen tekst
  //
  // Over de volle breedte binnen de marges, maar in kolommen gezet.
  //
  // Alleen breed maken was niet genoeg: op een pagina van dertig centimeter
  // wordt één kolom ruim honderdvijftig tekens per regel, en dan vindt je oog
  // aan het eind van een regel de volgende niet meer terug. Bovendien liep de
  // tekst dan zo ver door dat hij de stempelband raakte. Kolommen lossen
  // allebei op: de regels worden leesbaar én het blok wordt half zo hoog.
  if (gegevens.dag.tekst) {
    const tekst = document.createElement('div')
    tekst.className = 'dagtekst'
    tekst.setAttribute('data-plek', 'dagtekst')
    // 'doos' en niet 'css': aan de hoek slepen maakt het vak groter en de tekst
    // herwikkelt zich erin, zoals in een presentatieprogramma. Schalen zou de
    // letter meegroeien, en dan staat het dagverhaal in een ander corps dan de
    // rest van het boek.
    tekst.setAttribute('data-schaalbaar', 'doos')
    tekst.setAttribute('data-midden', '')
    tekst.setAttribute('data-knoppen', 'typografie')
    tekst.setAttribute('data-tekst', 'tekst')
    // Nu de tekst de volle breedte heeft, kan een bewaarde verschuiving hem
    // alleen nog van de pagina af duwen - er is opzij niets meer te winnen.
    // Dus klemt hij binnen de veilige marge, net als het titelblok.
    tekst.setAttribute('data-binnen-marge', String(stijl['pagina.veiligeMargeMm']))
    tekst.style.left = mm(marge)
    // Dicht onder de cijferrij. Er stond 34 tussen, wat een gat achterliet
    // waar niets kwam en de tekst tegen de stempelband aan duwde.
    tekst.style.top = mm(grafiekOnder + naamBandMm + 16 + 24)
    tekst.style.width = mm(maat.breedteMm - 2 * marge)
    tekst.style.columnCount = String(stijl['typografie.kolommen'])
    tekst.style.columnGap = mm(stijl['typografie.kolomGangMm'])
    tekst.style.fontSize = mm(stijl['typografie.tekstMm'])
    tekst.style.lineHeight = String(stijl['typografie.regelafstand'])
    tekst.style.color = stijl['titelblok.kleur']
    tekst.textContent = gegevens.dag.tekst
    opschriften.append(tekst)
  }

  // ---------------------------------------------------------- de stempels
  //
  // Onderaan het blad, per foto van die dag een gesneden afdruk met zijn
  // veldnotitie eronder. Dagen zonder foto krijgen niets; dan loopt de dagtekst
  // gewoon door tot onderaan.
  tekenStempelband(opschriften, gegevens.hero, stijl, maat, marge, gegevens.plaatsing)

  tekenBron(opschriften, stijl, maat, marge)
}
