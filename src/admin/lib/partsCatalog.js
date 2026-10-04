/**
 * The offline parts catalog (src/admin/data/partsCatalog.json, built by
 * scripts/buildPartsCatalog.js) and the matching used to search it. Shared by
 * the inventory name suggestions and the spreadsheet import.
 *
 * The catalog is ~380 KB, so it is loaded on demand, once, never with the
 * admin bundle.
 */

let catalogPromise = null
export const loadCatalog = () => {
  catalogPromise ??= import('../data/partsCatalog.json').then(m => m.default.parts.map(index))
  return catalogPromise
}

export const fold = text => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
// "HC-SR04", "hcsr04" and "hc sr04" should all find the same part.
export const squash = text => fold(text).replace(/[^a-z0-9]/g, '')

export function index(part) {
  const name = fold(part.name)
  return {
    ...part,
    _name: name,
    _words: name.split(/[^a-z0-9.]+/).filter(Boolean),
    _squash: squash(part.name),
    _rest: fold(`${part.keywords} ${part.family}`),
    _restSquash: squash(part.keywords),
  }
}

/** Lower is better; null means no match. Every query word must hit somewhere. */
export function score(part, words, whole) {
  let total = 0
  for (const w of words) {
    if (part._words.some(x => x === w)) total += 0
    else if (part._words.some(x => x.startsWith(w))) total += 1
    else if (part._name.includes(w)) total += 3
    else if (part._rest.includes(w)) total += 5
    else return null
  }
  if (part._name.startsWith(words[0])) total -= 2
  if (whole.length > 2 && (part._squash.includes(whole) || part._restSquash.includes(whole))) total -= 2
  if (part.source === 'curated') total -= 3
  return total + part._name.length / 200
}

/** Exact catalog entry for a name, ignoring case, spaces and punctuation. */
export function findPart(catalog, name) {
  const key = squash(name)
  return key ? catalog.find(p => p._squash === key) || null : null
}
