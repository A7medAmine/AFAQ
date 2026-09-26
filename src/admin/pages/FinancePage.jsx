import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Paperclip, Pencil, PiggyBank, Plus, Printer, Trash2, Wallet } from 'lucide-react'
import { logActivity, read, run, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { formatDate, formatDateTime } from '../lib/format'
import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, PERIODS, budgetActuals, categoryLabel, formatMoney,
  paymentLabel, periodRange, signedAmount, totals,
} from '../lib/finance'
import { printFinanceReport } from '../lib/financeReport'
import { savedExportLanguage } from '../lib/exportI18n'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import ExportMenu, { LanguageChoice } from '../components/ui/ExportMenu'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import Panel, { PanelHead } from '../components/ui/Panel'
import TransactionModal from '../components/finance/TransactionModal'
import BudgetModal from '../components/finance/BudgetModal'

const KINDS = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expenses' },
]

const VIEWS = [
  { value: 'ledger', label: 'Ledger' },
  { value: 'budgets', label: 'Budgets' },
]

/**
 * The club's books: every dinar in and out, and each event's or project's
 * budget against what was actually spent. Filters live in the URL so a budget
 * card can link straight to its own transactions.
 */
export default function FinancePage() {
  const [rows, setRows] = useState([])
  const [budgets, setBudgets] = useState([])
  const [events, setEvents] = useState([])
  const [projects, setProjects] = useState([])
  const [state, setState] = useState({ loading: true, error: null })

  const [view, setView] = useQueryParam('view', 'ledger')
  const [period, setPeriod] = useQueryParam('period', 'season')
  const [kind, setKind] = useQueryParam('kind', 'all')
  const [category, setCategory] = useQueryParam('category', '')
  const [eventId, setEventId] = useQueryParam('event', '')
  const [projectId, setProjectId] = useQueryParam('project', '')
  const [search] = useQueryParam('q')
  const [, setParams] = useSearchParams()

  const [editor, setEditor] = useState(null) // { transaction, defaults? }
  const [budgetEditor, setBudgetEditor] = useState(null) // { budget }
  const [pendingDelete, setPendingDelete] = useState(null)
  const [pendingBudgetDelete, setPendingBudgetDelete] = useState(null)
  const [printing, setPrinting] = useState(false)
  const [printDialog, setPrintDialog] = useState(false)
  const [reportLang, setReportLang] = useState(savedExportLanguage)

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [tx, budgetList, eventList, projectList] = await Promise.all([
      read(supabase.from('finance_transactions')
        .select('*, event:events(id, title_en), project:projects(id, title_en)')
        .order('occurred_on', { ascending: false })
        .order('id', { ascending: false })),
      read(supabase.from('finance_budgets')
        .select('*, event:events(id, title_en, date), project:projects(id, title_en)')
        .order('created_at', { ascending: false })),
      read(supabase.from('events').select('id, title_en, date').order('date', { ascending: false })),
      read(supabase.from('projects').select('id, title_en').order('title_en')),
    ])
    if (!tx.ok) { setState({ loading: false, error: tx.message }); return }
    if (!budgetList.ok) { setState({ loading: false, error: budgetList.message }); return }
    setRows(tx.data || [])
    setBudgets(budgetList.data || [])
    setEvents(eventList.data || [])
    setProjects(projectList.data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const range = periodRange(period)
  const inPeriod = useMemo(() => rows.filter(t =>
    !range || (t.occurred_on >= range[0] && t.occurred_on < range[1])
  ), [rows, range?.[0], range?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps

  const scoped = useMemo(() => inPeriod.filter(t =>
    (!eventId || String(t.event_id) === eventId) &&
    (!projectId || String(t.project_id) === projectId) &&
    (!category || t.category === category)
  ), [inPeriod, eventId, projectId, category])

  const filtered = useMemo(() => scoped.filter(t => kind === 'all' || t.kind === kind), [scoped, kind])

  const kindOptions = KINDS.map(k => ({ ...k, count: scoped.filter(t => k.value === 'all' || t.kind === k.value).length }))
  const periodTotals = totals(scoped)
  const balance = totals(rows).net

  // Where the money went this period, biggest first.
  const breakdown = useMemo(() => {
    const byCategory = new Map()
    scoped.filter(t => t.kind === 'expense').forEach(t =>
      byCategory.set(t.category, (byCategory.get(t.category) || 0) + Number(t.amount)))
    return [...byCategory.entries()].sort((a, b) => b[1] - a[1])
  }, [scoped])

  const deleteTransactions = async () => {
    const list = pendingDelete
    const { ok } = await run(
      supabase.from('finance_transactions').delete().in('id', list.map(t => t.id)),
      { success: list.length === 1 ? 'Transaction deleted.' : `${list.length} transactions deleted.`, failure: 'The transaction was not deleted.' }
    )
    if (!ok) return
    list.forEach(t => logActivity('deleted', 'finance_transactions', t.id, {
      name: t.description || t.category, kind: t.kind, amount: t.amount,
    }))
    setPendingDelete(null)
    load()
  }

  const deleteBudget = async () => {
    const b = pendingBudgetDelete
    const { ok } = await run(supabase.from('finance_budgets').delete().eq('id', b.id),
      { success: 'Budget deleted.', failure: 'The budget was not deleted.' })
    if (!ok) return
    logActivity('deleted', 'finance_budgets', b.id, { name: b.name })
    setPendingBudgetDelete(null)
    load()
  }

  // One URL write: separate setters in the same tick would overwrite each other.
  const openLedgerFor = budget => {
    const next = new URLSearchParams({ period: 'all' })
    if (budget.event_id) next.set('event', budget.event_id)
    if (budget.project_id) next.set('project', budget.project_id)
    setParams(next, { replace: true })
  }

  const periodLabel = PERIODS.find(p => p.value === period)?.label || ''

  // The report covers the whole period, narrowed only by the event or project
  // filter — kind, category and search are for browsing, not for the books.
  const printReport = async () => {
    // Open the tab inside the click, before any await, or it gets popup-blocked.
    const win = window.open('', '_blank')
    setPrinting(true)
    try {
      const reportRows = inPeriod.filter(t =>
        (!eventId || String(t.event_id) === eventId) && (!projectId || String(t.project_id) === projectId))
      const reportBudgets = budgets.filter(b =>
        (!eventId || String(b.event_id) === eventId) && (!projectId || String(b.project_id) === projectId))
      const scopeLabel = eventId ? events.find(e => String(e.id) === eventId)?.title_en
        : projectId ? projects.find(p => String(p.id) === projectId)?.title_en : null
      await printFinanceReport({
        all: rows, transactions: reportRows, budgets: reportBudgets,
        range, periodLabel, scopeLabel, lang: reportLang, win,
      })
    } catch {
      win?.close()
      useAdminStore.getState().addToast('The report could not be generated.', 'error')
    }
    setPrinting(false)
    setPrintDialog(false)
  }
  const exportHeaders = ['Date', 'Kind', 'Category', 'Description', 'From / to', 'Event / project', 'Method', 'Reference', 'Amount (DA)']
  const exportRows = filtered.map(t => [
    formatDate(t.occurred_on), t.kind, categoryLabel(t.category), t.description,
    t.counterparty, t.event?.title_en || t.project?.title_en,
    paymentLabel(t.payment_method), t.reference, signedAmount(t).toFixed(2),
  ])

  const columns = useMemo(() => [
    {
      header: 'Date',
      accessorKey: 'occurred_on',
      cell: ({ row }) => <span className="adm-data text-[12px]">{formatDate(row.original.occurred_on)}</span>,
    },
    {
      header: 'Description',
      id: 'description',
      accessorFn: t => `${t.description || ''} ${t.counterparty || ''}`,
      cell: ({ row }) => {
        const t = row.original
        const who = t.counterparty
        return (
          <span className="block min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-semibold adm-truncate" style={{ maxWidth: 320 }}>
              {t.description || categoryLabel(t.category)}
              {t.receipt_url && <Paperclip size={12} style={{ color: 'var(--adm-silk-faint)' }} aria-label="Has receipt" />}
            </span>
            {who && (
              <span className="block text-[12px] adm-truncate" style={{ color: 'var(--adm-silk-faint)', maxWidth: 320 }}>
                {t.kind === 'income' ? 'From ' : 'To '}{who}
              </span>
            )}
          </span>
        )
      },
    },
    {
      header: 'Category',
      accessorKey: 'category',
      cell: ({ row }) => (
        <Badge tone={row.original.kind === 'income' ? 'ok' : 'neutral'}>{categoryLabel(row.original.category)}</Badge>
      ),
    },
    {
      header: 'Event / project',
      id: 'scope',
      accessorFn: t => t.event?.title_en || t.project?.title_en || '',
      cell: ({ row }) => (
        <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>
          {row.original.event?.title_en || row.original.project?.title_en || '—'}
        </span>
      ),
    },
    {
      header: 'Amount',
      id: 'amount',
      accessorFn: t => signedAmount(t),
      cell: ({ row }) => (
        <span className="adm-data text-[13px] font-semibold whitespace-nowrap"
          style={{ color: row.original.kind === 'income' ? 'var(--adm-ok)' : 'var(--adm-silk)' }}>
          {formatMoney(signedAmount(row.original), { signed: true })}
        </span>
      ),
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
          <IconButton icon={Pencil} label="Edit" onClick={() => setEditor({ transaction: row.original })} />
          <IconButton icon={Trash2} label="Delete" danger onClick={() => setPendingDelete([row.original])} />
        </div>
      ),
    },
  ], [])

  const newTransaction = defaults => setEditor({
    transaction: null,
    defaults: defaults || {
      kind: kind === 'income' || INCOME_CATEGORIES.some(c => c.value === category) ? 'income' : 'expense',
      category: category || undefined,
      event_id: eventId ? Number(eventId) : null,
      project_id: projectId ? Number(projectId) : null,
    },
  })

  return (
    <div>
      <PageHeader
        eyebrow="Operate"
        title="Finance"
        description="Sponsorships, grants and spending — and how each event or project tracks against its budget."
        actions={
          <>
            {view === 'ledger' ? (
              <ExportMenu
                filename={`finance-${period}-${new Date().toISOString().slice(0, 10)}`}
                title="Finance ledger"
                subtitle={`${periodLabel} · ${formatDateTime(new Date())}`}
                headers={exportHeaders}
                rows={exportRows}
                enumColumns={[1, 2, 6]}
                disabled={!filtered.length}
              />
            ) : (
              <Button icon={PiggyBank} onClick={() => setBudgetEditor({ budget: null })}>New budget</Button>
            )}
            <Button icon={Printer} onClick={() => setPrintDialog(true)}
              disabled={state.loading || !!state.error}>
              Print report
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => newTransaction()}>New transaction</Button>
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <Tile label="Balance" hint="All time" value={formatMoney(balance)} tone={balance < 0 ? 'fault' : undefined} />
        <Tile label="Income" hint={periodLabel} value={formatMoney(periodTotals.income)} tone="ok" />
        <Tile label="Expenses" hint={periodLabel} value={formatMoney(periodTotals.expense)} />
        <Tile label="Net" hint={periodLabel} value={formatMoney(periodTotals.net, { signed: true })}
          tone={periodTotals.net < 0 ? 'fault' : 'ok'} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterTabs options={VIEWS} value={view} onChange={setView} label="Finance view" />
        <select className="adm-input" style={{ width: 'auto', height: 40 }} value={period}
          onChange={e => setPeriod(e.target.value)} aria-label="Period">
          {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : view === 'budgets' ? (
        <Budgets
          budgets={budgets}
          transactions={rows}
          loading={state.loading}
          onNew={() => setBudgetEditor({ budget: null })}
          onEdit={b => setBudgetEditor({ budget: b })}
          onDelete={setPendingBudgetDelete}
          onOpenLedger={openLedgerFor}
          onRecord={b => newTransaction({ kind: 'expense', event_id: b.event_id, project_id: b.project_id })}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_300px] items-start">
          <DataTable
            columns={columns}
            data={filtered}
            loading={state.loading}
            initialSearch={search}
            getRowId={row => String(row.id)}
            onRowClick={t => setEditor({ transaction: t })}
            enableSelection
            searchPlaceholder="Search descriptions, sponsors, vendors…"
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <FilterTabs options={kindOptions} value={kind} onChange={setKind} label="Kind filter" />
                <select className="adm-input" style={{ width: 'auto', height: 40 }} value={category}
                  onChange={e => setCategory(e.target.value)} aria-label="Category filter">
                  <option value="">All categories</option>
                  <optgroup label="Income">
                    {INCOME_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </optgroup>
                  <optgroup label="Expenses">
                    {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </optgroup>
                </select>
                <select className="adm-input" style={{ width: 'auto', height: 40 }} value={eventId}
                  onChange={e => { setEventId(e.target.value); if (e.target.value) setProjectId('') }} aria-label="Event filter">
                  <option value="">All events</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title_en}</option>)}
                </select>
                <select className="adm-input" style={{ width: 'auto', height: 40 }} value={projectId}
                  onChange={e => { setProjectId(e.target.value); if (e.target.value) setEventId('') }} aria-label="Project filter">
                  <option value="">All projects</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title_en}</option>)}
                </select>
              </div>
            }
            bulkActions={(selected, clear) => (
              <>
                <span className="adm-data text-[12px]" style={{ color: 'var(--adm-silk-dim)' }}>
                  {formatMoney(selected.reduce((sum, t) => sum + signedAmount(t), 0), { signed: true })}
                </span>
                <Button size="sm" icon={Trash2} onClick={() => { setPendingDelete(selected); clear() }}>Delete</Button>
              </>
            )}
            emptyState={
              rows.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="No transactions yet"
                  description="Record dues, sponsorships and purchases to see where the club's money comes from and goes."
                  action={<Button variant="primary" icon={Plus} onClick={() => newTransaction()}>New transaction</Button>}
                />
              ) : (
                <EmptyState compact icon={Wallet} title="Nothing in this view" description="Try another period or filter." />
              )
            }
          />

          <Panel>
            <PanelHead eyebrow={periodLabel} title="Where it went" description="Expenses by category." />
            <div className="p-4">
              {breakdown.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--adm-silk-faint)' }}>No expenses in this view.</p>
              ) : (
                <ul className="space-y-3">
                  {breakdown.map(([cat, amount]) => (
                    <li key={cat}>
                      <button type="button" className="w-full text-left" onClick={() => { setCategory(cat); setKind('expense') }}>
                        <span className="flex items-baseline justify-between gap-2 text-[13px]">
                          <span className="font-semibold adm-truncate">{categoryLabel(cat)}</span>
                          <span className="adm-data text-[12px]" style={{ color: 'var(--adm-silk-dim)' }}>{formatMoney(amount)}</span>
                        </span>
                        <Meter ratio={periodTotals.expense ? amount / periodTotals.expense : 0} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </div>
      )}

      <Modal
        open={printDialog}
        onClose={() => setPrintDialog(false)}
        title="Print financial report"
        description={`${periodLabel}${eventId || projectId ? ' · filtered to the selected event or project' : ''}.`}
        footer={
          <>
            <Button onClick={() => setPrintDialog(false)} data-dialog-dismiss="true">Cancel</Button>
            <Button variant="primary" icon={Printer} onClick={printReport} busy={printing} busyLabel="Preparing…">
              Print report
            </Button>
          </>
        }
      >
        <LanguageChoice value={reportLang} onChange={setReportLang} />
      </Modal>

      <TransactionModal
        open={!!editor}
        transaction={editor?.transaction || null}
        defaults={editor?.defaults}
        events={events}
        projects={projects}
        onClose={() => setEditor(null)}
        onSaved={load}
      />

      <BudgetModal
        open={!!budgetEditor}
        budget={budgetEditor?.budget || null}
        events={events}
        projects={projects}
        onClose={() => setBudgetEditor(null)}
        onSaved={load}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={deleteTransactions}
        title={pendingDelete?.length === 1 ? 'Delete this transaction?' : `Delete ${pendingDelete?.length || 0} transactions?`}
        message="Deleted transactions are gone for good and the balance changes with them."
        confirmLabel="Delete"
      />

      <ConfirmDialog
        open={!!pendingBudgetDelete}
        onClose={() => setPendingBudgetDelete(null)}
        onConfirm={deleteBudget}
        title={`Delete “${pendingBudgetDelete?.name || ''}”?`}
        message="Only the plan is removed. Its transactions stay in the ledger."
        confirmLabel="Delete"
      />
    </div>
  )
}

