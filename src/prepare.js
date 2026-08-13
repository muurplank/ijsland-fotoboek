/**
 * Haalt alle gegevens voor een dag op en drukt een controleverslag af.
 *
 * Bedoeld om na te lopen of de cijfers kloppen met wat je je van die dag
 * herinnert, voordat er ook maar iets gerenderd wordt.
 *
 *   node src/prepare.js 1
 */

import { buildDay } from './dayData.js'

const nummer = Number(process.argv[2] ?? 1)

const d = await buildDay(nummer, {
  onProgress: bericht => process.stderr.write(`  ... ${bericht}\n`)
})

const s = d.statistieken
const uur = Math.floor(s.rijtijdUren)
const min = Math.round((s.rijtijdUren - uur) * 60)

console.log(`
Dag ${d.dag.dag} — ${d.dag.titel}
${d.dag.datum}
${'-'.repeat(52)}

  Afstand over de weg    ${s.afstandKm.toFixed(1)} km
  Rijtijd (schatting)    ${uur} u ${min} min
  Hoogste punt           ${s.hoogstePuntM?.toFixed(0) ?? '?'} m
  Laagste punt           ${s.laagstePuntM?.toFixed(0) ?? '?'} m
  Totale stijging        ${s.stijgingM.toFixed(0)} m
`)

console.log('  Etappes:')
for (const leg of d.route.legs) {
  console.log(`    ${leg.from} → ${leg.to}`.padEnd(46) +
    `${leg.distanceKm.toFixed(1)} km  ${(leg.durationHours * 60).toFixed(0)} min`)
}

if (d.weer) {
  console.log(`
  Weer die dag           ${d.weer.tempMin?.toFixed(0)}–${d.weer.tempMax?.toFixed(0)} °C, ` +
    `${d.weer.omschrijving ?? 'onbekend'}, ${d.weer.neerslagMm ?? 0} mm regen, ` +
    `wind tot ${d.weer.windMaxKmh?.toFixed(0)} km/u`)
} else {
  console.log('\n  Weer die dag           niet opgehaald')
}

console.log(`
  Kaartuitsnede          ${d.view.metersPerMm().toFixed(0)} m per mm papier
  Hoogteraster           ${d.dem.width} × ${d.dem.height} punten op zoom ${d.dem.z}
  Routepunten            ${d.route.coordinates.length}
`)

if (d.genegeerd.length) {
  console.log(`  Let op: onbekende instellingen overgeslagen: ${d.genegeerd.join(', ')}\n`)
}
