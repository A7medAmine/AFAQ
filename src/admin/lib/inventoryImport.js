/**
 * Turning a parts spreadsheet into inventory rows. Reading the file and
 * guessing columns is shared with the member import; this file only knows
 * what an inventory row looks like.
 *
 * One inventory row per kind of item, with its quantity. A sheet row that
 * matches an item already in stock (same name, location and condition) adds
 * to that item's count instead of making a second entry.
 */

import { findPart } from './partsCatalog'
import { normalizeHeader, oneOf, text, toDate } from './memberImport'

export const CATEGORIES = ['Electronics', 'Tools', 'Lab equipment', 'Furniture', 'Consumables', 'Other']
export const CONDITIONS = ['new', 'good', 'worn', 'damaged']

/** What happens when someone takes one: it comes back, or it's used up. */
export const TRACKING_MODES = [
  { value: 'returnable', label: 'Lent — comes back' },
  { value: 'consumable', label: 'Used up — handed out' },
]
export const defaultTracking = category => (category === 'Consumables' ? 'consumable' : 'returnable')

/** On the shelf right now, and whether that's at or under the item's minimum. */
export const onShelf = item => (item.quantity ?? 1) - (item.on_loan || 0)
export const isLowStock = item => item.min_stock != null && item.status !== 'retired' && onShelf(item) <= item.min_stock

/** Caps that catch a wrong column mapped as quantity, and oversized sheets. */
export const MAX_QUANTITY = 100000
export const MAX_ROWS = 2000

export const ITEM_FIELDS = [
  { key: 'name', label: 'Name', aliases: ['name', 'item', 'item name', 'part', 'part name', 'component', 'designation', 'nom', 'article', 'composant', 'libelle', 'الاسم', 'العنصر', 'القطعة'] },
  { key: 'quantity', label: 'Quantity', aliases: ['quantity', 'qty', 'count', 'units', 'quantite', 'qte', 'nombre', 'الكمية', 'العدد'] },
  { key: 'category', label: 'Category', aliases: ['category', 'type', 'categorie', 'famille', 'الفئة', 'الصنف'] },
  { key: 'condition', label: 'Condition', aliases: ['condition', 'state', 'etat', 'الحالة'] },
  { key: 'location', label: 'Location', aliases: ['location', 'place', 'shelf', 'storage', 'emplacement', 'lieu', 'rangement', 'المكان', 'الموقع'] },
  { key: 'serial', label: 'Serial number', aliases: ['serial', 'serial number', 'sn', 's n', 'numero de serie', 'n de serie', 'الرقم التسلسلي'] },
  { key: 'value', label: 'Value (DA)', aliases: ['value', 'price', 'unit price', 'cost', 'value da', 'prix', 'prix unitaire', 'valeur', 'cout', 'السعر', 'القيمة'] },
  { key: 'purchase_date', label: 'Purchase date', aliases: ['purchase date', 'bought', 'bought on', 'date', 'date d achat', 'تاريخ الشراء'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'description', 'remarks', 'remarques', 'commentaire', 'ملاحظات', 'الوصف'] },
]

export const TEMPLATE_HEADERS = ['Name', 'Quantity', 'Category', 'Condition', 'Location', 'Serial number', 'Value (DA)', 'Purchase date', 'Notes']

export const TEMPLATE_EXAMPLES = [
  ['Arduino Uno R3', 10, 'Electronics', 'new', 'Lab shelf 1', '', 2500, '15/09/2025', ''],
  ['ESP32 DevKit V1 (ESP-WROOM-32)', 6, 'Electronics', 'new', 'Lab shelf 1', '', 1800, '15/09/2025', ''],
  ['HC-SR04 ultrasonic distance sensor', 15, 'Electronics', 'good', 'Drawer A3', '', 350, '', ''],
  ['Full-size breadboard (830 points)', 20, 'Consumables', 'good', 'Drawer B1', '', 400, '', ''],
  ['Digital multimeter', 3, 'Tools', 'good', 'Tool cabinet', 'DT830-0012', 1500, '', 'One has a cracked screen'],
  ['3D printer', 1, 'Lab equipment', 'good', 'Fab corner', 'ENDER3-55821', 65000, '02/02/2025', 'Ender 3 V2'],
]

const CATEGORY_ALIASES = {
  Electronics: ['electronics', 'electronic', 'electronique', 'composant', 'composants', 'إلكترونيات', 'الكترونيات'],
  Tools: ['tools', 'tool', 'outil', 'outils', 'أدوات', 'ادوات'],
  'Lab equipment': ['lab equipment', 'equipment', 'equipement', 'equipement de labo', 'materiel de labo', 'معدات', 'معدات المخبر'],
  Furniture: ['furniture', 'mobilier', 'meuble', 'meubles', 'أثاث', 'اثاث'],
  Consumables: ['consumables', 'consumable', 'consommable', 'consommables', 'مستهلكات'],
  Other: ['other', 'autre', 'autres', 'misc', 'أخرى', 'اخرى'],
}