function Tile({ label, hint, value, tone }) {
  return (
    <Panel className="px-4 py-3.5">
      <p className="adm-eyebrow">{label}</p>
      <p className="adm-data text-[20px] font-semibold mt-1.5 whitespace-nowrap"
        style={{ color: tone ? `var(--adm-${tone})` : 'var(--adm-silk)' }}>
        {value}
      </p>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--adm-silk-faint)' }}>{hint}</p>
    </Panel>
  )
}

function Meter({ ratio, tone = 'signal' }) {
  return (
    <span className="block h-1.5 mt-1.5 rounded-full overflow-hidden" style={{ background: 'var(--adm-board-sunk)' }}>
      <span className="block h-full rounded-full"
        style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%`, background: `var(--adm-${tone})` }} />
    </span>
  )
}

/** Planned vs actual for each budget. Overspend turns the bar red. */
function Budgets({ budgets, transactions, loading, onNew, onEdit, onDelete, onOpenLedger, onRecord }) {
  if (loading) return <Panel className="p-10" />
  if (!budgets.length) {
    return (
      <Panel>
        <EmptyState
          icon={PiggyBank}
          title="No budgets yet"
          description="Plan what an event or project should cost, then watch the actual spend fill in as you record transactions."
          action={<Button variant="primary" icon={Plus} onClick={onNew}>New budget</Button>}
        />
      </Panel>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {budgets.map(b => {
        const actual = budgetActuals(b, transactions)
        const plannedExpense = Number(b.planned_expense) || 0
        const plannedIncome = Number(b.planned_income) || 0
        const over = plannedExpense > 0 && actual.expense > plannedExpense
        const spendRatio = plannedExpense ? actual.expense / plannedExpense : actual.expense ? 1 : 0
        const scope = b.event?.title_en ? `Event · ${b.event.title_en}` : b.project?.title_en ? `Project · ${b.project.title_en}` : 'Whole club'
        return (
          <Panel key={b.id}>
            <PanelHead
              eyebrow={scope}
              title={b.name}
              action={
                <>
                  <IconButton icon={Pencil} label="Edit budget" onClick={() => onEdit(b)} />
                  <IconButton icon={Trash2} label="Delete budget" danger onClick={() => onDelete(b)} />
                </>
              }
            />
            <div className="p-4 space-y-4">
              <div>
                <p className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-semibold">Spent</span>
                  <span className="adm-data text-[12px]" style={{ color: over ? 'var(--adm-fault)' : 'var(--adm-silk-dim)' }}>
                    {formatMoney(actual.expense)} / {formatMoney(plannedExpense)}
                  </span>
                </p>
                <Meter ratio={spendRatio} tone={over ? 'fault' : spendRatio > 0.85 ? 'wait' : 'signal'} />
                {over && (
                  <p className="text-[12px] mt-1.5" style={{ color: 'var(--adm-fault)' }}>
                    Over by {formatMoney(actual.expense - plannedExpense)}
                  </p>
                )}
              </div>
              <div>
                <p className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-semibold">Raised</span>
                  <span className="adm-data text-[12px]" style={{ color: 'var(--adm-silk-dim)' }}>
                    {formatMoney(actual.income)} / {formatMoney(plannedIncome)}
                  </span>
                </p>
                <Meter ratio={plannedIncome ? actual.income / plannedIncome : 0} tone="ok" />
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>
                  Net <span className="adm-data" style={{ color: actual.net < 0 ? 'var(--adm-fault)' : 'var(--adm-ok)' }}>
                    {formatMoney(actual.net, { signed: true })}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button size="sm" onClick={() => onOpenLedger(b)}>Transactions</Button>
                  <Button size="sm" icon={Plus} onClick={() => onRecord(b)}>Expense</Button>
                </span>
              </div>
              {b.notes && <p className="text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>{b.notes}</p>}
            </div>
          </Panel>
        )
      })}
    </div>
  )
}
