import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  Bold, ChevronDown, Code, Columns2, Eye, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListChecks,
  ListOrdered, Loader2, MessageSquareQuote, Minus, MonitorPlay, PenLine, SquareCode, Table, TriangleAlert,
} from 'lucide-react'

const Markdown = lazy(() => import('../../../components/markdown/Markdown'))

const CODE_LANGS = [
  { value: 'cpp', label: 'Arduino / C++' },
  { value: 'python', label: 'Python' },
  { value: 'bash', label: 'Terminal' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'c', label: 'C' },
  { value: '', label: 'Plain text' },
]

const CALLOUTS = [
  { value: 'NOTE', label: 'Note' },
  { value: 'TIP', label: 'Tip' },
  { value: 'IMPORTANT', label: 'Important' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'CAUTION', label: 'Caution' },
]

const LIST_MARK = /^(\s*)(- \[[ xX]\] |[-*+] |(\d+)\. )/

/**
 * Replaces [start, end) with `text` through the browser's own editing, so
 * Ctrl+Z still undoes toolbar actions. Falls back to setRangeText.
 */
function replaceRange(ta, start, end, text, selStart, selEnd) {
  ta.focus()
  ta.setSelectionRange(start, end)
  let done = false
  try { done = document.execCommand('insertText', false, text) } catch { done = false }
  if (!done) {
    ta.setRangeText(text, start, end, 'end')
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const a = selStart ?? start + text.length
  ta.setSelectionRange(a, selEnd ?? a)
}

const lineStart = (v, i) => v.lastIndexOf('\n', i - 1) + 1
const lineEnd = (v, i) => { const n = v.indexOf('\n', i); return n === -1 ? v.length : n }

function Tool({ icon: Icon, label, onClick, keys, disabled }) {
  return (
    <button
      type="button"
      className="adm-icon-btn"
      title={keys ? `${label} (${keys})` : label}
      aria-label={label}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={16} />
    </button>
  )
}

function Sep() {
  return <span aria-hidden="true" style={{ width: 1, height: 20, background: 'var(--adm-trace)', margin: '0 4px' }} />
}

function Menu({ id, icon: Icon, label, items, onPick, open, onToggle, disabled }) {
  return (
    <div className="relative" data-md-menu>
      <button
        type="button"
        className="adm-icon-btn"
        style={{ width: 'auto', paddingInline: 6, gap: 2, display: 'inline-flex', alignItems: 'center' }}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={e => e.preventDefault()}
        onClick={() => onToggle(id)}
      >
        <Icon size={16} /><ChevronDown size={12} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute z-30 mt-1 py-1 rounded-lg shadow-lg"
          style={{ minWidth: 170, background: 'var(--adm-board)', border: '1px solid var(--adm-trace)' }}
        >
          {items.map(item => (
            <button
              key={item.value || 'plain'}
              type="button"
              role="menuitem"
              className="block w-full text-left px-3 py-1.5 text-[13px] hover:opacity-80"
              style={{ color: 'var(--adm-silk)' }}
              onMouseDown={e => e.preventDefault()}
              onClick={() => onPick(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Markdown editor for tutorials: a toolbar for everything the renderer
 * supports, keyboard shortcuts, list continuation, image paste/drop upload,
 * and a live preview that uses the exact component the site renders with.
 */
export default function MarkdownEditor({ value, onChange, onUploadImage, onPasteText, placeholder, minHeight = 520 }) {
  const ref = useRef(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const [view, setView] = useState(() => (window.innerWidth >= 1280 ? 'split' : 'write'))
  const [menu, setMenu] = useState(null)
  const [uploading, setUploading] = useState(0)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!menu) return
    const close = e => { if (!e.target.closest?.('[data-md-menu]')) setMenu(null) }
    const esc = e => { if (e.key === 'Escape') setMenu(null) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [menu])

  const ta = () => ref.current

  // ---- actions --------------------------------------------------------

  const wrap = (before, after = before, placeholderText = 'text') => {
    const el = ta(); const v = el.value
    const { selectionStart: s, selectionEnd: e } = el
    // Already wrapped: unwrap.
    if (v.slice(s - before.length, s) === before && v.slice(e, e + after.length) === after) {
      replaceRange(el, s - before.length, e + after.length, v.slice(s, e), s - before.length, e - before.length)
      return
    }
    const inner = v.slice(s, e) || placeholderText
    replaceRange(el, s, e, before + inner + after, s + before.length, s + before.length + inner.length)
  }

  /** Applies `fn(line, index)` to every line the selection touches. */
  const mapLines = fn => {
    const el = ta(); const v = el.value
    const s = lineStart(v, el.selectionStart)
    const e = lineEnd(v, el.selectionEnd)
    const lines = v.slice(s, e).split('\n')
    const next = lines.map(fn).join('\n')
    replaceRange(el, s, e, next, s, s + next.length)
  }

  const togglePrefix = (prefix, test) => {
    const el = ta(); const v = el.value
    const lines = v.slice(lineStart(v, el.selectionStart), lineEnd(v, el.selectionEnd)).split('\n')
    const all = lines.every(l => test(l))
    mapLines((l, i) => {
      const stripped = l.replace(LIST_MARK, '$1').replace(/^(\s*)> ?/, '$1')
      if (all) return l.replace(test === isQuote ? /^(\s*)> ?/ : LIST_MARK, '$1')
      return typeof prefix === 'function' ? prefix(stripped, i) : prefix + stripped
    })
  }
  const isBullet = l => /^\s*[-*+] (?!\[[ xX]\])/.test(l)
  const isNumbered = l => /^\s*\d+\. /.test(l)
  const isTask = l => /^\s*- \[[ xX]\] /.test(l)
  const isQuote = l => /^\s*>/.test(l)

  const heading = level => mapLines(l => {
    const bare = l.replace(/^#{1,6}\s+/, '')
    const current = l.match(/^(#{1,6})\s/)?.[1].length
    return current === level ? bare : `${'#'.repeat(level)} ${bare}`
  })

  /** Inserts a block on its own lines, with a blank line around it. */
  const insertBlock = (text, cursorOffset = null, selectLength = 0) => {
    const el = ta(); const v = el.value
    const { selectionStart: s, selectionEnd: e } = el
    const before = v.slice(0, s)
    const after = v.slice(e)
    const lead = !before ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    const trail = !after ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
    const full = lead + text + trail
    const at = s + lead.length + (cursorOffset ?? text.length)
    replaceRange(el, s, e, full, at, at + selectLength)
  }

  const codeBlock = lang => {
    setMenu(null)
    const el = ta(); const sel = el.value.slice(el.selectionStart, el.selectionEnd)
    const open = '```' + lang + '\n'
    if (sel) insertBlock(`${open}${sel.replace(/\n$/, '')}\n\`\`\``, open.length, sel.replace(/\n$/, '').length)
    else insertBlock(`${open}\n\`\`\``, open.length)
  }

  const callout = type => {
    setMenu(null)
    const el = ta(); const sel = el.value.slice(el.selectionStart, el.selectionEnd)
    const body = (sel || 'Write the note here.').split('\n').map(l => `> ${l}`).join('\n')
    const head = `> [!${type}]\n`
    insertBlock(head + body, head.length + 2, sel ? body.length - 2 : 'Write the note here.'.length)
  }

  const link = () => {
    const el = ta(); const v = el.value
    const { selectionStart: s, selectionEnd: e } = el
    const sel = v.slice(s, e)
    if (/^https?:\/\/\S+$/.test(sel)) {
      replaceRange(el, s, e, `[link text](${sel})`, s + 1, s + 10)
    } else {
      const text = sel || 'link text'
      const start = s + text.length + 3
      replaceRange(el, s, e, `[${text}](https://)`, start, start + 8)
    }
  }

  const table = () => insertBlock(
    '| Part | Quantity | Notes |\n| --- | --- | --- |\n| Arduino Uno | 1 |  |\n| LED | 2 |  |',
    2, 4,
  )

  const youtube = () => insertBlock('https://www.youtube.com/watch?v=', 'https://www.youtube.com/watch?v='.length)

  const uploadImages = async files => {
    const images = [...files].filter(f => f.type.startsWith('image/'))
    if (!images.length || !onUploadImage) return
    for (const file of images) {
      const name = file.name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '') || 'image'
      const token = `![Uploading ${name}…]()`
      insertBlock(token)
      setUploading(n => n + 1)
      let md = ''
      try {
        md = `![${name}](${await onUploadImage(file)})`
      } catch { /* the caller reports the error; drop the placeholder */ }
      try {
        // The textarea may be gone if the view switched to preview meanwhile.
        const el = ta()
        const i = el ? el.value.indexOf(token) : -1
        if (i !== -1) replaceRange(el, i, i + token.length, md)
        else onChange(valueRef.current.replace(token, md))
      } finally {
        setUploading(n => n - 1)
      }
    }
  }

  // ---- keyboard -------------------------------------------------------

  const onKeyDown = e => {
    const mod = e.ctrlKey || e.metaKey
    if (mod && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase()
      if (k === 'b') { e.preventDefault(); wrap('**', '**', 'bold text') }
      else if (k === 'i') { e.preventDefault(); wrap('*', '*', 'italic text') }
      else if (k === 'k') { e.preventDefault(); link() }
      else if (k === 'e') { e.preventDefault(); wrap('`', '`', 'code') }
      return
    }
    // Enter inside a list continues it; Enter on an empty item ends it.
    if (e.key === 'Enter' && !e.shiftKey && !mod) {
      const el = ta(); const v = el.value
      const { selectionStart: s, selectionEnd: end } = el
      if (s !== end) return
      const ls = lineStart(v, s)
      const current = v.slice(ls, s)
      const m = current.match(LIST_MARK)
      const quote = current.match(/^(\s*)> /)
      if (m) {
        e.preventDefault()
        if (current.trim() === m[0].trim()) { replaceRange(el, ls, s, ''); return }
        const mark = m[3] ? `${Number(m[3]) + 1}. ` : m[2].startsWith('- [') ? '- [ ] ' : m[2]
        replaceRange(el, s, s, `\n${m[1]}${mark}`)
      } else if (quote) {
        e.preventDefault()
        if (current.trim() === '>') { replaceRange(el, ls, s, ''); return }
        replaceRange(el, s, s, `\n${quote[1]}> `)
      }
    }
  }

  const onPaste = e => {
    const files = e.clipboardData?.files
    if (files?.length && [...files].some(f => f.type.startsWith('image/'))) {
      e.preventDefault()
      uploadImages(files)
      return
    }
    const text = e.clipboardData?.getData('text/plain')
    if (text && onPasteText) {
      const handled = onPasteText(text, body => {
        const el = ta()
        const replaceAll = !el.value.trim()
        if (replaceAll) replaceRange(el, 0, el.value.length, body, 0, 0)
        else replaceRange(el, el.selectionStart, el.selectionEnd, body)
      })
      if (handled) e.preventDefault()
    }
  }

  const onDrop = e => {
    if (!e.dataTransfer?.files?.length) return
    e.preventDefault()
    uploadImages(e.dataTransfer.files)
  }

  // ---- render ---------------------------------------------------------

  const locked = view === 'preview'
  const toggleMenu = id => setMenu(m => (m === id ? null : id))

  const words = value ? value.split(/\s+/).filter(Boolean).length : 0
  const showWrite = view !== 'preview'
  const showPreview = view !== 'write'

  return (
    <div className="rounded-lg" style={{ border: '1px solid var(--adm-trace)', background: 'var(--adm-board)' }}>
      <div
        className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 sticky top-0 z-20 rounded-t-lg"
        style={{ borderBottom: '1px solid var(--adm-trace)', background: 'var(--adm-board-sunk)' }}
        role="toolbar"
        aria-label="Formatting"
      >
        <Tool icon={Heading2} label="Section heading" onClick={() => heading(2)} disabled={locked} />
        <Tool icon={Heading3} label="Step heading" onClick={() => heading(3)} disabled={locked} />
        <Sep />
        <Tool icon={Bold} label="Bold" keys="Ctrl+B" onClick={() => wrap('**', '**', 'bold text')} disabled={locked} />
        <Tool icon={Italic} label="Italic" keys="Ctrl+I" onClick={() => wrap('*', '*', 'italic text')} disabled={locked} />
        <Tool icon={Code} label="Inline code" keys="Ctrl+E" onClick={() => wrap('`', '`', 'code')} disabled={locked} />
        <Tool icon={Link2} label="Link" keys="Ctrl+K" onClick={link} disabled={locked} />
        <Sep />
        <Tool icon={List} label="Bullet list" onClick={() => togglePrefix('- ', isBullet)} disabled={locked} />
        <Tool icon={ListOrdered} label="Numbered list" onClick={() => togglePrefix((l, i) => `${i + 1}. ${l}`, isNumbered)} disabled={locked} />
        <Tool icon={ListChecks} label="Checklist" onClick={() => togglePrefix('- [ ] ', isTask)} disabled={locked} />
        <Tool icon={MessageSquareQuote} label="Quote" onClick={() => togglePrefix('> ', isQuote)} disabled={locked} />
        <Sep />
        <Menu id="code" icon={SquareCode} label="Code block" items={CODE_LANGS} onPick={codeBlock} open={menu === 'code'} onToggle={toggleMenu} disabled={locked} />
        <Menu id="callout" icon={TriangleAlert} label="Callout box" items={CALLOUTS} onPick={callout} open={menu === 'callout'} onToggle={toggleMenu} disabled={locked} />
        <Tool icon={Table} label="Table" onClick={table} disabled={locked} />
        <Tool icon={Minus} label="Divider" onClick={() => insertBlock('---')} disabled={locked} />
        <Sep />
        {onUploadImage && (
          <>
            <Tool icon={uploading ? Loader2 : ImagePlus} label="Upload image" onClick={() => fileRef.current?.click()} disabled={locked} />
            <input
              ref={fileRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1}
              onChange={e => { uploadImages(e.target.files); e.target.value = '' }}
            />
          </>
        )}
        <Tool icon={MonitorPlay} label="YouTube video" onClick={youtube} disabled={locked} />

        <div className="ml-auto flex items-center rounded-md p-0.5" style={{ background: 'var(--adm-board)', border: '1px solid var(--adm-trace)' }} role="group" aria-label="View">
          {[
            { v: 'write', icon: PenLine, label: 'Write' },
            { v: 'split', icon: Columns2, label: 'Split' },
            { v: 'preview', icon: Eye, label: 'Preview' },
          ].map(({ v, icon: Icon, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[12px] font-semibold"
              style={view === v ? { background: 'var(--adm-signal)', color: '#fff' } : { color: 'var(--adm-silk-dim)' }}
            >
              <Icon size={13} /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={showWrite && showPreview ? 'grid lg:grid-cols-2' : ''}>
        {showWrite && (
          <textarea
            ref={ref}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onDrop={onDrop}
            onDragOver={e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault() }}
            placeholder={placeholder}
            spellCheck
            aria-label="Tutorial content in Markdown"
            className="block w-full resize-y outline-none p-4 text-[13.5px] leading-relaxed"
            style={{
              minHeight,
              fontFamily: 'ui-monospace, SFMono-Regular, "Cascadia Code", Menlo, Consolas, monospace',
              background: 'transparent',
              color: 'var(--adm-silk)',
              borderInlineEnd: showPreview ? '1px solid var(--adm-trace)' : undefined,
            }}
          />
        )}
        {showPreview && (
          <div className="p-5 overflow-auto" style={{ minHeight, maxHeight: showWrite ? '80vh' : undefined, background: 'var(--color-bg)' }} dir="ltr">
            {value?.trim() ? (
              <Suspense fallback={<Loader2 size={16} className="adm-spin" />}>
                <Markdown>{value}</Markdown>
              </Suspense>
            ) : (
              <p className="text-sm" style={{ color: 'var(--adm-silk-faint)' }}>Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-[11px] rounded-b-lg" style={{ borderTop: '1px solid var(--adm-trace)', color: 'var(--adm-silk-faint)' }}>
        <span>
          {uploading > 0 ? `Uploading ${uploading} image${uploading > 1 ? 's' : ''}…` : 'Paste or drop images to upload them. Ctrl+B bold, Ctrl+K link, Ctrl+E code.'}
        </span>
        <span className="adm-data">{words} words · {Math.max(1, Math.round(words / 200))} min read</span>
      </div>
    </div>
  )
}
