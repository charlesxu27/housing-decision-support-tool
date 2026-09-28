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

export function LotBriefBanner({
  engine,
  pending,
  model,
}: {
  engine: 'template' | 'openai'
  pending: boolean
  model: string
}) {
  if (engine === 'openai') {
    return (
      <p className="lot-brief__ai" role="note">
        <strong>AI-generated summary.</strong> {model} rewrote this brief from the snapshot
        facts. It does not change the match color, the scores, or the zoning result. If this
        wording and the checks above disagree, trust the checks.
      </p>
    )
  }
  return (
    <p className="lot-brief__engine">
      {pending
        ? 'Snapshot wording for now. An AI rewrite is loading…'
        : 'Written from the snapshot facts. Not AI-generated.'}
    </p>
  )
}

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
  const [model, setModel] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setNarrative(fallback)
    setEngine('template')
    setModel('')
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
          model?: string
          narrative?: LotBriefNarrative
        }
        if (body.engine === 'openai' && body.narrative?.headline) {
          setNarrative(body.narrative)
          setEngine('openai')
          setModel(body.model?.trim() || 'OpenAI')
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setPending(false)
      })
    return () => controller.abort()
  }, [card, fallback])

  const aiWritten = engine === 'openai'

  return (
    <div className={aiWritten ? 'lot-brief lot-brief--ai' : 'lot-brief'}>
      <p className="eyebrow">{aiWritten ? 'AI-generated brief' : 'Plain-language brief'}</p>
      <LotBriefBanner engine={engine} pending={pending} model={model} />
      <h4 className="lot-brief__headline">{narrative.headline}</h4>
      <p className="lot-brief__summary">{narrative.summary}</p>
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
