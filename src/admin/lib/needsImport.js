/**
 * Turning a spreadsheet into lines of a needs list. Reading the file and
 * guessing columns is shared with the member and inventory imports; this file
 * only knows what a need looks like. Values may be written in English,
 * French or Arabic.
 */

import { normalizeHeader, oneOf, text } from './memberImport'
import { onShelf } from './needs'

export const MAX_NEED_ROWS = 1000
const MAX_QUANTITY = 100000

export const NEED_FIELDS = [
  { key: 'name', label: 'Item', aliases: ['item', 'name', 'item name', 'need', 'designation', 'article', 'nom', 'besoin', 'materiel', 'العنصر', 'الاسم', 'المادة', 'الاحتياج'] },
  { key: 'quantity', label: 'Quantity', aliases: ['quantity', 'qty', 'count', 'quantite', 'qte', 'nombre', 'الكمية', 'العدد'] },
  { key: 'unit', label: 'Unit', aliases: ['unit', 'units', 'unite', 'الوحدة'] },
  { key: 'department', label: 'Department', aliases: ['department', 'dept', 'team', 'departement', 'service', 'equipe', 'pole', 'القسم', 'الفريق', 'الخلية'] },
  { key: 'kind', label: 'Type', aliases: ['type', 'kind', 'category', 'categorie', 'النوع', 'الصنف'] },
  { key: 'source', label: 'Source', aliases: ['source', 'from', 'provenance', 'origine', 'المصدر'] },
  { key: 'status', label: 'Status', aliases: ['status', 'state', 'statut', 'etat', 'الحالة'] },
  { key: 'priority', label: 'Priority', aliases: ['priority', 'priorite', 'importance', 'الأولوية', 'الاولوية'] },
  { key: 'assignee', label: 'Who', aliases: ['who', 'assignee', 'assigned to', 'responsible', 'owner', 'qui', 'responsable', 'المسؤول', 'المكلف'] },
  { key: 'supplier', label: 'Supplier', aliases: ['supplier', 'shop', 'store', 'vendor', 'where', 'fournisseur', 'magasin', 'boutique', 'المورد', 'المتجر'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'remarks', 'comment', 'description', 'remarques', 'commentaire', 'ملاحظات', 'الوصف'] },
]

const FIELD_LABEL = Object.fromEntries(NEED_FIELDS.map(f => [f.key, f.label]))

export const NEED_TEMPLATE_HEADERS = ['Item', 'Quantity', 'Unit', 'Department', 'Type', 'Source', 'Status', 'Priority', 'Who', 'Supplier', 'Notes']

export const NEED_TEMPLATE_EXAMPLES = [
  ['Projector', 1, 'pcs', 'Tech', 'Equipment', 'Borrow', 'Needed', 'Must have', 'Yacine', '', 'Ask the faculty'],
  ['HDMI cable 5 m', 2, 'pcs', 'Tech', 'Equipment', 'Buy', 'Needed', 'Must have', '', 'Electronics shop', ''],
  ['A4 paper', 2, 'pack', 'Logistics', 'Consumable', 'Buy', 'Needed', 'Must have', '', 'Stationery', ''],
  ['Camera batteries', 4, 'pcs', 'Media', 'Consumable', 'Buy', 'Ordered', 'Must have', 'Sara', 'Electronics shop', ''],
  ['Roll-up banner', 1, 'pcs', 'Media', 'Other', 'Make', 'Needed', 'Nice to have', '', 'Print shop', ''],
]

const KIND_ALIASES = {
  equipment: ['equipment', 'equipement', 'materiel', 'tool', 'tools', 'outil', 'معدات', 'عتاد', 'أدوات', 'ادوات'],
  consumable: ['consumable', 'consumables', 'consommable', 'consommables', 'fourniture', 'fournitures', 'مستهلكات', 'مستهلك'],
  other: ['other', 'autre', 'autres', 'misc', 'أخرى', 'اخرى'],
}

const SOURCE_ALIASES = {
  stock: ['stock', 'from stock', 'in stock', 'inventory', 'en stock', 'inventaire', 'club', 'من المخزون', 'المخزون'],
  buy: ['buy', 'purchase', 'to buy', 'acheter', 'a acheter', 'achat', 'شراء', 'للشراء'],
  borrow: ['borrow', 'to borrow', 'rent', 'emprunter', 'a emprunter', 'emprunt', 'pret', 'استعارة', 'إعارة', 'اعارة'],
  make: ['make', 'build', 'print', 'fabriquer', 'a fabriquer', 'faire', 'تصنيع', 'صنع'],
}

