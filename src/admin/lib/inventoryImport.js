/**
 * Turning a parts spreadsheet into inventory rows. Reading the file and
 * guessing columns is shared with the member import; this file only knows
 * what an inventory row looks like.
 *
 * Every inventory row is one physical unit with its own asset code and QR
 * label, so a "Quantity" of 5 becomes five rows.
 */

import { findPart } from './partsCatalog'
import { normalizeHeader, oneOf, text, toDate } from './memberImport'

export const CATEGORIES = ['Electronics', 'Tools', 'Lab equipment', 'Furniture', 'Consumables', 'Other']
export const CONDITIONS = ['new', 'good', 'worn', 'damaged']

/** One sheet is capped so a stray "5000" in the quantity column can't flood the table. */
export const MAX_QUANTITY = 200
export const MAX_UNITS = 2000

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
  for (const item of existing) {
    const key = normalizeHeader(item.name)
    stock.set(key, (stock.get(key) || 0) + 1)
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
    if (serial && quantity > 1) warnings.push('Serial number kept on the first unit only')

    const payload = {
      name,
      category,
      condition: condition || 'good',
      location: text(cell(row, 'location')) || null,
      value: value ?? null,
      purchase_date: purchaseDate || null,
      notes: text(cell(row, 'notes')) || null,
      photo_url: part?.image || null,
      status: 'available',
    }

    return {
      line: i + 1,
      payload,
      serial: serial || null,
      quantity: quantity || 0,
      part,
      inStock: name ? stock.get(normalizeHeader(name)) || 0 : 0,
      errors,
      warnings,
    }
  })
}

/** One insert row per unit; the serial only belongs to the first. */
export function expandUnits(rows) {
  return rows.flatMap(r => Array.from({ length: r.quantity }, (_, n) => ({
    ...r.payload,
    serial: n === 0 ? r.serial : null,
  })))
}
