import { useTranslation } from 'react-i18next'
import SectionHeader from '../shared/SectionHeader'
import StatCard from '../shared/StatCard'
import SideImage from '../shared/SideImage'

export default function StatisticsSection() {
  const { t } = useTranslation('home')

  const stats = ['members', 'projects', 'events', 'workshops']

  return (
    <section className="py-16 md:py-20 relative z-0" style={{ background: '#F1F5F9' }}>
        <SideImage side="left" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title={t('stats.title')}
          subtitle={t('stats.subtitle')}
          center
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <StatCard
              key={s}
              value={t(`stats.${s}.value`)}
              label={t(`stats.${s}.label`)}
              delay={i * 0.1}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
