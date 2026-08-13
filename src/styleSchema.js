/**
 * Elke instelknop van het hele project, op een plek.
 *
 * Hieruit wordt drie dingen tegelijk afgeleid: het bedieningspaneel in de
 * browser, de standaardwaarden, en de controle of een opgeslagen instelling nog
 * geldig is. Een knop toevoegen is dus een regel hier, en niet op drie plekken.
 *
 * Types:
 *   mm      - een maat op papier, in millimeters
 *   cm      - idem maar in centimeters, voor grotere afstanden
 *   getal   - kaal getal met een bereik
 *   kleur   - kleur, in het paneel met rood/groen/blauw-schuifjes en een hexveld
 *   aanuit  - vinkje
 *   keuze   - een van een lijstje
 *   tekst   - vrije tekst
 *   graden  - hoek van 0 tot 360
 */

export const GROEPEN = [
  { id: 'pagina', label: 'Pagina' },
  { id: 'uitsnede', label: 'Uitsnede' },
  { id: 'kaartvorm', label: 'Kaartvorm' },
  { id: 'lagen', label: 'Lagen' },
  { id: 'relief', label: 'Reliëf' },
  { id: 'route', label: 'Routelijn' },
  { id: 'pijltjes', label: 'Richtingspijltjes' },
  { id: 'eerdere', label: 'Eerdere dagen' },
  { id: 'markers', label: 'Markers' },
  { id: 'labels', label: 'Labels' },
  { id: 'typografie', label: 'Typografie' },
  { id: 'titelblok', label: 'Titelblok' },
  { id: 'inzet', label: 'Inzetkaartje' },
  { id: 'schaal', label: 'Schaalbalk & noordpijl' },
  { id: 'bron', label: 'Bronvermelding' },
  { id: 'profiel', label: 'Hoogteprofiel' },
  { id: 'statistieken', label: 'Statistieken' }
]

/**
 * Alle knoppen. Volgorde bepaalt de volgorde in het paneel.
 */
