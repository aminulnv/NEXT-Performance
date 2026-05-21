export const DEFAULT_PAGE_SIZE = 25

export function paginate<T>(items: T[], page: number, pageSize: number = DEFAULT_PAGE_SIZE) {
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const startIndex = (safePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  return {
    items: items.slice(startIndex, endIndex),
    totalItems,
    totalPages,
    page: safePage,
    startIndex,
    endIndex,
  }
}

type TablePaginationProps = {
  page: number
  totalPages: number
  totalItems: number
  startIndex: number
  endIndex: number
  onPageChange: (page: number) => void
}

export function TablePagination({
  page,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
}: TablePaginationProps) {
  if (totalItems === 0) return null

  const from = startIndex + 1
  const to = endIndex

  return (
    <div className="pd-pagination">
      <p className="pd-pagination-summary">
        Showing {from}–{to} of {totalItems}
      </p>
      <div className="pd-pagination-controls">
        <button
          type="button"
          className="pd-btn-secondary pd-btn pd-pagination-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="pd-pagination-page">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="pd-btn-secondary pd-btn pd-pagination-btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