const CONDITION_ALIASES = {
  new: ['new', 'neuf', 'neuve', 'nouveau', 'جديد'],
  good: ['good', 'ok', 'bon', 'bon etat', 'fonctionnel', 'جيد'],
  worn: ['worn', 'used', 'use', 'usage', 'usagé', 'moyen', 'مستعمل'],
  damaged: ['damaged', 'broken', 'endommage', 'casse', 'en panne', 'hs', 'تالف', 'معطل'],
}

function pick(value, aliases) {
  const s = normalizeHeader(value)
  if (!s) return null
  for (const [key, words] of Object.entries(aliases)) {
    if (normalizeHeader(key) === s || oneOf(s, words)) return key
  }
  return undefined
}

/** "2 500 DA", "2500,00", 2500 → 2500. */
function toAmount(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : undefined
  const s = String(value).replace(/da|dzd|دج/gi, '').replace(/[\s ]/g, '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '')
  const n = Number(s)
  return s && Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined
}

function toQuantity(value) {
  if (value === null || value === undefined || String(value).trim() === '') return 1
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isInteger(n) && n >= 1 ? n : undefined
}

/**
 * Clean every row against the mapping and say what will happen to it.
 *
 * @param existing  current inventory, so the preview can say "you already have 4"
 * @param catalog   indexed parts catalog; a name it knows exactly brings a
 *                  photo and, if the sheet has none, a category
 */
export function buildItemRows(body, mapping, existing, catalog = []) {
  const stock = new Map()
  const targets = new Map()
  for (const item of existing) {
    if (item.status === 'retired') continue
    const key = normalizeHeader(item.name)
    stock.set(key, (stock.get(key) || 0) + (item.quantity ?? 1))
    if (!item.serial) targets.set(itemKey(item), item)
  }
  const cell = (row, key) => (mapping[key] === undefined ? undefined : row[mapping[key]])

  return body.map((row, i) => {
    const errors = []
    const warnings = []

    const name = text(cell(row, 'name')).replace(/\s+/g, ' ')
    if (!name) errors.push('No name')

    const quantity = toQuantity(cell(row, 'quantity'))
    if (quantity === undefined) errors.push('Quantity is not a whole number')
    else if (quantity > MAX_QUANTITY) errors.push(`Quantity over ${MAX_QUANTITY}`)

    const part = name ? findPart(catalog, name) : null

    let category = pick(cell(row, 'category'), CATEGORY_ALIASES)
    if (category === undefined) {
      warnings.push(`Category “${text(cell(row, 'category'))}” not known, set to Other`)
      category = 'Other'
    }
    if (!category) category = part?.category && CATEGORIES.includes(part.category) ? part.category : 'Electronics'

    let condition = pick(cell(row, 'condition'), CONDITION_ALIASES)
    if (condition === undefined) { warnings.push('Condition not understood, set to good'); condition = 'good' }

    const value = toAmount(cell(row, 'value'))
    if (value === undefined) warnings.push('Value not understood, left empty')

    const purchaseDate = toDate(cell(row, 'purchase_date'))
    if (purchaseDate === undefined) warnings.push('Purchase date not understood, left empty')

    const serial = text(cell(row, 'serial'))

    const payload = {
      name,
      category,
      condition: condition || 'good',
      location: text(cell(row, 'location')) || null,
      value: value ?? null,
      purchase_date: purchaseDate || null,
      notes: text(cell(row, 'notes')) || null,
      photo_url: part?.image || null,
      tracking_mode: defaultTracking(category),
      status: 'available',
    }

    return {
      line: i + 1,
      payload,
      serial: serial || null,
      quantity: quantity || 0,
      part,
      inStock: name ? stock.get(normalizeHeader(name)) || 0 : 0,
      // Already have this exact item: the row tops up its count.
      target: name && !serial ? targets.get(itemKey(payload)) || null : null,
      errors,
      warnings,
    }
  })
}

/** Same item = same name, location and condition, ignoring case and spacing. */
function itemKey(item) {
  return [normalizeHeader(item.name), normalizeHeader(item.location || ''), item.condition || 'good'].join('|')
}

/**
 * What the import will do: top up items already in stock, and insert one row
 * per new item, with sheet rows for the same item added together.
 */
export function planImport(rows) {
  const restock = new Map()
  const inserts = new Map()
  rows.forEach((r, i) => {
    if (r.target) {
      restock.set(r.target.id, (restock.get(r.target.id) || 0) + r.quantity)
      return
    }
    const key = r.serial ? `serial:${i}` : itemKey(r.payload)
    const prev = inserts.get(key)
    if (prev) prev.quantity += r.quantity
    else inserts.set(key, { ...r.payload, serial: r.serial, quantity: r.quantity })
  })
  return {
    restock: [...restock].map(([id, quantity]) => ({ id, quantity })),
    inserts: [...inserts.values()],
  }
}
