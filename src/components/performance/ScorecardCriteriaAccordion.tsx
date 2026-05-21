import { useState } from 'react'
import { displayRatingLabel } from '@/lib/formatRatingLabel'
import type { ScorecardCriterionGroup } from '@/lib/scorecardPayload'

type Props = {
  groups: ScorecardCriterionGroup[]
}

export function ScorecardCriteriaAccordion({ groups }: Props) {
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set())

  if (!groups.length) return null

  const toggle = (section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  return (
    <section className="pd-detail-block">
      <h3 className="pd-detail-heading">Criteria ratings</h3>
      <div className="pd-accordion">
        {groups.map((group) => {
          const open = openSections.has(group.section)
          return (
            <div key={group.section} className="pd-accordion-item">
              <button
                type="button"
                className="pd-accordion-trigger"
                aria-expanded={open}
                onClick={() => toggle(group.section)}
              >
                <span>
                  {group.section} ({group.criteria.length})
                </span>
                <span aria-hidden>{open ? '−' : '+'}</span>
              </button>
              {open ? (
                <div className="pd-accordion-panel">
                  <table className="pd-table pd-table--compact">
                    <thead>
                      <tr>
                        <th>Criterion</th>
                        <th>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.criteria.map((c) => (
                        <tr key={c.label}>
                          <td>{c.label}</td>
                          <td>{displayRatingLabel(c.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
