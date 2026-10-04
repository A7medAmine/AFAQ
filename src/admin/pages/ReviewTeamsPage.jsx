import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Network, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { api, logActivity, read, run, supabase } from '../lib/db'
import PageHeader from '../components/ui/PageHeader'
import Panel, { PanelHead } from '../components/ui/Panel'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { CheckField, TextArea, TextField } from '../components/ui/Field'
import useAdminStore from '../store/adminStore'

const toast = message => useAdminStore.getState().addToast(message)

/**
 * Review teams and the interests that route applications to them. An interest
 * can feed several teams; one feeding none sends its applicants to the general
 * pool. Interest keys are what applications store, so a key never changes —
 * relabel it, or switch it off, instead.
 */
export default function ReviewTeamsPage() {
  const [teams, setTeams] = useState([])
  const [interests, setInterests] = useState([])
  const [links, setLinks] = useState([])
  const [reviewerLinks, setReviewerLinks] = useState([])
  const [admins, setAdmins] = useState([])
  const [staleDays, setStaleDays] = useState(5)
  const [state, setState] = useState({ loading: true, error: null })

  const [teamModal, setTeamModal] = useState(null) // { team } | { team: null }
  const [interestModal, setInterestModal] = useState(null)
  const [deleting, setDeleting] = useState(null) // { kind, row }

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const [t, i, l, r, s, a] = await Promise.all([
      read(supabase.from('review_teams').select('*').order('sort_order').order('id')),
      read(supabase.from('interests').select('*').order('sort_order').order('id')),
      read(supabase.from('interest_teams').select('*')),
      read(supabase.from('team_reviewers').select('*')),
      read(supabase.from('review_settings').select('*').eq('id', 1).maybeSingle()),
      api('/api/review/directory'),
    ])
    const failed = [t, i, l, r, s].find(x => !x.ok)
    if (failed || !a.ok) { setState({ loading: false, error: failed?.message || a.message }); return }
    setTeams(t.data); setInterests(i.data); setLinks(l.data); setReviewerLinks(r.data)
    setStaleDays(s.data?.stale_days ?? 5); setAdmins(a.data)
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const adminsById = useMemo(() => Object.fromEntries(admins.map(a => [a.id, a])), [admins])
  const interestsById = useMemo(() => Object.fromEntries(interests.map(i => [i.id, i])), [interests])
  const teamsById = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams])
  const teamInterests = id => links.filter(l => l.team_id === id).map(l => interestsById[l.interest_id]).filter(Boolean)
  const teamReviewers = id => reviewerLinks.filter(l => l.team_id === id).map(l => adminsById[l.admin_user_id]).filter(Boolean)
  const interestTeams = id => links.filter(l => l.interest_id === id).map(l => teamsById[l.team_id]).filter(Boolean)

  const saveStale = async value => {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1 || n > 60 || n === staleDays) return
    const { ok } = await run(
      supabase.from('review_settings').upsert({ id: 1, stale_days: n, updated_at: new Date().toISOString() }),
      { success: `Applications now go stale after ${n} days.`, failure: 'The setting did not save.' }
    )
    if (ok) setStaleDays(n)
  }

  const remove = async () => {
    const { kind, row } = deleting
    const table = kind === 'team' ? 'review_teams' : 'interests'
    const name = kind === 'team' ? row.name_en : row.label_en
    const { ok } = await run(supabase.from(table).delete().eq('id', row.id),
      { success: `${name} deleted.`, failure: 'It was not deleted.' })
    if (ok) { logActivity('deleted', table, row.id, { name }); setDeleting(null); load() }
  }

  if (state.error) return <Panel><ErrorState message={state.error} onRetry={load} /></Panel>

  return (
    <div>
      <PageHeader
        eyebrow="Console"
        title="Review teams"
        description="Who interviews whom. Applications go to the team their interests point to, then to its least-loaded reviewer."
        actions={<Link to="/admin/review?view=load"><Button>See the load</Button></Link>}
      />

      <div className="space-y-5">
        <Panel>
          <PanelHead eyebrow="Teams" title="Teams and reviewers"
            description="A reviewer can sit on several teams. Any admin can review, whatever their console role."
            action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setTeamModal({ team: null })}>Add team</Button>} />
          {state.loading ? (
            <p className="p-6 text-sm" style={{ color: 'var(--adm-silk-faint)' }}>Loading…</p>
          ) : teams.length === 0 ? (
            <EmptyState compact icon={Network} title="No teams yet" description="Without teams every application waits in the general pool." />
          ) : (
            <ul>
              {teams.map(t => {
                const reviewers = teamReviewers(t.id)
                const ints = teamInterests(t.id)
                return (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--adm-trace)' }}>
                    <span className="mt-1.5 rounded-full shrink-0" style={{ width: 10, height: 10, background: t.color }} aria-hidden="true" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-sm font-semibold">
                        {t.name_en}
                        <span className="font-normal" style={{ color: 'var(--adm-silk-faint)' }}>
                          {[t.name_ar, t.name_fr].filter(Boolean).map(n => ` · ${n}`).join('')}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {reviewers.length
                          ? reviewers.map(r => <Badge key={r.id} tone={r.review_available ? 'signal' : 'wait'}>{r.full_name || r.email}</Badge>)
                          : <Badge tone="fault">No reviewers: applications wait unassigned</Badge>}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--adm-silk-faint)' }}>
                        {ints.length ? `Interests: ${ints.map(i => i.label_en).join(', ')}` : 'No interests route here yet.'}
                      </p>
                    </div>
                    <IconButton icon={Pencil} label={`Edit ${t.name_en}`} onClick={() => setTeamModal({ team: t })} />
                    <IconButton icon={Trash2} label={`Delete ${t.name_en}`} danger onClick={() => setDeleting({ kind: 'team', row: t })} />
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHead eyebrow="Join form" title="Interests"
            description="What applicants pick on the join form, in the order shown there. Switched-off interests disappear from the form but stay on old applications."
            action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setInterestModal({ interest: null })}>Add interest</Button>} />
          {interests.length === 0 && !state.loading ? (
            <EmptyState compact icon={Tag} title="No interests" description="The join form shows no interests until you add some." />
          ) : (
            <ul>
              {interests.map(i => {
                const its = interestTeams(i.id)
                return (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: '1px solid var(--adm-trace)', opacity: i.is_active ? 1 : 0.55 }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {i.label_en}
                        <span className="font-normal" style={{ color: 'var(--adm-silk-faint)' }}>
                          {[i.label_ar, i.label_fr].filter(Boolean).map(n => ` · ${n}`).join('')}
                        </span>
                      </p>
                      <p className="adm-data text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>{i.key}</p>
                    </div>
                    <div className="hidden sm:flex flex-wrap gap-1 justify-end">
                      {its.length
                        ? its.map(t => <Badge key={t.id}><span style={{ color: t.color }}>●</span> {t.name_en}</Badge>)
                        : <Badge tone="wait">General pool</Badge>}
                      {!i.is_active && <Badge>Off</Badge>}
                    </div>
                    <IconButton icon={Pencil} label={`Edit ${i.label_en}`} onClick={() => setInterestModal({ interest: i })} />
                    <IconButton icon={Trash2} label={`Delete ${i.label_en}`} danger onClick={() => setDeleting({ kind: 'interest', row: i })} />
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHead eyebrow="Routing" title="Keeping the queues moving" />
          <div className="p-4 flex flex-wrap items-end gap-4">
            <TextField label="Stale after (days)" type="number" min="1" max="60" key={staleDays} defaultValue={staleDays}
              onBlur={e => saveStale(e.target.value)} className="w-40" />
            <p className="text-xs flex-1 min-w-[220px]" style={{ color: 'var(--adm-silk-faint)' }}>
              An application nobody has touched for this long, or whose interview passed this long ago without a decision,
              moves to another available reviewer in its team. Set reviewer capacity and away status on the load board.
            </p>
          </div>
        </Panel>
      </div>

      <TeamModal
        open={!!teamModal}
        team={teamModal?.team}
        admins={admins}
        interests={interests}
        initialReviewers={teamModal?.team ? teamReviewers(teamModal.team.id).map(r => r.id) : []}
        initialInterests={teamModal?.team ? teamInterests(teamModal.team.id).map(i => i.id) : []}
        nextOrder={teams.length + 1}
        onClose={() => setTeamModal(null)}
        onSaved={load}
      />
      <InterestModal
        open={!!interestModal}
        interest={interestModal?.interest}
        teams={teams}
        existingKeys={interests.map(i => i.key)}
        initialTeams={interestModal?.interest ? interestTeams(interestModal.interest.id).map(t => t.id) : []}
        nextOrder={interests.length + 1}
        onClose={() => setInterestModal(null)}
        onSaved={load}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title={deleting?.kind === 'team' ? `Delete ${deleting.row.name_en}?` : `Delete ${deleting?.row.label_en}?`}
        message={deleting?.kind === 'team'
          ? 'Its open applications keep their reviewer; unassigned ones move to the general pool. Members are not affected.'
          : 'It disappears from the join form. Applications and members that chose it keep the key; switching it off instead keeps its label readable.'}
      />
    </div>
  )
}

/** Replace a junction table's rows for one owner with the chosen set. */
async function syncLinks(table, ownerColumn, ownerId, otherColumn, ids) {
  const { error } = await supabase.from(table).delete().eq(ownerColumn, ownerId)
  if (error) return { error }
  if (!ids.length) return { error: null }
  return supabase.from(table).insert(ids.map(id => ({ [ownerColumn]: ownerId, [otherColumn]: id })))
}

function toggle(list, id) {
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id]
}

function TeamModal({ open, team, admins, interests, initialReviewers, initialInterests, nextOrder, onClose, onSaved }) {
  const [form, setForm] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) { setForm({}); return }
    setForm({
      name_en: team?.name_en || '', name_ar: team?.name_ar || '', name_fr: team?.name_fr || '',
      description: team?.description || '', color: team?.color || '#2563EB',
      sort_order: team?.sort_order ?? nextOrder,
      reviewers: initialReviewers, interests: initialInterests,
    })
    setError(null)
  }, [open, team]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name_en.trim()) { setError('Name the team.'); return }
    setSaving(true)
    const payload = {
      name_en: form.name_en.trim(), name_ar: form.name_ar.trim() || null, name_fr: form.name_fr.trim() || null,
      description: form.description.trim() || null, color: form.color, sort_order: Number(form.sort_order) || 0,
    }
    const saved = await run(
      team
        ? supabase.from('review_teams').update(payload).eq('id', team.id).select('*').single()
        : supabase.from('review_teams').insert(payload).select('*').single(),
      { failure: 'The team did not save.' }
    )
    if (!saved.ok) { setSaving(false); return }
    const id = saved.data.id
    const r1 = await run(syncLinks('team_reviewers', 'team_id', id, 'admin_user_id', form.reviewers), { failure: 'Reviewers did not save.' })
    const r2 = await run(syncLinks('interest_teams', 'team_id', id, 'interest_id', form.interests), { failure: 'Interests did not save.' })
    setSaving(false)
    if (!r1.ok || !r2.ok) { onSaved(); return }
    toast(`${payload.name_en} saved.`)
    logActivity(team ? 'updated' : 'created', 'review_teams', id, { name: payload.name_en })
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={team ? `Edit ${team.name_en}` : 'Add a team'}
      description="Reviewers interview applicants whose interests point here."
      footer={<>
        <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
        <Button variant="primary" onClick={submit} busy={saving} busyLabel="Saving…">{team ? 'Save team' : 'Add team'}</Button>
      </>}>
      {open && form.reviewers && (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-3 gap-3">
            <TextField label="Name (English)" required value={form.name_en} error={error}
              onChange={e => { set('name_en', e.target.value); setError(null) }} placeholder="Tech" />
            <TextField label="Name (Arabic)" dir="rtl" value={form.name_ar} onChange={e => set('name_ar', e.target.value)} placeholder="التقنية" />
            <TextField label="Name (French)" value={form.name_fr} onChange={e => set('name_fr', e.target.value)} placeholder="Technique" />
          </div>
          <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <TextArea label="Description" rows={1} value={form.description} onChange={e => set('description', e.target.value)} />
            <TextField label="Colour" type="color" value={form.color} onChange={e => set('color', e.target.value)} className="w-24" />
            <TextField label="Order" type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} className="w-24" />
          </div>
          <PickList title="Reviewers" empty="No active admins."
            items={admins.map(a => ({ id: a.id, label: a.full_name || a.email, hint: a.full_name ? a.email : null }))}
            selected={form.reviewers} onToggle={id => set('reviewers', toggle(form.reviewers, id))} />
          <PickList title="Interests routed here" empty="Add interests first."
            items={interests.map(i => ({ id: i.id, label: i.label_en, hint: i.is_active ? null : 'off' }))}
            selected={form.interests} onToggle={id => set('interests', toggle(form.interests, id))} />
        </div>
      )}
    </Modal>
  )
}

