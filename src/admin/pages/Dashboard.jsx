import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, Calendar, FolderGit2, Image, Mail, UserPlus, UserCheck, ArrowRight, Plus, UserRoundPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import useAdminStore from '../store/adminStore'
import StatsCard from '../components/ui/StatsCard'
import Skeleton from '../components/ui/Skeleton'
import Modal from '../components/ui/Modal'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recentEvents, setRecentEvents] = useState([])
  const [recentMessages, setRecentMessages] = useState([])
  const [memberModal, setMemberModal] = useState(false)
  const [memberForm, setMemberForm] = useState({ full_name: '', email: '', phone: '', department: '' })
  const [addingMember, setAddingMember] = useState(false)
  const navigate = useNavigate()
  const addToast = useAdminStore(s => s.addToast)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const [
        { count: members },
        { count: pendingRegs },
        { count: membershipApps },
        { count: pendingMembership },
        { count: upcomingEvents },
        { count: projects },
        { count: images },
        { count: messages },
        { data: events },
        { data: msgs },
      ] = await Promise.all([
        supabase.from('event_registrations').select('*', { count: 'exact', head: true }),
        supabase.from('event_registrations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('membership_applications').select('*', { count: 'exact', head: true }),
        supabase.from('membership_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('events').select('*', { count: 'exact', head: true }).gte('date', new Date().toISOString().split('T')[0]),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('gallery_images').select('*', { count: 'exact', head: true }),
        supabase.from('contact_messages').select('*', { count: 'exact', head: true }).eq('is_read', false),
        supabase.from('events').select('id, title_en, date, registration_open, is_published').order('date', { ascending: true }).limit(5),
        supabase.from('contact_messages').select('id, name, subject, created_at, is_read').order('created_at', { ascending: false }).limit(5),
      ])

      setStats({
        members: (members || 0) + (membershipApps || 0),
        pendingRegistrations: pendingRegs || 0,
        membershipApplications: membershipApps || 0,
        pendingMembership: pendingMembership || 0,
        upcomingEvents: upcomingEvents || 0,
        projects: projects || 0,
        galleryImages: images || 0,
        unreadMessages: messages || 0,
      })
      setRecentEvents(events || [])
      setRecentMessages(msgs || [])
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const addMember = async () => {
    if (!memberForm.full_name.trim() || !memberForm.email.trim()) return
    setAddingMember(true)
    const { error } = await supabase.from('membership_applications').insert({
      full_name: memberForm.full_name,
      email: memberForm.email,
      phone: memberForm.phone || null,
      department: memberForm.department || null,
      status: 'approved',
    })
    if (error) {
      addToast('Failed to add member', 'error')
    } else {
      addToast('Member added successfully')
      setMemberModal(false)
      setMemberForm({ full_name: '', email: '', phone: '', department: '' })
      loadStats()
    }
    setAddingMember(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 120 }} />
          ))}
        </div>
      </div>
    )
  }

  const statCards = [
    { icon: Users, label: 'Total Members', value: stats?.members || 0, color: '#2460e7' },
    { icon: UserPlus, label: 'Pending Registrations', value: stats?.pendingRegistrations || 0, color: '#d97706' },
    { icon: UserCheck, label: 'Membership Apps', value: stats?.membershipApplications || 0, color: '#0891b2' },
    { icon: Calendar, label: 'Upcoming Events', value: stats?.upcomingEvents || 0, color: '#16a34a' },
    { icon: FolderGit2, label: 'Projects', value: stats?.projects || 0, color: '#8b5cf6' },
    { icon: Image, label: 'Gallery Images', value: stats?.galleryImages || 0, color: '#ec4899' },
    { icon: Mail, label: 'Unread Messages', value: stats?.unreadMessages || 0, color: '#dc2626' },
  ]

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((s, i) => (
          <StatsCard key={i} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Events */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-5"
          style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Upcoming Events</h2>
            <button onClick={() => navigate('/admin/events')} className="text-xs font-medium flex items-center gap-1 transition-all hover:gap-1.5 admin-icon-btn px-2 py-1 -mr-2 rounded-lg" style={{ color: 'var(--color-accent)' }}>
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {recentEvents.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No upcoming events</p>
            ) : (
              recentEvents.map(ev => (
                <div key={ev.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--color-border-light)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{ev.title_en}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{ev.date}</p>
                  </div>
                  <div className="flex gap-2">
                    {ev.registration_open && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#16a34a20', color: '#16a34a' }}>Open</span>}
                    {!ev.is_published && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#d9770620', color: '#d97706' }}>Draft</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Recent Messages */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border p-5"
          style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Recent Messages</h2>
            <button onClick={() => navigate('/admin/messages')} className="text-xs font-medium flex items-center gap-1 transition-all hover:gap-1.5 admin-icon-btn px-2 py-1 -mr-2 rounded-lg" style={{ color: 'var(--color-accent)' }}>
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {recentMessages.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No messages yet</p>
            ) : (
              recentMessages.map(msg => (
                <div key={msg.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--color-border-light)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{msg.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{msg.subject}</p>
                  </div>
                  {!msg.is_read && (
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent)' }} />
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border p-5"
        style={{ background: 'var(--color-card)', borderColor: 'var(--color-border-light)' }}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <QuickActionBtn icon={UserRoundPlus} label="Add Member" onClick={() => setMemberModal(true)} />
          <QuickActionBtn icon={Plus} label="New Event" onClick={() => navigate('/admin/events')} />
          <QuickActionBtn icon={Plus} label="New Project" onClick={() => navigate('/admin/projects')} />
          <QuickActionBtn icon={Plus} label="New Album" onClick={() => navigate('/admin/gallery')} />
          <QuickActionBtn icon={Mail} label="View Messages" onClick={() => navigate('/admin/messages')} />
        </div>
      </motion.div>

      {/* Add Member Modal */}
      <Modal open={memberModal} onClose={() => setMemberModal(false)} title="Add Member">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Full Name *</label>
            <input value={memberForm.full_name} onChange={e => setMemberForm({...memberForm, full_name: e.target.value})}
              className="w-full px-3 py-2 rounded-xl border text-sm"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
              placeholder="Ahmed Mansouri" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Email *</label>
            <input type="email" value={memberForm.email} onChange={e => setMemberForm({...memberForm, email: e.target.value})}
              className="w-full px-3 py-2 rounded-xl border text-sm"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
              placeholder="ahmed@univ-bouira.dz" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Phone</label>
            <input value={memberForm.phone} onChange={e => setMemberForm({...memberForm, phone: e.target.value})}
              className="w-full px-3 py-2 rounded-xl border text-sm"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
              placeholder="+213 6XX XXX XXX" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Department</label>
            <input value={memberForm.department} onChange={e => setMemberForm({...memberForm, department: e.target.value})}
              className="w-full px-3 py-2 rounded-xl border text-sm"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
              placeholder="Computer Science" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
            <button onClick={() => setMemberModal(false)} className="admin-btn px-4 py-2 rounded-xl text-sm font-medium border transition-all hover:-translate-y-0.5"
              style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}>Cancel</button>
            <button onClick={addMember} disabled={addingMember}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:brightness-110 hover:-translate-y-0.5 active:brightness-95 disabled:brightness-75 disabled:hover:-translate-y-0"
              style={{ background: addingMember ? 'var(--color-accent-dark)' : 'var(--color-accent)' }}>
              {addingMember ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function QuickActionBtn({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="admin-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
      style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
    >
      <Icon size={16} style={{ color: 'var(--color-accent)' }} />
      {label}
    </button>
  )
}
