import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, Calendar, FolderGit2, Image, Mail, UserPlus, ArrowRight, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import useAdminStore from '../store/adminStore'
import StatsCard from '../components/ui/StatsCard'
import Skeleton from '../components/ui/Skeleton'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recentEvents, setRecentEvents] = useState([])
  const [recentMessages, setRecentMessages] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const [
        { count: members },
        { count: pendingRegs },
        { count: upcomingEvents },
        { count: projects },
        { count: images },
        { count: messages },
        { data: events },
        { data: msgs },
      ] = await Promise.all([
        supabase.from('event_registrations').select('*', { count: 'exact', head: true }),
        supabase.from('event_registrations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('events').select('*', { count: 'exact', head: true }).gte('date', new Date().toISOString().split('T')[0]),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('gallery_images').select('*', { count: 'exact', head: true }),
        supabase.from('contact_messages').select('*', { count: 'exact', head: true }).eq('is_read', false),
        supabase.from('events').select('id, title_en, date, registration_open, is_published').order('date', { ascending: true }).limit(5),
        supabase.from('contact_messages').select('id, name, subject, created_at, is_read').order('created_at', { ascending: false }).limit(5),
      ])

      setStats({
        members: members || 0,
        pendingRegistrations: pendingRegs || 0,
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
            <button onClick={() => navigate('/admin/events')} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>
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
            <button onClick={() => navigate('/admin/messages')} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>
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
          <QuickActionBtn icon={Plus} label="New Event" onClick={() => navigate('/admin/events')} />
          <QuickActionBtn icon={Plus} label="New Project" onClick={() => navigate('/admin/projects')} />
          <QuickActionBtn icon={Plus} label="New Album" onClick={() => navigate('/admin/gallery')} />
          <QuickActionBtn icon={Mail} label="View Messages" onClick={() => navigate('/admin/messages')} />
        </div>
      </motion.div>
    </div>
  )
}

function QuickActionBtn({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all hover:opacity-80"
      style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
    >
      <Icon size={16} style={{ color: 'var(--color-accent)' }} />
      {label}
    </button>
  )
}
