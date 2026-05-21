import { useRef } from 'react'
import { Upload, RefreshCw, Loader2 } from 'lucide-react'

type GoalsCsvUploadProps = {
  uploading: boolean
  onUpload: (file: File) => void | Promise<void>
  onRefresh: () => void
  importedAt?: string | null
  source?: string | null
}

export function GoalsCsvUpload({
  uploading,
  onUpload,
  onRefresh,
  importedAt,
  source,
}: GoalsCsvUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file || uploading) return
    await onUpload(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  const importMeta =
    importedAt &&
    `Imported ${new Date(importedAt).toLocaleString()}${source ? ` (${source})` : ''}`

  return (
    <div className="pd-upload pd-upload--compact">
      <input
        ref={inputRef}
        id="goals-csv-upload"
        type="file"
        accept=".csv,text/csv"
        className="pd-upload-input"
        disabled={uploading}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <div className="pd-upload-actions">
        <label
          htmlFor="goals-csv-upload"
          className={`pd-upload-btn${uploading ? ' pd-upload-btn--loading' : ''}`}
          aria-disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 size={15} className="pd-upload-btn-spinner" aria-hidden />
              Uploading…
            </>
          ) : (
            <>
              <Upload size={15} strokeWidth={2.25} aria-hidden />
              Upload CSV
            </>
          )}
        </label>
        <button
          type="button"
          className="pd-upload-refresh-icon"
          onClick={onRefresh}
          disabled={uploading}
          title="Reload goals from your last upload on this server"
          aria-label="Refresh saved data"
        >
          <RefreshCw size={15} aria-hidden />
        </button>
      </div>

      {importMeta && <p className="pd-upload-meta">{importMeta}</p>}
    </div>
  )
}
