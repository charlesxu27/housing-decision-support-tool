# Data pipeline

Offline, reproducible Python build that turns public Allegheny County and City of
Pittsburgh data into the versioned static snapshot the web app loads from
`web/public/data/`. The browser never calls a public API; it only reads the
files described here.

```sh
python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
.venv/bin/python -m hdst_pipeline fetch      # downloads into data/raw/ (gitignored)
.venv/bin/python -m hdst_pipeline build      # writes web/public/data/
.venv/bin/python -m hdst_pipeline validate   # re-checks the exported snapshot
.venv/bin/pytest pipeline/tests
```

`tippecanoe` (Homebrew) is required for the parcel vector tiles.

Optional inputs (the build runs without them and records the gap in the manifest):

| Item | Where | Effect when absent |
| --- | --- | --- |
| `CENSUS_API_KEY` in `.env` | repo root | Not needed: ACS is read from the keyless summary-file bulk downloads. |
| HUD CHAS tract zip (e.g. `2018thru2022-140-csv.zip`) | `data/raw/chas/` | HUD's download is behind a bot check. Without it, income-banded cost burden is null and the ACS gross-rent-burden share is used for the `cost_burdened_renters` measure. |
| Reviewed `pipeline/zoning/pittsburgh_matrix.csv` | in repo | Rows without `verified_by` are exported as `draft`; the UI labels them "draft, not human-verified". |

## Sources (organizer catalog)

All URLs are pinned in `pipeline/sources.yaml` with vintage, license, retrieval
date, checksum, and the fields retained. Owner names and mailing addresses from
the assessment file are never read past the raw download.

| id | Dataset | Resource | Use |
| --- | --- | --- | --- |
| `acs5` | ACS 5-year 2020-2024 table-based summary files (`acsdt5y2024-<table>.dat`) | `https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/` | NEED (tables B11016, B11007, B25003, B25002, B25004, B25014, B25024, B25041, B25070, B19013, B25064) |
| `tiger_tracts` | TIGER/Line 2024 tracts, PA | `https://www2.census.gov/geo/tiger/TIGER2024/TRACT/tl_2024_42_tract.zip` | Analysis areas |
| `chas` | HUD CHAS 2018-2022 tract tables (optional, user-supplied) | `https://www.huduser.gov/portal/datasets/cp.html` | NEED (income-banded cost burden) |
| `parcels` | Allegheny County Parcel Boundaries (Sept 2026) | WPRDC resource `be216088-d51c-41ce-aa4a-2c315c2c7725` (shapefile) | FIT, tiles |
| `assessments` | Allegheny County Property Assessments | WPRDC resource `9a1c60bd-f9f7-4aba-aeb7-af8c3aaa44e5` | FIT (lot area, use, building value) |
| `delinquency` | Delinquent County Real Estate Taxes (cumulative) | WPRDC resource `96e9d6b2-3e1a-4a0c-8ef6-23a049c263d8` | FIT rehab candidates |
| `condemned` | Condemned and Dead-End Properties | WPRDC resource `0a963f26-eb4b-4325-bbbc-3ddf6a871410` | FIT rehab candidates |
| `city_owned` | City-Owned Properties | WPRDC resource `e1dcee82-9179-4306-8167-5891915b62a7` | FIT rehab candidates |
| `zoning` | Pittsburgh Zoning districts | WPRDC resource `6127f35e-f36b-4a53-80b3-f4409609e9df` (GeoJSON) | ALLOWED |
| `municipalities` | Allegheny County Municipal Boundaries | WPRDC resource `b0cb0249-d1ba-45b7-9918-dc86fa8af04c` | Summaries |
| `neighborhoods` | Pittsburgh Neighborhoods | WPRDC resource `4af8e160-57e9-4ebf-a501-76ca1b42fc99` | Summaries |
| `flood` | FEMA NFHL S_FLD_HAZ_AR, DFIRM 42003C | `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query` | FIT gate/penalty, overlay |
| `slopes` | Pittsburgh 25% or Greater Slope | WPRDC resource `5ce91a56-0799-46ea-9585-13fa8db5979e` | FIT (City only) |
| `undermined` | Undermined Areas | WPRDC resource `e1d96015-818f-46fb-88dd-85c20eacb96c` | FIT flag |
| `gtfs` | PRT GTFS (latest in GTFS Archive) | WPRDC dataset `gtfs-archive` | Transit access |
| `future_ready` | Future Ready PA Index, SY 2024-2025 (school assessment file and school fast facts) | `https://futurereadypa.org/Home/DataFiles` | School math and reading scores |
| `school_districts` | TIGER/Line 2024 unified school districts, PA | `https://www2.census.gov/geo/tiger/TIGER2024/UNSD/tl_2024_42_unsd.zip` | Which district covers each tract |
| `pps_attendance` | Pittsburgh Public Schools feeder-pattern attendance boundaries (elementary, middle, high) | WPRDC dataset `pittsburgh-public-schools-feeder-pattern-attendance-boundaries` | Which school serves each Pittsburgh tract |

## Exported files (`web/public/data/`)

TypeScript contracts live in `web/src/data/types.ts`; the pipeline validates
its own output against the same shapes before writing.

