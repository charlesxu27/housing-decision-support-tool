import { useEffect, useMemo, useState } from 'react'
import type { LookupAllowed } from '../data/load'
import type { AreaRecord, ParcelTileProperties, TypeId } from '../data/types'
import {
  buildLotBriefCard,
  templateLotBrief,
  type LotBriefNarrative,
} from '../model/lotBrief'

const SECTIONS = [
  ['Demand', 'demand'],
  ['Transit', 'transit'],
  ['Equity', 'equity'],
  ['Climate & hazards', 'climate'],
  ['Cost', 'cost'],
  ['Size', 'size'],
] as const

interface LotBriefProps {
  parcel: ParcelTileProperties
  area: AreaRecord | undefined
  type: TypeId
  lookupAllowed: LookupAllowed
}

export function LotBrief({ parcel, area, type, lookupAllowed }: LotBriefProps) {
  const card = useMemo(
    () => buildLotBriefCard({ parcel, area, type, lookupAllowed }),
    [area, lookupAllowed, parcel, type],
  )
  const fallback = useMemo(() => templateLotBrief(card), [card])
  const [narrative, setNarrative] = useState<LotBriefNarrative>(fallback)
  const [engine, setEngine] = useState<'template' | 'openai'>('template')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setNarrative(fallback)
    setEngine('template')
    if (import.meta.env.MODE === 'test') return
    const controller = new AbortController()
    setPending(true)
    void fetch('/api/lot-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return
        const body = (await res.json()) as {
          engine?: string
          narrative?: LotBriefNarrative
        }
        if (body.engine === 'openai' && body.narrative?.headline) {
          setNarrative(body.narrative)
          setEngine('openai')
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setPending(false)
      })
    return () => controller.abort()
  }, [card, fallback])

  return (
    <div className="lot-brief">
      <p className="eyebrow">Plain-language brief</p>
      <h4 className="lot-brief__headline">{narrative.headline}</h4>
      <p className="lot-brief__summary">{narrative.summary}</p>
      <p className="lot-brief__engine">
        {engine === 'openai'
          ? 'OpenAI, grounded in the Need / Fit / Allowed snapshot'
          : pending
            ? 'Snapshot template · asking the model to rephrase…'
            : 'Snapshot template (add OPENAI_API_KEY to use a model writeup)'}
      </p>
      {SECTIONS.map(([title, key]) => (
        <details key={key} className="parcel-card__more" open={key === 'demand' || key === 'transit'}>
          <summary>{title}</summary>
          <p>{narrative[key]}</p>
        </details>
      ))}
      <p className="lot-brief__note">{narrative.sources_note}</p>
    </div>
  )
}
