/**
 * Rendered email in a sandboxed frame — no scripts, no navigation — so a
 * custom HTML template can be previewed without touching the console.
 */
export default function EmailPreview({ subject, html, height = 520 }) {
  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{ border: '1px solid var(--adm-trace)', background: 'var(--adm-board-sunk)' }}
    >
      <div className="px-3.5 py-2.5 text-xs" style={{ borderBottom: '1px solid var(--adm-trace)' }}>
        <span className="adm-eyebrow mr-2">Subject</span>
        <span style={{ color: 'var(--adm-silk)' }}>{subject || '—'}</span>
      </div>
      <iframe
        title="Email preview"
        sandbox=""
        srcDoc={html}
        style={{ width: '100%', height, border: 0, background: '#f1f5f9' }}
      />
    </div>
  )
}
