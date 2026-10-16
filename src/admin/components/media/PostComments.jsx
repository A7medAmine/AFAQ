import { useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { run, supabase } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import { formatDateTime } from '../../lib/format'
import { IconButton } from '../ui/Button'
import { PersonChip } from './PostCard'

/** The thread on a post. Review notes from "send back" land here too. */
export default function PostComments({ postId, comments, people, onChanged }) {
  const adminId = useAdminStore(s => s.adminProfile?.id)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!body.trim()) return
    setSending(true)
    const { ok } = await run(supabase.from('media_comments').insert({ post_id: postId, author_id: adminId, body: body.trim() }), {
      failure: 'The comment was not posted.',
    })
    setSending(false)
    if (!ok) return
    setBody('')
    onChanged()
  }

  const remove = async id => {
    const { ok } = await run(supabase.from('media_comments').delete().eq('id', id), { failure: 'The comment was not removed.' })
    if (ok) onChanged()
  }

  return (
    <div className="flex flex-col gap-2.5">
      {comments.length === 0 && (
        <p className="text-[12px]" style={{ color: 'var(--adm-silk-faint)' }}>No comments yet. Leave a note for the next person.</p>
      )}
      {comments.map(c => {
        const person = people.find(p => p.id === c.author_id)
        return (
          <div key={c.id} className="flex gap-2">
            <PersonChip person={person || { full_name: '?' }} />
            <div className="flex-1 min-w-0 p-2 rounded-lg" style={{ background: 'var(--adm-board-sunk)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold">{person?.full_name || person?.email || 'Former admin'}</span>
                <span className="flex items-center gap-1">
                  <span className="text-[11px] adm-data" style={{ color: 'var(--adm-silk-faint)' }}>{formatDateTime(c.created_at)}</span>
                  {c.author_id === adminId && (
                    <IconButton icon={Trash2} label="Delete comment" danger size={12} style={{ width: 22, height: 22 }} onClick={() => remove(c.id)} />
                  )}
                </span>
              </div>
              <p className="text-[13px] whitespace-pre-wrap mt-0.5" style={{ color: 'var(--adm-silk)' }}>{c.body}</p>
            </div>
          </div>
        )
      })}
      <div className="flex gap-2 items-end">
        <textarea className="adm-input flex-1" rows={2} value={body} onChange={e => setBody(e.target.value)}
          placeholder="Write a comment…" aria-label="New comment"
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }} />
        <IconButton icon={Send} label="Post comment" onClick={send} disabled={sending || !body.trim()} />
      </div>
    </div>
  )
}
