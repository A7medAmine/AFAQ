import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { AlertTriangle, ArrowUpRight, Check, Copy, Flame, Info, Lightbulb, MessageSquareWarning, Terminal } from 'lucide-react'
import { rehypeHeadingIds, remarkCallouts, remarkYoutube } from './plugins'
import './markdown.css'

const LANG_NAMES = {
  bash: 'Terminal', sh: 'Terminal', shell: 'Terminal', zsh: 'Terminal', powershell: 'PowerShell', ps1: 'PowerShell',
  js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX',
  py: 'Python', python: 'Python', cpp: 'C++', 'c++': 'C++', arduino: 'Arduino', ino: 'Arduino', c: 'C',
  html: 'HTML', xml: 'XML', css: 'CSS', json: 'JSON', yaml: 'YAML', yml: 'YAML', sql: 'SQL', java: 'Java',
  go: 'Go', rust: 'Rust', php: 'PHP', markdown: 'Markdown', md: 'Markdown', diff: 'Diff', text: 'Text', txt: 'Text',
}
const TERMINAL = new Set(['bash', 'sh', 'shell', 'zsh', 'powershell', 'ps1', 'console'])

const CALLOUTS = {
  note: { icon: Info, label: 'Note' },
  tip: { icon: Lightbulb, label: 'Tip' },
  important: { icon: MessageSquareWarning, label: 'Important' },
  warning: { icon: AlertTriangle, label: 'Warning' },
  caution: { icon: Flame, label: 'Caution' },
}

// `title="main.py"` (or title='…') after the language names the file.
const titleFrom = meta => meta?.match(/title=(?:"([^"]+)"|'([^']+)'|(\S+))/)?.slice(1).find(Boolean) || null

function CodeBlock({ node, children }) {
  const ref = useRef(null)
  const [copied, setCopied] = useState(false)
  const code = node?.children?.find(c => c.tagName === 'code')
  const lang = (code?.properties?.className || []).map(String).find(c => c.startsWith('language-'))?.slice(9)?.toLowerCase()
  const title = titleFrom(code?.data?.meta)
  const label = title || LANG_NAMES[lang] || lang || 'Code'

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async () => {
    const text = ref.current?.querySelector('code')?.textContent ?? ''
    try {
      await navigator.clipboard.writeText(text.replace(/\n$/, ''))
      setCopied(true)
    } catch { /* clipboard blocked; the code is still selectable */ }
  }

  return (
    <div className="md-code" dir="ltr">
      <div className="md-code-bar">
        <span className="md-code-label">
          {TERMINAL.has(lang) && <Terminal size={13} aria-hidden="true" />}
          {label}
        </span>
        <button type="button" onClick={copy} className="md-code-copy" aria-label={copied ? 'Copied' : `Copy ${label}`}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre ref={ref}>{children}</pre>
    </div>
  )
}

function Callout({ type, children }) {
  const { icon: Icon, label } = CALLOUTS[type] || CALLOUTS.note
  return (
    <div className={`md-callout md-callout-${type}`} role="note">
      <div className="md-callout-title"><Icon size={15} aria-hidden="true" />{label}</div>
      {children}
    </div>
  )
}

const isExternal = href => /^https?:\/\//i.test(href || '')

const components = {
  pre: CodeBlock,
  blockquote: ({ node, children }) => {
    const type = node?.properties?.dataCallout
    return type ? <Callout type={type}>{children}</Callout> : <blockquote>{children}</blockquote>
  },
  div: ({ node, children, ...rest }) => {
    const id = node?.properties?.dataYoutube
    if (!id) return <div {...rest}>{children}</div>
    return (
      <div className="md-video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title="YouTube video"
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  },
  a: ({ href, children }) => {
    if (href?.startsWith('/') && !href.startsWith('//')) return <Link to={href}>{children}</Link>
    if (!isExternal(href)) return <a href={href}>{children}</a>
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <ArrowUpRight size={13} className="md-ext" aria-hidden="true" />
      </a>
    )
  },
  img: ({ src, alt, title }) => (
    <span className="md-figure">
      <img src={src} alt={alt || ''} title={title} loading="lazy" />
      {alt && <span className="md-caption">{alt}</span>}
    </span>
  ),
  table: ({ children }) => <div className="md-table"><table>{children}</table></div>,
  // GFM renders "- [ ] step" as a disabled box; let readers tick steps off.
  input: ({ node: _node, type, checked, disabled: _disabled, ...rest }) =>
    type === 'checkbox'
      ? <input type="checkbox" defaultChecked={checked} aria-label="Done" />
      : <input type={type} checked={checked} {...rest} />,
}

const remarkPlugins = [remarkGfm, remarkCallouts, remarkYoutube]
const rehypePlugins = [[rehypeHighlight, { detect: false }], rehypeHeadingIds]

/**
 * Tutorial Markdown as the site shows it: GitHub-flavoured (tables, task
 * lists), highlighted code with a copy button, callouts and video embeds.
 * Raw HTML is not rendered, and react-markdown drops javascript: links.
 */
export default function Markdown({ children, className = '' }) {
  return (
    <div className={`md-doc ${className}`}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {children || ''}
      </ReactMarkdown>
    </div>
  )
}
