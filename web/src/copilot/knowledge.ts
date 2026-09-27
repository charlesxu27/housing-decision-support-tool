export interface KnowledgeSnippet {
  id: string
  label: string
  title: string
  text: string
  keywords: readonly string[]
}

export const COPILOT_KNOWLEDGE: readonly KnowledgeSnippet[] = [
  {
    id: 'fixture-limitations',
    label: 'Fixture data notice',
    title: 'Illustrative data, not findings',
    text:
      'The current map uses a small set of plausible, illustrative Pittsburgh-area fixture records. Demographic, parcel, zoning, hazard, transit, and carbon values are not authoritative findings and must not be used for planning or zoning decisions.',
    keywords: [
      'fixture',
      'sample',
      'demo',
      'data',
      'limitation',
      'authoritative',
      'accuracy',
      'coverage',
      'confidence',
    ],
  },
  {
    id: 'need-fit-allowed',
    label: 'Method: Need · Fit · Allowed',
    title: 'Three distinct planning questions',
    text:
      'Need describes whether household patterns suggest a housing-type gap. Fit estimates physical opportunity using illustrative parcel capacity and home ranges. Allowed summarizes the fixture zoning status. A match combines these dimensions but does not replace feasibility, market, legal, or community review.',
    keywords: [
      'need',
      'demand',
      'household',
      'fit',
      'parcel',
      'capacity',
      'homes',
      'allowed',
      'match',
      'method',
      'score',
    ],
  },
  {
    id: 'zoning-verification',
    label: 'Planning safeguard: zoning verification',
    title: 'Verify zoning at the parcel level',
    text:
      'Treat by-right, conditional-use, special-exception, prohibited, and unknown labels as screening signals only. Before acting, confirm the current zoning map, ordinance text, overlays, lot-specific conditions, approval pathway, and interpretation with the relevant municipality.',
    keywords: [
      'zoning',
      'zone',
      'allowed',
      'by-right',
      'permit',
      'permitted',
      'approval',
      'conditional',
      'exception',
      'ordinance',
      'overlay',
      'legal',
      'build',
    ],
  },
  {
    id: 'climate-hazards',
    label: 'Planning safeguard: climate and hazards',
    title: 'Hazards are constraints, not footnotes',
    text:
      'Floodway is a hard screening concern in the current matching logic. Flood exposure, slope, undermining, displacement risk, and transportation emissions require current authoritative sources, site investigation, and professional review; missing values mean unknown, not safe.',
    keywords: [
      'climate',
      'hazard',
      'risk',
      'flood',
      'floodway',
      'slope',
      'mine',
      'undermined',
      'displacement',
      'carbon',
      'emissions',
      'safe',
      'safety',
    ],
  },
  {
    id: 'human-next-steps',
    label: 'Workflow: human review',
    title: 'Move from screening to accountable review',
    text:
      'Use the preview to form questions, not conclusions. Next steps are to inspect source dates and uncertainty, validate candidate parcels, verify zoning and hazards, document assumptions, compare alternatives, and involve municipal staff, technical experts, and affected residents before a decision.',
    keywords: [
      'next',
      'step',
      'workflow',
      'review',
      'human',
      'verify',
      'validate',
      'decision',
      'community',
      'resident',
      'planner',
      'action',
      'recommendation',
    ],
  },
] as const

export const SUGGESTED_PROMPTS = [
  'How should I read Need, Fit, and Allowed?',
  'What zoning checks are still required?',
  'Which climate and hazard limits matter here?',
  'What should a planner verify next?',
] as const
