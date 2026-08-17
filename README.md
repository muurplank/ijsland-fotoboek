# IJsland-fotoboek

Maakt de kaartpagina's voor een zelfontworpen fotoboek van een reis door IJsland,
op drukkwaliteit. Per dag een kaart met de route, een hoogteprofiel met de
kerncijfers, en daarnaast een overzicht van de hele reis.

Je zet de opmaak in de browser goed en exporteert hem daarna als PNG en PDF op
600 dpi. Wat je op het scherm ziet is exact wat er uit komt.

## Alles is millimeters

Dat is de kerngedachte van het hele project. De pagina is een `<div>` met een
CSS-variabele `--mm` die zegt hoeveel schermpixels één millimeter is, en de
SVG-lagen hebben een `viewBox` in millimeters. Een `stroke-width: 1.1` is dus
echt 1,1 mm op papier. Het enige verschil tussen scherm en druk is de waarde van
`--mm`.

Daarom staan alle instellingen ook in millimeters en niet in pixels: een
routelijn van 1,5 mm blijft 1,5 mm, of je nu een A5'je maakt of een pagina van
30 bij 30 centimeter.

## Aan de praat krijgen

Node 22 of nieuwer.

```sh
npm install
```

Je hebt een gratis Mapbox-token nodig voor de kaartachtergrond. Maak een account
op [mapbox.com](https://mapbox.com), kopieer je **publieke** token (die begint
met `pk.`) en zet hem in `data/secrets.json`:

```json
{ "mapboxToken": "pk.eyJ..." }
```

Dat bestand staat in `.gitignore` en hoort daar te blijven.

```sh
npm run dev            # bedieningspagina op http://localhost:4321
node src/build.js 4    # exporteert dag 4 naar out/dag-04-kaart.png en .pdf
npm test               # 21 testbestanden
npm run statisch       # bakt een alleen-lezen versie naar docs/
```

## Hoe het in elkaar zit

Het werk is verdeeld tussen de server en de browser, en die grens loopt langs
"wat is zwaar" en "wat wil je live kunnen bijstellen".

**De server** (`src/server.js`) maakt alleen de rasterachtergrond. Die heeft het
hoogtemodel, de Mapbox-tegels en `sharp` nodig, en dat is te traag om bij elke
schuifbeweging te doen. Hij levert één PNG plus de rechthoek in millimeters waar
die op de pagina hoort.

**De browser** (`src/pages/preview.js`) tekent al het andere als vectoren: de
route, de richtingspijltjes, de markers, de plaatsnamen, het titelblok, het
inzetkaartje, de schaalbalk en de kompasroos. Daarom reageert vrijwel elke knop
meteen. Alleen de 33 instellingen die de achtergrond veranderen kosten een rondje
langs de server; welke dat zijn staat in `ACHTERGROND_KNOPPEN` in
`src/render/layout.js`.

**De export** (`src/build.js`) start de previewserver als die nog niet loopt,
stuurt Chromium via Playwright naar dezelfde pagina met `?export=png` of
`?export=pdf`, en schrijft het resultaat naar `out/`. In de PDF blijven tekst en
lijnen vectoren. Na afloop volgt een controlelijst: onder 300 dpi, minder dan
3 mm afloop, tekst kleiner dan 1,8 mm of een lijn dunner dan 0,09 mm laat de
export met een foutcode afgaan.

```
src/
  server.js          devserver plus een kleine JSON- en PNG-API
  build.js           de export naar PNG en PDF, met de drukcontrole
  styleSchema.js     alle 253 instelknoppen, op één plek
  style.js           instellingenlagen stapelen en waarden klemmen
  pages/             wat er in de browser gebeurt
    preview.js       knoopt paneel, pagina en server aan elkaar
    panel.js         het bedieningspaneel, opgebouwd uit het schema
    draw.js          route, pijltjes, markers, plaatsnamen
    furniture.js     titelblok, inzetkaartje, schaalbalk, kompas
    compass.js       de kompasroos
    editable.js      slepen, schalen, teksten aanpassen
    statspage.js  overview.js  tripstats.js  progress.js
  render/            beeld maken: achtergrond, silhouet, profielvormen
  geo/               tegels, uitsnede, hoogtemodel, afstanden
  fetch/             ophalen en cachen van tegels, routes, hoogtes, weer
```

## De instellingen

Elke knop staat als één regel in `src/styleSchema.js`. Daaruit komen drie dingen
tegelijk: het bedieningspaneel, de standaardwaarden, en de controle of een
bewaarde instelling nog bestaat. Een knop toevoegen is dus één regel, niet drie
plekken.

De waarden komen in lagen, en de laatste wint:

```
schemastandaard  →  data/book.json  →  data/days/day-NN.json  →  het paneel
```

Zo blijft het boek consistent zonder dat je vastzit als één dag om een
uitzondering vraagt. Onderin het paneel kies je of je naar het boek of naar deze
ene dag bewaart. Een instelling die het schema niet meer kent wordt overgeslagen
en gemeld, in plaats van dat het bestand stukloopt — zo blijft een oud
dagbestand werken nadat er een knop hernoemd is.

