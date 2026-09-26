import { budgetActuals, categoryLabel, signedAmount, totals } from './finance'
import { formatDateFor, isRtl, moneyFor, t, term } from './exportI18n'
import { FONT, THEME, createPdf, drawFooters, drawHeader, mirror, mirrorColumnStyles, sourceIndex, tableTheme } from './pdf'

function byCategory(transactions, kind) {
  const map = new Map()
  transactions.filter(t => t.kind === kind).forEach(t =>
    map.set(t.category, (map.get(t.category) || 0) + (Number(t.amount) || 0)))
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

/**
 * The printable financial report: summary with opening and closing balance,
 * income and spending by category, budgets against actuals, the full list of
 * transactions and signature lines for the treasurer and president.
 *
 * @param all          every transaction (for the opening balance)
 * @param transactions the ones in the report's period and scope
 * @param budgets      budgets to show against their actuals
 * @param range        [from, to) ISO dates, or null for all time
 * @param periodLabel  e.g. "This season"
 * @param scopeLabel   event or project name when the report is narrowed to one
 * @param lang         'en', 'fr' or 'ar'
 * @param win          a window opened synchronously by the click, so the
 *                     browser does not block it as a popup; null to download
 */
export async function printFinanceReport({ all, transactions, budgets, range, periodLabel, scopeLabel, lang = 'en', win }) {
  const { doc, autoTable } = await createPdf({ orientation: 'portrait' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 44
  const rtl = isRtl(lang)
  const align = rtl ? 'right' : 'left'
  const alignEnd = rtl ? 'left' : 'right'
  const money = (value, opts) => moneyFor(lang, value, opts)
  // Arabic amounts are bare numbers; say the currency once in each header.
  const amountHeader = key => (rtl ? `${t(lang, key)} (دج)` : t(lang, key))

  const periodText = range
    ? `${term(lang, periodLabel)} · ${formatDateFor(lang, range[0])} – ${formatDateFor(lang, new Date(new Date(range[1]).getTime() - 86400000))}`
    : t(lang, 'allTime')

  let y = drawHeader(doc, {
    lang,
    title: `${t(lang, 'financialReport')}${scopeLabel ? ` · ${scopeLabel}` : ''}`,
    subtitle: periodText,
    margin,
  })

  const heading = text => {
    if (y > pageHeight - 140) { doc.addPage(); y = margin + 10 }
    doc.setTextColor(...THEME.ink)
    doc.setFont(FONT, 'bold')
    doc.setFontSize(11)
    doc.text(text, rtl ? pageWidth - margin : margin, y, { align })
    y += 8
  }

  const theme = tableTheme(lang)
  /** A table whose `head`, `body`, `foot` and `columnStyles` are written in reading order. */
  const table = ({ head, body, foot, columnStyles = {}, didParseCell, ...options }) => {
    const count = (head?.[0] || body[0]).length
    autoTable(doc, {
      ...theme,
      startY: y,
      margin: { left: margin, right: margin, top: margin, bottom: 48 },
      head: head?.map(r => mirror(lang, r)),
      body: body.map(r => mirror(lang, r)),
      foot: foot?.map(r => mirror(lang, r)),
      columnStyles: mirrorColumnStyles(lang, columnStyles, count),
      didParseCell: cell => {
        const index = sourceIndex(lang, cell.column.index, count)
        // columnStyles only reach the body; line headers and totals up with their numbers.
        if (cell.section !== 'body' && columnStyles[index]?.halign) cell.cell.styles.halign = columnStyles[index].halign
        didParseCell?.(cell, index)
      },
      ...options,
    })
    y = doc.lastAutoTable.finalY + 28
  }

  // Summary. The opening balance is everything before the period — for a
  // report scoped to one event or project it is meaningless, so it is skipped.
  const period = totals(transactions)
  const opening = range && !scopeLabel ? totals(all.filter(t => t.occurred_on < range[0])).net : null
  const summary = [
    ...(opening != null ? [['openingBalance', opening]] : []),
    ['totalIncome', period.income],
    ['totalExpenses', period.expense],
    ['netResult', period.net],
    ...(opening != null ? [['closingBalance', opening + period.net]] : []),
  ]
  heading(t(lang, 'summary'))
  table({
    body: summary.map(([key, value]) => [t(lang, key), money(value, { signed: key === 'netResult' })]),
    tableWidth: 300,
    margin: rtl ? { left: pageWidth - margin - 300, right: margin } : { left: margin, right: pageWidth - margin - 300 },
    columnStyles: { 1: { halign: alignEnd } },
    didParseCell: (cell, index) => {
      const key = summary[cell.row.index][0]
      if (key === 'closingBalance' || key === 'netResult') {
        cell.cell.styles.fontStyle = 'bold'
        cell.cell.styles.textColor = THEME.ink
        cell.cell.styles.lineWidth = { top: 0.8, bottom: 0.4 }
        cell.cell.styles.lineColor = THEME.ink
      }
      if (index === 1 && key === 'netResult' && period.net < 0) cell.cell.styles.textColor = THEME.negative
    },
  })
  doc.setFont(FONT, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...THEME.muted)
  doc.text(t(lang, 'currencyNote'), rtl ? pageWidth - margin : margin, y - 16, { align })
  y += 12

  const categoryTable = (title, rows, total) => {
    heading(title)
    table({
      head: [[t(lang, 'category'), amountHeader('amount'), t(lang, 'share')]],
      body: rows.length
        ? rows.map(([cat, amount]) => [term(lang, categoryLabel(cat)), money(amount), total ? `${Math.round((amount / total) * 100)}%` : '—'])
        : [[t(lang, 'nothingRecorded'), '', '']],
      foot: rows.length ? [[t(lang, 'total'), money(total), '100%']] : undefined,
      columnStyles: { 1: { halign: alignEnd }, 2: { halign: alignEnd, cellWidth: 60 } },
    })
  }
  categoryTable(t(lang, 'incomeByCategory'), byCategory(transactions, 'income'), period.income)
  categoryTable(t(lang, 'expensesByCategory'), byCategory(transactions, 'expense'), period.expense)

  if (budgets.length) {
    heading(t(lang, 'budgets'))
    const rows = budgets.map(b => {
      const actual = budgetActuals(b, all)
      const planned = Number(b.planned_expense) || 0
      const scope = b.event?.title_en || b.project?.title_en || t(lang, 'wholeClub')
      return {
        variance: planned - actual.expense,
        cells: [
          `${b.name}\n${scope}`,
          money(planned), money(actual.expense), money(planned - actual.expense, { signed: true }),
          money(Number(b.planned_income) || 0), money(actual.income),
        ],
      }
    })
    const right = { halign: alignEnd }
    table({
      head: [[
        t(lang, 'budget'), amountHeader('plannedSpend'), amountHeader('actualSpend'), amountHeader('remaining'),
        amountHeader('expectedIncome'), amountHeader('raised'),
      ]],
      body: rows.map(r => r.cells),
      columnStyles: { 1: right, 2: right, 3: right, 4: right, 5: right },
      didParseCell: (cell, index) => {
        if (cell.section !== 'body' || index !== 3) return
        cell.cell.styles.fontStyle = 'bold'
        cell.cell.styles.textColor = rows[cell.row.index].variance < 0 ? THEME.negative : THEME.ink
      },
    })
  }

  heading(t(lang, 'transactions', { n: transactions.length }))
  const ordered = [...transactions].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.id - b.id)
  table({
    head: [[t(lang, 'date'), t(lang, 'category'), t(lang, 'description'), t(lang, 'fromTo'), t(lang, 'ref'), amountHeader('amount')]],
    body: ordered.length
      ? ordered.map(t => [
        formatDateFor(lang, t.occurred_on), term(lang, categoryLabel(t.category)), t.description || '',
        t.counterparty || '', t.reference || '', money(signedAmount(t), { signed: true }),
      ])
      : [['', '', t(lang, 'noTransactions'), '', '', '']],
    columnStyles: { 0: { cellWidth: rtl ? 96 : 80 }, 5: { halign: alignEnd, cellWidth: 82 } },
    didParseCell: (cell, index) => {
      if (cell.section !== 'body' || index !== 5 || !ordered.length) return
      cell.cell.styles.textColor = THEME.ink
    },
  })

  // Signatures.
  if (y > pageHeight - 120) { doc.addPage(); y = margin + 20 }
  y += 24
  doc.setDrawColor(...THEME.ink)
  doc.setLineWidth(0.6)
  doc.setTextColor(...THEME.muted)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(8.5)
  const colWidth = (pageWidth - margin * 2 - 48) / 2
  ;['treasurer', 'president'].forEach((role, i) => {
    // The treasurer signs on the reading side.
    const x = rtl ? pageWidth - margin - colWidth - i * (colWidth + 48) : margin + i * (colWidth + 48)
    doc.line(x, y + 30, x + colWidth, y + 30)
    doc.text(t(lang, 'signatureLine', { role: t(lang, role) }), rtl ? x + colWidth : x, y + 44, { align })
  })

  drawFooters(doc, { lang, margin })

  const filename = `financial-report-${lang}-${new Date().toISOString().slice(0, 10)}.pdf`
  if (win && !win.closed) {
    doc.autoPrint()
    win.location.href = doc.output('bloburl')
  } else {
    doc.save(filename)
  }
}
