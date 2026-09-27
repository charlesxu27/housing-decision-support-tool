import type { ZoningStatus } from './types'

export interface DistrictDescription {
  /** Spoken name, e.g. "General industrial". */
  name: string
  /** What the district is for, in plain language. */
  about: string
}

const DENSITY: Record<string, string> = {
  VL: 'very low density',
  L: 'low density',
  M: 'moderate density',
  H: 'high density',
  VH: 'very high density',
}

interface Entry {
  name: string
  about: string
}

/** Districts whose code is the whole name (no density suffix). */
const EXACT: Record<string, Entry> = {
  H: {
    name: 'Hillside',
    about: 'Steep residential hillsides. The code is written mainly for detached houses.',
  },
  LNC: {
    name: 'Local neighborhood commercial',
    about: 'Small commercial streets that also allow housing beside or above shops.',
  },
  UNC: {
    name: 'Urban neighborhood commercial',
    about: 'Denser neighborhood commercial streets that also allow housing.',
  },
  NDO: {
    name: 'Neighborhood office',
    about: 'Small offices. Housing is more limited than in a residential district.',
  },
  NDI: {
    name: 'Neighborhood industrial',
    about: 'Light industry next to neighborhoods. Some housing needs an extra approval.',
  },
  HC: {
    name: 'Highway commercial',
    about: 'Auto-oriented commercial corridors. Housing is not the main purpose.',
  },
  GI: {
    name: 'General industrial',
    about: 'Manufacturing, warehousing, and heavy commercial. New housing is not the purpose of this district.',
  },
  UI: {
    name: 'Urban industrial',
    about: 'Industry and production in denser parts of the city. New housing is not the purpose of this district.',
  },
  P: {
    name: 'Parks',
    about: 'Parks and open space. Housing is not the purpose of this district.',
  },
  EMI: {
    name: 'Educational / medical institution',
    about: 'Hospitals, universities, and their campuses. What can be built follows an institutional master plan.',
  },
  RP: {
    name: 'Residential planned unit development',
    about: 'A planned residential site. Allowed housing is set by the approved plan, not the base use table.',
  },
  AP: {
    name: 'Residential and commercial planned unit development',
    about: 'A planned mixed-use site. Allowed housing is set by the approved plan.',
  },
  CP: {
    name: 'Commercial planned unit development',
    about: 'A planned commercial site. Allowed housing is set by the approved plan.',
  },
  'R-MU': {
    name: 'Mixed-use residential',
    about: 'Housing mixed with other uses. The allowance for a specific housing type still needs a code check.',
  },
  MTOBOR: {
    name: 'Mount Oliver boundary code',
    about: 'A code on the city zoning map along Mount Oliver. It is not a standard Pittsburgh base district, so the housing allowance is unknown.',
  },
  GT: {
    name: 'Golden Triangle',
    about: 'Downtown. Each subdistrict (GT-A through GT-E) sets its own mix of offices, shops, and housing.',
  },
  'GT-A': {
    name: 'Golden Triangle, subdistrict A',
    about: 'A downtown subdistrict. Housing rules come from the Golden Triangle chapter, not a residential district.',
  },
  'GT-B': {
    name: 'Golden Triangle, subdistrict B',
    about: 'A downtown subdistrict. Housing rules come from the Golden Triangle chapter, not a residential district.',
  },
  'GT-C': {
    name: 'Golden Triangle, subdistrict C',
    about: 'A downtown subdistrict. Housing rules come from the Golden Triangle chapter, not a residential district.',
  },
  'GT-D': {
    name: 'Golden Triangle, subdistrict D',
    about: 'A downtown subdistrict. Housing rules come from the Golden Triangle chapter, not a residential district.',
  },
  'GT-E': {
    name: 'Golden Triangle, subdistrict E',
    about: 'A downtown subdistrict. Housing rules come from the Golden Triangle chapter, not a residential district.',
  },
  RIV: {
    name: 'Riverfront',
    about: 'Land along the rivers. Each subdistrict has its own use rules in Chapter 905.04.',
  },
  'RIV-NS': {
    name: 'Riverfront, North Shore',
    about: 'The North Shore riverfront. Uses follow the riverfront rules for this subdistrict, not the base residential table.',
  },
  'RIV-RM': {
    name: 'Riverfront, mixed residential',
    about: 'A riverfront district intended for housing mixed with other uses. The exact allowance is in Chapter 905.04.',
  },
  'RIV-MU': {
    name: 'Riverfront, mixed use',
    about: 'A riverfront district for mixed use. Housing can be part of the mix; the exact allowance is in Chapter 905.04.',
  },
  'RIV-IMU': {
    name: 'Riverfront, industrial mixed use',
    about: 'A riverfront district that mixes industry with other uses. New housing is limited compared with a residential district.',
  },
  'RIV-GI': {
    name: 'Riverfront, general industrial',
    about: 'Industrial land along the river. New housing is not the purpose of this district.',
  },
  SP: {
    name: 'Specially planned',
    about: 'A site-specific plan district. Allowed housing is set by that plan, not the base use table.',
  },
  'SP-1': {
    name: 'Specially planned, Pittsburgh Technology Center',
    about: 'Allowed housing is set by the Pittsburgh Technology Center plan.',
  },
  'SP-4': {
    name: 'Specially planned, Station Square',
    about: 'Allowed housing is set by the Station Square plan.',
  },
  'SP-5': {
    name: 'Specially planned, SouthSide Works',
    about: 'Allowed housing is set by the SouthSide Works plan.',
  },
  'SP-8': {
    name: 'Specially planned, Riverfront Landing',
    about: 'Allowed housing is set by the Riverfront Landing plan.',
  },
  'SP-9': {
    name: 'Specially planned, Bakery Square',
    about: 'Allowed housing is set by the Bakery Square plan.',
  },
  'SP-10': {
    name: 'Specially planned, Hazelwood Green',
    about: 'Allowed housing is set by the Hazelwood Green plan.',
  },
  'SP-11': {
    name: 'Specially planned, Lower Hill',
    about: 'Allowed housing is set by the Lower Hill planned development.',
  },
  GPRA: {
    name: 'Grandview Public Realm A',
    about: 'A Grandview Avenue public-realm district. Uses follow those rules, not the base residential table.',
  },
  GPRB: {
    name: 'Grandview Public Realm B',
    about: 'A Grandview Avenue public-realm district. Uses follow those rules, not the base residential table.',
  },
  GPRC: {
    name: 'Grandview Public Realm C',
    about: 'A Grandview Avenue public-realm district. Uses follow those rules, not the base residential table.',
  },
  'UPR-A': {
    name: 'Uptown Public Realm A',
    about: 'An Uptown public-realm district. Uses follow those rules, not the base residential table.',
  },
  'UPR-B': {
    name: 'Uptown Public Realm B',
    about: 'An Uptown public-realm district. Uses follow those rules, not the base residential table.',
  },
  'UC-E': {
    name: 'Urban Center, employment',
    about: 'An employment-focused urban center. Housing is secondary to jobs and institutions.',
  },
  'UC-MU': {
    name: 'Urban Center, mixed use',
    about: 'A mixed-use urban center where housing can be part of a larger project.',
  },
}

