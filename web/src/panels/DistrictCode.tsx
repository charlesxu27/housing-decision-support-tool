import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LookupAllowed } from '../data/load'
import type { TypeId, ZoningStatus } from '../data/types'
import { allowanceSentence, describeDistrict } from '../data/zoningGlossary'

interface DistrictCodeProps {
  code: string
  typeLabel?: string
  status?: ZoningStatus
  /** True when the Pittsburgh matrix has not been human-verified. */
  draft?: boolean
}

export function DistrictCode({ code, typeLabel, status, draft = false }: DistrictCodeProps) {
  const tipId = useId()
  const described = describeDistrict(code)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const box = anchor?.getBoundingClientRect()
  const placeBelow = box != null && box.top < 140

  return (
    <>
      <button
        type="button"
        className="district-code"
        aria-label={`${code}, ${described.name}`}
        aria-describedby={anchor ? tipId : undefined}
        onMouseEnter={(event) => setAnchor(event.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        onFocus={(event) => setAnchor(event.currentTarget)}
        onBlur={() => setAnchor(null)}
      >
        {code}
      </button>
      {box
        ? createPortal(
            <span
              id={tipId}
              role="tooltip"
              className={`district-tip${placeBelow ? ' district-tip--below' : ''}`}
              style={{ top: placeBelow ? box.bottom : box.top, left: box.left + box.width / 2 }}
            >
              <strong>{code}</strong>
              <span className="district-tip__name">{described.name}</span>
              <span className="district-tip__about">{described.about}</span>
              {typeLabel && status ? (
                <span className="district-tip__why">{allowanceSentence(typeLabel, status)}</span>
              ) : null}
              {draft ? (
                <span className="district-tip__draft">
                  Draft reading of the Pittsburgh zoning code, not a permit decision.
                </span>
              ) : null}
            </span>,
            document.body,
          )
        : null}
    </>
  )
}

interface DistrictCodeListProps {
  codes: readonly string[]
  type?: TypeId
  typeLabel?: string
  lookupAllowed?: LookupAllowed
  draft?: boolean
}

export function DistrictCodeList({
  codes,
  type,
  typeLabel,
  lookupAllowed,
  draft = false,
}: DistrictCodeListProps) {
  if (codes.length === 0) return <>not available</>
  return (
    <span className="district-codes">
      {codes.map((code) => (
        <DistrictCode
          key={code}
          code={code}
          typeLabel={typeLabel}
          status={type && lookupAllowed ? lookupAllowed(code, type) : undefined}
          draft={draft}
        />
      ))}
    </span>
  )
}
