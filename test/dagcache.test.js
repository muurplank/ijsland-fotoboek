import test from 'node:test'
import assert from 'node:assert/strict'
import { stat, utimes } from 'node:fs/promises'

import { maakDagCache, bronStempel, dagBestand } from '../src/dagCache.js'

/** Een namaakbouwer die alleen bijhoudt hoe vaak hij geroepen is. */
function teller () {
  let keer = 0
  return {
    bouw: async nummer => ({ nummer, keer: ++keer }),
    get keer () { return keer }
  }
}

/** Raakt een bestand aan zoals een editor of git dat doet: buiten de server om. */
async function raakAan (pad) {
  const nu = await stat(pad)
  const later = new Date(nu.mtimeMs + 2000)
  await utimes(pad, later, later)
}

test('bouwt een dag maar een keer op zolang de bronbestanden gelijk blijven', async () => {
  const t = teller()
  const cache = maakDagCache(t.bouw)

  await cache.dag(1)
  await cache.dag(1)
  await cache.dag(1)

  assert.equal(t.keer, 1)
})

test('bouwt opnieuw op als het dagbestand van buitenaf verandert', async () => {
  const t = teller()
  const cache = maakDagCache(t.bouw)
  const pad = dagBestand(1)
  const oud = await stat(pad)

  try {
    await cache.dag(1)
    await raakAan(pad)
    await cache.dag(1)

    assert.equal(t.keer, 2, 'de wijziging op schijf werd niet opgemerkt')
  } finally {
    await utimes(pad, oud.atime, oud.mtime)
  }
})

test('bouwt alle dagen opnieuw op als de boekinstellingen veranderen', async () => {
  const t = teller()
  const cache = maakDagCache(t.bouw)
  const boek = new URL('../data/book.json', import.meta.url)
  const oud = await stat(boek)

  try {
    await cache.dag(1)
    await cache.dag(2)
    await raakAan(boek)
    await cache.dag(1)
    await cache.dag(2)

    assert.equal(t.keer, 4)
  } finally {
    await utimes(boek, oud.atime, oud.mtime)
  }
})

test('houdt dagen en tijdelijke afwijkingen uit elkaar', async () => {
  const t = teller()
  const cache = maakDagCache(t.bouw)

  await cache.dag(1)
  await cache.dag(2)
  await cache.dag(1, { stijlOverschrijving: { 'route.kleur': '#000000' } })
  await cache.dag(1, { stijlOverschrijving: { 'route.kleur': '#000000' } })

  assert.equal(t.keer, 3)
})

test('houdt geen achterhaalde versie van dezelfde dag vast', async () => {
  // anders groeit de cache bij elke wijziging, met een heel hoogtemodel per
  // achterhaalde versie erin
  const t = teller()
  const cache = maakDagCache(t.bouw)
  const pad = dagBestand(1)
  const oud = await stat(pad)

  try {
    await cache.dag(1)
    await raakAan(pad)
    await cache.dag(1)

    assert.equal(cache.aantal, 1, 'de oude versie bleef naast de nieuwe staan')
  } finally {
    await utimes(pad, oud.atime, oud.mtime)
  }
})

test('leeg() vergeet alles', async () => {
  const t = teller()
  const cache = maakDagCache(t.bouw)

  await cache.dag(1)
  cache.leeg()
  await cache.dag(1)

  assert.equal(t.keer, 2)
})

test('een stempel verandert niet vanzelf', async () => {
  assert.equal(await bronStempel(1), await bronStempel(1))
})

test('een ontbrekende dag krijgt gewoon een stempel, geen fout', async () => {
  assert.match(await bronStempel(99), /weg/)
})
