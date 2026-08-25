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

Er zijn twee sleutels. De eerste heb je nodig, de tweede alleen als je beeld
wilt laten verzinnen. Ze gaan allebei in `data/secrets.json`:

```json
{
  "mapboxToken": "pk.eyJ...",
  "googleApiKey": "AIza..."
}
```

**Mapbox** levert de kaartachtergrond. Maak een gratis account op
[mapbox.com](https://mapbox.com) en kopieer je **publieke** token, die met `pk.`
begint. Een geheime `sk.`-token wordt geweigerd: die geeft toegang tot je hele
account.

**Google** levert Nano Banana, het beeldmodel dat een sfeerbeeld tekent voor de
plekken waar geen eigen foto van is. Een sleutel maak je op
[aistudio.google.com/apikey](https://aistudio.google.com/apikey). Anders dan de
rest kost dit geld per plaatje, dus elk resultaat gaat de schijfcache in:
dezelfde prompt levert daarna hetzelfde beeld zonder nieuwe rekening. Sla dit
over als je alleen kaarten maakt.

`data/secrets.json` staat in `.gitignore` en hoort daar te blijven. Welke
sleutels er bestaan staat in `data/secrets.voorbeeld.json`, en die mag wel mee
in git omdat er alleen plaatshouders in staan.

Voor een enkel commando kan het ook zonder bestand; de omgeving wint:

```sh
GOOGLE_API_KEY=AIza... node src/build.js 4
```

```sh
npm run dev              # bedieningspagina op http://localhost:4321
node src/build.js 4      # exporteert de kaart van dag 4 naar out/
node src/build.js 4 stats  # en de cijferpagina van diezelfde dag
node src/stempel.js      # snijdt een stempel uit elke heropfoto
npm test                 # 25 testbestanden
npm run statisch         # bakt een alleen-lezen versie naar docs/
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
    geheimen.js      de sleutels, uit de omgeving of uit data/secrets.json
    nanobanana.js    beeld van Googles beeldmodel, met de schijfcache erachter
  hero.js            welke foto bij welke dag hoort, en wat we het model vragen
  stempel.js         maakt de reisstempels; het enige dat geld kost
  render/papier.js   het vel met vezels waar de veldnotitie-stijl op ligt
  render/weertekens.js  het weer als notatie van een waarnemer, niet als emoji
  pages/postzegel.js de stempelband onderaan, en de afdruk op de kaart
```

## De reisstempels

Onderaan elke cijferpagina staat een band met kleine gesneden stempels: per
heropfoto van die dag een afdruk die alleen nog de contouren bewaart waaraan je
de plek herkent. De foto legt de dag vast, de stempel houdt het fragment over
dat je je herinnert.

```sh
node src/stempel.js              # alle dagen, slaat over wat er al staat
node src/stempel.js 4            # alleen dag 4
node src/stempel.js 4 --opnieuw  # een nieuwe afdruk kopen van dezelfde foto
node src/stempel.js --herzet     # de bewaarde platen opnieuw bewerken, gratis
```

De foto's staan in `Hero/`, met namen als `Dag 3.ARW` of `Dag 5-2.jpg`. Het
cijfer achter het streepje is de volgorde binnen die dag, niet een tweede dag.

**Let op de verschuiving van één dag.** `Dag 1.jpg` in die map is de eerste dag
waarvan er een foto is, en dat is de tweede dag van de reis: van dag 1, de
aankomst in Keflavík, is niets bewaard. Dat staat als `DAG_VERSCHUIVING` in
`src/hero.js`, want het is precies het soort ding dat je een halfjaar later niet
meer terugvindt.

Sony-RAW gaat eerst even door `sips` heen: sharp heeft geen RAW-decoder, macOS
wel. Dat scheelt een afhankelijkheid van honderden megabytes.

### Wat het model wel en niet doet

Het model tekent **alleen de stempel**. De foto, het papier, de typografie en de
cijfers maakt dit project zelf, op 600 dpi en uit de echte route. Laat je het
model de hele pagina maken, dan staan er verzonnen kilometers op en is er daarna
niets meer bij te stellen.

### Drie bestanden per afdruk

| in `data/hero/` | wat het is |
|---|---|
| `ruw/dag-NN-K.jpg` | de plaat zoals het model hem gaf, op volle maat |
| `plaat-dag-NN-K.jpg` | diezelfde plaat, met zijn papier naar wit teruggerekend |
| `stempel-dag-NN-K.png` | de inkt uitgesleuteld, met echte doorzichtigheid |
| `foto-dag-NN-K.jpg` | de heropfoto zelf, ingehouden gegradeerd met filmkorrel |

De ruwe platen zijn het enige in dit project dat geld kost én niet opnieuw te
maken is: hetzelfde verzoek geeft een andere afdruk terug. Ze staan daarom in
`.gitignore` maar wél op schijf, en omdat de projectmap in iCloud ligt zijn ze
daarmee geback-upt. Wil je aan de bewerking draaien zonder opnieuw te betalen,
dan is dat `--herzet`.

De pagina gebruikt standaard de plaat en drukt hem er optisch op met
vermenigvuldigen: wit vermenigvuldigt tot niets, dus het vel van het model
verdwijnt en de inkt gedraagt zich als inkt op het papier van de bladzijde. Geen
uitgeknipte rand, en de korrel en de droge plekken blijven heel. Met
"Hoe hard aangedrukt" zet je de hele band lichter of zwaarder.

## De veldnotitie-stijl

`data/presets/veldnotitie.json` zet het hele boek in één klik op stempelinkt:
een verbleekte, ontzadigde kaart die naar de papierkleur trekt in plaats van
naar wit, de typemachineletter, het vel met vezels onder de cijfers én over de
kaart, en het inzetkaartje als postzegel met kartelrand en afstempeling.

Twee dingen om te weten:

- De typemachineletter is American Typewriter, en die staat alleen op macOS. In
  de gebakken `docs/` valt hij elders terug op Courier New. Zelfde soort letter,
  iets minder mooi.
- Het dagverhaal staat in kolommen. Over de volle breedte van een pagina van
  dertig centimeter wordt één kolom ruim honderdvijftig tekens per regel, en dan
  vindt je oog de volgende regel niet meer terug.

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
| greepje op het dagverhaal | het vak smaller of breder maken; de tekst herwikkelt zich erin en de letter blijft even groot |
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
