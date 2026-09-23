import { POSITION_TITLES, roleOptions } from '../../lib/hr'
import { logActivity, run, supabase } from '../../lib/db'
import { SelectField, TextField } from '../ui/Field'

export const NEW_ROLE = '__new'

/**
 * Role picker shared by the member form and the position form: built-in
 * offices, the club's custom roles, and "New role…" to name one on the spot.
 * The typed name is saved as a custom role when the form submits (see saveRole).
 *
 * @param value      selected role value, NEW_ROLE, or '' when `emptyLabel` is set
 * @param newName    text of the "New role…" field
 * @param emptyLabel when set, adds a blank first option (e.g. "No role")
 */
export default function RoleField({
  value, newName, onChange, onNewNameChange, customRoles = [], error, emptyLabel, label = 'Role', required,
}) {
  const options = roleOptions(customRoles)
  // Editing a term whose role was since deleted: keep it selectable.
  const orphan = value && value !== NEW_ROLE && !options.some(o => o.value === value)

  return (
    <>
      <SelectField label={label} required={required} value={value || ''} onChange={e => onChange(e.target.value)}>
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        <optgroup label="Offices">
          {POSITION_TITLES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </optgroup>
        {(options.length > POSITION_TITLES.length || orphan) && (
          <optgroup label="Custom roles">
            {options.slice(POSITION_TITLES.length).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            {orphan && <option value={value}>{value}</option>}
          </optgroup>
        )}
        <option value={NEW_ROLE}>New role…</option>
      </SelectField>
      {value === NEW_ROLE && (
        <TextField label="Role name" required value={newName || ''} error={error} autoFocus
          onChange={e => onNewNameChange(e.target.value)} placeholder="Media officer" />
      )}
    </>
  )
}

/**
 * Resolve the picked role to what member_positions.title stores, creating the
 * custom role first when "New role…" was used. Returns null if nothing usable.
 */
export async function saveRole(value, newName, customRoles = []) {
  if (value !== NEW_ROLE) return value || null
  const name = (newName || '').trim()
  if (!name) return null
  const existing = roleOptions(customRoles).find(o => o.label.toLowerCase() === name.toLowerCase())
  if (existing) return existing.value
  const { ok, data } = await run(
    supabase.from('member_roles').insert({ name }).select('*').single(),
    { failure: 'The new role did not save.' }
  )
  if (!ok) return null
  logActivity('created', 'member_roles', data.id, { name })
  return data.name
}