const STATUS_ALIASES = {
  needed: ['needed', 'need', 'todo', 'to do', 'missing', 'a trouver', 'manquant', 'a faire', 'مطلوب', 'ناقص'],
  ordered: ['ordered', 'order', 'on the way', 'commande', 'commandé', 'en cours', 'تم الطلب', 'مطلوب من المورد'],
  ready: ['ready', 'done', 'got it', 'have', 'ok', 'yes', 'pret', 'prete', 'fait', 'disponible', 'جاهز', 'متوفر', 'تم'],
  cancelled: ['cancelled', 'canceled', 'dropped', 'no', 'annule', 'abandonne', 'ملغى', 'ملغي'],
}

const PRIORITY_ALIASES = {
  must: ['must', 'must have', 'high', 'required', 'essential', 'indispensable', 'obligatoire', 'haute', 'ضروري', 'مهم'],
  nice: ['nice', 'nice to have', 'optional', 'low', 'souhaitable', 'optionnel', 'basse', 'اختياري', 'ثانوي'],
}

function pick(value, aliases) {
  const s = normalizeHeader(value)
  if (!s) return null
  for (const [key, words] of Object.entries(aliases)) {
    if (normalizeHeader(key) === s || oneOf(s, words)) return key
  }
  return undefined
}

function toQuantity(value) {
  if (value === null || value === undefined || String(value).trim() === '') return 1
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.min(MAX_QUANTITY, Math.ceil(n))
}

/**
 * Clean every row against the mapping and say what will happen to it.
 *
 * @param departments  existing departments; a name not among them is
 *                     collected in `newDepartments` for the caller to create
 * @param inventory    club stock, so a known item is linked and, with no
 *                     source column, marked "from stock" when enough is there
 * @param fallbackDept department id for rows without one (or null)
 */
export function buildNeedRows(body, mapping, { departments, inventory, fallbackDept = null }) {
  const deptByName = new Map(departments.map(d => [normalizeHeader(d.name), d]))
  const stockByName = new Map(inventory.map(i => [normalizeHeader(i.name), i]))
  const cell = (row, key) => (mapping[key] === undefined ? undefined : row[mapping[key]])
  const newDepartments = new Map() // normalized → name as first written

  const rows = body.map((row, i) => {
    const errors = []
    const warnings = []

    const name = text(cell(row, 'name')).replace(/\s+/g, ' ')
    if (!name) errors.push('No item name')

    const quantity = toQuantity(cell(row, 'quantity'))
    if (quantity === undefined) errors.push(`Quantity “${text(cell(row, 'quantity'))}” is not a number`)

    const enumOf = (key, aliases, fallback) => {
      const raw = cell(row, key)
      const value = pick(raw, aliases)
      if (value === undefined) { warnings.push(`${FIELD_LABEL[key]} “${text(raw)}” not recognised`); return fallback }
      return value ?? fallback
    }

    const linked = name ? stockByName.get(normalizeHeader(name)) : null
    const kind = enumOf('kind', KIND_ALIASES, linked?.tracking_mode === 'consumable' ? 'consumable' : 'equipment')
    const sourceRaw = cell(row, 'source')
    const source = text(sourceRaw)
      ? enumOf('source', SOURCE_ALIASES, 'buy')
      : linked && onShelf(linked) >= (quantity || 1) ? 'stock' : 'buy'
    const status = enumOf('status', STATUS_ALIASES, 'needed')
    const priority = enumOf('priority', PRIORITY_ALIASES, 'must')

    const deptName = text(cell(row, 'department'))
    let department = null
    let newDept = null
    if (deptName) {
      const key = normalizeHeader(deptName)
      department = deptByName.get(key) || null
      if (!department) {
        newDept = newDepartments.get(key) || deptName
        newDepartments.set(key, newDept)
      }
    }

    return {
      line: i + 1,
      errors,
      warnings,
      linked,
      deptName: department?.name || newDept || null,
      newDept,
      payload: {
        name,
        quantity: quantity || 1,
        unit: text(cell(row, 'unit')) || null,
        department_id: department?.id ?? (newDept ? null : fallbackDept),
        kind,
        source,
        status,
        priority,
        assignee: text(cell(row, 'assignee')) || null,
        supplier: text(cell(row, 'supplier')) || null,
        notes: text(cell(row, 'notes')) || null,
        inventory_item_id: linked?.id ?? null,
      },
    }
  })

  return { rows, newDepartments: [...newDepartments.values()] }
}
