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
node src/build.js 1 voorblad  # het omslag, als PNG met doorzichtige achtergrond
node src/build.js 4      # exporteert de kaart van dag 4 naar out/
node src/build.js 4 stats  # en de cijferpagina van diezelfde dag
node src/build.js 3 voortgang 9  # het strookje van dag 3, gevuld tot stop 9
node src/stempel.js      # snijdt een stempel uit elke heropfoto
npm test                 # 30 testbestanden
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
meteen. Alleen de 35 instellingen die de achtergrond veranderen kosten een rondje
langs de server; welke dat zijn staat in `ACHTERGROND_KNOPPEN` in
`src/render/layout.js`.

**De export** (`src/export.js`) stuurt Chromium via Playwright naar dezelfde
pagina met `?export=png` of `?export=pdf`, maar dan op de drukmaat en zonder
paneel. In de PDF blijven tekst en lijnen vectoren. Na afloop volgt een
controlelijst: onder 300 dpi, minder dan 3 mm afloop, tekst kleiner dan 1,8 mm of
een lijn dunner dan 0,09 mm laat de export met een foutcode afgaan.

Er zijn twee manieren om erbij te komen. `src/build.js` doet het vanaf de
opdrachtregel, start de previewserver zelf op als die nog niet loopt en schrijft
PNG én PDF naar `out/`. En onderin het paneel zit **Opslaan als JPG…**: die
rendert het blad waar je op dat moment naar kijkt, met de knopstanden zoals ze nu
staan - ook wat je nog niet bewaard hebt - en laat je zelf kiezen waar het
bestand landt. Eén JPG op 95% met volle kleurresolutie, met de dpi in de kop
zodat een fotoboekprogramma het vel meteen op de goede maat zet. Chrome vraagt
eerst waar het heen moet, Safari laat het in je downloadmap vallen.

Het voortgangsstrookje komt daar als PNG uit ook al vraagt de knop om een JPG:
dat leeft van zijn doorzichtige achtergrond, en die bestaat niet in JPG.

Het voortgangsstrookje is daar de uitzondering op: dat is geen bladzijde maar
iets wat je over een foto legt, en komt er dus uit als één PNG met een
doorzichtige achtergrond en zonder PDF. Welke stop de balk vult geef je als
laatste getal mee. Zet je er papier onder met een scheurrand, dan is dat papier
wél dekkend - dan krijg je een strookje papier op een doorzichtige achtergrond.

