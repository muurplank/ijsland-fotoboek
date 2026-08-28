/**
 * De opmaak van een pagina: hoe groot is hij, en welk stuk IJsland staat erop.
 *
 * Zowel de server (die de reliefachtergrond rendert) als de browser (die de
 * route eroverheen tekent) gebruikt deze functies. Daardoor kunnen ze niet uit
 * elkaar lopen: als de kaart in de preview een millimeter verschuift, schuift
 * de achtergrond precies mee.
 */

import { MapView } from '../geo/viewport.js'

/** Buitenmaat van de pagina, inclusief de afloop aan alle vier de kanten. */
export function paginaMaat (stijl) {
  const afloop = stijl['pagina.afloopMm']
  return {
    breedteMm: stijl['pagina.breedteMm'] + 2 * afloop,
    hoogteMm: stijl['pagina.hoogteMm'] + 2 * afloop,
    afloopMm: afloop,
    snijBreedteMm: stijl['pagina.breedteMm'],
    snijHoogteMm: stijl['pagina.hoogteMm']
  }
}

/**
 * Buitenmaat van het voortgangsstrookje: paginabreed, maar veel lager.
 *
 * Staat hier en niet in de pagina die het tekent, want de export moet dezelfde
 * maat uitrekenen zonder browser - en twee plekken die dit apart uitrekenen
 * lopen binnen een maand uiteen.
 */
export function voortgangMaat (stijl) {
  const paginaBreed = paginaMaat(stijl)
  const afloop = stijl['pagina.afloopMm']
  return {
    breedteMm: paginaBreed.breedteMm,
    hoogteMm: stijl['voortgang.hoogteMm'] + 2 * afloop,
    afloopMm: afloop,
    snijBreedteMm: paginaBreed.snijBreedteMm,
    snijHoogteMm: stijl['voortgang.hoogteMm']
  }
}

/** De kaartuitsnede voor deze route bij deze instellingen. */
export function maakView (coords, stijl) {
  const maat = paginaMaat(stijl)
  return MapView.fit(coords, {
    widthMm: maat.breedteMm,
    heightMm: maat.hoogteMm,
    paddingMm: stijl['uitsnede.margeMm'] + maat.afloopMm,
    zoom: stijl['uitsnede.zoom'],
    panXMm: stijl['uitsnede.panXMm'],
    panYMm: stijl['uitsnede.panYMm']
  })
}

/**
 * De instellingen die de reliefachtergrond bepalen.
 *
 * Alleen als een van deze verandert hoeft de server een nieuwe achtergrond te
 * maken. Alle andere knoppen - kleuren van de route, pijltjes, labels,
 * typografie - passen direct in de browser aan, zonder wachten.
 */
export const ACHTERGROND_KNOPPEN = [
  'lagen.stijl',
  'pagina.breedteMm',
  'pagina.hoogteMm',
  'pagina.afloopMm',
  'uitsnede.zoom',
  'uitsnede.panXMm',
  'uitsnede.panYMm',
  'uitsnede.margeMm',
  'lagen.mapboxLabelMm',
  'lagen.badgesWeg',
  'lagen.badgesBoven',
  'lagen.mapboxTekst',
  'lagen.tekstKleur',
  'route.dikteMm',
  'route.buitenExtraMm',
  'lagen.zeeKleur',
  'lagen.verbleking',
  'lagen.verbleekNaar',
  'lagen.ontzadiging',
  'relief.zonRichting',
  'relief.zonHoogte',
  'relief.overdrijving',
  'relief.contrast',
  'relief.zachtheid',
  'relief.schaduwKleur',
  'relief.detailZoom',
  'terrein.kust',
  'terrein.laag',
  'terrein.laagM',
  'terrein.midden',
  'terrein.middenM',
  'terrein.hoog',
  'terrein.hoogM',
  'terrein.top',
  'terrein.topM'
]

/** Een korte, stabiele beschrijving van de achtergrond-instellingen. */
export function achtergrondSleutel (stijl) {
  return ACHTERGROND_KNOPPEN.map(k => `${k}=${stijl[k]}`).join('&')
}
