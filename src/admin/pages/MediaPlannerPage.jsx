import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookMarked, CalendarPlus, Clapperboard, Frame, Plus, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { read, run, logActivity, supabase } from '../lib/db'
import useAdminStore from '../store/adminStore'
import useQueryParam from '../hooks/useQueryParam'
import { PLATFORMS, STAGES, isLate, involves, waitsOn } from '../lib/media'
import PageHeader, { FilterTabs } from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import Button from '../components/ui/Button'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import MediaBoard from '../components/media/MediaBoard'
import MediaCalendar from '../components/media/MediaCalendar'
import MyMediaWork from '../components/media/MyMediaWork'
import PostDrawer from '../components/media/PostDrawer'
import IdeasModal from '../components/media/IdeasModal'
import EventPlanModal from '../components/media/EventPlanModal'
import SnippetsModal from '../components/media/SnippetsModal'

const VIEWS = [
  { value: 'board', label: 'Board' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'mine', label: 'My work' },
]

const POST_SELECT = '*, event:events(id, title_en, title_ar, date, time, location_en, description_en), assets:media_assets(id, kind, url)'

/**
 * The media team's shared plan: every post from the first idea to the live
 * link, who it is waiting on, and when it goes out. The writer, photographer,
 * editor and publisher each work their own column and hand the post on.
 */