```
src/
  server.js          devserver plus een kleine JSON- en PNG-API
  build.js           de export vanaf de opdrachtregel, naar out/
  export.js          het browserwerk van de export, met de drukcontrole
  styleSchema.js     alle 314 instelknoppen, op één plek
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
    plaatsen.js      de plaatsnamen op de kaart, uit OpenStreetMap
    geheimen.js      de sleutels, uit de omgeving of uit data/secrets.json
    nanobanana.js    beeld van Googles beeldmodel, met de schijfcache erachter
  hero.js            welke foto bij welke dag hoort, en wat we het model vragen
  stempel.js         maakt de reisstempels; het enige dat geld kost
  pages/voorblad.js  het omslag: de omtrek van het eiland en de ring van de reis
  render/kustringen.js  de kustlijn als gesloten ringen, uit het hoogtemodel
  render/vlag.js     de IJslandse vlag, gesneden en met de hand aangedrukt
  render/isolijn.js  marching squares: de lijn van gelijke hoogte door een rooster
  render/papier.js   het vel met vezels waar de veldnotitie-stijl op ligt
  render/pen.js      lijnen, kaders en cirkels zoals een hand ze zet
  render/hoogtelijnvulling.js  een vlak volgetekend met kringen die niet kruisen
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
node src/stempel.js --kleur=1    # de kleuren precies zoals het model ze gaf
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

De opdracht staat als één lange tekst in `stempelPrompt` in `src/hero.js`, en
twee regels daarin zijn de moeite waard om te kennen, want ze zijn er allebei na
een mislukte ronde bij gezet.

**Lucht, water en verte zijn drie verschillende dingen.** Eerst stonden ze in één
zin, alle drie als rijen streepjes. Het model doet dat dan ook: bij Búðakirkja
liep de lucht als een dicht streepjesveld over de halve afdruk en verdween het
zwarte kerkje erin. Nu is de lucht kaal papier, houdt het water zijn streepjes en
is de verte één dunne contourlijn.

**Het onderwerp wint.** De prompt zei nergens welk deel van het beeld het
onderwerp is, en dus kreeg de helling achter drie schapen meer inkt dan de
schapen zelf. Nu staat er dat niets in de achtergrond donkerder of drukker mag
zijn dan het onderwerp, en dat je dan inkt uit de achtergrond haalt in plaats van
er bij het onderwerp bij te doen.

Wat voor één afdruk geldt en niet voor alle twaalf zet je als `nadruk` bij die
afdruk in `data/hero/dag-NN.json`; die regel gaat als los blokje mee in de
prompt. Zo staat er bij de vleugel van dag 8 dat de zee wél streepjes houdt en de
lucht niet, en bij het vliegtuigwrak dat het zand oranje mag zijn. Dat veld
schrijf je met de hand en het blijft staan als je opnieuw genereert.

De kleur is daarna nog bij te stellen met `--kleur=`, en dat is de goedkope kant:
de bewaarde platen opnieuw sleutelen kost niets. Die knop draait de kleur om de
grijsas open of juist dicht, en weegt mee met de helderheid, zodat de sleutelinkt
- een warm bruinzwart, geen zuiver zwart - er niet roder van wordt.

Let op de richting, want die is een keer omgeklapt. Zolang de prompt om
ingehouden kleur vroeg kwamen de platen te bleek terug en stond deze knop boven
de 1 om ze op te halen. Nu de prompt om volle inkt vraagt komen ze er andersom
uit - fel genoeg voor een reisposter - en houdt hij ze juist in. Vandaar dat de
standaard `0.75` is. Zet hem op `1` en je ziet de plaat zoals het model hem gaf.

### Drie bestanden per afdruk

| in `data/hero/` | wat het is |
|---|---|
| `ruw/dag-NN-K.jpg` | de plaat zoals het model hem gaf, op volle maat |
| `ruw/dag-NN-K-vN.jpg` | dezelfde foto, maar een latere afdruk |
| `plaat-dag-NN-K.jpg` | diezelfde plaat, met zijn papier naar wit teruggerekend |
| `stempel-dag-NN-K.png` | de inkt uitgesleuteld, met echte doorzichtigheid |
| `foto-dag-NN-K.jpg` | de heropfoto zelf, ingehouden gegradeerd met filmkorrel |

De ruwe platen zijn het enige in dit project dat geld kost én niet opnieuw te
maken is: hetzelfde verzoek geeft een andere afdruk terug. Ze staan daarom in
`.gitignore` maar wél op schijf, en omdat de projectmap in iCloud ligt zijn ze
daarmee geback-upt. Wil je aan de bewerking draaien zonder opnieuw te betalen,
dan is dat `--herzet`.

Elke `--opnieuw` schrijft naar een nieuw bestand in plaats van over de vorige
heen: variant 1 houdt zijn kale naam, daarna komt het nummer erachter. Vind je de
oude afdruk toch mooier, zet dan `"variant"` terug in `data/hero/dag-NN.json` en
draai `node src/stempel.js NN --herzet`. Dat kost niets en je bent nooit iets
kwijt.

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

Het voortgangsstrookje doet in die stijl mee onder de naam **vak**: een met de
pen omlijnd kader dat volgetekend is tot de stop waar je bent, op een strookje
papier dat boven en onder uit de bladzijde gescheurd is, met het opschrift er in
kapitalen bij getypt. Waar de inkt ophoudt sta je nu; de stops ervoor en erna
staan als streepjes in het kader. De vulling kun je kiezen: **hoogtelijnen**
(geneste kringen die net als op een kaart nooit kruisen - ze komen uit een echt
hoogteveld, niet uit een stapel ovalen), **profiel** (het hoogteprofiel van die
dag, dus het terrein waar je overheen bent gegaan), **arcering** of effen
**inkt**. Wie de grafiek wil houden zet de gedaante terug op **balk**, en
daartussenin staat **penlijn**: dezelfde balk, met de hand getrokken.

Twee dingen om te weten:

- De typemachineletter is American Typewriter, en die staat alleen op macOS. In
  de gebakken `docs/` valt hij elders terug op Courier New. Zelfde soort letter,
  iets minder mooi.
- Het dagverhaal staat in kolommen. Over de volle breedte van een pagina van
  dertig centimeter wordt één kolom ruim honderdvijftig tekens per regel, en dan
  vindt je oog de volgende regel niet meer terug.

## Het voorblad

Het omslag is dezelfde reis als de overzichtskaart en toch een ander blad. Daar
gaat het erom welke dag waar liep, dus staat er van alles bij: dagkleuren, een
legenda, plaatsnamen, een schaalbalk. Hier gaat het erom dat je in één blik ziet
wat dit boek is, en dan is alles wat je erbij zet er één te veel.

Wat er staat zijn twee omtrekken die elkaar uitleggen: de vorm van het eiland en
de vorm van de rit. De ene is een ring om de andere, en juist die gelijkenis is
waar een rondreis om draait. Het eiland is gevuld met de IJslandse vlag, bij elke
overnachting staat een stip met het dagnummer, en verder niets — de titel staat
standaard uit, want een omslag dat het nog eens uitspreekt is er een dat zichzelf
niet vertrouwt.

De achtergrond is standaard doorzichtig. Het blad komt er dus als PNG uit en niet
als PDF, precies zoals het voortgangsstrookje, zodat je het in het
fotoboekprogramma over een foto of een egale kleur kunt leggen. Wil je er een
gewone bladzijde van maken, zet dan *Doorzichtige achtergrond* uit en *Papier
eronder* aan; dan komt er ook weer een PDF.

### De vlag als de vorm van het land

Standaard is de landsgrens het venster en de vlag de vulling: IJsland in blauw,
wit en rood, met de kustlijn en de ringroute er als lijn overheen. Juist die
lijnen maken er een kaart van in plaats van een plaatje — zonder de route is het
een vlaggetje in een landvorm, mét de route is het deze reis.

De vlag wordt daarbij **niet uitgerekt naar de vorm van het land** maar dekkend
geschaald met behoud van verhouding. IJsland is breder dan de vlag hoog is, dus
wat boven en onder uitsteekt knipt de kust vanzelf weg. Uitrekken zou het kruis
vervormen, en een vlag met een scheef kruis is geen vlag meer.

Twee dingen om te weten als je deze stand gebruikt:

- Zet **"Hoe de kaart meedoet" op `geen`**. De vlag ligt over het eiland heen en
  dekt de kaart volledig af, dus anders haalt de server elke keer een plaat op
  die niemand ziet. Tenzij je de dekking van de vlag verlaagt — dan schijnt het
  reliëf er juist doorheen, en dat kan mooi zijn.
- **De routekleur vecht met de vlag.** De standaard is stempeloker, en dat leest
  slecht op vol rood. Een donkere inkt (`#1b2430`) leest op blauw, wit én rood;
  wit leest prachtig op blauw en rood maar verdwijnt waar de route het witte
  kruis kruist.

