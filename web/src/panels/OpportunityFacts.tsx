import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AreaRecord, SourceRecord, TractSchool } from '../data/types'
import { dollars, pct } from '../shared/format'
import { combinedProficient, letterGrade } from '../shared/schoolGrade'
import { SourceCite } from './SourceCite'

interface OpportunityFactsProps {
  area: AreaRecord | undefined
  sources: readonly SourceRecord[]
}

const LEVEL_LABELS: Record<TractSchool['level'], string> = {
  elementary: 'Elementary',
  middle: 'Middle',
  high: 'High school',
}

function GradeShare({ share }: { share: number | null }) {
  if (share == null) return <>score not published</>
  const grade = letterGrade(share)
  return (
    <>
      <span className={`opportunity-grade opportunity-grade--${grade.toLowerCase()}`}>{grade}</span>
      {' · '}
      {pct(share)}
    </>
  )
}

function formatMiles(miles: number): string {
  return miles < 0.1 ? 'under 0.1 mi' : `${miles.toFixed(1)} mi`
}

function basisLine(school: TractSchool): string {
  if (school.basis === 'attendance_zone') {
    if (school.coverage != null && school.coverage < 0.95) {
      return `Feeder attendance zone, ${pct(school.coverage)} of this tract`
    }
    return 'Feeder attendance zone'
  }
  const place =
    school.distanceMiles == null
      ? 'in this district'
      : `${formatMiles(school.distanceMiles)} from the tract center`
  const level =
    school.level === 'elementary' ? 'elementary school' : school.level === 'middle' ? 'middle school' : 'high school'
  return `Nearest ${level} in this district, ${place}`
}

function AboutFigures({ text }: { text: string }) {
  const tipId = useId()
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const box = anchor?.getBoundingClientRect()
  const placeBelow = box != null && box.top < 160

  return (
    <>
      <button
        type="button"
        className="opportunity-facts__about"
        aria-describedby={anchor ? tipId : undefined}
        onMouseEnter={(event) => setAnchor(event.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        onFocus={(event) => setAnchor(event.currentTarget)}
        onBlur={() => setAnchor(null)}
      >
        About these figures
      </button>
      {box
        ? createPortal(
            <span
              id={tipId}
              role="tooltip"
              className={`opportunity-tip${placeBelow ? ' opportunity-tip--below' : ''}`}
              style={{ top: placeBelow ? box.bottom : box.top, left: box.left + box.width / 2 }}
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </>
  )
}

/**
 * Income and school context for the map sidebar. These are place facts.
 * They do not change the match color.
 */
export function OpportunityFacts({ area, sources }: OpportunityFactsProps) {
  const opportunity = area?.opportunity
  const income = opportunity?.medianHouseholdIncome ?? null
  const countyIncome = opportunity?.countyMedianHouseholdIncome ?? null
  const district = opportunity?.schoolDistrict ?? null
  const share = opportunity?.schoolDistrictShare ?? null
  const schools = opportunity?.schools ?? []
  const split = share != null && share < 0.95
  const usesZones = schools.some((school) => school.basis === 'attendance_zone')
  const usesNearest = schools.some((school) => school.basis === 'nearest_in_district')
  const observedIds = ['acs5', 'school_districts', ...(usesZones ? ['pps_attendance'] : [])]
  const about = [
    'Household income is the Census median for this tract, the published typical income, not a mean.',
    'School scores are Future Ready PA 2024–25 results for the school named here: the share of students proficient or advanced, averaged across math and reading.',
    'Letter grades use that share. A is 80% or higher, B is 60–79%, C is 40–59%, D is 20–39%, and F is under 20%. The district grade weights every tested school in the district by enrollment.',
    usesZones
      ? "In Pittsburgh that school is the district's feeder attendance zone, not a magnet or charter."
      : '',
    usesNearest
      ? 'Outside Pittsburgh the school is the nearest one of that level in the district, which may differ from the official attendance zone.'
      : '',
    split ? `${district} is the largest overlap; other districts cover the rest of the tract.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className="opportunity-facts" aria-label="Access to opportunity">
      <p className="eyebrow">Access to opportunity</p>
      <dl>
        <div>
          <dt>Median household income</dt>
          <dd>
            {dollars(income)}
            {countyIncome == null ? null : <small>County median {dollars(countyIncome)}</small>}
          </dd>
        </div>
        <div>
          <dt>School district</dt>
          <dd>
            {district ?? 'not available'}
            {opportunity?.districtProficient == null ? null : (
              <small>
                <GradeShare share={opportunity.districtProficient} />
              </small>
            )}
            {share == null ? null : <small>{pct(share)} of this tract</small>}
          </dd>
        </div>
        {schools.length === 0 ? (
          <div>
            <dt>Schools</dt>
            <dd>not available</dd>
          </div>
        ) : null}
      </dl>
      {schools.length === 0 ? null : (
        <details className="opportunity-facts__levels">
          <summary>Elementary, middle, and high</summary>
          <dl>
            {schools.map((school) => (
              <div key={school.level} className="opportunity-facts__school">
                <dt>{LEVEL_LABELS[school.level]}</dt>
                <dd>
                  {school.name}
                  <small>
                    <GradeShare share={combinedProficient(school.mathProficient, school.elaProficient)} />
                  </small>
                  <small>{basisLine(school)}</small>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      <AboutFigures text={about} />
      <div className="provenance-row">
        <SourceCite sources={sources} ids={observedIds} kind="observed" />
        {schools.length ? <SourceCite sources={sources} ids={['future_ready']} kind="derived" /> : null}
      </div>
    </section>
  )
}