`data/presets/*.json` zijn kleurensets: één klik en het geheel klopt.

## Rechtstreeks op de pagina werken

Twee dingen kun je met geen enkele instelling oplossen: een plaatsnaam die net
over je route valt, en een titel die op déze dag beter rechtsonder staat.
Daarvoor sleep je gewoon.

| actie | wat het doet |
|---|---|
| slepen | verschuift het onderdeel; het midden en gelijke hoogtes snappen |
| slepen met Alt | zonder snappen, als je er net naast wilt |
| greepje rechtsonder | schalen — op een marker verzet dat de maat voor álle markers van die soort |
| dubbelklik op het greepje | terug naar de standaardmaat |
| dubbelklik op tekst | titel, dagverhaal of plaatsnaam ter plekke aanpassen |
| Delete op een icoontje | haalt de stip weg; de naam en de voortgangsbalk blijven |
| klikken | het paneel springt naar de knoppen van dat onderdeel |

Verschuivingen worden als afwijking bewaard en niet als absolute positie, zodat
de standaardopmaak leidend blijft en jouw correctie meeschuift als je later van
paginaformaat wisselt.

## De dagbestanden

`data/days/day-NN.json` heeft de datum, de titel, het dagverhaal en de
waypoints. De route ertussen komt van OSRM, dus je zet alleen de punten.

```json
{
  "name": "Goðafoss",
  "lat": 65.685482,
  "lon": -17.545502,
  "type": "stop",
  "notitie": "gestopt voor mega waterval",
  "fweg": false
}
```

`type` bepaalt wat het punt is en wat je ervan ziet:

| type | betekenis |
|---|---|
| `start` | begin van de dag |
| `via` | alleen langsgereden, stuurt de route langs de goede weg |
| `stop` | echt uitgestapt, krijgt een stip en een naam |
| `overnight` | hier geslapen, krijgt een badge — tentje, huisje, auto of vliegtuig via `verblijf` |
| `end` | eind van de reis |

Verder per punt: `fweg: true` markeert een onverharde F-weg (die wordt gestippeld
getekend), `toonLabel: false` verbergt de naam, `toonIcoon: false` alleen het
icoontje, en `toon: false` haalt het punt helemaal van de kaart terwijl het in de
route blijft staan — je reed er langs, dus de kilometers kloppen.

## Waar de gegevens vandaan komen

| bron | waarvoor |
|---|---|
| [Mapbox](https://mapbox.com) | de kaartachtergrond |
| [OSRM](https://project-osrm.org) | de route tussen de waypoints |
| [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (AWS) | hoogtes voor het profiel, het reliëf en de kustlijn |
| [Open-Meteo](https://open-meteo.com) | het weer per dag, voor de temperatuurlijn |
| Esri | luchtfoto's |

Alles wordt op schijf gecachet in `~/Library/Caches/ijsland-fotoboek`, per soort
apart. Dat loopt in de honderden megabytes voor het hoogtemodel, dus verwacht dat
de eerste keer even duurt en daarna niet meer.

## De statische versie

`npm run statisch` bakt de bedieningspagina tot een map `docs/` die je zonder
server kunt neerzetten, bijvoorbeeld op GitHub Pages (instellingen: main / docs).

Het werkt doordat de zware kant en de bedienbare kant hier al gescheiden zijn.
De elf antwoorden van de server worden één keer opgehaald en als bestand
weggeschreven — de JSON van het schema, de dagen en de reis, plus per dag de
achtergrondplaat en de plaatsnamenlaag. `src/pages/statisch-schil.js` onderschept
de aanroepen en haalt in plaats daarvan die bestanden op, zodat de tekencode
zelf niet weet of er een server is en er maar één versie van bestaat.

Bij elkaar ongeveer 21 MB. Wat blijft werken is alles wat de browser tekent:
route, pijltjes, markers, plaatsnamen, typografie, titelblok, inzetkaartje,
schaalbalk, kompas, en de kleurensets. Wat vastligt is de kaartachtergrond — de
33 knoppen uit `ACHTERGROND_KNOPPEN` doen daar niets meer, want die plaat is
gebakken. Opslaan doet niets: wat je verzet blijft in dat tabblad staan en
verdwijnt bij het herladen.

Let op dat `docs/` je dagverhalen bevat. Zet je de repo publiek, dan staan die
op internet.

## Bij het werken hieraan

De testbestanden dekken het rekenwerk: tegels, uitsnedes, hoogtemodel,
kleurverlopen, profielvormen, het opsporen van wegnummer-badges, en de
invarianten van het instellingenschema. Het tekenwerk in de browser is niet
getest — daarvoor is de preview er.

Eén valkuil is het waard om te weten: `node src/build.js` hergebruikt een
previewserver die al draait. De browserbestanden worden per verzoek van schijf
gelezen, maar `styleSchema.js`, `src/render/*`, `server.js` en `style.js` zijn
modules die één keer bij het opstarten worden geladen. Verander je daar iets
zonder de server te herstarten, dan exporteert de build met het oude schema en
ontbreken er stilletjes dingen. Herstart hem dus na zo'n wijziging.
