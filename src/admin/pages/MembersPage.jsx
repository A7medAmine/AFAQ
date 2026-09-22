import { useCallback, useEffect, useMemo, useState } from 'react'
import { IdCard, Loader2, UserCheck, UserRoundPlus, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, run, read, supabase, uploadFile } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { formatDate, formatDateTime } from '../lib/format'
import PageHeader from '../components/ui/PageHeader'
import DataTable from '../components/ui/DataTable'
import Drawer, { DetailRow, TagList } from '../components/ui/Drawer'
import Modal from '../components/ui/Modal'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import ExportMenu from '../components/ui/ExportMenu'
import { StatusBadge } from '../components/ui/Badge'
import Panel from '../components/ui/Panel'
import { TextField } from '../components/ui/Field'

export default function MembersPage() {
  const addToast = useAdminStore(s => s.addToast)

  const [rows, setRows] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [search] = useQueryParam('q')

  const [detail, setDetail] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [working, setWorking] = useState({})

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const { ok, data, message } = await read(
      supabase.from('members').select('*').order('created_at', { ascending: false })
    )
    if (!ok) { setState({ loading: false, error: message }); return }
    setRows(data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const issueCard = async row => {
    setWorking(w => ({ ...w, [row.id]: true }))
    const { ok, data, message } = await api('/api/members/issue-card', { method: 'POST', body: { id: row.id } })
    setWorking(w => ({ ...w, [row.id]: false }))
    if (!ok) { addToast(message, 'error'); return }
    await load()
    setDetail(d => d && { ...d, ...data.member })
  }

  const exportHeaders = ['Name', 'Email', 'Phone', 'Member code', 'Student ID', 'Department', 'Study year', 'Card status', 'Joined']
  const exportRows = rows.map(r => [
    r.full_name, r.email, r.phone, r.member_code, r.student_id, r.department, r.study_year, r.card_status, formatDateTime(r.created_at),
  ])

  const columns = useMemo(() => [
    {
      header: 'Name',
      accessorKey: 'full_name',
      cell: ({ row }) => (
        <span className="min-w-0 block">
          <span className="block text-sm font-semibold adm-truncate" style={{ maxWidth: 210 }}>{row.original.full_name}</span>
          <span className="adm-data block text-[11px] adm-truncate" style={{ color: 'var(--adm-silk-faint)', maxWidth: 210 }}>
            {row.original.email}
          </span>
        </span>
      ),
    },
    { header: 'Member code', accessorKey: 'member_code', cell: ({ row }) => (
      <span className="adm-data text-[12px]">{row.original.member_code || '—'}</span>
    )},
    { header: 'Department', accessorKey: 'department', cell: ({ row }) => (
      <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>{row.original.department || '—'}</span>
    )},
    { header: 'Year', accessorKey: 'study_year', cell: ({ row }) => (
      <span className="text-[13px]" style={{ color: 'var(--adm-silk-dim)' }}>{row.original.study_year || '—'}</span>
    )},
    { header: 'Card', accessorKey: 'card_status', cell: ({ row }) => <StatusBadge status={row.original.card_status} /> },
    {
      header: 'Joined',
      accessorKey: 'created_at',
      cell: ({ row }) => <span className="adm-data text-[12px]">{formatDate(row.original.created_at)}</span>,
    },
  ], [])

  return (
    <div>
      <PageHeader
        eyebrow="Operate"
        title="Members"
        description="The club roster. New rows land here automatically when an application is approved."
        actions={
          <>
            <ExportMenu
              filename={`members-${new Date().toISOString().slice(0, 10)}`}
              title="Members"
              subtitle={formatDateTime(new Date())}
              headers={exportHeaders}
              rows={exportRows}
              statusColumnIndex={7}
              disabled={!rows.length}
            />
            <Button variant="primary" icon={UserRoundPlus} onClick={() => setAddOpen(true)}>Add a member</Button>
          </>
        }
      />

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          loading={state.loading}
          initialSearch={search}
          getRowId={row => String(row.id)}
          onRowClick={setDetail}
          searchPlaceholder="Search by name, email, department…"
          emptyState={
            <EmptyState
              icon={UserCheck}
              title="No members yet"
              description="Approve an application, or add a member by hand for someone who joined in person."
              action={<Button variant="primary" icon={UserRoundPlus} onClick={() => setAddOpen(true)}>Add a member</Button>}
            />
          }
        />
      )}

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.full_name || ''}
        subtitle={detail ? `Joined ${formatDateTime(detail.created_at)}` : ''}
        badge={detail && <StatusBadge status={detail.card_status} />}
        footer={
          detail && (
            detail.card_qr_code ? (
              <Link to={`/admin/members/${detail.id}/card`} className="adm-btn adm-btn-primary">
                <IdCard size={15} /> Print card
              </Link>
            ) : (
              <Button
                variant="primary" icon={IdCard} busy={working[detail.id]} busyLabel="Issuing…"
                onClick={() => issueCard(detail)}
              >
                Issue card
              </Button>
            )
          )
        }
      >
        {detail && (
          <div className="space-y-5">
            <PhotoUpload member={detail} onUpdated={photo_url => {
              setDetail(d => d && { ...d, photo_url })
              setRows(rs => rs.map(r => r.id === detail.id ? { ...r, photo_url } : r))
            }} />
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Email" mono>{detail.email}</DetailRow>
              <DetailRow label="Phone" mono>{detail.phone || '—'}</DetailRow>
              <DetailRow label="Student ID" mono>{detail.student_id || '—'}</DetailRow>
              <DetailRow label="Study year">{detail.study_year || '—'}</DetailRow>
              <DetailRow label="Department">{detail.department || '—'}</DetailRow>
              {detail.member_code && <DetailRow label="Member code" mono>{detail.member_code}</DetailRow>}
            </div>
            <DetailRow label="Skills"><TagList items={detail.skills} empty="None listed" /></DetailRow>
            <DetailRow label="Interests"><TagList items={detail.interests} empty="None listed" /></DetailRow>
          </div>
        )}
      </Drawer>

      <AddMember open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />
    </div>
  )
}