De andere drie standen van "Hoe de vlag meedoet" zetten hem als los voorwerp
neer: `postzegel` (gefrankeerd in een hoek, zie hieronder), `los in de hoek`, en
`bij het beginpunt` — klein, op Keflavík waar de reis begon.

### De postzegel

Als zegel zit de vlag op een vel met kartelrand, een paar graden scheef geplakt,
met de afstempeling er schuin overheen. Dat is waar op een envelop een zegel
hoort, en daarmee leest het omslag als post uit IJsland. Een vlag die gewoon in
de hoek geparkeerd staat is een logo, en een boek met een logo erop is een
brochure; als zegel krijgt hij een reden om er te zijn.

De zegel is een eigen vel en dus dekkend, ook als het blad verder doorzichtig is.
Dat hoort zo: een zegel is een voorwerp dat je erop plakt.

De perforatie zijn halve cirkels die naar bínnen bijten — dat is wat een
perforatie is, gaatjes die uit het vel geponst zijn met het papier ertussen.
Bollen ze naar buiten, dan wordt het een bloem. Elke boog wordt met een even
aantal stukjes benaderd, want bij een oneven aantal valt er geen meetpunt op het
diepste punt en is elke tand een paar procent ondieper dan de straal zegt.

### De vlag zelf is overgenomen, niet nagetekend

`src/render/vlag.js` bevat letterlijk de drie paden uit `Flag_of_Iceland.svg`: een
blauw veld van 25 bij 18, en daarop twee kruisen die als **streek** getekend zijn
in plaats van als losse balken — eerst wit op streekbreedte 4, daar bovenop rood
op 2. Dat het één streek is en geen vier rechthoeken is precies waarom het klopt:
het midden van het kruis komt zo vanzelf goed uit, zonder dat er ergens vier
hoeken op elkaar hoeven te passen. Op maat zetten gebeurt met één transform, dus
de streekbreedte schaalt mee en de verhouding tussen wit en rood blijft staan.

Hier stond eerst een eigen versie, met een gesneden rand en drie inkten die naast
elkaar vielen zoals bij de reisstempels. Die was niet mooi. De vlag is geen
stempel: hij hoort strak te zijn, en het karakter van het blad komt van de zegel
eromheen of van de landvorm eromheen. `test/vlag.test.js` legt de padtekst vast,
want een nagetekende vlag ziet er goed uit tot je hem naast de echte legt.

