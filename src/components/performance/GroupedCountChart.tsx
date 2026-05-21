type Row = { key: string; count: number }

type Props = {
  rows: Row[]
  title: string
}

export function GroupedCountChart({ rows, title }: Props) {
  const total = rows.reduce((sum, r) => sum + r.count, 0) || 1
  const max = Math.max(...rows.map((r) => r.count), 1)

  return (
    <div>
      <h3 className="pd-panel-title" style={{ marginTop: 0 }}>
        {title}
      </h3>
      {rows.length === 0 ? (
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>No rows match this view.</p>
      ) : (
        rows.map((row) => {
          const pct = Math.round((row.count / total) * 100)
          return (
            <div key={row.key} className="pd-bar-row">
              <span className="pd-bar-label" title={row.key}>
                {row.key}
              </span>
              <div className="pd-bar-track">
                <div className="pd-bar-fill" style={{ width: `${(row.count / max) * 100}%` }} />
              </div>
              <span className="pd-bar-count">
                {row.count} ({pct}%)
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}