function PhotoUpload({ member, onUpdated }) {
  const addToast = useAdminStore(s => s.addToast)
  const [busy, setBusy] = useState(false)

  const pick = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const url = await uploadFile(file)
      const { ok } = await run(
        supabase.from('members').update({ photo_url: url }).eq('id', member.id),
        { failure: 'The photo did not save.' }
      )
      if (ok) onUpdated(url)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="rounded-full overflow-hidden shrink-0" style={{ width: 56, height: 56, background: 'var(--adm-panel-raise)' }}>
        {member.photo_url
          ? <img src={member.photo_url} alt="" className="w-full h-full object-cover" />
          : null}
      </div>
      <label className="adm-btn adm-btn-sm" style={{ cursor: busy ? 'default' : 'pointer' }}>
        {busy ? <Loader2 size={14} className="adm-spin" /> : <Upload size={14} />}
        {member.photo_url ? 'Replace photo' : 'Add photo'}
        <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={pick} />
      </label>
    </div>
  )
}

function AddMember({ open, onClose, onAdded }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', department: '', student_id: '', study_year: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({ full_name: '', email: '', phone: '', department: '', student_id: '', study_year: '' })
      setErrors({})
    }
  }, [open])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const submit = async () => {
    const next = {}
    if (!form.full_name.trim()) next.full_name = 'Enter the member’s name.'
    if (!form.email.trim()) next.email = 'Enter an email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'That is not a valid email address.'
    if (Object.keys(next).length) { setErrors(next); return }

    setSaving(true)
    const { ok } = await run(
      supabase.from('members').insert({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        department: form.department.trim() || null,
        student_id: form.student_id.trim() || null,
        study_year: form.study_year.trim() || null,
      }),
      { success: `${form.full_name.trim()} added to the club.`, failure: 'The member was not added.' }
    )
    setSaving(false)
    if (ok) { onClose(); onAdded() }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a member"
      description="For people who joined in person. No email is sent; issue a card from their detail view."
      footer={
        <>
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={submit} busy={saving} busyLabel="Adding…">Add member</Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Full name" required value={form.full_name} error={errors.full_name}
          onChange={e => set('full_name', e.target.value)} placeholder="Ahmed Mansouri" />
        <TextField label="Email" type="email" required value={form.email} error={errors.email}
          onChange={e => set('email', e.target.value)} placeholder="ahmed@univ-bouira.dz" />
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+213 6XX XXX XXX" />
          <TextField label="Student ID" value={form.student_id} onChange={e => set('student_id', e.target.value)} />
          <TextField label="Department" value={form.department} onChange={e => set('department', e.target.value)} placeholder="Computer Science" />
          <TextField label="Study year" value={form.study_year} onChange={e => set('study_year', e.target.value)} placeholder="L2" />
        </div>
      </div>
    </Modal>
  )
}
