import { useRef, useState } from 'react'
import { Download, Frame, Trash2, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { deleteUploadedFile, run, supabase, uploadFile } from '../../lib/db'
import useAdminStore from '../../store/adminStore'
import { ASSET_KINDS, downloadZip, fileNameOf, fitForUpload } from '../../lib/media'
import Button, { IconButton } from '../ui/Button'

const toast = (message, type) => useAdminStore.getState().addToast(message, type)

/**
 * Raw shots from the photographer, finished versions from the editor, and
 * references. The publisher downloads the finals in one zip.
 */
export default function PostFiles({ postId, assets, onChanged }) {
  const adminId = useAdminStore(s => s.adminProfile?.id)
  const [kind, setKind] = useState('raw')
  const [progress, setProgress] = useState(null) // { index, total, percent }
  const [zipping, setZipping] = useState(false)
  const input = useRef(null)

  const list = assets.filter(a => a.kind === kind)

  const upload = async files => {
    const queue = [...files].filter(f => f.type.startsWith('image/'))
    if (!queue.length) return
    let done = 0
    for (let i = 0; i < queue.length; i++) {
      setProgress({ index: i + 1, total: queue.length, percent: 0 })
      try {
        const file = await fitForUpload(queue[i])
        const url = await uploadFile(file, percent => setProgress(p => (p ? { ...p, percent } : p)))
        const { ok } = await run(supabase.from('media_assets').insert({
          post_id: postId, kind, url, file_name: queue[i].name, uploaded_by: adminId,
        }), { failure: `${queue[i].name} uploaded but was not attached.` })
        if (ok) done += 1
      } catch (err) {
        toast(`${queue[i].name}: ${err.message}`, 'error')
      }
    }
    setProgress(null)
    if (done) toast(`${done} file${done === 1 ? '' : 's'} added.`)
    onChanged()
  }

  const remove = async asset => {
    const { ok } = await run(supabase.from('media_assets').delete().eq('id', asset.id), { failure: 'The file was not removed.' })
    if (!ok) return
    deleteUploadedFile(asset.url)
    onChanged()
  }

  const downloadAll = async () => {
    setZipping(true)
    try {
      const files = await Promise.all(list.map(async a => ({
        name: a.file_name || fileNameOf(a.url),
        blob: await (await fetch(a.url)).blob(),
      })))
      await downloadZip(files, `post-${postId}-${kind}.zip`)
    } catch {
      toast('The files could not be downloaded. Try again.', 'error')
    }
    setZipping(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="File kind" className="flex gap-0.5">
          {ASSET_KINDS.map(k => {
            const count = assets.filter(a => a.kind === k.value).length
            return (
              <button key={k.value} type="button" role="tab" aria-selected={kind === k.value} onClick={() => setKind(k.value)}
                className="px-2.5 h-7 rounded-md text-[12px] font-semibold"
                style={{
                  background: kind === k.value ? 'var(--adm-signal-wash)' : 'transparent',
                  color: kind === k.value ? 'var(--adm-signal)' : 'var(--adm-silk-faint)',
                }}>
                {k.label} {count > 0 && <span className="adm-data">{count}</span>}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-1.5">
          {list.length > 0 && (
            <Button size="sm" icon={Download} busy={zipping} busyLabel="Zipping…" onClick={downloadAll}>Download all</Button>
          )}
          <Link to={`/admin/media/studio?post=${postId}`} className="adm-btn adm-btn-sm"><Frame size={14} /> Frame studio</Link>
        </div>
      </div>

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files) }}
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}
      >
        {list.map(a => (
          <figure key={a.id} className="relative group rounded-lg overflow-hidden" style={{ background: 'var(--adm-board-sunk)', aspectRatio: '1' }}>
            <a href={a.url} target="_blank" rel="noreferrer" title={a.file_name || 'Open'}>
              <img src={a.url} alt={a.file_name || ''} loading="lazy" className="w-full h-full object-cover" />
            </a>
            <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <a href={a.url} download={a.file_name || fileNameOf(a.url)} className="adm-icon-btn" style={{ width: 26, height: 26, background: 'var(--adm-panel)' }}
                aria-label="Download" title="Download"><Download size={13} /></a>
              <IconButton icon={Trash2} label="Remove" danger size={13} onClick={() => remove(a)}
                style={{ width: 26, height: 26, background: 'var(--adm-panel)' }} />
            </div>
          </figure>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={!!progress}
          className="flex flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold"
          style={{ aspectRatio: '1', border: '1.5px dashed var(--adm-trace-strong)', color: 'var(--adm-silk-faint)' }}
        >
          <Upload size={16} />
          {progress ? `${progress.index}/${progress.total} · ${progress.percent}%` : 'Add or drop'}
        </button>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
        onChange={e => { upload(e.target.files); e.target.value = '' }} />
    </div>
  )
}
