import { useTranslation } from 'react-i18next'
import { Copy, Download as DownloadIcon } from 'lucide-react'
import { COLORS, PALETTE_FILES, contrast, formats, readableOn, tintScale } from '../../data/brand'
import { Download, useCopy } from './copy'

function ColorCard({ color }) {
  const { t } = useTranslation('brand')
  const copy = useCopy()
  const fmts = formats(color.hex)
  const fg = readableOn(color.hex)

  return (
    <div className="bk-card overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={() => copy(color.hex, color.hex)}
        className="text-start p-5 h-36 flex flex-col justify-between cursor-pointer"
        style={{ background: color.hex, color: fg, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,.06)' }}
        title={t('colors.clickToCopy')}
      >
        <span className="text-xs uppercase tracking-widest opacity-75">{t(`colors.roles.${color.role}`)}</span>
        <span>
          <span className="block text-xl font-bold">{t(`colors.names.${color.key}`)}</span>
          <span className="bk-mono text-sm opacity-80">{color.hex}</span>
        </span>
      </button>
      <div className="p-3 flex flex-col gap-3 flex-1">
        <p className="text-sm bk-muted px-2 pt-1">{t(`colors.uses.${color.key}`)}</p>
        <div className="flex flex-col">
          {Object.entries(fmts).map(([k, v]) => (
            <button key={k} type="button" className="bk-format" onClick={() => copy(v, color.hex)}>
              <span className="text-xs bk-muted w-12 text-start">{k}</span>
              <span className="bk-mono flex-1 text-start whitespace-nowrap overflow-hidden text-ellipsis" dir="ltr">{v}</span>
              <Copy size={13} className="bk-muted" />
            </button>
          ))}
        </div>
        <div className="mt-auto px-1 pb-1">
          <div className="text-xs bk-muted mb-2">{t('colors.tints')}</div>
          <div className="bk-tints" dir="ltr">
            {tintScale(color.hex).map(s => (
              <button
                key={s.step}
                type="button"
                title={s.hex}
                data-base={s.step === 0}
                onClick={() => copy(s.hex, s.hex)}
                style={{ background: s.hex, color: readableOn(s.hex) }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const TEXT_COLORS = ['#FFFFFF', '#050A30', '#233DFF', '#5CBCF9']

function Pairings() {
  const { t } = useTranslation('brand')
  const copy = useCopy()
  // Every palette background with each text colour that passes AA-large (3:1).
  const pairs = COLORS.flatMap(bg =>
    TEXT_COLORS.filter(fg => fg !== bg.hex).map(fg => ({ bg: bg.hex, fg, ratio: contrast(bg.hex, fg) }))
  ).filter(p => p.ratio >= 3).sort((a, b) => b.ratio - a.ratio)

  return (
    <div>
      <h3 className="bk-title text-lg mb-1">{t('colors.pairings')}</h3>
      <p className="text-sm bk-muted mb-5">{t('colors.pairingsHint')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {pairs.map(p => {
          const level = p.ratio >= 7 ? 'AAA' : p.ratio >= 4.5 ? 'AA' : 'AA Large'
          return (
            <button
              key={p.bg + p.fg}
              type="button"
              onClick={() => copy(`color: ${p.fg}; background: ${p.bg};`, p.bg)}
              className="rounded-xl p-4 text-start cursor-pointer transition-transform hover:-translate-y-0.5"
              style={{ background: p.bg, color: p.fg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)' }}
            >
              <div className="bk-title text-2xl mb-3">Aa آفاق</div>
              <div className="flex items-center justify-between text-xs bk-mono" dir="ltr">
                <span>{p.ratio.toFixed(2)}:1</span>
                <span className="px-1.5 py-0.5 rounded" style={{ border: `1px solid ${p.fg}` }}>{level}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ColorSection() {
  const { t } = useTranslation('brand')
  const copy = useCopy()

  return (
    <div className="flex flex-col gap-12">
      {/* Full strip, the way the palette was designed. */}
      <div className="bk-strip" dir="ltr">
        {COLORS.map(c => (
          <button key={c.key} type="button" onClick={() => copy(c.hex, c.hex)} style={{ background: c.hex, color: readableOn(c.hex) }}>
            <span className="bk-strip-hint">{t('colors.clickToCopy')}</span>
            <span className="bk-title text-lg md:text-xl">{c.hex.slice(1)}</span>
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {COLORS.map(c => <ColorCard key={c.key} color={c} />)}
        <div className="bk-card p-5 flex flex-col gap-3" style={{ background: 'var(--bk-midnight)', color: '#fff', borderColor: 'transparent' }}>
          <h3 className="bk-title text-lg">{t('colors.files')}</h3>
          <div className="flex flex-col gap-2 mt-1">
            {PALETTE_FILES.map(f => (
              <Download key={f.file} href={f.file} className="bk-btn" style={{ justifyContent: 'space-between', background: 'rgba(255,255,255,.06)', borderColor: 'rgba(255,255,255,.14)', color: '#fff' }}>
                <span>{f.label}</span><DownloadIcon size={14} />
              </Download>
            ))}
          </div>
          <button
            type="button"
            className="bk-btn mt-auto"
            style={{ background: 'var(--bk-blue)', borderColor: 'var(--bk-blue)', color: '#fff' }}
            onClick={() => copy(COLORS.map(c => c.hex).join(', '))}
          >
            <Copy size={14} /> HEX ×7
          </button>
        </div>
      </div>

      <Pairings />
    </div>
  )
}
