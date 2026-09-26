/**
 * Finance vocabulary shared by the ledger, the budget cards and the modals, so
 * a category or an amount reads the same wherever it shows up.
 */

export const INCOME_CATEGORIES = [
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'donation', label: 'Donation' },
  { value: 'grant', label: 'Grant / subsidy' },
  { value: 'event_revenue', label: 'Event revenue' },
  { value: 'other_income', label: 'Other income' },
]

export const EXPENSE_CATEGORIES = [
  { value: 'event_cost', label: 'Event cost' },
  { value: 'equipment_purchase', label: 'Equipment purchase' },
  { value: 'supplies', label: 'Supplies & components' },
  { value: 'printing', label: 'Printing & merch' },
  { value: 'transport', label: 'Transport' },
  { value: 'food', label: 'Food & catering' },
  { value: 'fees', label: 'Fees & subscriptions' },
  { value: 'other_expense', label: 'Other expense' },
]

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'ccp', label: 'CCP / BaridiMob' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
]

export const categoriesFor = kind => (kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)

export function categoryLabel(value) {
  return [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].find(c => c.value === value)?.label || value || '—'
}

export function paymentLabel(value) {
  return PAYMENT_METHODS.find(m => m.value === value)?.label || value || '—'
}

const DA = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** `1 250 DA`. PostgREST may hand numeric columns back as strings. */
export function formatMoney(value, { signed = false } = {}) {
  const n = Number(value) || 0
  const sign = signed && n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${DA.format(Math.abs(n))} DA`
}

/** Income positive, expense negative — the one place that sign rule lives. */
export const signedAmount = t => (t.kind === 'income' ? 1 : -1) * (Number(t.amount) || 0)

export function totals(transactions) {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (t.kind === 'income') income += Number(t.amount) || 0
    else expense += Number(t.amount) || 0
  }
  return { income, expense, net: income - expense }
}

/**
 * Transactions a budget measures itself against: the ones sharing its event
 * or project. A club-wide budget (neither set) counts every transaction.
 */
export function budgetActuals(budget, transactions) {
  const scoped = transactions.filter(t =>
    budget.event_id ? t.event_id === budget.event_id
      : budget.project_id ? t.project_id === budget.project_id
        : true
  )
  return totals(scoped)
}

/** Period filter values → [from, to) ISO dates, or null for all time. */
export function periodRange(period, now = new Date()) {
  const y = now.getFullYear()
  const m = now.getMonth()
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (period === 'month') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 1))]
  if (period === 'last_month') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 1))]
  // Academic year runs September to August.
  if (period === 'season') {
    const start = m >= 8 ? y : y - 1
    return [iso(new Date(start, 8, 1)), iso(new Date(start + 1, 8, 1))]
  }
  if (period === 'year') return [iso(new Date(y, 0, 1)), iso(new Date(y + 1, 0, 1))]
  return null
}

export const PERIODS = [
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'season', label: 'This season' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
]