export default function MediaPlannerPage() {
  const adminId = useAdminStore(s => s.adminProfile?.id)
  const role = useAdminStore(s => s.adminProfile?.role?.name)
  const canReview = ['owner', 'super_admin', 'media_manager'].includes(role)

  const [posts, setPosts] = useState([])
  const [people, setPeople] = useState([])
  const [events, setEvents] = useState([])
  const [snippets, setSnippets] = useState([])
  const [state, setState] = useState({ loading: true, error: null })

  const [view, setView] = useQueryParam('view', 'board')
  const [platform, setPlatform] = useQueryParam('platform', '')
  const [person, setPerson] = useQueryParam('person', '')
  const [openId, setOpenId] = useQueryParam('post', '')

  const [modal, setModal] = useState(null) // 'ideas' | 'event' | 'snippets'
  const [draft, setDraft] = useState(null) // defaults for a new post opened in the drawer

  const load = useCallback(async () => {
    setState(s => ({ ...s, error: null }))
    const since = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10)
    const [postRes, peopleRes, eventRes, snippetRes] = await Promise.all([
      read(supabase.from('media_posts').select(POST_SELECT).neq('status', 'dropped').order('publish_at', { ascending: true, nullsFirst: false })),
      read(supabase.rpc('media_people')),
      read(supabase.from('events').select('id, title_en, title_ar, date, time, location_en, description_en').gte('date', since).order('date')),
      read(supabase.from('media_snippets').select('*').order('sort_order')),
    ])
    if (!postRes.ok) { setState({ loading: false, error: postRes.message }); return }
    setPosts(postRes.data || [])
    setPeople(peopleRes.data || [])
    setEvents(eventRes.data || [])
    setSnippets(snippetRes.data || [])
    setState({ loading: false, error: null })
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => posts.filter(p =>
    (!platform || (p.platforms || []).includes(platform)) &&
    (!person || involves(p, Number(person)))
  ), [posts, platform, person])

  const mineCount = useMemo(() => posts.filter(p =>
    waitsOn(p, adminId) || (canReview && p.status === 'review')
  ).length, [posts, adminId, canReview])

  const lateCount = posts.filter(p => isLate(p)).length

  const viewOptions = VIEWS.map(v => (v.value === 'mine' ? { ...v, count: mineCount } : v))

  const openPost = post => { setDraft(null); setOpenId(String(post.id)) }
  const newPost = defaults => { setOpenId(''); setDraft({ ...defaults }) }
  const closeDrawer = () => { setOpenId(''); setDraft(null) }

  const openPostRow = openId ? posts.find(p => String(p.id) === openId) : null

  /** Drag on the board, or the stage buttons in the drawer. */
  const moveTo = async (post, status) => {
    if (post.status === status) return
    const patch = { status, updated_at: new Date().toISOString() }
    if (status === 'posted') patch.posted_at = post.posted_at || new Date().toISOString()
    setPosts(list => list.map(p => (p.id === post.id ? { ...p, ...patch } : p)))
    const { ok } = await run(supabase.from('media_posts').update(patch).eq('id', post.id), {
      failure: 'The post did not move.',
    })
    if (!ok) { load(); return }
    logActivity('updated', 'media_posts', post.id, { name: post.title, status })
  }

  const header = (
    <PageHeader
      eyebrow="Publish"
      title="Media planner"
      description="Every post from idea to live link — who it's waiting on and when it goes out."
      actions={
        <>
          <Link to="/admin/media/studio" className="adm-btn"><Frame size={15} /> Frame studio</Link>
          <Button icon={BookMarked} onClick={() => setModal('snippets')}>Library</Button>
          <Button icon={CalendarPlus} onClick={() => setModal('event')}>Plan an event</Button>
          <Button icon={Sparkles} onClick={() => setModal('ideas')}>AI ideas</Button>
          <Button variant="primary" icon={Plus} onClick={() => newPost({ status: 'idea', writer_id: adminId })}>New post</Button>
        </>
      }
    />
  )

  return (
    <div>
      {header}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterTabs options={viewOptions} value={view} onChange={setView} label="Planner view" />
        <select className="adm-input" style={{ width: 'auto', height: 40 }} value={platform}
          onChange={e => setPlatform(e.target.value)} aria-label="Platform filter">
          <option value="">All platforms</option>
          {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select className="adm-input" style={{ width: 'auto', height: 40 }} value={person}
          onChange={e => setPerson(e.target.value)} aria-label="Person filter">
          <option value="">Everyone</option>
          {people.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
        </select>
        {lateCount > 0 && (
          <span className="text-xs font-semibold" style={{ color: 'var(--adm-fault)' }}>
            {lateCount} past their publish time
          </span>
        )}
      </div>

      {state.error ? (
        <Panel><ErrorState message={state.error} onRetry={load} /></Panel>
      ) : !state.loading && posts.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Clapperboard}
            title="The plan is empty"
            description="Start with an idea, let the AI suggest some, or plan the usual run of posts around an event."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button icon={CalendarPlus} onClick={() => setModal('event')}>Plan an event</Button>
                <Button variant="primary" icon={Sparkles} onClick={() => setModal('ideas')}>AI ideas</Button>
              </div>
            }
          />
        </Panel>
      ) : view === 'calendar' ? (
        <MediaCalendar posts={filtered} people={people} onOpen={openPost}
          onNew={date => newPost({ status: 'idea', writer_id: adminId, publish_at: date })} />
      ) : view === 'mine' ? (
        <MyMediaWork posts={posts} adminId={adminId} canReview={canReview} onOpen={openPost} />
      ) : (
        <MediaBoard posts={filtered} people={people} loading={state.loading} onOpen={openPost} onMove={moveTo}
          onNew={status => newPost({ status, writer_id: adminId })} />
      )}

      <PostDrawer
        open={!!openPostRow || !!draft}
        post={openPostRow}
        defaults={draft}
        people={people}
        events={events}
        snippets={snippets}
        canReview={canReview}
        onClose={closeDrawer}
        onSaved={saved => {
          // Keep the drawer on the row while the list reloads, so a new post doesn't blink shut.
          if (saved?.id) {
            setPosts(list => list.some(p => p.id === saved.id)
              ? list.map(p => (p.id === saved.id ? { ...p, ...saved } : p))
              : [...list, { ...saved, assets: [] }])
            setOpenId(String(saved.id))
            setDraft(null)
          }
          load()
        }}
        onMove={async (post, status) => { await moveTo(post, status); load() }}
        onDeleted={() => { closeDrawer(); load() }}
      />

      <IdeasModal open={modal === 'ideas'} events={events} onClose={() => setModal(null)} onAdded={load} />
      <EventPlanModal open={modal === 'event'} events={events} people={people} onClose={() => setModal(null)} onAdded={load} />
      <SnippetsModal open={modal === 'snippets'} snippets={snippets} onClose={() => setModal(null)} onChanged={load} />
    </div>
  )
}