### De kaart zit erin, maar altijd door iets heen

Een gewone kaartachtergrond zou het meteen weer een kaartpagina maken. Daarom
komt de plaat er alleen doorheen waar hij iets toevoegt, en dat regelt één knop:

| stand | wat je ziet |
|---|---|
| `eiland` | de kaart vult het land, de zee blijft leeg — de standaard |
| `baan` | alleen een strook kaart langs de route, met een zachte rand |
| `lijn` | de routelijn zelf is het venster op de kaart |
| `achter` | de hele kaart, ver weggezet als watermerk |
| `geen` | niets: alleen de omtrek en de ring |

`eiland` knipt met een `clipPath` en `baan` en `lijn` met een `mask`, en dat is
geen willekeur. Een `clipPath` gebruikt de *vulling* van zijn inhoud en negeert
de streek, en een baan langs de route is een dikke streek zonder vulling — daar
kán het dus niet mee. Andersom is `clipPath` voor het eiland juist beter, want
dat blijft in de PDF een echte snede in plaats van een gerasterde laag.

De plaat zit als `<image>` ín de tekening-SVG en niet als los `<img>` erachter,
zoals bij de andere bladen. Dat moet ook: het masker leeft in de
millimeter-userspace van die SVG en de `<img>` in beeldpunten van de pagina. Zo
staan plaat en masker per definitie in hetzelfde stelsel.

Het voorblad kiest ook zijn eigen kaartlaag, los van de rest van het boek —
standaard het kale reliëf, want dat heeft geen wegen en geen
wegnummer-schildjes. Dat gaat door `lagen.stijl` te overschrijven in wat er naar
de server gestuurd wordt en niet door het te bewaren, zodat de dagkaarten blijven
wat ze waren.

### De omtrek komt uit het hoogtemodel

Niet uit een aparte kaartbron. Het inzetkaartje haalt zijn silhouet al uit het
hoogtemodel — alles onder zeeniveau is zee, de rest is land — en het voorblad
gebruikt exact hetzelfde masker. De kust op het omslag is dus letterlijk dezelfde
kust als in het kaartje twintig bladzijden verderop.

Nieuw is alleen dat het een *lijn* moet worden in plaats van een vlak. Dat is
dezelfde bewerking als een hoogtelijn, maar dan op niveau nul: zeeniveau ís de
hoogtelijn die land van water scheidt. Marching squares stond al in het project,
verstopt in de vulling van het voortgangsvak; die drie functies staan nu in
`src/render/isolijn.js` en worden door allebei gebruikt.

Twee dingen zijn het waard om te weten:

- **De knop "kleinste eiland" doet het echte werk.** Op nul komen er
  negenenveertig ringen terug en zijn er tweeëndertig kleiner dan een vierkante
  kilometer — rotsen, zandbanken, meertjes onder zeeniveau. Op vijf blijven het
  vasteland, Heimaey, Hrísey en Grímsey over, en dat zijn precies de vier die je
  op een kaart van IJsland verwacht.
- **De omloopsrichting van een ring ligt niet vast.** Het rijgen begint bij het
  eerste streepje dat het tegenkomt, dus of een ring met de klok mee terugkomt
  hangt ervan af waar hij in het rooster ligt. Een vlak dat hieruit gevuld wordt
  moet daarom `fill-rule: evenodd` gebruiken en nooit `nonzero` — anders is een
  meer de ene keer een gat en de andere keer niet.

Ter controle van het geheel: het vasteland komt er op 104.815 vierkante kilometer
uit, en IJsland is er 103.000. Dat verschil is de halve cel die marching squares
er per definitie omheen legt.

### Het voorblad kadert op het eiland, niet op de rit

De overzichtskaart past zijn uitsnede op de route. Dat kan hier niet: de ringweg
raakt de Westfjorden en de oostpunt niet, dus een omslag dat op de rit kadert
snijdt daar een stuk IJsland af. Het voorblad past daarom op de kustringen, en
het heeft eigen schuifjes voor marge, zoom en verschuiven — de gedeelde
`uitsnede.*`-knoppen zijn boekbreed en zouden de overzichtskaart meeslepen.

Server en browser rekenen met precies dezelfde ringen, via `voorbladView` in
`src/render/layout.js`. Zolang dat zo blijft kunnen de plaat en de getekende kust
niet uit elkaar lopen.

## Alle letters op de kaart zijn van jou

