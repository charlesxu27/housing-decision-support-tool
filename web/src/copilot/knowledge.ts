export interface KnowledgeSnippet {
  id: string
  label: string
  title: string
  text: string
  keywords: readonly string[]
}

export const COPILOT_KNOWLEDGE: readonly KnowledgeSnippet[] = [
  {
    id: 'data-sources',
    label: 'Data sources and vintages',
    title: 'Public data, pinned by vintage',
    text:
      'Household and housing-stock measures come from the ACS 2020-2024 5-year summary file at the Census tract level, with margins of error used to flag unreliable estimates. Parcel fit uses Allegheny County parcel boundaries and property assessments plus tax delinquency, condemned, and city-owned property lists. Pittsburgh zoning districts come from the City GIS layer joined to a code matrix that is draft until a person reviews each row. Flood hazard is FEMA NFHL, transit access is the PRT GTFS schedule, and slope and undermined-area layers are City of Pittsburgh datasets. The build date and every source vintage are listed in the report.',
    keywords: [
      'source',
      'sources',
      'data',
      'vintage',
      'acs',
      'census',
      'assessment',
      'gtfs',
      'fema',
      'wprdc',
      'accuracy',
      'coverage',
      'confidence',
      'date',
      'built',
    ],
  },
  {
    id: 'need-fit-allowed',
    label: 'Method: Need · Fit · Allowed',
    title: 'Three distinct planning questions',
    text:
      'Need compares who lives in a tract with the homes that exist there: household sizes against bedroom counts, seniors living alone, cost-burdened renters, overcrowding, and vacancy. Scores come from the American Community Survey and are ranked within Allegheny County. Low need is the lowest 10% of scores for that housing type. Fit counts parcels that pass a size, use, building, transit, and hazard rule for each housing type and reports a homes-possible range. Allowed summarizes the zoning status covering most residential-capable parcels. A match combines these in a fixed order but does not replace feasibility, market, legal, or community review.',
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
      'tertile',
      'bedroom',
    ],
  },
  {
    id: 'coverage-limits',
    label: 'Coverage limits',
    title: 'Where the snapshot goes quiet',
    text:
      'Need and Fit cover every Allegheny County tract. Allowed is computed only inside the City of Pittsburgh; every other municipality shows zoning unknown until its code is reviewed. The steep-slope layer exists only for the City, so slope share is not available elsewhere. When HUD CHAS tables are not supplied, cost burden falls back to the ACS gross-rent share. A value shown as not available means the source did not publish it; nothing is filled in from a neighboring place.',
    keywords: [
      'limitation',
      'limit',
      'missing',
      'null',
      'available',
      'outside',
      'city',
      'county',
      'municipality',
      'chas',
      'unknown',
      'gap',
    ],
  },
  {
    id: 'zoning-verification',
    label: 'Planning safeguard: zoning verification',
    title: 'Verify zoning at the parcel level',
    text:
      'Treat by-right, conditional-use, special-exception, prohibited, and unknown labels as screening signals only. The Pittsburgh matrix was extracted from the Zoning Code use table and is marked draft until every row carries a reviewer. Before acting, confirm the current zoning map, ordinance text, overlays, lot-specific conditions, approval pathway, and interpretation with the relevant municipality.',
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
      'draft',
      'matrix',
      'district',
    ],
  },
  {
    id: 'climate-hazards',
    label: 'Planning safeguard: climate and hazards',
    title: 'Hazards are constraints, not footnotes',
    text:
      'Any parcel that intersects a FEMA regulatory floodway is excluded from every housing type, and a tract that is mostly floodway is not recommended before any other check. Special flood hazard area share, mapped steep slopes, undermined land, and the displacement index are shown as shares of parcels so you can see exposure, not just a flag. These layers require current authoritative sources, site investigation, and professional review; missing values mean unknown, not safe.',
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
      'Use the map to form questions, not conclusions. Next steps are to inspect source dates and uncertainty flags, validate candidate parcels on the ground, verify zoning and hazards, document assumptions, compare alternatives, and involve municipal staff, technical experts, and affected residents before a decision.',
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
  'Which data sources and vintages are used?',
  'What zoning checks are still required?',
  'Which climate and hazard limits matter here?',
  'What should a planner verify next?',
] as const
