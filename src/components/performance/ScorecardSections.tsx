import { displayRatingLabel } from '@/lib/formatRatingLabel'
import type { ScorecardDetail } from '@/lib/scorecardPayload'
import { ScorecardCriteriaAccordion } from '@/components/performance/ScorecardCriteriaAccordion'

type Props = {
  detail: ScorecardDetail
  grades?: {
    display: string | null
    lineManager: string | null
    calculated: string | null
  }
}

export function ScorecardSections({ detail, grades }: Props) {
  return (
    <div className="pd-scorecard-sections">
      <div className="pd-detail-grid">
        <DetailItem label="Reviewer" value={detail.reviewer} />
        <DetailItem label="Relation" value={detail.relation} ratingLabel />
        <DetailItem label="Status" value={detail.status} ratingLabel />
        <DetailItem label="Opened" value={detail.openedAt} />
        <DetailItem label="Completed" value={detail.completedAt} />
        <DetailItem label="Duration" value={detail.duration} />
        <DetailItem
          label="Overall rating"
          value={detail.overallRating ?? detail.reviewOverallRating}
          ratingLabel
        />
      </div>

      {grades ? (
        <section className="pd-detail-block">
          <h3 className="pd-detail-heading">Grade outcome</h3>
          <div className="pd-detail-grid">
            <DetailItem label="Display grade" value={grades.display} />
            <DetailItem label="LM grade" value={grades.lineManager} />
            <DetailItem label="Calculated" value={grades.calculated} />
          </div>
        </section>
      ) : null}

      <div className="pd-scorecard-ratings">
        {detail.sections.map((section) => (
          <section key={section.title} className="pd-detail-block pd-detail-block--section">
            <h3 className="pd-detail-heading">{section.title}</h3>
            <div className="pd-detail-grid">
              <DetailItem label="Rating" value={section.rating} ratingLabel />
              <DetailItem label="Section grade" value={section.sectionGrade} ratingLabel />
              {section.extra ? <DetailItem label="Details" value={section.extra} span /> : null}
            </div>
          </section>
        ))}
      </div>

      <ScorecardCriteriaAccordion groups={detail.criteria} />

      {detail.alternates.length > 1 ? (
        <section className="pd-detail-block">
          <h3 className="pd-detail-heading">All scorecards for this cycle ({detail.alternates.length})</h3>
          <div className="pd-table-wrap">
            <table className="pd-table pd-table--compact">
              <thead>
                <tr>
                  <th>Reviewer</th>
                  <th>Relation</th>
                  <th>Status</th>
                  <th>Opened</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {detail.alternates.map((alt) => (
                  <tr key={alt.id}>
                    <td>{alt.reviewer || '—'}</td>
                    <td>{displayRatingLabel(alt.relation)}</td>
                    <td>{displayRatingLabel(alt.status)}</td>
                    <td>{alt.openedAt || '—'}</td>
                    <td>{alt.completedAt || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="pd-detail-block">
        <h3 className="pd-detail-heading">Bar raiser</h3>
        <div className="pd-detail-grid">
          {detail.barRaiser.map((q) => (
            <DetailItem key={q.label} label={q.label} value={q.value} ratingLabel />
          ))}
        </div>
      </section>
    </div>
  )
}

function DetailItem({
  label,
  value,
  span,
  ratingLabel: formatAsRating,
}: {
  label: string
  value: string | null | undefined
  span?: boolean
  ratingLabel?: boolean
}) {
  const display = formatAsRating ? displayRatingLabel(value) : value || '—'
  return (
    <div className={span ? 'pd-detail-item pd-detail-item--span' : 'pd-detail-item'}>
      <span className="pd-detail-label">{label}</span>
      <span className="pd-detail-value">{display}</span>
    </div>
  )
}
