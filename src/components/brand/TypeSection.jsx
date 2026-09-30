import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Download as DownloadIcon, Package } from 'lucide-react'
import { FONTS, TYPE_SCALE } from '../../data/brand'
import { Download, useCopy } from './copy'

const byKey = Object.fromEntries(FONTS.map(f => [f.key, f]))

const LATIN_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 !?&@#%'
const ARABIC_SET = 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي ٠١٢٣٤٥٦٧٨٩'

function fontFaceCss(font) {
  return font.weights.map(w => {
    const src = [w.woff2 && `url("${w.woff2}") format("woff2")`, w.ttf && `url("${w.ttf}") format("truetype")`]
      .filter(Boolean).join(',\n       ')
    return `@font-face {\n  font-family: "${font.family}";\n  src: ${src};\n  font-weight: ${w.weight};\n  font-display: swap;\n}`
  }).join('\n') + `\n\n/* usage */\nfont-family: ${font.css};`
}

function FontCard({ font, text, size }) {
  const { t } = useTranslation('brand')
  const copy = useCopy()
  const showArabic = font.script === 'ar'
  const sample = text || (showArabic ? t('type.sampleArabic') : t('type.sampleLatin'))
  const dir = /[؀-ۿ]/.test(sample) ? 'rtl' : 'ltr'

  return (
    <article className="bk-card overflow-hidden">
      <header className="p-6 md:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6" style={{ background: 'var(--color-bg-alt)' }}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--bk-blue)', color: '#fff' }}>{t(`type.roles.${font.key}`)}</span>
            <span className="text-xs bk-muted">{font.weights.length} {font.weights.length > 1 ? 'weights' : 'weight'} · {showArabic ? 'Arabic + Latin' : 'Latin'}</span>
          </div>
          <div className={`${font.cls} text-4xl md:text-5xl leading-tight`} style={{ fontWeight: font.weights.at(-1).weight }}>{font.family}</div>
        </div>
        <div className={`${font.cls} text-7xl md:text-8xl leading-none shrink-0`} aria-hidden="true" style={{ color: 'var(--bk-blue)' }}>
          Aa{showArabic && <span className="ms-3">أب</span>}
        </div>
      </header>

      <div className="px-6 md:px-8 py-4 flex flex-wrap gap-2 items-center" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
        <Download href={font.zip} className="bk-btn bk-btn-primary"><Package size={14} />{t('type.downloadFamily')}</Download>
        <button type="button" className="bk-btn" onClick={() => copy(fontFaceCss(font))}><Copy size={14} />{t('type.copyCss')}</button>
        <button type="button" className="bk-btn" onClick={() => copy(`font-family: ${font.css};`)}>
          <span className="bk-mono text-xs" dir="ltr">font-family</span>
        </button>
      </div>

      <div>
        {font.weights.map(w => (
          <div key={w.name} className="bk-weight-row px-6 md:px-8 py-5 grid md:grid-cols-[140px_1fr_auto] gap-3 md:gap-6 items-center">
            <div className="text-sm">
              <div className="font-medium">{w.name}</div>
              <div className="bk-muted bk-mono text-xs">{w.weight}</div>
            </div>
            <div className={`${font.cls} bk-specimen`} dir={dir} style={{ fontWeight: w.weight, fontSize: size }}>{sample}</div>
            <div className="flex gap-2">
              {w.woff2 && <Download href={w.woff2}><DownloadIcon size={13} />WOFF2</Download>}
              {w.ttf && <Download href={w.ttf}><DownloadIcon size={13} />TTF</Download>}
            </div>
          </div>
        ))}
      </div>

      <div className="bk-weight-row px-6 md:px-8 py-5 flex flex-col gap-2">
        <div className={`${font.cls} text-lg bk-muted`} dir="ltr" style={{ overflowWrap: 'anywhere' }}>{LATIN_SET}</div>
        {showArabic && <div className={`${font.cls} text-lg bk-muted`} dir="rtl">{ARABIC_SET}</div>}
      </div>
    </article>
  )
}

function TypeScale() {
  const { t } = useTranslation('brand')
  const copy = useCopy()

  return (
    <div className="bk-card overflow-hidden">
      <div className="p-6 md:p-8">
        <h3 className="bk-title text-lg mb-1">{t('type.scale')}</h3>
        <p className="text-sm bk-muted">{t('type.scaleHint')}</p>
      </div>
      {TYPE_SCALE.map(s => {
        const latin = byKey[s.latin]
        const ar = byKey[s.ar]
        const css = `/* ${s.key} */\nfont-size: ${s.size}px;\nline-height: ${s.line};\nfont-weight: ${s.weight};\n/* Latin */ font-family: ${latin.css};\n/* Arabic */ font-family: ${ar.css};`
        const shown = Math.min(s.size, 56)
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => copy(css)}
            className="bk-scale-row bk-weight-row w-full text-start px-6 md:px-8 py-5 grid md:grid-cols-[170px_1fr_1fr] gap-3 md:gap-8 items-center"
          >
            <div className="text-sm">
              <div className="font-medium">{t(`type.scaleNames.${s.key}`)}</div>
              <div className="bk-muted bk-mono text-xs" dir="ltr">{s.size}px / {s.line} · {latin.family.split(' ')[0]} · {ar.family.replace('Thmanyah ', 'Th. ')}</div>
            </div>
            <div className={`${latin.cls} truncate`} dir="ltr" style={{ fontSize: shown, lineHeight: s.line, fontWeight: s.weight }}>
              {t('type.sampleLatin')}
            </div>
            <div className={`${ar.cls} truncate`} dir="rtl" style={{ fontSize: shown, lineHeight: s.line, fontWeight: s.weight }}>
              {t('type.sampleArabic')}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default function TypeSection() {
  const { t } = useTranslation('brand')
  const [text, setText] = useState('')
  const [size, setSize] = useState(36)

  return (
    <div className="flex flex-col gap-8">
      <div className="bk-card p-4 md:p-5 grid md:grid-cols-[1fr_260px] gap-4 items-center" style={{ position: 'sticky', top: 'calc(var(--nav-h) + 56px)', zIndex: 20 }}>
        <input
          className="bk-input"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('type.previewPlaceholder')}
          aria-label={t('type.preview')}
        />
        <label className="flex items-center gap-3 text-sm">
          <span className="bk-muted">{t('type.sizeLabel')}</span>
          <input type="range" min={14} max={96} value={size} onChange={e => setSize(+e.target.value)} className="bk-range flex-1" />
          <span className="bk-mono w-12 text-end">{size}px</span>
        </label>
      </div>

      {FONTS.map(f => <FontCard key={f.key} font={f} text={text} size={size} />)}

      <TypeScale />

      <p className="text-xs bk-muted">{t('type.license')}</p>
    </div>
  )
}
