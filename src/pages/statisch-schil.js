/**
 * De schil om de bedieningspagina op een statische host te laten werken.
 *
 * Op GitHub Pages is er geen server. Geen sharp om het schaduwreliëf, het
 * silhouet en de kleurbewerking te maken, geen Mapbox-token om tegels op te
 * halen, en niets om de dagbestanden naar terug te schrijven.
 *
 * Wat er wel is, zijn de antwoorden van die server, één keer vooraf gebakken
 * door `node src/statisch.js`. Deze schil onderschept de aanroepen en haalt in
 * plaats daarvan die bestanden op. Zo hoeft preview.js zelf niets van statisch
 * of dynamisch te weten en is er maar één versie van de tekencode.
 *
 * Wat blijft werken is alles wat de browser zelf tekent: de route, de pijltjes,
 * de markers, de plaatsnamen, het titelblok, het inzetkaartje, de schaalbalk en
 * het kompas. Wat vastligt is de kaartachtergrond, want die komt uit de gebakken
 * plaat - de knoppen in ACHTERGROND_KNOPPEN veranderen daar dus niets meer aan.
 *
 * Dit is een gewoon script en geen module, zodat het klaar is voordat de
 * uitgestelde module met de tekencode begint.
 */

;(function () {
  const echteFetch = window.fetch.bind(window)

  // Ten opzichte van de pagina zelf, want op Pages staat de site in een map met
  // de naam van de repo en niet in de wortel van het domein.
  const basis = new URL('.', document.baseURI)
  const naar = pad => new URL(pad, basis).href

  /** Voor welke dag de plaatsnamenlaag hoort die als laatste klaargezet is. */
  let laatsteDag = '1'

  /** Een gebakken plaatje, met de kop die de server erbij zou hebben gezet. */
  async function plaat (bestand, kopBestand, kopNaam) {
    const beeld = await echteFetch(naar(bestand))
    // Niet gebakken betekent: die laag is er voor deze dag niet. De server zegt
    // dat met 204, en daar kan de pagina al mee omgaan.
    if (!beeld.ok) return new Response(null, { status: 204 })

    const koppen = { 'content-type': 'image/png' }
    if (kopBestand) {
      const kop = await echteFetch(naar(kopBestand))
      if (kop.ok) koppen[kopNaam] = JSON.stringify(await kop.json())
    }
    return new Response(await beeld.blob(), { status: 200, headers: koppen })
  }

  window.fetch = function (bron, opties) {
    const adres = typeof bron === 'string' ? bron : (bron?.url ?? String(bron))
    if (!adres.includes('/api/')) return echteFetch(bron, opties)

    const u = new URL(adres, location.href)
    const naam = u.pathname.replace(/^.*\/api\//, '')
    const dag = u.searchParams.get('dag') ?? '1'

    // Opslaan bestaat hier niet: er is geen server die naar de dagbestanden
    // schrijft. Netjes ja zeggen is beter dan een foutmelding in de statusbalk,
    // want wat je verzet blijft in dit tabblad gewoon staan.
    if ((opties?.method ?? 'GET').toUpperCase() !== 'GET') {
      return Promise.resolve(new Response('{"ok":true,"statisch":true}', {
        status: 200, headers: { 'content-type': 'application/json' }
      }))
    }

    if (naam === 'achtergrond') {
      const overzicht = u.searchParams.get('overzicht') === '1'
      const sleutel = overzicht ? 'overzicht' : dag
      if (!overzicht) laatsteDag = dag
      return plaat(`api/achtergrond-${sleutel}.png`, `api/achtergrond-${sleutel}.json`, 'x-plaatsing')
    }
    if (naam === 'bovenlaag') return plaat(`api/bovenlaag-${laatsteDag}.png`)
    if (naam === 'plaatsen') {
      const sleutel = u.searchParams.get('overzicht') === '1' ? 'overzicht' : dag
      return echteFetch(naar(`api/plaatsen-${sleutel}.json`))
    }
    if (naam === 'inzet') return plaat('api/inzet.png', 'api/inzet.json', 'x-bounds')
    if (naam === 'dag') return echteFetch(naar(`api/dag-${dag}.json`))

    return echteFetch(naar(`api/${naam}.json`))
  }

  // De plaatsnamenlaag wordt niet gefetcht maar als afbeelding gezet, dus die
  // gaat langs het bovenstaande heen. Vandaar dat we bij dat ene element het
  // zetten van src onderscheppen.
  const bovenlaag = document.getElementById('bovenlaag')
  if (bovenlaag) {
    const origineel = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
    Object.defineProperty(bovenlaag, 'src', {
      get () { return origineel.get.call(this) },
      set (waarde) {
        const pad = String(waarde).includes('/api/bovenlaag')
          ? naar(`api/bovenlaag-${laatsteDag}.png`)
          : waarde
        origineel.set.call(this, pad)
      }
    })
  }

  // Geen server om naar te bewaren, dus die knoppen verbergen.
  //
  // Verbergen en niet weghalen: de tekencode hangt er later een handler op, en
  // als het element dan weg is loopt die vast nog voordat de eerste kaart staat.
  // Dat kostte me een lege pagina bij het openen, terwijl van dag wisselen wel
  // werkte - precies het soort fout dat je alleen ziet als je het echt opent.
  addEventListener('DOMContentLoaded', () => {
    for (const id of ['bewaar-boek', 'bewaar-dag']) {
      const knop = document.getElementById(id)
      if (knop) { knop.hidden = true; knop.disabled = true }
    }

    const balk = document.getElementById('melding')
    if (!balk) return

    // Pas iets zeggen als de pagina klaar is, zodat we geen echte melding
    // overschrijven terwijl er nog geladen wordt.
    const kijk = setInterval(() => {
      if (balk.textContent === 'klaar') {
        balk.textContent = 'alleen-lezen — de kaartachtergrond ligt vast, de rest kun je bijstellen'
        clearInterval(kijk)
      }
    }, 400)
    setTimeout(() => clearInterval(kijk), 30000)
  })
})()
