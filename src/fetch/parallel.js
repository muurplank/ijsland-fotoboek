/**
 * Een handvol taken tegelijk uitvoeren, maar niet honderden.
 *
 * Een dagkaart kan een paar honderd tegels nodig hebben. Die allemaal in een keer
 * opvragen is onbeleefd tegen gratis servers en levert alleen maar afgeknepen
 * verbindingen op.
 */
export async function mapLimit (items, limiet, taak) {
  const resultaten = new Array(items.length)
  let volgende = 0

  const werkers = Array.from({ length: Math.min(limiet, items.length) }, async () => {
    while (volgende < items.length) {
      const i = volgende++
      resultaten[i] = await taak(items[i], i)
    }
  })

  await Promise.all(werkers)
  return resultaten
}