/** Families that add a density suffix, such as R1D-L or R2-VH. */
const FAMILIES: Record<string, Entry> = {
  R1D: {
    name: 'Single-unit detached residential',
    about: 'Houses on their own lots. Attached homes, duplexes, and apartments are generally not the purpose of this district.',
  },
  R1A: {
    name: 'Single-unit attached residential',
    about: 'Townhomes and rowhouses. Larger apartment buildings are generally not the purpose of this district.',
  },
  R2: {
    name: 'Two-unit residential',
    about: 'Duplexes and two-unit houses. Larger apartment buildings are generally not the purpose of this district.',
  },
  R3: {
    name: 'Three-unit residential',
    about: 'Small buildings of about three units. Larger apartment buildings are generally not the purpose of this district.',
  },
  RM: {
    name: 'Multi-unit residential',
    about: 'Apartment buildings. Smaller house types are often allowed as well.',
  },
}

const ALLOWANCE: Record<ZoningStatus, (typeLabel: string) => string> = {
  by_right: (typeLabel) => `${typeLabel} is allowed by right in this district.`,
  special_exception: (typeLabel) =>
    `${typeLabel} needs a special exception before it can be built in this district.`,
  conditional_use: (typeLabel) =>
    `${typeLabel} needs conditional-use approval before it can be built in this district.`,
  not_permitted: (typeLabel) => `${typeLabel} is not permitted in this district.`,
  unknown: (typeLabel) =>
    `The allowance for ${typeLabel} in this district has not been verified.`,
}

export function describeDistrict(code: string): DistrictDescription {
  const key = code.trim().toUpperCase()
  const exact = EXACT[key]
  if (exact) return exact

  const parts = key.split('-')
  const suffix = parts[parts.length - 1] ?? ''
  if (parts.length > 1 && DENSITY[suffix]) {
    const family = FAMILIES[parts.slice(0, -1).join('-')]
    if (family) {
      return {
        name: `${family.name}, ${DENSITY[suffix]}`,
        about: family.about,
      }
    }
  }

  const family = FAMILIES[parts[0] ?? '']
  if (family) return family

  return {
    name: 'Zoning district',
    about: 'This code is on the Pittsburgh zoning map. The housing allowance comes from the zoning matrix.',
  }
}

export function allowanceSentence(typeLabel: string, status: ZoningStatus): string {
  return ALLOWANCE[status](typeLabel)
}

/** Plain-text hover used by the map, which cannot render the chip tooltip. */
export function districtHoverText(
  code: string,
  options?: { typeLabel?: string; status?: ZoningStatus },
): string {
  const described = describeDistrict(code)
  const lines = [`${code} · ${described.name}`, described.about]
  if (options?.typeLabel && options.status) {
    lines.push(allowanceSentence(options.typeLabel, options.status))
  }
  return lines.join('\n')
}
