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
  { id: 'terrein', label: 'Hoogtekleuren' },
  { id: 'route', label: 'Routelijn' },
  { id: 'pijltjes', label: 'Richtingspijltjes' },
  { id: 'eerdere', label: 'Overzichtskaart & eerdere dagen' },
  { id: 'markers', label: 'Markers' },
  { id: 'labels', label: 'Labels' },
  { id: 'typografie', label: 'Typografie' },
  { id: 'titelblok', label: 'Titelblok' },
  { id: 'inzet', label: 'Inzetkaartje' },
  { id: 'schaal', label: 'Schaalbalk & kompas' },
  { id: 'bron', label: 'Bronvermelding' },
  { id: 'voortgang', label: 'Voortgangsbalk' },
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
  { key: 'lagen.stijl', groep: 'lagen', label: 'Kaartstijl', type: 'keuze', opties: ['mapbox-outdoors', 'mapbox-satelliet-straten', 'mapbox-licht', 'mapbox-straten', 'mapbox-donker', 'mapbox-nacht'], standaard: 'mapbox-outdoors', help: 'Outdoors heeft hoogtelijnen, paden en landcover; satelliet-straten zet wegen en namen over een luchtfoto. Donker en nacht zijn de enige stijlen die bij Mapbox zelf donker zijn - van Outdoors bestaat geen donkere versie' },
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
  { key: 'lagen.mapboxLabelMm', groep: 'lagen', label: 'Mapbox: tekstgrootte', type: 'mm', min: 1.5, max: 9, step: 0.1, standaard: 3, help: 'Alleen voor de mapbox-stijlen. Hun plaatsnamen zitten met een vaste pixelgrootte in het beeld, dus dit bepaalt tegelijk hoe scherp de achtergrond wordt: grotere tekst betekent een zachtere kaart eronder' },
  { key: 'lagen.badgesWeg', groep: 'lagen', label: 'Wegnummers onder de route weghalen', type: 'aanuit', standaard: true, help: 'Mapbox zet witte wegnummer-badges langs de wegen. Die onder je eigen routelijn liggen zeggen niets en zien er rommelig uit; deze poetst alleen die weg' },
  { key: 'lagen.tekstBoven', groep: 'lagen', label: 'Plaatsnamen boven de route', type: 'aanuit', standaard: true, help: 'De plaatsnamen worden uit de kaart geknipt en als eigen laag over de routelijn gelegd. De stapeling is dan: kaart, routelijn, plaatsnamen' },
  { key: 'lagen.badgesBoven', groep: 'lagen', label: 'Wegnummers juist bovenop leggen', type: 'aanuit', standaard: false, help: 'In plaats van weghalen: uitknippen en over de routelijn heen leggen, zodat de tekst leesbaar blijft' },
  { key: 'lagen.achtergrondDekking', groep: 'lagen', label: 'Dekking achtergrond', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 1 },
  { key: 'lagen.verbleking', groep: 'lagen', label: 'Verbleken naar wit', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 0.1, help: 'Trekt de achtergrond richting het wit van het papier, zodat je route ervoor knalt' },
  { key: 'lagen.verdonkering', groep: 'lagen', label: 'Verdonkeren naar zwart', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 0, help: 'Het omgekeerde van verbleken. Hiermee maak je van Outdoors alsnog een donkere kaart met zijn hoogtelijnen erin - zet dan wel "Opgetilde namen" op licht, anders verdwijnen de plaatsnamen in het donker' },
  { key: 'lagen.tekstKleur', groep: 'lagen', label: 'Opgetilde namen', type: 'keuze', opties: ['origineel', 'licht', 'donker'], standaard: 'origineel', help: 'De plaatsnamen die boven de route worden gelegd. Op een donkere kaart zijn ze zwart op zwart; met "licht" worden ze wit overgezet' },
  { key: 'lagen.ontzadiging', groep: 'lagen', label: 'Ontzadigen', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 0.28, help: 'Haalt kleur uit de achtergrond zodat hij niet vloekt met je foto\'s' },

  // ---------------------------------------------------------------- relief
  { key: 'relief.aan', groep: 'relief', label: 'Schaduwreliëf', type: 'aanuit', standaard: true },
  { key: 'relief.zonRichting', groep: 'relief', label: 'Richting van de zon', type: 'graden', min: 0, max: 360, step: 1, standaard: 315, help: 'Cartografen zetten de zon linksboven, anders lijken bergen dalen' },
  { key: 'relief.zonHoogte', groep: 'relief', label: 'Hoogte van de zon', type: 'getal', min: 5, max: 89, step: 1, standaard: 42, eenheid: '°' },
  { key: 'relief.overdrijving', groep: 'relief', label: 'Hoogtes overdrijven', type: 'getal', min: 0.2, max: 6, step: 0.1, standaard: 2 },
  { key: 'relief.contrast', groep: 'relief', label: 'Contrast', type: 'getal', min: 0, max: 2, step: 0.05, standaard: 1.15 },
  { key: 'relief.zachtheid', groep: 'relief', label: 'Zachtheid', type: 'getal', min: 0, max: 5, step: 0.1, standaard: 0.6 },
  { key: 'relief.schaduwKleur', groep: 'relief', label: 'Kleurzweem schaduw', type: 'kleur', standaard: '#6b6459' },
  { key: 'relief.detailZoom', groep: 'relief', label: 'Detail hoogtemodel', type: 'keuze', opties: [10, 11, 12, 13], standaard: 12, help: 'Het hoogtemodel heeft voor IJsland ongeveer 30 m echt detail (niveau 11). Niveau 12 geeft een vloeiender reliëf; 13 downloadt vier keer zoveel zonder dat er detail bij komt' },

  // -------------------------------------------------------------- terrein
  // De hoogtetrap van de terreinkaart. Elke kleur hoort bij een hoogte; ertussen
  // wordt vloeiend gemengd. IJsland loopt van zeeniveau tot 2110 m, en de
  // gletsjers liggen boven de 700 m - vandaar dat het wit daar al begint.
  { key: 'terrein.kust', groep: 'terrein', label: 'Zeeniveau', type: 'kleur', standaard: '#a8b894' },
  { key: 'terrein.laag', groep: 'terrein', label: 'Laagland', type: 'kleur', standaard: '#c5c193' },
  { key: 'terrein.laagM', groep: 'terrein', label: 'Laagland op hoogte', type: 'getal', min: 20, max: 600, step: 10, standaard: 180, eenheid: 'm' },
  { key: 'terrein.midden', groep: 'terrein', label: 'Heuvelland', type: 'kleur', standaard: '#cbb287' },
  { key: 'terrein.middenM', groep: 'terrein', label: 'Heuvelland op hoogte', type: 'getal', min: 100, max: 1200, step: 20, standaard: 420, eenheid: 'm' },
  { key: 'terrein.hoog', groep: 'terrein', label: 'Bergen', type: 'kleur', standaard: '#c2a184' },
  { key: 'terrein.hoogM', groep: 'terrein', label: 'Bergen op hoogte', type: 'getal', min: 300, max: 2000, step: 50, standaard: 800, eenheid: 'm' },
  { key: 'terrein.top', groep: 'terrein', label: 'Toppen en gletsjers', type: 'kleur', standaard: '#fbfbfa' },
  { key: 'terrein.topM', groep: 'terrein', label: 'Toppen vanaf', type: 'getal', min: 500, max: 3000, step: 50, standaard: 1250, eenheid: 'm' },

  // ----------------------------------------------------------------- route
  { key: 'route.kleur', groep: 'route', label: 'Kleur binnenlijn', type: 'kleur', standaard: '#f4610c'},
  { key: 'route.dikteMm', groep: 'route', label: 'Dikte binnenlijn', type: 'mm', min: 0.1, max: 6, step: 0.05, standaard: 2.0},
  { key: 'route.dekking', groep: 'route', label: 'Dekking binnenlijn', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 0.5},
  { key: 'route.buitenKleur', groep: 'route', label: 'Kleur buitenlijn', type: 'kleur', standaard: '#ffffff'},
  { key: 'route.buitenExtraMm', groep: 'route', label: 'Buitenlijn extra dik', type: 'mm', min: 0, max: 4, step: 0.05, standaard: 0.42, help: 'Hoeveel de buitenlijn aan elke kant buiten de binnenlijn uitsteekt' },
  { key: 'route.buitenDekking', groep: 'route', label: 'Dekking buitenlijn', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 1},
  { key: 'route.buitenAlsRand', groep: 'route', label: 'Buitenlijn als omranding', type: 'aanuit', standaard: true, help: 'Normaal ligt de buitenlijn als brede lijn onder de route. Dan laat een doorzichtige binnenlijn die buitenlijn zien, niet de kaart. Met deze aan wordt de buitenlijn een echte rand eromheen, en schijnt de kaart door je route heen' },
  { key: 'route.uiteinden', groep: 'route', label: 'Lijnuiteinden', type: 'keuze', opties: ['rond', 'plat', 'vierkant'], standaard: 'rond'},
  { key: 'route.streepjes', groep: 'route', label: 'Streepjeslijn', type: 'aanuit', standaard: false},
  { key: 'route.streepMm', groep: 'route', label: 'Streeplengte', type: 'mm', min: 0.2, max: 20, step: 0.1, standaard: 3 },
  { key: 'route.gatMm', groep: 'route', label: 'Gat tussen streepjes', type: 'mm', min: 0.2, max: 20, step: 0.1, standaard: 1.6 },

  // -------------------------------------------------------------- pijltjes
  { key: 'pijltjes.aan', groep: 'pijltjes', label: 'Richtingspijltjes', type: 'aanuit', standaard: true},
  { key: 'pijltjes.afstandCm', groep: 'pijltjes', label: 'Om de hoeveel cm', type: 'cm', min: 0.3, max: 15, step: 0.1, standaard: 3, help: 'Gemeten op papier, dus dit blijft kloppen als je van formaat wisselt' },
  { key: 'pijltjes.grootteMm', groep: 'pijltjes', label: 'Grootte', type: 'mm', min: 0.5, max: 12, step: 0.1, standaard: 1.6},
  { key: 'pijltjes.kleur', groep: 'pijltjes', label: 'Kleur', type: 'kleur', standaard: '#ffffff'},
  { key: 'pijltjes.vorm', groep: 'pijltjes', label: 'Vorm', type: 'keuze', opties: ['driehoek', 'driehoek-vol', 'dart', 'druppel', 'pijl', 'chevron', 'dubbele-chevron', 'haakje', 'streep'], standaard: 'driehoek' },
  { key: 'pijltjes.lijnDikte', groep: 'pijltjes', label: 'Dikte bij de lijnvormen', type: 'getal', min: 0.08, max: 0.6, step: 0.01, standaard: 0.28, help: 'Alleen voor chevron, haakje en streep: die worden met een lijn getekend in plaats van gevuld' },
  { key: 'pijltjes.randKleur', groep: 'pijltjes', label: 'Randje', type: 'kleur', standaard: '#f4610c'},
  { key: 'pijltjes.randMm', groep: 'pijltjes', label: 'Randdikte', type: 'mm', min: 0, max: 1.5, step: 0.05, standaard: 0.18},

  // --------------------------------------------------------- eerdere dagen
  { key: 'overzicht.dagkleuren', groep: 'eerdere', label: 'Elke dag een eigen kleur', type: 'aanuit', standaard: true, help: 'Op de overzichtskaart. Uit betekent: een verloop van licht naar donker, wat rustiger oogt maar minder goed laat zien welke dag welke is' },
  { key: 'overzicht.langsElkaar', groep: 'eerdere', label: 'Gedeelde wegen naast elkaar', type: 'aanuit', standaard: true, help: 'Reed je twee dagen over dezelfde weg, dan verdwijnt de ene lijn onder de andere. Met deze aan komen ze naast elkaar te liggen' },
  { key: 'overzicht.dikteMm', groep: 'eerdere', label: 'Lijndikte op de overzichtskaart', type: 'mm', min: 0.15, max: 3, step: 0.05, standaard: 0.7, help: 'Losstaand van de dagkaarten: acht routes over heel IJsland vragen om dunnere lijnen dan een enkele dag' },
  { key: 'overzicht.buitenMm', groep: 'eerdere', label: 'Buitenlijn op de overzichtskaart', type: 'mm', min: 0, max: 1.5, step: 0.05, standaard: 0.22 },
  { key: 'overzicht.tussenruimteMm', groep: 'eerdere', label: 'Ruimte tussen de lijnen', type: 'mm', min: 0.3, max: 5, step: 0.1, standaard: 0.95 },
  { key: 'route.fwegStippels', groep: 'route', label: 'F-wegen als stippellijn', type: 'aanuit', standaard: true, help: 'De onverharde hooglandwegen krijgen een stippellijn, zodat je ziet waar het geen gewone weg meer was' },
  { key: 'route.fwegStreepMm', groep: 'route', label: 'F-weg: streeplengte', type: 'mm', min: 0.3, max: 8, step: 0.1, standaard: 1.6 },
  { key: 'route.fwegGatMm', groep: 'route', label: 'F-weg: gat', type: 'mm', min: 0.3, max: 8, step: 0.1, standaard: 1.2 },
  { key: 'route.heenEnTerug', groep: 'route', label: 'Heen en terug naast elkaar', type: 'aanuit', standaard: true, help: 'Reed je dezelfde weg heen en terug, dan ligt de terugweg precies op de heenweg en zie je maar één lijn. Met deze aan komen ze naast elkaar, net als op de overzichtskaart' },
  { key: 'route.tussenruimteMm', groep: 'route', label: 'Wit tussen heen en terug', type: 'mm', min: 0, max: 3, step: 0.05, standaard: 0.35, help: 'Komt bovenop de lijndikte, dus dit is precies de streep die je ertussen ziet. De buitenlijn van de route vult die ruimte, dus hij krijgt vanzelf de kleur van het randje' },
  { key: 'route.keerNegeerMm', groep: 'route', label: 'Kortste stuk dat als terugweg telt', type: 'mm', min: 5, max: 120, step: 5, standaard: 25, help: 'Hoeveel weg vlak achter je niet meetelt. Te laag en elke haarspeldbocht wordt een terugweg; te hoog en een kort keerpunt wordt gemist' },
  { key: 'profiel.dagLijnenAan', groep: 'profiel', label: 'Stippellijn tussen de dagen', type: 'aanuit', standaard: true, help: 'Alleen op de reiscijfer-pagina: een verticale stippellijn op elke dagovergang' },
  { key: 'profiel.dagLijnKleur', groep: 'profiel', label: 'Kleur dagscheiding', type: 'kleur', standaard: '#8b847c' },
  { key: 'profiel.dagLijnMm', groep: 'profiel', label: 'Dikte dagscheiding', type: 'mm', min: 0.05, max: 1, step: 0.01, standaard: 0.22 },
  { key: 'profiel.dagStreepMm', groep: 'profiel', label: 'Streeplengte dagscheiding', type: 'mm', min: 0.2, max: 5, step: 0.1, standaard: 1.2 },
  { key: 'profiel.rasterVerticaal', groep: 'profiel', label: 'Ook verticale rasterlijnen', type: 'aanuit', standaard: true },
  { key: 'profiel.rasterFijnheid', groep: 'profiel', label: 'Fijnheid van het raster', type: 'getal', min: 2, max: 20, step: 1, standaard: 10, help: 'Hoeveel vakken er ongeveer over de grafiek komen. Hoger is fijner' },
  { key: 'eerdere.aan', groep: 'eerdere', label: 'Eerdere dagen tonen', type: 'aanuit', standaard: true },
  { key: 'eerdere.kleur', groep: 'eerdere', label: 'Kleur', type: 'kleur', standaard: '#c9c1b8'},
  { key: 'eerdere.dikteMm', groep: 'eerdere', label: 'Dikte', type: 'mm', min: 0.05, max: 3, step: 0.05, standaard: 0.45 },
  { key: 'eerdere.dekking', groep: 'eerdere', label: 'Dekking', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 0.55 },
  { key: 'eerdere.hoeveel', groep: 'eerdere', label: 'Welke dagen', type: 'keuze', opties: ['alle voorgaande', 'alleen de vorige', 'de hele reis'], standaard: 'alle voorgaande' },

  // --------------------------------------------------------------- markers
  { key: 'markers.stopGrootteMm', groep: 'markers', label: 'Stop: grootte', type: 'mm', min: 0.5, max: 12, step: 0.1, standaard: 3.1},
  { key: 'markers.stopVulling', groep: 'markers', label: 'Stop: vulkleur', type: 'kleur', standaard: '#ffffff'},
  { key: 'markers.stopRand', groep: 'markers', label: 'Stop: randkleur', type: 'kleur', standaard: '#f4610c'},
  { key: 'markers.stopRandMm', groep: 'markers', label: 'Stop: randdikte', type: 'mm', min: 0.05, max: 2, step: 0.05, standaard: 0.85},
  { key: 'markers.stopVorm', groep: 'markers', label: 'Stop: vorm', type: 'keuze', opties: ['cirkel', 'vierkant', 'ruit', 'speld'], standaard: 'cirkel' },
  { key: 'markers.viaGrootteMm', groep: 'markers', label: 'Doorrijpunt: grootte', type: 'mm', min: 0, max: 8, step: 0.1, standaard: 1.3 },
  { key: 'markers.viaVulling', groep: 'markers', label: 'Doorrijpunt: kleur', type: 'kleur', standaard: '#f4610c'},
  { key: 'markers.slaapGrootteMm', groep: 'markers', label: 'Overnachting: grootte', type: 'mm', min: 0.5, max: 14, step: 0.1, standaard: 4.2 },
  { key: 'markers.slaapVulling', groep: 'markers', label: 'Overnachting: vulkleur', type: 'kleur', standaard: '#f4610c'},
  { key: 'markers.slaapRand', groep: 'markers', label: 'Overnachting: randkleur', type: 'kleur', standaard: '#ffffff'},
  { key: 'markers.slaapVorm', groep: 'markers', label: 'Overnachting: vorm', type: 'keuze', opties: ['tent', 'huisje', 'auto', 'cirkel', 'ster', 'ruit', 'speld'], standaard: 'tent', help: 'Wordt overschreven door wat er in het dagbestand staat: kamperen wordt een tent, een hotel een huisje' },
  { key: 'markers.nummers', groep: 'markers', label: 'Stops nummeren', type: 'aanuit', standaard: false },

  // ---------------------------------------------------------------- labels
  { key: 'labels.aan', groep: 'labels', label: 'Labels tonen', type: 'aanuit', standaard: true },
  { key: 'labels.grootteMm', groep: 'labels', label: 'Lettergrootte', type: 'mm', min: 1.2, max: 12, step: 0.1, standaard: 3 },
  { key: 'labels.kleur', groep: 'labels', label: 'Kleur', type: 'kleur', standaard: '#2b2926'},
  { key: 'labels.haloKleur', groep: 'labels', label: 'Witrand', type: 'kleur', standaard: '#ffffff'},
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
  { key: 'titelblok.glasAan', groep: 'titelblok', label: 'Glasplaatje erachter', type: 'aanuit', standaard: true, help: 'Een melkachtig plaatje achter de titel, met een lichte rand bovenaan en een zachte schaduw eronder. De vervaging van de kaart erdoorheen zie je in de preview en de PNG; in de PDF blijft de rest staan, want dat pad kan geen achtergrondvervaging' },
  { key: 'titelblok.glasKleur', groep: 'titelblok', label: 'Glas: kleur', type: 'kleur', standaard: '#ffffff' },
  { key: 'titelblok.glasDekking', groep: 'titelblok', label: 'Glas: melkachtigheid', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 0.42, help: 'Hoe dicht het plaatje is. Laag laat de kaart er goed doorheen komen, hoog maakt het bijna een gewoon vlak' },
  { key: 'titelblok.glasBlurMm', groep: 'titelblok', label: 'Glas: vervaging', type: 'mm', min: 0, max: 6, step: 0.1, standaard: 1.6 },
  { key: 'titelblok.glasRondingMm', groep: 'titelblok', label: 'Glas: hoekronding', type: 'mm', min: 0, max: 20, step: 0.5, standaard: 5 },
  { key: 'titelblok.glasPadMm', groep: 'titelblok', label: 'Glas: ruimte om de tekst', type: 'mm', min: 0, max: 15, step: 0.5, standaard: 3.5 },
  { key: 'titelblok.glasSchaduw', groep: 'titelblok', label: 'Glas: schaduw eronder', type: 'aanuit', standaard: true },
  { key: 'titelblok.vlakAan', groep: 'titelblok', label: 'Achtergrondvlak (het oude, platte)', type: 'aanuit', standaard: false, help: 'Het effen vlak van voorheen. Het glasplaatje gaat hiervoor als ze allebei aanstaan' },
  { key: 'titelblok.vlakKleur', groep: 'titelblok', label: 'Kleur vlak', type: 'kleur', standaard: '#ffffff' },
  { key: 'titelblok.vlakDekking', groep: 'titelblok', label: 'Dekking vlak', type: 'getal', min: 0, max: 1, step: 0.01, standaard: 0.85 },
  { key: 'titelblok.kleur', groep: 'titelblok', label: 'Tekstkleur', type: 'kleur', standaard: '#2b2926'},

  // ----------------------------------------------------------------- inzet
  { key: 'inzet.aan', groep: 'inzet', label: 'Inzetkaartje tonen', type: 'aanuit', standaard: true },
  { key: 'inzet.hoek', groep: 'inzet', label: 'Hoek', type: 'keuze', opties: ['rechtsonder', 'linksonder', 'rechtsboven', 'linksboven'], standaard: 'rechtsonder' },
  { key: 'inzet.breedteMm', groep: 'inzet', label: 'Breedte', type: 'mm', min: 15, max: 120, step: 1, standaard: 52 },
  { key: 'inzet.achtergrond', groep: 'inzet', label: 'Achtergrond kaartje', type: 'kleur', standaard: '#ffffff'},
  { key: 'inzet.landKleur', groep: 'inzet', label: 'Landkleur', type: 'kleur', standaard: '#e2ddd4'},
  { key: 'inzet.routeKleur', groep: 'inzet', label: 'Kleur hele reis', type: 'kleur', standaard: '#f4610c'},
  { key: 'inzet.kaderKleur', groep: 'inzet', label: 'Kleur kadertje', type: 'kleur', standaard: '#f4610c'},
  { key: 'inzet.kaderMm', groep: 'inzet', label: 'Dikte kadertje', type: 'mm', min: 0.05, max: 2, step: 0.05, standaard: 0.4 },
  { key: 'inzet.afrondingMm', groep: 'inzet', label: 'Afronding hoeken', type: 'mm', min: 0, max: 12, step: 0.5, standaard: 2.5 },
  { key: 'inzet.padMm', groep: 'inzet', label: 'Ruimte rond het eiland', type: 'mm', min: 0, max: 12, step: 0.5, standaard: 3 },
  { key: 'inzet.schaduw', groep: 'inzet', label: 'Zachte schaduw', type: 'aanuit', standaard: true },
  { key: 'inzet.kaderVulling', groep: 'inzet', label: 'Vulling van het kadertje', type: 'getal', min: 0, max: 0.5, step: 0.01, standaard: 0.12, help: 'Een lichte kleurwaas binnen het kadertje maakt in een oogopslag duidelijk welk stuk je op de grote kaart ziet' },
  { key: 'inzet.randKleur', groep: 'inzet', label: 'Randlijn', type: 'kleur', standaard: '#e6e2db'},
  { key: 'inzet.randMm', groep: 'inzet', label: 'Dikte randlijn', type: 'mm', min: 0, max: 2, step: 0.05, standaard: 0.2 },

  // ----------------------------------------------------------------- schaal
  { key: 'schaal.balkAan', groep: 'schaal', label: 'Schaalbalk tonen', type: 'aanuit', standaard: true },
  { key: 'schaal.positie', groep: 'schaal', label: 'Schaalbalk: hoek', type: 'keuze', opties: ['linksonder', 'rechtsonder', 'linksboven', 'rechtsboven'], standaard: 'linksonder' },
  { key: 'schaal.kleur', groep: 'schaal', label: 'Schaalbalk: kleur', type: 'kleur', standaard: '#8b847c'},
  { key: 'schaal.noordpijlAan', groep: 'schaal', label: 'Kompasroos', type: 'aanuit', standaard: true },
  { key: 'schaal.kompasVorm', groep: 'schaal', label: 'Kompas: vorm', type: 'keuze', opties: ['klassiek', 'ster', 'pijl'], standaard: 'klassiek', help: 'klassiek = acht punten met ring en gradenstreepjes · ster = alleen de vier hoofdrichtingen · pijl = alleen noord-zuid' },
  { key: 'schaal.kompasMm', groep: 'schaal', label: 'Kompas: grootte', type: 'mm', min: 4, max: 40, step: 0.5, standaard: 17 },
  { key: 'schaal.kompasGlasFactor', groep: 'schaal', label: 'Kompas: hoeveel groter het glas is', type: 'getal', min: 1, max: 2.6, step: 0.05, standaard: 1.62, help: 'Ten opzichte van de roos zelf. 1 is precies eromheen, hoger geeft meer rustige ruimte rond de punten en de letters' },
  { key: 'schaal.kompasGlas', groep: 'schaal', label: 'Kompas: glasplaatje eronder', type: 'aanuit', standaard: true, help: 'Een melkachtig schijfje onder de roos, zodat hij ook op een drukke kaart leesbaar blijft. Volgt de kleur en melkachtigheid van het glas achter het titelblok' },
  { key: 'schaal.kompasHoek', groep: 'schaal', label: 'Kompas: hoek', type: 'keuze', opties: ['rechtsboven', 'linksboven', 'rechtsonder', 'linksonder'], standaard: 'rechtsboven' },
  { key: 'schaal.kompasDonker', groep: 'schaal', label: 'Kompas: belichte helft', type: 'kleur', standaard: '#3a352e' },
  { key: 'schaal.kompasLicht', groep: 'schaal', label: 'Kompas: schaduwhelft', type: 'kleur', standaard: '#ffffff' },
  { key: 'schaal.kompasRing', groep: 'schaal', label: 'Kompas: ring en streepjes', type: 'kleur', standaard: '#3a352e' },
  { key: 'schaal.kompasLijnMm', groep: 'schaal', label: 'Kompas: lijndikte', type: 'mm', min: 0.05, max: 1, step: 0.01, standaard: 0.18 },
  { key: 'schaal.kompasLetters', groep: 'schaal', label: 'Kompas: letters erbij', type: 'aanuit', standaard: true },
  { key: 'schaal.kompasLetterMm', groep: 'schaal', label: 'Kompas: lettergrootte', type: 'mm', min: 1.2, max: 8, step: 0.1, standaard: 2.6 },

  // -------------------------------------------------------------------- bron
  { key: 'bron.aan', groep: 'bron', label: 'Bronvermelding tonen', type: 'aanuit', standaard: true },
  { key: 'bron.grootteMm', groep: 'bron', label: 'Grootte', type: 'mm', min: 1, max: 5, step: 0.1, standaard: 1.8 },
  { key: 'bron.kleur', groep: 'bron', label: 'Kleur', type: 'kleur', standaard: '#a8a099'},

  // ------------------------------------------------------------- voortgang
  { key: 'voortgang.hoogteMm', groep: 'voortgang', label: 'Hoogte van het strookje', type: 'mm', min: 8, max: 80, step: 1, standaard: 24, help: 'Het strookje wordt zo hoog als je hier zet, en net zo breed als de pagina. Bedoeld om onder een foto te plaatsen' },
  { key: 'voortgang.dikteMm', groep: 'voortgang', label: 'Dikte van de balk', type: 'mm', min: 0.5, max: 8, step: 0.1, standaard: 1.8 },
  { key: 'voortgang.kernDekking', groep: 'voortgang', label: 'Dekking van de kern', type: 'getal', min: 0.05, max: 1, step: 0.01, standaard: 0.47, help: 'De rand blijft altijd dekkend; dit is alleen de binnenkant, net als bij de routelijn op de kaart' },
  { key: 'voortgang.buitenExtraMm', groep: 'voortgang', label: 'Rand extra dik', type: 'mm', min: 0, max: 2, step: 0.05, standaard: 0.35 },
  { key: 'voortgang.gehadFactor', groep: 'voortgang', label: 'Stippen die je gehad hebt', type: 'getal', min: 0.42, max: 1, step: 0.01, standaard: 0.62, help: 'Hoeveel groter de stops die je al gehad hebt zijn dan de stops die nog komen' },
  { key: 'voortgang.baanKleur', groep: 'voortgang', label: 'Kleur van het lege deel', type: 'kleur', standaard: '#e4e0d9' },
  { key: 'voortgang.stipMm', groep: 'voortgang', label: 'Grootte van de stippen', type: 'mm', min: 0.5, max: 8, step: 0.1, standaard: 2.6 },
  { key: 'voortgang.stipRand', groep: 'voortgang', label: 'Randkleur huidige stip', type: 'kleur', standaard: '#ffffff' },
  { key: 'voortgang.naamAan', groep: 'voortgang', label: 'Naam van de stop tonen', type: 'aanuit', standaard: true },
  { key: 'voortgang.naamMm', groep: 'voortgang', label: 'Lettergrootte', type: 'mm', min: 1.5, max: 10, step: 0.1, standaard: 3.2 },
  { key: 'voortgang.kmAan', groep: 'voortgang', label: 'Kilometers tonen', type: 'aanuit', standaard: true },
  { key: 'voortgang.dagAan', groep: 'voortgang', label: 'Dag en titel tonen', type: 'aanuit', standaard: true },

  // ----------------------------------------------------------------- profiel
  { key: 'profiel.vorm', groep: 'profiel', label: 'Vorm van de grafiek', type: 'keuze', opties: ['silhouet', 'lagen', 'kam', 'arcering', 'terras', 'spiegel'], standaard: 'silhouet', help: 'silhouet = vlak met kleurverloop · lagen = vlakke hoogtebanden als uitgesneden multiplex · kam = een staand streepje per meetpunt in zijn eigen hoogtekleur · arcering = schuine lijntjes die hoger dichter gaan staan · terras = rustig vlak met hoogtelijnen erdoorheen · spiegel = het profiel met zijn weerspiegeling eronder' },
  { key: 'profiel.bandStapM', groep: 'profiel', label: 'Hoogte per band', type: 'getal', min: 25, max: 500, step: 25, standaard: 100, eenheid: 'm', help: 'Voor lagen, arcering en terras: om de hoeveel meter er een nieuwe band of hoogtelijn komt' },
  { key: 'profiel.kamAfstandMm', groep: 'profiel', label: 'Kam: afstand tussen de streepjes', type: 'mm', min: 0.2, max: 4, step: 0.05, standaard: 0.7 },
  { key: 'profiel.arceringMm', groep: 'profiel', label: 'Arcering: ruimte tussen de lijntjes', type: 'mm', min: 0.3, max: 3, step: 0.05, standaard: 0.9, help: 'Dit is de ruimste stand, onderaan de grafiek. Naar boven toe gaan de lijntjes vanzelf dichter staan' },
  { key: 'profiel.hoogteMm', groep: 'profiel', label: 'Hoogte van de grafiek', type: 'mm', min: 20, max: 200, step: 1, standaard: 70 },
  { key: 'profiel.vulKleur', groep: 'profiel', label: 'Vulkleur', type: 'kleur', standaard: '#dfe6e9' },
  { key: 'profiel.lijnKleur', groep: 'profiel', label: 'Lijnkleur', type: 'kleur', standaard: '#f4610c'},
  { key: 'profiel.lijnDikteMm', groep: 'profiel', label: 'Lijndikte', type: 'mm', min: 0.05, max: 2, step: 0.05, standaard: 0.4 },
  { key: 'profiel.verloopAan', groep: 'profiel', label: 'Kleur volgt de hoogte', type: 'aanuit', standaard: true, help: 'Het vlak onder de lijn krijgt een kleurverloop dat met de hoogte meeloopt: het dal blijft rustig, de klim naar de F-weg springt eruit' },
  { key: 'profiel.dal', groep: 'profiel', label: 'Kleur op zeeniveau', type: 'kleur', standaard: '#a6c99a' },
  { key: 'profiel.laag', groep: 'profiel', label: 'Kleur laag', type: 'kleur', standaard: '#b9ab53' },
  { key: 'profiel.laagM', groep: 'profiel', label: 'Laag op hoogte', type: 'getal', min: 50, max: 800, step: 25, standaard: 300, eenheid: 'm' },
  { key: 'profiel.midden', groep: 'profiel', label: 'Kleur midden', type: 'kleur', standaard: '#c98345' },
  { key: 'profiel.middenM', groep: 'profiel', label: 'Midden op hoogte', type: 'getal', min: 100, max: 1500, step: 25, standaard: 600, eenheid: 'm' },
  { key: 'profiel.hoog', groep: 'profiel', label: 'Kleur hoog', type: 'kleur', standaard: '#c84e35' },
  { key: 'profiel.hoogM', groep: 'profiel', label: 'Hoog op hoogte', type: 'getal', min: 200, max: 2000, step: 25, standaard: 850, eenheid: 'm' },
  { key: 'profiel.piek', groep: 'profiel', label: 'Kleur piek', type: 'kleur', standaard: '#7f346c' },
  { key: 'profiel.piekM', groep: 'profiel', label: 'Piek vanaf', type: 'getal', min: 300, max: 2500, step: 50, standaard: 1100, eenheid: 'm' },
  { key: 'profiel.verloopDekking', groep: 'profiel', label: 'Dekking van het verloop', type: 'getal', min: 0.1, max: 1, step: 0.01, standaard: 0.75 },
  { key: 'profiel.rasterAan', groep: 'profiel', label: 'Raster', type: 'aanuit', standaard: true },
  { key: 'profiel.stopsAan', groep: 'profiel', label: 'Stops aangeven', type: 'aanuit', standaard: true },
  { key: 'profiel.topLabelAan', groep: 'profiel', label: 'Hoogste punt labelen', type: 'aanuit', standaard: true },
  { key: 'profiel.overdrijving', groep: 'profiel', label: 'Verticaal overdrijven', type: 'getal', min: 0.5, max: 4, step: 0.1, standaard: 1 },

  // ------------------------------------------------------------ statistieken
  { key: 'statistieken.kolommen', groep: 'statistieken', label: 'Aantal kolommen', type: 'getal', min: 2, max: 6, step: 1, standaard: 4 },
  { key: 'statistieken.getalMm', groep: 'statistieken', label: 'Grootte van de getallen', type: 'mm', min: 3, max: 30, step: 0.5, standaard: 9 },
  { key: 'statistieken.labelMm', groep: 'statistieken', label: 'Grootte van de labels', type: 'mm', min: 1.5, max: 10, step: 0.1, standaard: 2.6 },
  { key: 'statistieken.getalKleur', groep: 'statistieken', label: 'Kleur getallen', type: 'kleur', standaard: '#2b2926'},
  { key: 'statistieken.labelKleur', groep: 'statistieken', label: 'Kleur labels', type: 'kleur', standaard: '#8b847c'},
  { key: 'statistieken.lijntjes', groep: 'statistieken', label: 'Scheidingslijntjes', type: 'aanuit', standaard: false }
]

// De logica die met dit schema werkt (standaardwaarden, samenvoegen, controleren)
// staat in src/style.js. Dit bestand is bewust alleen data.
