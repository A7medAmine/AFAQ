import { formatDateFor, isRtl, t, term } from './exportI18n'
import { FONT, THEME, createPdf, drawFooters, drawHeader, mirror, mirrorColumnStyles, sourceIndex, tableTheme } from './pdf'
import { progressOf } from './needs'

const QR_SIZE = 64

const BOX = 9

/**
 * The printable needs list: one table per department with a tick box on
 * every line, ready lines already ticked, and sign-off lines at the end.
 *
 * @param list          the need_lists row, with `event` / `department` joined
 * @param items         its need_items rows
 * @param departments   departments to print, in order; `null` id stands for
 *                      "No department"
 * @param layout        'checklist' (everything) or 'shopping' (only what has
 *                      to be bought and isn't ready yet)
 * @param includeReady  checklist only: keep lines already marked ready
 * @param pagePerDept   start each department on a new page
 * @param bySupplier    shopping list only: group by supplier instead of department
 * @param deptSignoff   a "received by" line under each group, for the team to sign
 * @param qrUrl         when set, a QR code to this address so the paper copy
 *                      can be scanned to open the list
 * @param lang          'en', 'fr' or 'ar'
 * @param win           a window opened by the click, so the browser does not
 *                      block it as a popup; null to download instead
 */
export async function printNeedsList({
  list, items, departments, layout = 'checklist', includeReady = true, pagePerDept = false,
  bySupplier = false, deptSignoff = false, qrUrl = null, lang = 'en', win,
}) {
  const { doc, autoTable } = await createPdf({ orientation: 'portrait' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const rtl = isRtl(lang)
  const align = rtl ? 'right' : 'left'
  const shopping = layout === 'shopping'

  const keep = item => {
    if (item.status === 'cancelled') return false
    if (shopping) return item.source === 'buy' && item.status !== 'ready'
    return includeReady || item.status !== 'ready'
  }

  const context = list.scope === 'event'
    ? list.event?.title_en
    : list.scope === 'department' ? list.department?.name : null
  const subtitle = [context, list.due_date ? t(lang, 'needDue', { date: formatDateFor(lang, list.due_date) }) : null]
    .filter(Boolean).join(' · ')

  let y = drawHeader(doc, {
    lang,
    title: `${t(lang, shopping ? 'shoppingList' : 'needsList')} · ${list.title}`,
    subtitle,
    margin,
  })

  if (list.notes) {
    doc.setFont(FONT, 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...THEME.text)
    const lines = doc.splitTextToSize(list.notes, pageWidth - margin * 2)
    doc.text(lines, rtl ? pageWidth - margin : margin, y - 6, { align })
    y += lines.length * 12 + 6
  }

  const theme = tableTheme(lang)
  const head = shopping
    ? ['', t(lang, 'needItem'), t(lang, 'needQty'), t(lang, 'needWho'), t(lang, 'needNotes')]
    : ['', t(lang, 'needItem'), t(lang, 'needQty'), t(lang, 'needKind'), t(lang, 'needSource'), t(lang, 'needStatus'), t(lang, 'needWho')]
  const count = head.length
  const columnStyles = shopping
    ? { 0: { cellWidth: 24 }, 2: { cellWidth: 64 }, 3: { cellWidth: 90 }, 4: { cellWidth: 150 } }
    : { 0: { cellWidth: 24 }, 2: { cellWidth: 56 }, 3: { cellWidth: 70 }, 4: { cellWidth: 66 }, 5: { cellWidth: 58 }, 6: { cellWidth: 80 } }

  const qtyText = item => `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
  const itemText = item => {
    const extra = [!shopping && item.notes, item.priority === 'nice' && term(lang, 'nice to have')].filter(Boolean)
    return extra.length ? `${item.name}\n${extra.join(' · ')}` : item.name
  }

  const heading = (text, aside) => {
    if (y > pageHeight - 120) { doc.addPage(); y = margin + 10 }
    doc.setTextColor(...THEME.ink)
    doc.setFont(FONT, 'bold')
    doc.setFontSize(12)
    doc.text(text, rtl ? pageWidth - margin : margin, y, { align })
    if (aside) {
      doc.setFont(FONT, 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...THEME.muted)
      doc.text(aside, rtl ? margin : pageWidth - margin, y, { align: rtl ? 'left' : 'right' })
    }
    y += 8
  }

  // Departments are always a filter; the groups are departments, or suppliers
  // for a shopping list sorted by where to buy.
  const deptIds = new Set(departments.map(d => d.id ?? null))
  const inDepts = items.filter(i => deptIds.has(i.department_id ?? null))
  const groups = shopping && bySupplier
    ? [...new Set(inDepts.filter(keep).map(i => (i.supplier || '').trim()))]
      .sort((a, b) => (!a) - (!b) || a.localeCompare(b))
      .map(name => ({ name: name || t(lang, 'noSupplier'), all: inDepts.filter(i => (i.supplier || '').trim() === name) }))
    : departments.map(dept => ({ name: dept.id ? dept.name : t(lang, 'noDepartment'), all: items.filter(i => (i.department_id ?? null) === (dept.id ?? null)) }))

  let printed = 0
  groups.forEach(group => {
    const { all } = group
    const rows = all.filter(keep).sort((a, b) => kindOrder(a) - kindOrder(b) || a.name.localeCompare(b.name))
    if (!rows.length) return
    if (pagePerDept && printed > 0) { doc.addPage(); y = margin + 10 }
    printed++

    const progress = progressOf(all)
    heading(group.name, shopping ? null : t(lang, 'needCount', progress))

    const body = rows.map(item => shopping
      ? ['', itemText(item), qtyText(item), item.assignee || '', item.notes || '']
      : ['', itemText(item), qtyText(item), t(lang, `kind_${item.kind}`), t(lang, `source_${item.source}`), t(lang, `status_${item.status}`), item.assignee || ''])

    autoTable(doc, {
      ...theme,
      startY: y,
      margin: { left: margin, right: margin, top: margin, bottom: 48 },
      head: [mirror(lang, head)],
      body: body.map(r => mirror(lang, r)),
      columnStyles: mirrorColumnStyles(lang, columnStyles, count),
      didParseCell: cell => {
        if (cell.section !== 'body') return
        const index = sourceIndex(lang, cell.column.index, count)
        const item = rows[cell.row.index]
        if (index === 1) {
          cell.cell.styles.textColor = item.priority === 'nice' ? THEME.muted : THEME.ink
          cell.cell.styles.fontStyle = item.priority === 'must' ? 'bold' : 'normal'
        }
        if (item.status === 'ready' && !shopping) cell.cell.styles.textColor = THEME.muted
      },
      didDrawCell: cell => {
        if (cell.section !== 'body' || sourceIndex(lang, cell.column.index, count) !== 0) return
        const x = cell.cell.x + (cell.cell.width - BOX) / 2
        const top = cell.cell.y + 6
        doc.setDrawColor(...THEME.ink)
        doc.setLineWidth(0.8)
        doc.rect(x, top, BOX, BOX)
        if (rows[cell.row.index].status === 'ready') {
          doc.setLineWidth(1.2)
          doc.line(x + 2, top + BOX / 2, x + BOX / 2 - 0.5, top + BOX - 2)
          doc.line(x + BOX / 2 - 0.5, top + BOX - 2, x + BOX - 1.5, top + 2)
        }
      },
    })
    y = doc.lastAutoTable.finalY + 26

    if (deptSignoff) {
      if (y > pageHeight - 80) { doc.addPage(); y = margin + 10 }
      const lineWidth = Math.min(260, pageWidth - margin * 2)
      const x = rtl ? pageWidth - margin - lineWidth : margin
      doc.setDrawColor(...THEME.ink)
      doc.setLineWidth(0.5)
      doc.line(x, y + 8, x + lineWidth, y + 8)
      doc.setFont(FONT, 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...THEME.muted)
      doc.text(t(lang, 'groupSignoff', { group: group.name }), rtl ? pageWidth - margin : margin, y + 20, { align })
      y += 42
    }
  })

  if (!printed) {
    doc.setFont(FONT, 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...THEME.muted)
    doc.text(t(lang, 'nothingToList'), rtl ? pageWidth - margin : margin, y, { align })
    y += 30
  }

  // Sign-off: who prepared the list, and who checked everything arrived.
  if (y > pageHeight - (qrUrl ? 190 : 110)) { doc.addPage(); y = margin + 20 }

  if (qrUrl) {
    const { default: QRCode } = await import('qrcode')
    const png = await QRCode.toDataURL(qrUrl, { margin: 1, width: 256, errorCorrectionLevel: 'M' })
    const x = rtl ? margin : pageWidth - margin - QR_SIZE
    doc.addImage(png, 'PNG', x, y, QR_SIZE, QR_SIZE)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...THEME.muted)
    const caption = doc.splitTextToSize(t(lang, 'scanToOpen'), pageWidth - margin * 2 - QR_SIZE - 16)
    doc.text(caption, rtl ? pageWidth - margin : pageWidth - margin - QR_SIZE - 12, y + QR_SIZE / 2, { align: rtl ? 'right' : 'right' })
    y += QR_SIZE + 6
  }
  y += 18
  doc.setDrawColor(...THEME.ink)
  doc.setLineWidth(0.6)
  doc.setTextColor(...THEME.muted)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(8.5)
  const colWidth = (pageWidth - margin * 2 - 48) / 2
  ;['preparedBy', 'receivedBy'].forEach((key, i) => {
    const x = rtl ? pageWidth - margin - colWidth - i * (colWidth + 48) : margin + i * (colWidth + 48)
    doc.line(x, y + 30, x + colWidth, y + 30)
    doc.text(t(lang, key), rtl ? x + colWidth : x, y + 44, { align })
  })

  drawFooters(doc, { lang, margin })

  const slug = list.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'needs'
  const filename = `${shopping ? 'shopping' : 'needs'}-${slug}-${lang}.pdf`
  if (win && !win.closed) {
    doc.autoPrint()
    win.location.href = doc.output('bloburl')
  } else {
    doc.save(filename)
  }
}

const KIND_ORDER = { equipment: 0, consumable: 1, other: 2 }
const kindOrder = item => KIND_ORDER[item.kind] ?? 3