| File | Contract | Notes |
| --- | --- | --- |
| `manifest.json` | `DataManifest` | Build time, model version, config hash, per-file sha256/bytes/rows, sources, null coverage, counts, parcel tile descriptor. |
| `area_metrics.json` | `AreaMetricsFile` | One `AreaRecord` per tract plus `SummaryArea` records for every municipality and City neighborhood. |
| `analysis_areas.geojson` | `AnalysisAreaProperties` | Tract polygons (simplified ~5 m). |
| `municipalities.geojson` | `SummaryAreaProperties` | County municipal boundaries, `id = muni:<name slug>`. |
| `pittsburgh_neighborhoods.geojson` | `SummaryAreaProperties` | `id = hood:<slug>`. |
| `zoning_pittsburgh.geojson` | `ZoningDistrictProperties` | Base zoning districts. |
| `zoning_matrix.json` | `ZoningMatrix` | Built from `pipeline/zoning/pittsburgh_matrix.csv`. |
| `overlays/flood_zones.geojson` | `FloodZoneProperties` | SFHA polygons, dissolved by zone, simplified. |
| `overlays/transit_stops.geojson` | `TransitStopProperties` | Stops with weekday scheduled trips. |
| `overlays/steep_slopes.geojson`, `overlays/undermined.geojson` | `{}` | Hazard overlays, simplified. |
| `tiles/parcels/{z}/{x}/{y}.pbf` + `tiles/parcels/metadata.json` | `ParcelTileProperties` | Uncompressed MVT directory from tippecanoe, layer `parcels`, zoom 13-16. |

## Models (deterministic; thresholds in `pipeline/config/model.yaml`)

**Geography.** Parcels are assigned to a tract, municipality, and City
neighborhood by representative point. Tract `muni` is the municipality with the
most parcels. `SummaryArea.members` weights are the parcel counts in each tract
x summary overlap.

**NEED (tract).** Household and stock shares from ACS with MOE-derived
reliability flags (coefficient of variation > 0.40 or households < 50 => flag).
Segment gaps: `small = hh_1_2 - (br_0_1 + br_2)`, `large = hh_5_plus - br_3_plus`
plus overcrowding, `senior = senior_alone`, `burden = cost_burdened_renters`,
`vacancy = other_vacant_share`, plus `renter_share`. Per-type score = weighted
sum of min-max scaled gaps (weights in config). Bands are county tertiles of
the score: top third `high`, middle `medium`, bottom `low`. `uncertain` when
any contributing measure is flagged or missing.

**FIT (parcel -> tract).** Use classes from assessment `USEDESC`/`CLASS`; lot
area from `LOTAREA`; building presence from `COUNTYBUILDING > 0`. Rules per
type (square feet; assumptions):

| Type | Rule |
| --- | --- |
| adu | detached single-family with building, lot >= 5,000 |
| duplex_triplex | vacant lot >= 3,000, or single-family with finished area >= 2,400 and lot >= 4,000 |
| townhome | vacant lot >= 6,000 |
| small_apartment | vacant or commercial lot 8,000-43,560 with >= 60 weekday trips within 800 m |
| large_apartment | vacant or commercial lot >= 21,780 with >= 120 weekday trips within 800 m |
| senior_accessible | lot >= 8,000, not steep, >= 60 weekday trips within 800 m |
| rehab_reuse | has building and is condemned, city-owned, or county tax-delinquent |
| detached_sf | vacant lot >= 4,000 |

Any parcel intersecting a FEMA floodway is excluded from every type; parcels
intersecting mapped >= 25% slopes are excluded from new-construction types.
Homes per parcel ranges per type are in config. Tract `fit.band` = county
tertiles of suitable-parcel count for that type (`low` when zero).

**ALLOWED (parcel -> tract).** City parcels take the zoning district by
representative point; the matrix maps district x type -> status. Outside the
City every status is `unknown`. Tract `allowed[type]` is the status covering the
most residential-capable parcels; `allowedShares` carries the full breakdown.

**Risk.** `displacement = 0.4*renter_share + 0.3*cost_burdened_renters +
0.3*(1 - clamp(median_income / county_median, 0, 1))` (null if any input
missing). Flood/floodway/slope/undermined shares are parcel-intersection shares;
`floodway = floodwayShare >= 0.5`.

**Transit.** Weekday trips per stop from GTFS `stop_times` on the busiest
regular weekday service; `transitTrips800m` sums trips at stops within 800 m of
the tract centroid (EPSG:32617).

**Opportunity context (sidebar, not a match input).** `opportunity.medianHouseholdIncome`
is ACS B19013 for the tract; `countyMedianHouseholdIncome` is the same table for
Allegheny County. Each tract is assigned the TIGER unified school district that
covers the largest share of its land. `schools` lists the elementary, middle,
and high school for that tract. Inside Pittsburgh those are the feeder
attendance zones (largest overlap, at least 5% of the tract). Elsewhere each
level is the nearest regular school in the district. `districtProficient` is
the enrollment-weighted mean of each tested school's math and reading shares
for that whole district. `mathProficient` and `elaProficient` mirror the
elementary school. Shares are in 0..1; suppressed Future Ready cells stay null.
They do not change Need, Fit, or Allowed. The sidebar turns those shares into
letter grades (A at 80% or higher, then B, C, D, and F below 20%).

**Confidence.** Share of the required measures present and unflagged, times
1.0 in the City and 0.85 outside it (slope layer missing).

## Zoning matrix review

`pipeline/zoning/pittsburgh_matrix.csv` columns:
`district,type,status,min_lot_sqft,section,quote,verified_by,verified_at,notes`.
Draft rows were extracted from the Pittsburgh Zoning Code Title 9 use table
(Chapter 911) and must be checked by a person before the app can mark them
verified. See `pipeline/zoning/review.md`.
