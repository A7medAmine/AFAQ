/**
 * The Excel template for the inventory import: a header row, a few example
 * rows, dropdowns on Category and Condition so typos never reach the import,
 * and a second sheet explaining each column.
 *
 * exceljs is large, so it is only loaded when someone clicks the button.
 */

import { CATEGORIES, CONDITIONS, MAX_QUANTITY, TEMPLATE_EXAMPLES, TEMPLATE_HEADERS } from './inventoryImport'

const ROWS_WITH_DROPDOWNS = 1000

const HELP = [
  ['Name', 'Required. What the item is called. Exact catalog names (e.g. “Arduino Uno R3”) get a photo automatically.'],
  ['Quantity', `How many identical units. Each unit gets its own asset code and QR label. Empty = 1. Max ${MAX_QUANTITY} per row.`],
  ['Category', `One of: ${CATEGORIES.join(', ')}. Empty = taken from the catalog, or Electronics.`],
  ['Condition', `One of: ${CONDITIONS.join(', ')}. Empty = good.`],
  ['Location', 'Where it is kept, e.g. “Lab shelf 2”.'],
  ['Serial number', 'Optional. With a quantity above 1 it is kept on the first unit only.'],
  ['Value (DA)', 'Price of one unit in dinars. Numbers only.'],
  ['Purchase date', 'Optional. dd/mm/yyyy.'],
  ['Notes', 'Anything else.'],
]

export async function downloadInventoryTemplate() {
  const { default: ExcelJS } = await import('exceljs')
  const book = new ExcelJS.Workbook()
  book.creator = 'AFAQ'

  const sheet = book.addWorksheet('Items', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = TEMPLATE_HEADERS.map((header, i) => ({
    header,
    width: [38, 10, 16, 12, 18, 18, 12, 14, 32][i],
  }))
  const head = sheet.getRow(1)
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
  head.alignment = { vertical: 'middle' }
  head.height = 22

  for (const example of TEMPLATE_EXAMPLES) sheet.addRow(example)

  // Lists live on a sheet of their own so the dropdowns stay short formulas.
  const lists = book.addWorksheet('Lists', { state: 'veryHidden' })
  CATEGORIES.forEach((c, i) => { lists.getCell(i + 1, 1).value = c })
  CONDITIONS.forEach((c, i) => { lists.getCell(i + 1, 2).value = c })

  // One validation per column range; per-cell validations get merged into
  // overlapping ranges that Excel reports as a damaged file.
  const last = ROWS_WITH_DROPDOWNS
  sheet.dataValidations.add(`B2:B${last}`, {
    type: 'whole', operator: 'between', formulae: [1, MAX_QUANTITY], allowBlank: true,
    showErrorMessage: true, errorTitle: 'Quantity', error: `A whole number from 1 to ${MAX_QUANTITY}.`,
  })
  sheet.dataValidations.add(`C2:C${last}`, {
    type: 'list', allowBlank: true, formulae: [`Lists!$A$1:$A$${CATEGORIES.length}`],
    showErrorMessage: true, errorTitle: 'Category', error: 'Pick a category from the list.',
  })
  sheet.dataValidations.add(`D2:D${last}`, {
    type: 'list', allowBlank: true, formulae: [`Lists!$B$1:$B$${CONDITIONS.length}`],
    showErrorMessage: true, errorTitle: 'Condition', error: 'Pick a condition from the list.',
  })
  sheet.dataValidations.add(`G2:G${last}`, {
    type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true,
    showErrorMessage: true, errorTitle: 'Value', error: 'A price in DA, numbers only.',
  })
  sheet.getColumn(8).numFmt = 'dd/mm/yyyy'

  const help = book.addWorksheet('How to fill')
  help.columns = [{ header: 'Column', width: 18 }, { header: 'What to put', width: 100 }]
  help.getRow(1).font = { bold: true }
  for (const line of HELP) help.addRow(line)
  help.addRow([])
  help.addRow(['', 'Replace the example rows with your own, keep the header line, then import the file from Inventory → Import.'])

  const buffer = await book.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'inventory-import-template.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
