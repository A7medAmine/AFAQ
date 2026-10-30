import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDay, portalRpc } from '../lib/portal'

const STATUS_TONE = { todo: 'plain', in_progress: 'warn', done: 'good', cancelled: 'plain' }

export default function PortalTasks() {
  const { t, i18n } = useTranslation('portal')
  const [tasks, setTasks] = useState(null)

  useEffect(() => { portalRpc('portal_tasks').then(({ data }) => setTasks(data || [])) }, [])

  if (!tasks) return <p className="text-sm portal-muted">{t('loading')}</p>
  if (!tasks.length) return <div className="portal-card"><p className="text-sm portal-muted">{t('tasks.empty')}</p></div>

  const today = new Date().toISOString().slice(0, 10)

  return (
    <section className="portal-card">
      <p className="text-sm portal-muted mb-3">{t('tasks.note')}</p>
      <ul className="portal-list">
        {tasks.map(task => {
          const late = task.due_date && task.due_date < today && !['done', 'cancelled'].includes(task.status)
          return (
            <li key={task.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className={`font-semibold ${task.status === 'done' ? 'line-through portal-muted' : ''}`}>{task.title}</p>
                <span className={`portal-badge ${STATUS_TONE[task.status] || 'plain'}`}>{t(`tasks.status.${task.status}`, { defaultValue: task.status })}</span>
                {task.priority === 'high' && <span className="portal-badge bad">{t('tasks.high')}</span>}
              </div>
              {task.description && <p className="text-sm portal-muted mt-1 whitespace-pre-line">{task.description}</p>}
              <p className="text-xs portal-muted mt-1">
                {task.project_title && <>{task.project_title} · </>}
                {task.due_date && <span style={late ? { color: '#dc2626', fontWeight: 600 } : undefined}>{t('tasks.due', { date: formatDay(task.due_date, i18n.language) })}</span>}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
