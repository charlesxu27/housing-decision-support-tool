export type RankedType = {
  id: string;
  label: string;
  blurb: string;
  score: number;
  eligibility: string;
  why: string;
  flags: string[];
};

export type RecommendResponse = {
  card: {
    address?: string | null;
    in_city: boolean;
    parcel: {
      pin: string;
      mapblocklo?: string;
      municode?: number;
      acreage?: number;
      lot_sqft?: number | null;
    };
    assessment: Record<string, unknown> | null;
    zoning: { code?: string; name?: string; ordinance_url?: string } | null;
    hazards: {
      steep_slope_25pct: boolean;
      undermined: boolean;
      flood: { zone?: string; sfha?: boolean; subtype?: string | null } | null;
    };
    transit: {
      stops_400m: number | null;
      stops_800m: number | null;
      nearest_m: number | null;
      nearest_name: string | null;
      nearest_kind: string | null;
      nearest_network: string | null;
    };
    acs: Record<string, unknown> | null;
    flags: Record<string, boolean>;
    sources: { name: string; url: string }[];
  };
  geometry: GeoJSON.Polygon | null;
  ranked: RankedType[];
  narrative: {
    headline: string;
    summary: string;
    demand: string;
    transit: string;
    equity: string;
    climate: string;
    cost: string;
    size: string;
    sources_note: string;
  };
  engine: string;
};

export const BOOKMARKS = [
  {
    id: "east-liberty",
    label: "East Liberty",
    hint: "Example lot on a transit-rich mixed-use corridor",
    lat: 40.4614,
    lon: -79.9262,
  },
  {
    id: "south-slopes",
    label: "South Side Slopes",
    hint: "Example hillside lot with steep-slope constraints",
    lat: 40.4236,
    lon: -79.9749,
  },
  {
    id: "strip",
    label: "Strip District",
    hint: "Example riverfront lot for conversion and flood screening",
    lat: 40.453,
    lon: -79.9835,
  },
];
