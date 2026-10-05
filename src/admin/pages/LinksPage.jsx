import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Download, ExternalLink, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import QRCode from 'qrcode'
import useAdminStore from '../store/adminStore'
import { logActivity, read, run, supabase } from '../lib/db'
import { LINKS_PATH, LINKS_URL, PLATFORMS, PlatformIcon, normalizeLinkUrl } from '../../lib/socialLinks'
import PageHeader from '../components/ui/PageHeader'
import Panel, { PanelHead } from '../components/ui/Panel'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Button, { IconButton } from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { SkeletonPanel } from '../components/ui/Skeleton'
import { CheckField, SelectField, TextField } from '../components/ui/Field'
import { QrCode } from '../components/print/Codes'

/**
 * The public /links page — the club's link-in-bio, and where poster QR codes
 * point. Order here is the order on the page; hidden links stay saved but
 * don't show.
 */
export default function LinksPage() {
  const toast = useAdminStore(s => s.addToast)
  const [links, setLinks] = useState([])
  const [state, setState] = useState({ loading: true, error: null })
  const [editing, setEditing] = useState(null) // a link, or {} for a new one
  const [remove, setRemove] = useState(null)
  const [moving, setMoving] = useState(false)

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const res = await read(supabase.from('social_links').select('*').order('sort_order').order('id'))
    if (!res.ok) { setState({ loading: false, error: res.message }); return }
    setLinks(res.data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  /** Swap with a neighbour, then write back every position that changed. */
  const move = async (index, delta) => {
    const target = index + delta
    if (moving || target < 0 || target >= links.length) return
    const next = [...links]
    ;[next[index], next[target]] = [next[target], next[index]]
    const changed = next
      .map((link, i) => ({ link, order: i + 1 }))
      .filter(({ link, order }) => link.sort_order !== order)
    setLinks(next.map((link, i) => ({ ...link, sort_order: i + 1 })))
    setMoving(true)
    const results = await Promise.all(changed.map(({ link, order }) =>
      run(supabase.from('social_links').update({ sort_order: order }).eq('id', link.id), { failure: 'The new order was not saved.' })
    ))
    setMoving(false)
    if (results.some(r => !r.ok)) load()
  }

  const toggle = async link => {
    const isActive = !link.is_active
    setLinks(ls => ls.map(l => (l.id === link.id ? { ...l, is_active: isActive } : l)))
    const { ok } = await run(
      supabase.from('social_links').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', link.id),
      { success: isActive ? `${link.label} is on the page.` : `${link.label} is hidden.`, failure: 'The link was not changed.' }
    )
    if (ok) logActivity(isActive ? 'shown' : 'hidden', 'social_links', link.id, { label: link.label })
    else load()
  }

  const destroy = async link => {
    const { ok } = await run(
      supabase.from('social_links').delete().eq('id', link.id),
      { success: `${link.label} deleted.`, failure: 'The link was not deleted.' }
    )
    if (ok) { logActivity('deleted', 'social_links', link.id, { label: link.label }); setRemove(null); setEditing(null); load() }
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(LINKS_URL)
      toast('Link copied.')
    } catch {
      toast('Copy failed. Select the address and copy it by hand.', 'error')
    }
  }

  const downloadQr = async format => {
    const opts = { errorCorrectionLevel: 'M', margin: 2, color: { dark: '#050A30', light: '#FFFFFF' } }
    const href = format === 'svg'
      ? URL.createObjectURL(new Blob([await QRCode.toString(LINKS_URL, { ...opts, type: 'svg' })], { type: 'image/svg+xml' }))
      : await QRCode.toDataURL(LINKS_URL, { ...opts, width: 1200 })
    const a = document.createElement('a')
    a.href = href
    a.download = `afaq-links-qr.${format}`
    a.click()
    if (format === 'svg') setTimeout(() => URL.revokeObjectURL(href), 1000)
  }

  const shown = links.filter(l => l.is_active).length

  return (
    <div>
      <PageHeader
        eyebrow="Publish"
        title="Links page"
        description="The club's link-in-bio at /links. Poster QR codes point here, so changes show up without reprinting anything."
        actions={
          <>
            <a className="adm-btn" href={LINKS_PATH} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Open page</a>
            <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add link</Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        <Panel>
          <PanelHead
            eyebrow="Links"
            title={state.loading ? 'Loading…' : `${shown} shown · ${links.length - shown} hidden`}
            description="Top to bottom, as visitors see them. Use the arrows to reorder."
          />
          {state.error ? (
            <ErrorState message={state.error} onRetry={load} />
          ) : state.loading ? (
            <SkeletonPanel rows={4} />
          ) : links.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="No links yet"
              description="Add the club's accounts — Instagram, Facebook, a sign-up form — and they appear on /links."
              action={<Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add link</Button>}
            />
          ) : (
            <ul>
              {links.map((link, i) => (
                <li
                  key={link.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: i ? '1px solid var(--adm-trace)' : undefined, opacity: link.is_active ? 1 : 0.6 }}
                >
                  <div className="flex flex-col">
                    <IconButton icon={ArrowUp} size={14} label={`Move ${link.label} up`} disabled={i === 0 || moving} onClick={() => move(i, -1)} />
                    <IconButton icon={ArrowDown} size={14} label={`Move ${link.label} down`} disabled={i === links.length - 1 || moving} onClick={() => move(i, 1)} />
                  </div>
                  <span
                    className="grid place-items-center shrink-0"
                    style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--adm-signal-wash)', color: 'var(--adm-signal)' }}
                  >
                    <PlatformIcon platform={link.platform} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold adm-truncate">{link.label}</span>
                      {!link.is_active && <Badge>Hidden</Badge>}
                    </span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="adm-data block text-[12px] adm-truncate"
                      style={{ color: 'var(--adm-silk-faint)', maxWidth: 420 }}
                    >
                      {link.url}
                    </a>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => toggle(link)}>{link.is_active ? 'Hide' : 'Show'}</Button>
                  <IconButton icon={Pencil} label={`Edit ${link.label}`} onClick={() => setEditing(link)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHead eyebrow="QR code" title="Put this on posters" description="It always opens the current list." />
          <div className="p-4 flex flex-col items-center gap-3">
            <div style={{ background: '#fff', padding: 10, borderRadius: 8 }}>
              <QrCode value={LINKS_URL} size={44} color="#050A30" />
            </div>
            <p className="adm-data text-[12px] text-center break-all" style={{ color: 'var(--adm-silk-dim)' }}>{LINKS_URL}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" icon={Copy} onClick={copyUrl}>Copy link</Button>
              <Button size="sm" icon={Download} onClick={() => downloadQr('svg')}>SVG</Button>
              <Button size="sm" icon={Download} onClick={() => downloadQr('png')}>PNG</Button>
            </div>
            <p className="text-[11.5px] text-center" style={{ color: 'var(--adm-silk-faint)' }}>
              SVG for print — it stays sharp at any size.
            </p>
          </div>
        </Panel>
      </div>

      <EditLink
        link={editing}
        nextOrder={links.reduce((max, l) => Math.max(max, l.sort_order || 0), 0) + 1}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load() }}
        onDelete={() => setRemove(editing)}
      />

      <ConfirmDialog
        open={!!remove}
        onClose={() => setRemove(null)}
        onConfirm={() => destroy(remove)}
        title="Delete this link?"
        message={remove ? `${remove.label} leaves the links page. To take it off for a while, hide it instead.` : ''}
      />
    </div>
  )
}

const EMPTY = { platform: 'instagram', label: 'Instagram', url: '', isActive: true }

function EditLink({ link, nextOrder, onClose, onSaved, onDelete }) {
  const isNew = link && !link.id
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!link) return
    setForm(link.id
      ? { platform: link.platform, label: link.label, url: link.url, isActive: link.is_active }
      : EMPTY)
    setErrors({})
  }, [link])

  // Picking a platform fills the label while it still holds a platform's name.
  const pickPlatform = platform => setForm(f => {
    const auto = !f.label.trim() || PLATFORMS.some(p => p.label === f.label)
    const name = PLATFORMS.find(p => p.value === platform)?.label
    return { ...f, platform, label: auto && platform !== 'other' ? name : f.label }
  })

  const save = async () => {
    const url = normalizeLinkUrl(form.url, form.platform)
    const next = {}
    if (!form.label.trim()) next.label = 'Enter the text visitors see.'
    if (!url) next.url = 'Enter the address.'
    else if (/^https?:/i.test(url)) {
      try { new URL(url) } catch { next.url = 'That does not look like a web address.' }
    }
    setErrors(next)
    if (Object.keys(next).length) return

    const row = {
      platform: form.platform,
      label: form.label.trim(),
      url,
      is_active: form.isActive,
      updated_at: new Date().toISOString(),
    }
    setSaving(true)
    const { ok, data } = await run(
      isNew
        ? supabase.from('social_links').insert({ ...row, sort_order: nextOrder }).select().single()
        : supabase.from('social_links').update(row).eq('id', link.id).select().single(),
      { success: isNew ? `${row.label} added.` : `${row.label} saved.`, failure: 'The link was not saved.' }
    )
    setSaving(false)
    if (!ok) return
    logActivity(isNew ? 'created' : 'updated', 'social_links', data?.id ?? link.id, { label: row.label })
    onSaved()
  }

  return (
    <Modal
      open={!!link}
      onClose={onClose}
      size="sm"
      title={isNew ? 'Add link' : link?.label || ''}
      description={isNew ? 'It goes to the bottom of the list.' : undefined}
      footer={
        <>
          {!isNew && <Button className="mr-auto" icon={Trash2} onClick={onDelete}>Delete</Button>}
          <Button onClick={onClose} data-dialog-dismiss="true">Cancel</Button>
          <Button variant="primary" onClick={save} busy={saving} busyLabel="Saving…">{isNew ? 'Add link' : 'Save'}</Button>
        </>
      }
    >
      <div className="space-y-4" onKeyDown={e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save() } }}>
        <SelectField label="Platform" value={form.platform} onChange={e => pickPlatform(e.target.value)}>
          {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </SelectField>
        <TextField
          label="Text on the button"
          required
          value={form.label}
          error={errors.label}
          placeholder="Instagram, Join the club, Open Week program…"
          onChange={e => { setForm(f => ({ ...f, label: e.target.value })); setErrors(x => ({ ...x, label: null })) }}
        />
        <TextField
          label="Address"
          required
          value={form.url}
          error={errors.url}
          hint="A web address, an email or a phone number."
          placeholder="instagram.com/afaq_scientific_club"
          onChange={e => { setForm(f => ({ ...f, url: e.target.value })); setErrors(x => ({ ...x, url: null })) }}
        />
        <CheckField
          label="Show on the links page"
          description="Hidden links stay saved here."
          checked={form.isActive}
          onChange={isActive => setForm(f => ({ ...f, isActive }))}
        />
      </div>
    </Modal>
  )
}
