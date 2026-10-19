import { useEffect, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, X } from 'lucide-react'
import Skeleton from './Skeleton'

const PAGE_SIZES = [10, 25, 50, 100]

// Contact details often sit inside another column's cell (email under the
// name), so search them even when no column is keyed on them.
const SEARCH_FIELDS = ['email', 'phone', 'student_id', 'member_code', 'instagram']

function matchesSearch(row, columnId, filterValue) {
  const term = String(filterValue ?? '').trim().toLowerCase()
  if (!term) return true
  const has = v => v != null && String(v).toLowerCase().includes(term)
  return has(row.getValue(columnId)) || SEARCH_FIELDS.some(key => has(row.original?.[key]))
}

/**
 * The list surface for every record type in the console. Adds what the old
 * table was missing: row selection with bulk actions, a sticky header, real
 * aria-sort, a row count you can trust, and an empty state that lives inside
 * the frame instead of replacing it.
 */
export default function DataTable({
  columns,
  data,
  loading = false,
  searchable = true,
  searchPlaceholder = 'Search…',
  toolbar,
  emptyState,
  getRowId,
  onRowClick,
  enableSelection = false,
  bulkActions,
  initialSort = [],
  initialSearch = '',
  defaultPageSize = 25,
  rowAttributes,
}) {
  const [sorting, setSorting] = useState(initialSort)
  // The command palette hands a term over in the URL; the list opens on it.
  const [globalFilter, setGlobalFilter] = useState(initialSearch)
  const [rowSelection, setRowSelection] = useState({})
  const [pageSize, setPageSize] = useState(defaultPageSize)

  const selectionColumn = useMemo(
    () => ({
      id: '__select',
      size: 40,
      enableSorting: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          className="adm-check"
          aria-label="Select all rows on this page"
          checked={table.getIsAllPageRowsSelected()}
          ref={el => {
            if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
          }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="adm-check"
          aria-label="Select row"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={e => e.stopPropagation()}
        />
      ),
    }),
    []
  )

  const tableColumns = useMemo(
    () => (enableSelection ? [selectionColumn, ...columns] : columns),
    [columns, enableSelection, selectionColumn]
  )

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, globalFilter, rowSelection },
    getRowId,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: matchesSearch,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: enableSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: defaultPageSize } },
    autoResetPageIndex: true,
  })

  useEffect(() => { table.setPageSize(pageSize) }, [pageSize, table])

  // Filtering to a page that no longer exists leaves a blank table — snap back.
  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex
  useEffect(() => {
    if (pageCount > 0 && pageIndex > pageCount - 1) table.setPageIndex(pageCount - 1)
  }, [pageCount, pageIndex, table])

  const selectedRows = table.getSelectedRowModel().rows.map(r => r.original)
  const filteredCount = table.getFilteredRowModel().rows.length
  const first = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
  const last = Math.min(filteredCount, (pageIndex + 1) * pageSize)

  return (
    <div>
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-2.5 mb-3.5">
          {searchable && (
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--adm-silk-faint)' }}
              />
              <input
                type="search"
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="adm-input"
                style={{ paddingLeft: 34, paddingRight: globalFilter ? 34 : 12 }}
              />
              {globalFilter && (
                <button
                  type="button"
                  onClick={() => setGlobalFilter('')}
                  aria-label="Clear search"
                  className="adm-icon-btn absolute right-1 top-1/2 -translate-y-1/2"
                  style={{ width: 28, height: 28 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          {toolbar}
        </div>
      )}

      <AnimatePresence>
        {enableSelection && selectedRows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-wrap items-center gap-2.5 mb-3 px-3.5 py-2.5 rounded-xl"
            style={{ background: 'var(--adm-signal-wash)', border: '1px solid var(--adm-signal-edge)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--adm-signal)' }}>
              {selectedRows.length} selected
            </span>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {bulkActions?.(selectedRows, () => setRowSelection({}))}
              <button
                type="button"
                onClick={() => setRowSelection({})}
                className="text-sm font-medium underline underline-offset-2"
                style={{ color: 'var(--adm-signal)' }}
              >
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="adm-scroll overflow-auto"
        style={{
          border: '1px solid var(--adm-trace)',
          borderRadius: 14,
          background: 'var(--adm-panel)',
          maxHeight: '68vh',
        }}
      >
        <table className="adm-table">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const sortable = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      data-sortable={sortable || undefined}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : sortable ? 'none' : undefined}
                      onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                      style={{ width: header.column.columnDef.size }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortable && (
                          sorted === 'asc' ? <ArrowUp size={11} />
                            : sorted === 'desc' ? <ArrowDown size={11} />
                              : <ChevronsUpDown size={11} style={{ opacity: 0.4 }} />
                        )}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {tableColumns.map((col, j) => (
                    <td key={j}><Skeleton style={{ height: 16, width: j === 0 ? '55%' : '75%' }} /></td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={tableColumns.length} style={{ padding: 0 }}>
                  {emptyState || (
                    <p className="text-center py-14 text-sm" style={{ color: 'var(--adm-silk-faint)' }}>
                      Nothing matches this search.
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  data-selected={row.getIsSelected() || undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  style={{ cursor: onRowClick ? 'pointer' : undefined }}
                  {...(rowAttributes?.(row.original) || {})}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
          <p className="adm-data text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
            {first}–{last} of {filteredCount}
            {filteredCount !== data.length && ` (filtered from ${data.length})`}
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
              Rows
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className="adm-input adm-data"
                style={{ width: 74, minHeight: 32, paddingTop: 4, paddingBottom: 4 }}
                aria-label="Rows per page"
              >
                {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            {pageCount > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="adm-icon-btn"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="adm-data text-xs px-1" style={{ color: 'var(--adm-silk-dim)' }}>
                  {pageIndex + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="adm-icon-btn"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