De kaartachtergrond komt als plaatje binnen, dus de plaatsnamen die Mapbox erin
tekent zijn rasterletters: in hún letter, in hún kleur, en op 600 dpi zacht
opgeblazen. Naast een naam die het boek zelf zet valt dat meteen op — en de helft
van de tijd staat dezelfde plaats er dan twee keer, in twee verschillende letters.

Daarom worden ze uit de plaat gepoetst en zetten we ze zelf opnieuw:

1. **Wissen.** `src/render/shields.js` zoekt de kaarttekst op aan het patroon dat
   letters altijd hebben — ingehouden donkere inkt met iets veel helderders er
   vlak naast, in een compact blokje — en vult alleen die pixels op met de kleur
   van de dichtstbijzijnde buurman die blijft. Een kustlijn onder een naam blijft
   daardoor gewoon doorlopen. De wegnummer-schildjes blijven staan: die zijn geen
   letter maar een bordje, en ze verbleken netjes mee met de rest van de kaart.
2. **Zelf zetten.** `src/fetch/plaatsen.js` haalt de plaatsnamen als gegevens op
   bij OpenStreetMap. De browser tekent ze als vector in de letter van het boek,
   in de kleur en de maat die je onder "Labels" instelt.

Welke namen je krijgt regel je met twee knoppen. *Hoe klein mag een plaats zijn*
loopt van 1 (alleen Reykjavík) tot 19 (elk gehucht); *hoogstens zoveel plaatsen*
zet er een dak op. Wat niet past valt vanzelf af: een naam wijkt voor je route,
je stops, het titelblok en de wegnummers, probeert een plekje ernaast, en laat
het anders zitten. Een plaats waar je zelf al een stop met een naam hebt staan
wordt overgeslagen — die staat er dan al.

Een naam die je toch niet wilt haal je met Delete of een dubbelklik van de
kaart; dat blijft bewaard, net als het verslepen ervan. En wil je het oude gedrag terug, dan zet
*Mapbox: eigen plaatsnamen* op `optillen` (uitknippen en over de route leggen)
of `laten` (gewoon laten staan, mee-verbleekt met de kaart).

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
| greepje rechtsonder | schalen — op een marker of het inzetkaartje verzet dat de maat voor het hele boek |
| greepje op het dagverhaal | het vak smaller of breder maken; de tekst herwikkelt zich erin en de letter blijft even groot |
| dubbelklik op het greepje | terug naar de standaardmaat |
| dubbelklik op tekst | titel, dagverhaal of plaatsnaam ter plekke aanpassen |
| Delete op een icoontje | haalt de stip weg; de naam en de voortgangsbalk blijven |
| dubbelklik op een icoontje | hetzelfde, zonder eerst te hoeven aanwijzen wat je bedoelt |
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
| [Overpass](https://overpass-api.de) (OpenStreetMap) | de plaatsnamen op de kaart |
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
De twaalf antwoorden van de server worden één keer opgehaald en als bestand
weggeschreven — de JSON van het schema, de dagen en de reis, plus per dag de
achtergrondplaat en het lijstje plaatsnamen. `src/pages/statisch-schil.js` onderschept
de aanroepen en haalt in plaats daarvan die bestanden op, zodat de tekencode
zelf niet weet of er een server is en er maar één versie van bestaat.

Bij elkaar ongeveer 21 MB. Wat blijft werken is alles wat de browser tekent:
route, pijltjes, markers, plaatsnamen, typografie, titelblok, inzetkaartje,
schaalbalk, kompas, en de kleurensets. Wat vastligt is de kaartachtergrond — de
35 knoppen uit `ACHTERGROND_KNOPPEN` doen daar niets meer, want die plaat is
gebakken. Opslaan doet niets: wat je verzet blijft in dat tabblad staan en
verdwijnt bij het herladen.

Let op dat `docs/` je dagverhalen bevat. Zet je de repo publiek, dan staan die
op internet.

## Bij het werken hieraan

De testbestanden dekken het rekenwerk: tegels, uitsnedes, hoogtemodel,
kleurverlopen, profielvormen, het opsporen van kaarttekst en wegnummer-badges,
het rangschikken van plaatsnamen, en de invarianten van het instellingenschema. Het tekenwerk in de browser is niet
getest — daarvoor is de preview er.

Eén valkuil is het waard om te weten: `node src/build.js` hergebruikt een
previewserver die al draait. De browserbestanden worden per verzoek van schijf
gelezen, maar `styleSchema.js`, `src/render/*`, `server.js` en `style.js` zijn
modules die één keer bij het opstarten worden geladen. Verander je daar iets
zonder de server te herstarten, dan exporteert de build met het oude schema en
ontbreken er stilletjes dingen. Herstart hem dus na zo'n wijziging.