export const KNOPPEN = [
  // ---------------------------------------------------------------- pagina
  { key: 'pagina.breedteMm', groep: 'pagina', label: 'Breedte', type: 'mm', min: 50, max: 600, step: 1, standaard: 300 },
  { key: 'pagina.hoogteMm', groep: 'pagina', label: 'Hoogte', type: 'mm', min: 50, max: 600, step: 1, standaard: 300 },
  { key: 'pagina.afloopMm', groep: 'pagina', label: 'Afloop', type: 'mm', min: 0, max: 10, step: 0.5, standaard: 3, help: 'Loopt buiten de snijlijn door, zodat er na het snijden geen wit randje overblijft' },
  { key: 'pagina.veiligeMargeMm', groep: 'pagina', label: 'Veiligheidsmarge', type: 'mm', min: 0, max: 30, step: 1, standaard: 8, help: 'Belangrijke dingen blijven hierbinnen, voor het geval de snijmachine een millimeter afwijkt' },
  { key: 'pagina.dpi', groep: 'pagina', label: 'Resolutie', type: 'keuze', opties: [300, 400, 600, 800, 1200], standaard: 600, help: 'Drukkerijen vragen 300. Standaard staat het dubbele ingesteld' },
  { key: 'pagina.achtergrond', groep: 'pagina', label: 'Paginakleur', type: 'kleur', standaard: '#ffffff' },
  { key: 'pagina.snijtekens', groep: 'pagina', label: 'Snijtekens tonen', type: 'aanuit', standaard: false },

  // -------------------------------------------------------------- uitsnede
  { key: 'uitsnede.zoom', groep: 'uitsnede', label: 'Zoom', type: 'getal', min: 0.2, max: 8, step: 0.01, standaard: 1 },
  { key: 'uitsnede.panXMm', groep: 'uitsnede', label: 'Verschuiven horizontaal', type: 'mm', min: -200, max: 200, step: 0.5, standaard: 0 },
  { key: 'uitsnede.panYMm', groep: 'uitsnede', label: 'Verschuiven verticaal', type: 'mm', min: -200, max: 200, step: 0.5, standaard: 0 },
  { key: 'uitsnede.margeMm', groep: 'uitsnede', label: 'Ruimte rond de route', type: 'mm', min: 0, max: 100, step: 1, standaard: 25 },

  // ------------------------------------------------------------- kaartvorm
  { key: 'kaartvorm.vorm', groep: 'kaartvorm', label: 'Vorm', type: 'keuze', opties: ['paginavullend', 'rechthoek', 'afgerond', 'cirkel', 'vervagend'], standaard: 'paginavullend' },
  { key: 'kaartvorm.afrondingMm', groep: 'kaartvorm', label: 'Afronding hoeken', type: 'mm', min: 0, max: 60, step: 1, standaard: 6 },
  { key: 'kaartvorm.vervagingMm', groep: 'kaartvorm', label: 'Breedte van de vervaging', type: 'mm', min: 0, max: 80, step: 1, standaard: 25 },
  { key: 'kaartvorm.randKleur', groep: 'kaartvorm', label: 'Randlijn', type: 'kleur', standaard: '#d8d4cd' },
  { key: 'kaartvorm.randDikteMm', groep: 'kaartvorm', label: 'Randlijndikte', type: 'mm', min: 0, max: 3, step: 0.05, standaard: 0 },

  // ----------------------------------------------------------------- lagen
  { key: 'lagen.stijl', groep: 'lagen', label: 'Kaartstijl', type: 'keuze', opties: ['vector', 'relief', 'topo', 'satelliet'], standaard: 'relief' },
  { key: 'lagen.zeeAan', groep: 'lagen', label: 'Zee', type: 'aanuit', standaard: true },
  { key: 'lagen.zeeKleur', groep: 'lagen', label: 'Zeekleur', type: 'kleur', standaard: '#eef2f4' },
  { key: 'lagen.landKleur', groep: 'lagen', label: 'Landkleur', type: 'kleur', standaard: '#f6f4f0' },
  { key: 'lagen.gletsjerAan', groep: 'lagen', label: 'Gletsjers', type: 'aanuit', standaard: true },
  { key: 'lagen.gletsjerKleur', groep: 'lagen', label: 'Gletsjerkleur', type: 'kleur', standaard: '#ffffff' },
  { key: 'lagen.waterAan', groep: 'lagen', label: 'Meren en rivieren', type: 'aanuit', standaard: true },
  { key: 'lagen.waterKleur', groep: 'lagen', label: 'Waterkleur', type: 'kleur', standaard: '#dde7ec' },
  { key: 'lagen.wegenAan', groep: 'lagen', label: 'Hoofdwegen', type: 'aanuit', standaard: true },
  { key: 'lagen.wegenKleur', groep: 'lagen', label: 'Wegkleur', type: 'kleur', standaard: '#e2ded7' },
  { key: 'lagen.wegenDikteMm', groep: 'lagen', label: 'Wegdikte', type: 'mm', min: 0.05, max: 2, step: 0.05, standaard: 0.35 },
  { key: 'lagen.hoogtelijnenAan', groep: 'lagen', label: 'Hoogtelijnen', type: 'aanuit', standaard: false },
  { key: 'lagen.hoogtelijnenStapM', groep: 'lagen', label: 'Hoogte per lijn', type: 'getal', min: 25, max: 500, step: 25, standaard: 100, eenheid: 'm' },
  { key: 'lagen.hoogtelijnenKleur', groep: 'lagen', label: 'Hoogtelijnkleur', type: 'kleur', standaard: '#c9c2b6' },
  { key: 'lagen.achtergrondDekking', groep: 'lagen', label: 'Dekking achtergrond', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 1 },
  { key: 'lagen.verbleking', groep: 'lagen', label: 'Verbleken naar wit', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 0.05, help: 'Trekt de achtergrond richting het wit van het papier, zodat je route ervoor knalt' },
  { key: 'lagen.ontzadiging', groep: 'lagen', label: 'Ontzadigen', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 0.3, help: 'Haalt kleur uit de achtergrond zodat hij niet vloekt met je foto\'s' },

  // ---------------------------------------------------------------- relief
  { key: 'relief.aan', groep: 'relief', label: 'Schaduwreliëf', type: 'aanuit', standaard: true },
  { key: 'relief.zonRichting', groep: 'relief', label: 'Richting van de zon', type: 'graden', min: 0, max: 360, step: 1, standaard: 315, help: 'Cartografen zetten de zon linksboven, anders lijken bergen dalen' },
  { key: 'relief.zonHoogte', groep: 'relief', label: 'Hoogte van de zon', type: 'getal', min: 5, max: 89, step: 1, standaard: 42, eenheid: '°' },
  { key: 'relief.overdrijving', groep: 'relief', label: 'Hoogtes overdrijven', type: 'getal', min: 0.2, max: 6, step: 0.1, standaard: 2 },
  { key: 'relief.contrast', groep: 'relief', label: 'Contrast', type: 'getal', min: 0, max: 2, step: 0.05, standaard: 1.15 },
  { key: 'relief.zachtheid', groep: 'relief', label: 'Zachtheid', type: 'getal', min: 0, max: 5, step: 0.1, standaard: 0.6 },
  { key: 'relief.schaduwKleur', groep: 'relief', label: 'Kleurzweem schaduw', type: 'kleur', standaard: '#6b6459' },
  { key: 'relief.detailZoom', groep: 'relief', label: 'Detail hoogtemodel', type: 'keuze', opties: [10, 11, 12, 13], standaard: 12, help: 'Het hoogtemodel heeft voor IJsland ongeveer 30 m echt detail (niveau 11). Niveau 12 geeft een vloeiender reliëf; 13 downloadt vier keer zoveel zonder dat er detail bij komt' },

  // ----------------------------------------------------------------- route
  { key: 'route.kleur', groep: 'route', label: 'Kleur binnenlijn', type: 'kleur', standaard: '#c1352b' },
  { key: 'route.dikteMm', groep: 'route', label: 'Dikte binnenlijn', type: 'mm', min: 0.1, max: 6, step: 0.05, standaard: 1.1 },
  { key: 'route.dekking', groep: 'route', label: 'Dekking binnenlijn', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 1 },
  { key: 'route.buitenKleur', groep: 'route', label: 'Kleur buitenlijn', type: 'kleur', standaard: '#ffffff' },
  { key: 'route.buitenExtraMm', groep: 'route', label: 'Buitenlijn extra dik', type: 'mm', min: 0, max: 4, step: 0.05, standaard: 0.7, help: 'Hoeveel de buitenlijn aan elke kant buiten de binnenlijn uitsteekt' },
  { key: 'route.buitenDekking', groep: 'route', label: 'Dekking buitenlijn', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 0.9 },
  { key: 'route.uiteinden', groep: 'route', label: 'Lijnuiteinden', type: 'keuze', opties: ['rond', 'plat', 'vierkant'], standaard: 'rond' },
  { key: 'route.streepjes', groep: 'route', label: 'Streepjeslijn', type: 'aanuit', standaard: false },
  { key: 'route.streepMm', groep: 'route', label: 'Streeplengte', type: 'mm', min: 0.2, max: 20, step: 0.1, standaard: 3 },
  { key: 'route.gatMm', groep: 'route', label: 'Gat tussen streepjes', type: 'mm', min: 0.2, max: 20, step: 0.1, standaard: 1.6 },

  // -------------------------------------------------------------- pijltjes
  { key: 'pijltjes.aan', groep: 'pijltjes', label: 'Richtingspijltjes', type: 'aanuit', standaard: true },
  { key: 'pijltjes.afstandCm', groep: 'pijltjes', label: 'Om de hoeveel cm', type: 'cm', min: 0.3, max: 15, step: 0.1, standaard: 2.5, help: 'Gemeten op papier, dus dit blijft kloppen als je van formaat wisselt' },
  { key: 'pijltjes.grootteMm', groep: 'pijltjes', label: 'Grootte', type: 'mm', min: 0.5, max: 12, step: 0.1, standaard: 2 },
  { key: 'pijltjes.kleur', groep: 'pijltjes', label: 'Kleur', type: 'kleur', standaard: '#ffffff' },
  { key: 'pijltjes.vorm', groep: 'pijltjes', label: 'Vorm', type: 'keuze', opties: ['driehoek', 'chevron'], standaard: 'driehoek' },
  { key: 'pijltjes.randKleur', groep: 'pijltjes', label: 'Randje', type: 'kleur', standaard: '#c1352b' },
  { key: 'pijltjes.randMm', groep: 'pijltjes', label: 'Randdikte', type: 'mm', min: 0, max: 1.5, step: 0.05, standaard: 0 },

  // --------------------------------------------------------- eerdere dagen
  { key: 'eerdere.aan', groep: 'eerdere', label: 'Eerdere dagen tonen', type: 'aanuit', standaard: true },
  { key: 'eerdere.kleur', groep: 'eerdere', label: 'Kleur', type: 'kleur', standaard: '#b3ada2' },
  { key: 'eerdere.dikteMm', groep: 'eerdere', label: 'Dikte', type: 'mm', min: 0.05, max: 3, step: 0.05, standaard: 0.45 },
  { key: 'eerdere.dekking', groep: 'eerdere', label: 'Dekking', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 0.55 },
  { key: 'eerdere.hoeveel', groep: 'eerdere', label: 'Welke dagen', type: 'keuze', opties: ['alle voorgaande', 'alleen de vorige', 'de hele reis'], standaard: 'alle voorgaande' },

  // --------------------------------------------------------------- markers
  { key: 'markers.stopGrootteMm', groep: 'markers', label: 'Stop: grootte', type: 'mm', min: 0.5, max: 12, step: 0.1, standaard: 3.2 },
  { key: 'markers.stopVulling', groep: 'markers', label: 'Stop: vulkleur', type: 'kleur', standaard: '#ffffff' },
  { key: 'markers.stopRand', groep: 'markers', label: 'Stop: randkleur', type: 'kleur', standaard: '#c1352b' },
  { key: 'markers.stopRandMm', groep: 'markers', label: 'Stop: randdikte', type: 'mm', min: 0.05, max: 2, step: 0.05, standaard: 0.7 },
  { key: 'markers.stopVorm', groep: 'markers', label: 'Stop: vorm', type: 'keuze', opties: ['cirkel', 'vierkant', 'ruit', 'speld'], standaard: 'cirkel' },
  { key: 'markers.viaGrootteMm', groep: 'markers', label: 'Doorrijpunt: grootte', type: 'mm', min: 0, max: 8, step: 0.1, standaard: 1.3 },
  { key: 'markers.viaVulling', groep: 'markers', label: 'Doorrijpunt: kleur', type: 'kleur', standaard: '#c1352b' },
  { key: 'markers.slaapGrootteMm', groep: 'markers', label: 'Overnachting: grootte', type: 'mm', min: 0.5, max: 14, step: 0.1, standaard: 4.2 },
  { key: 'markers.slaapVulling', groep: 'markers', label: 'Overnachting: vulkleur', type: 'kleur', standaard: '#c1352b' },
  { key: 'markers.slaapRand', groep: 'markers', label: 'Overnachting: randkleur', type: 'kleur', standaard: '#ffffff' },
  { key: 'markers.slaapVorm', groep: 'markers', label: 'Overnachting: vorm', type: 'keuze', opties: ['cirkel', 'ster', 'ruit', 'speld'], standaard: 'ster' },
  { key: 'markers.nummers', groep: 'markers', label: 'Stops nummeren', type: 'aanuit', standaard: false },

  // ---------------------------------------------------------------- labels
  { key: 'labels.aan', groep: 'labels', label: 'Labels tonen', type: 'aanuit', standaard: true },
  { key: 'labels.grootteMm', groep: 'labels', label: 'Lettergrootte', type: 'mm', min: 1.2, max: 12, step: 0.1, standaard: 3 },
  { key: 'labels.kleur', groep: 'labels', label: 'Kleur', type: 'kleur', standaard: '#33302b' },
  { key: 'labels.haloKleur', groep: 'labels', label: 'Witrand', type: 'kleur', standaard: '#ffffff' },
  { key: 'labels.haloMm', groep: 'labels', label: 'Dikte witrand', type: 'mm', min: 0, max: 2, step: 0.05, standaard: 0.5, help: 'Houdt de naam leesbaar waar hij over een donkere achtergrond valt' },
  { key: 'labels.hoofdletters', groep: 'labels', label: 'Hoofdletters', type: 'aanuit', standaard: false },
  { key: 'labels.letterafstand', groep: 'labels', label: 'Letterafstand', type: 'getal', min: -0.05, max: 0.4, step: 0.01, standaard: 0.01, eenheid: 'em' },
  { key: 'labels.lijntjes', groep: 'labels', label: 'Lijntje naar de marker', type: 'aanuit', standaard: true },
  { key: 'labels.omgevingAan', groep: 'labels', label: 'Bekende plaatsen erbij', type: 'aanuit', standaard: true, help: 'Plaatsen waar je niet stopte, voor de oriëntatie' },
  { key: 'labels.omgevingKleur', groep: 'labels', label: 'Kleur bekende plaatsen', type: 'kleur', standaard: '#8b857c' },
  { key: 'labels.omgevingGrootteMm', groep: 'labels', label: 'Grootte bekende plaatsen', type: 'mm', min: 1, max: 8, step: 0.1, standaard: 2.2 },

  // ------------------------------------------------------------ typografie
  { key: 'typografie.lettertype', groep: 'typografie', label: 'Lettertype', type: 'keuze', opties: ['systeem-schreefloos', 'systeem-schreef'], standaard: 'systeem-schreefloos' },
  { key: 'typografie.titelMm', groep: 'typografie', label: 'Titelgrootte', type: 'mm', min: 3, max: 40, step: 0.5, standaard: 11 },
  { key: 'typografie.datumMm', groep: 'typografie', label: 'Datumgrootte', type: 'mm', min: 2, max: 20, step: 0.5, standaard: 4 },
  { key: 'typografie.tekstMm', groep: 'typografie', label: 'Lopende tekst', type: 'mm', min: 1.5, max: 12, step: 0.1, standaard: 3.4 },
  { key: 'typografie.regelafstand', groep: 'typografie', label: 'Regelafstand', type: 'getal', min: 1, max: 2.4, step: 0.05, standaard: 1.5 },

  // ------------------------------------------------------------- titelblok
  { key: 'titelblok.aan', groep: 'titelblok', label: 'Titelblok tonen', type: 'aanuit', standaard: true },
  { key: 'titelblok.positie', groep: 'titelblok', label: 'Positie', type: 'keuze', opties: ['linksboven', 'rechtsboven', 'linksonder', 'rechtsonder'], standaard: 'linksboven' },
  { key: 'titelblok.uitlijning', groep: 'titelblok', label: 'Uitlijning', type: 'keuze', opties: ['links', 'midden', 'rechts'], standaard: 'links' },
  { key: 'titelblok.vlakAan', groep: 'titelblok', label: 'Achtergrondvlak', type: 'aanuit', standaard: false },
  { key: 'titelblok.vlakKleur', groep: 'titelblok', label: 'Kleur vlak', type: 'kleur', standaard: '#ffffff' },
  { key: 'titelblok.vlakDekking', groep: 'titelblok', label: 'Dekking vlak', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 0.85 },
  { key: 'titelblok.kleur', groep: 'titelblok', label: 'Tekstkleur', type: 'kleur', standaard: '#26241f' },

  // ----------------------------------------------------------------- inzet
  { key: 'inzet.aan', groep: 'inzet', label: 'Inzetkaartje tonen', type: 'aanuit', standaard: true },
  { key: 'inzet.hoek', groep: 'inzet', label: 'Hoek', type: 'keuze', opties: ['rechtsonder', 'linksonder', 'rechtsboven', 'linksboven'], standaard: 'rechtsonder' },
  { key: 'inzet.breedteMm', groep: 'inzet', label: 'Breedte', type: 'mm', min: 15, max: 120, step: 1, standaard: 52 },
  { key: 'inzet.achtergrond', groep: 'inzet', label: 'Achtergrond kaartje', type: 'kleur', standaard: '#ffffff' },
  { key: 'inzet.landKleur', groep: 'inzet', label: 'Landkleur', type: 'kleur', standaard: '#d5cfc5' },
  { key: 'inzet.routeKleur', groep: 'inzet', label: 'Kleur hele reis', type: 'kleur', standaard: '#b3ada2' },
  { key: 'inzet.kaderKleur', groep: 'inzet', label: 'Kleur kadertje', type: 'kleur', standaard: '#c1352b' },
  { key: 'inzet.kaderMm', groep: 'inzet', label: 'Dikte kadertje', type: 'mm', min: 0.05, max: 2, step: 0.05, standaard: 0.45 },
  { key: 'inzet.randKleur', groep: 'inzet', label: 'Randlijn', type: 'kleur', standaard: '#d8d4cd' },
  { key: 'inzet.randMm', groep: 'inzet', label: 'Dikte randlijn', type: 'mm', min: 0, max: 2, step: 0.05, standaard: 0.25 },

  // ----------------------------------------------------------------- schaal
  { key: 'schaal.balkAan', groep: 'schaal', label: 'Schaalbalk', type: 'aanuit', standaard: true },
  { key: 'schaal.positie', groep: 'schaal', label: 'Positie', type: 'keuze', opties: ['linksonder', 'rechtsonder', 'linksboven', 'rechtsboven'], standaard: 'linksonder' },
  { key: 'schaal.kleur', groep: 'schaal', label: 'Kleur', type: 'kleur', standaard: '#55504a' },
  { key: 'schaal.noordpijlAan', groep: 'schaal', label: 'Noordpijl', type: 'aanuit', standaard: false },

  // -------------------------------------------------------------------- bron
  { key: 'bron.aan', groep: 'bron', label: 'Bronvermelding tonen', type: 'aanuit', standaard: true },
  { key: 'bron.grootteMm', groep: 'bron', label: 'Grootte', type: 'mm', min: 1, max: 5, step: 0.1, standaard: 1.8 },
  { key: 'bron.kleur', groep: 'bron', label: 'Kleur', type: 'kleur', standaard: '#9a948b' },

  // ----------------------------------------------------------------- profiel
  { key: 'profiel.hoogteMm', groep: 'profiel', label: 'Hoogte van de grafiek', type: 'mm', min: 20, max: 200, step: 1, standaard: 70 },
  { key: 'profiel.vulKleur', groep: 'profiel', label: 'Vulkleur', type: 'kleur', standaard: '#dfe6e9' },
  { key: 'profiel.lijnKleur', groep: 'profiel', label: 'Lijnkleur', type: 'kleur', standaard: '#5b6b73' },
  { key: 'profiel.lijnDikteMm', groep: 'profiel', label: 'Lijndikte', type: 'mm', min: 0.05, max: 2, step: 0.05, standaard: 0.4 },
  { key: 'profiel.rasterAan', groep: 'profiel', label: 'Raster', type: 'aanuit', standaard: true },
  { key: 'profiel.stopsAan', groep: 'profiel', label: 'Stops aangeven', type: 'aanuit', standaard: true },
  { key: 'profiel.topLabelAan', groep: 'profiel', label: 'Hoogste punt labelen', type: 'aanuit', standaard: true },
  { key: 'profiel.overdrijving', groep: 'profiel', label: 'Verticaal overdrijven', type: 'getal', min: 0.5, max: 4, step: 0.1, standaard: 1 },

  // ------------------------------------------------------------ statistieken
  { key: 'statistieken.kolommen', groep: 'statistieken', label: 'Aantal kolommen', type: 'getal', min: 2, max: 6, step: 1, standaard: 4 },
  { key: 'statistieken.getalMm', groep: 'statistieken', label: 'Grootte van de getallen', type: 'mm', min: 3, max: 30, step: 0.5, standaard: 9 },
  { key: 'statistieken.labelMm', groep: 'statistieken', label: 'Grootte van de labels', type: 'mm', min: 1.5, max: 10, step: 0.1, standaard: 2.6 },
  { key: 'statistieken.getalKleur', groep: 'statistieken', label: 'Kleur getallen', type: 'kleur', standaard: '#26241f' },
  { key: 'statistieken.labelKleur', groep: 'statistieken', label: 'Kleur labels', type: 'kleur', standaard: '#8b857c' },
  { key: 'statistieken.lijntjes', groep: 'statistieken', label: 'Scheidingslijntjes', type: 'aanuit', standaard: false }
]

// De logica die met dit schema werkt (standaardwaarden, samenvoegen, controleren)
// staat in src/style.js. Dit bestand is bewust alleen data.
