type EmptyStateProps = {
  title: string
  description: string
  onRefresh?: () => void
}

export function EmptyState({ title, description, onRefresh }: EmptyStateProps) {
  return (
    <div className="pd-empty">
      <h2 className="pd-empty-title">{title}</h2>
      <p className="pd-empty-text">{description}</p>
      {onRefresh ? (
        <button type="button" className="pd-btn" onClick={onRefresh}>
          Refresh
        </button>
      ) : null}
    </div>
  )
}