const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

function InterestModal({ open, interest, teams, existingKeys, initialTeams, nextOrder, onClose, onSaved }) {
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) { setForm({}); return }
    setForm({
      key: interest?.key || '', label_en: interest?.label_en || '', label_ar: interest?.label_ar || '',
      label_fr: interest?.label_fr || '', is_active: interest?.is_active ?? true,
      sort_order: interest?.sort_order ?? nextOrder, teams: initialTeams, keyTouched: false,
    })
    setErrors({})
  }, [open, interest]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })) }

  const submit = async () => {
    const next = {}
    const key = interest ? interest.key : slug(form.key || form.label_en)
    if (!form.label_en.trim()) next.label_en = 'Give it an English label.'
    if (!interest && !key) next.key = 'Enter a key using letters or numbers.'
    if (!interest && existingKeys.includes(key)) next.key = 'That key is taken.'
    if (Object.keys(next).length) { setErrors(next); return }

    setSaving(true)
    const payload = {
      label_en: form.label_en.trim(), label_ar: form.label_ar.trim() || null, label_fr: form.label_fr.trim() || null,
      is_active: form.is_active, sort_order: Number(form.sort_order) || 0,
    }
    const saved = await run(
      interest
        ? supabase.from('interests').update(payload).eq('id', interest.id).select('*').single()
        : supabase.from('interests').insert({ ...payload, key }).select('*').single(),
      { failure: 'The interest did not save.' }
    )
    if (!saved.ok) { setSaving(false); return }
    const linked = await run(syncLinks('interest_teams', 'interest_id', saved.data.id, 'team_id', form.teams), { failure: 'Its teams did not save.' })
    setSaving(false)
    if (!linked.ok) { onSaved(); return }
    toast(`${payload.label_en} saved.`)
    logActivity(interest ? 'updated' : 'created', 'interests', saved.data.id, { name: payload.label_en })
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={interest ? `Edit ${interest.label_en}` : 'Add an interest'}
      description="Shown on the join form in the visitor’s language."
      footer={<>
        <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
        <Button variant="primary" onClick={submit} busy={saving} busyLabel="Saving…">{interest ? 'Save' : 'Add interest'}</Button>
      </>}>
      {open && form.teams && (
        <div className="space-y-4">
          <TextField label="Label (English)" required value={form.label_en} error={errors.label_en}
            onChange={e => set('label_en', e.target.value)} placeholder="Video editing" />
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField label="Label (Arabic)" dir="rtl" value={form.label_ar} onChange={e => set('label_ar', e.target.value)} placeholder="مونتاج الفيديو" />
            <TextField label="Label (French)" value={form.label_fr} onChange={e => set('label_fr', e.target.value)} placeholder="Montage vidéo" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField label="Key" value={interest ? interest.key : (form.keyTouched ? form.key : slug(form.label_en || ''))}
              disabled={!!interest} error={errors.key}
              onChange={e => setForm(f => ({ ...f, key: e.target.value, keyTouched: true }))}
              hint={interest ? 'Stored on applications, so it cannot change.' : 'Stored on applications. Set once.'} />
            <TextField label="Order" type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} />
          </div>
          <CheckField label="Show on the join form" checked={form.is_active} onChange={v => set('is_active', v)} />
          <PickList title="Routes to" empty="No teams yet."
            hint="None selected sends these applicants to the general pool."
            items={teams.map(t => ({ id: t.id, label: t.name_en, color: t.color }))}
            selected={form.teams} onToggle={id => set('teams', toggle(form.teams, id))} />
        </div>
      )}
    </Modal>
  )
}

function PickList({ title, hint, items, selected, onToggle, empty }) {
  return (
    <fieldset>
      <legend className="adm-label">{title}</legend>
      {hint && <p className="text-xs -mt-1 mb-2" style={{ color: 'var(--adm-silk-faint)' }}>{hint}</p>}
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map(item => {
            const on = selected.includes(item.id)
            return (
              <button key={item.id} type="button" aria-pressed={on} onClick={() => onToggle(item.id)}
                className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[13px] font-medium transition-colors"
                style={{
                  background: on ? 'var(--adm-signal-wash)' : 'var(--adm-board-sunk)',
                  color: on ? 'var(--adm-signal)' : 'var(--adm-silk-dim)',
                  border: `1px solid ${on ? 'var(--adm-signal)' : 'var(--adm-trace)'}`,
                }}>
                {item.color && <span className="rounded-full" style={{ width: 8, height: 8, background: item.color }} aria-hidden="true" />}
                {item.label}
                {item.hint && <span className="text-[11px]" style={{ color: 'var(--adm-silk-faint)' }}>{item.hint}</span>}
              </button>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}
