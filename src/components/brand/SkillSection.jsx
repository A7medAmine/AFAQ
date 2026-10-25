import { useTranslation } from 'react-i18next'
import { Copy, FileText, Package } from 'lucide-react'
import { FONTS_CSS_URL, SKILL_MD, SKILL_ZIP } from '../../data/brand'
import { Download, useCopy } from './copy'

const LINK_TAG = `<link rel="stylesheet" href="${FONTS_CSS_URL}">`

export default function SkillSection() {
  const { t } = useTranslation('brand')
  const copy = useCopy()
  const inside = t('skill.insideItems', { returnObjects: true })
  const steps = t('skill.steps', { returnObjects: true })

  return (
    <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
      <div className="flex flex-col gap-6">
        <div className="bk-card p-6 md:p-8">
          <div className="flex flex-wrap gap-3 mb-8">
            <Download href={SKILL_ZIP} className="bk-btn bk-btn-primary bk-btn-lg"><Package size={18} />{t('skill.download')}</Download>
            <a href={SKILL_MD} target="_blank" rel="noreferrer" className="bk-btn bk-btn-lg"><FileText size={18} />{t('skill.view')}</a>
          </div>
          <h3 className="bk-title text-lg mb-4">{t('skill.inside')}</h3>
          <ul className="flex flex-col gap-3">
            {Array.isArray(inside) && inside.map((it, i) => (
              <li key={i} className="flex gap-3 text-sm bk-muted leading-relaxed">
                <i className="w-2 h-2 mt-2 shrink-0 block" style={{ background: 'var(--bk-blue)' }} />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bk-card p-6 md:p-8">
          <h3 className="bk-title text-lg mb-1">{t('skill.fontsTitle')}</h3>
          <p className="text-sm bk-muted mb-4">{t('skill.fontsHint')}</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <code className="bk-mono text-xs p-3 rounded-lg flex-1 min-w-0" dir="ltr" style={{ background: 'var(--color-bg-alt)', overflowWrap: 'anywhere' }}>{LINK_TAG}</code>
            <button type="button" className="bk-btn" onClick={() => copy(LINK_TAG)}><Copy size={14} />{t('skill.copyLink')}</button>
          </div>
        </div>
      </div>

      <div className="bk-card p-6 md:p-8">
        <h3 className="bk-title text-lg mb-6">{t('skill.install')}</h3>
        <ol className="flex flex-col gap-6">
          {Array.isArray(steps) && steps.map((s, i) => (
            <li key={i} className="flex gap-4">
              <span className="bk-f-mine text-sm w-8 h-8 shrink-0 grid place-items-center" style={{ background: 'var(--bk-blue)', color: '#fff' }} dir="ltr">{i + 1}</span>
              <div>
                <div className="font-medium mb-1">{s.t}</div>
                <p className="text-sm bk-muted leading-relaxed">{s.d}</p>
                {s.c && <code className="bk-mono text-xs mt-2 inline-block px-2 py-1 rounded-md" dir="ltr" style={{ background: 'var(--color-bg-alt)' }}>{s.c}</code>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
