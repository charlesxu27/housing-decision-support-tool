# MVP Task Backlog

This backlog implements the MVP in `implementation_plan_map_feature.md` for local development only. Deployment, LLM features, the zoning simulator, and live data ingestion are out of scope for this slice.

## Task 1 — Local application scaffold

**Owner:** Frontend  
**Status:** Complete

Acceptance criteria:
- Vite + React + TypeScript app runs with `npm run dev`.
- `npm test`, `npm run lint`, and `npm run build` are available.
- MapLibre and deck.gl dependencies are installed.
- README contains local setup commands.

## Task 2 — Deterministic domain model and fixture data

**Owner:** Scoring/data contract
**Status:** Complete

Acceptance criteria:
- Types cover all eight housing types and Need, Fit, Allowed, and Match Status.
- Match status is derived by a pure function, including floodway and unknown-zoning cases.
- At least six geographically valid fixture records represent Homewood, Wilkinsburg, and nearby places; H3 IDs may be used internally but are not the visible map geography.
- UI clearly labels fixture values as illustrative, not authoritative.
- Unit tests exercise every match-status branch.

## Task 3 — Interactive match map

**Owner:** Frontend/map
**Status:** Complete

Acceptance criteria:
- OpenStreetMap-derived basemap can be dragged, zoomed, pitched, and rotated.
- deck.gl renders recognizable neighborhood/planning-area boundaries at summary zoom and parcel polygons at detailed zoom.
- Mixed regional statuses show a breakdown instead of a misleading dominant color.
- The user can switch between Match Status and What's Missing views.
- Hover shows a concise explanation; click selects a place.
- A municipality/place selector moves the map to the selected area.

## Task 4 — Place report

**Owner:** Frontend/domain
**Status:** Complete

Acceptance criteria:
- Selected place shows household demand versus existing stock.
- All eight housing types show Need, Fit, Allowed, suitable parcels, and possible homes.
- Provenance badges distinguish observed, derived, assumption, law, and user values.
- Unknowns and limitations are visible without opening developer tools.

## Task 5 — Scenario comparison

**Owner:** Frontend/scoring
**Status:** Complete

Acceptance criteria:
- User compares at least two predefined scenarios for the selected place.
- Five normative sliders re-rank scenarios without changing factual Need/Fit/Allowed values.
- Scorecard covers households served, land fit, zoning path, displacement, carbon, climate, and speed.
- Scenario ranking is deterministic and unit tested.

## Task 6 — MVP verification

**Owner:** Team
**Status:** Complete for automated checks; manual keyboard and browser checks remain

Acceptance criteria:
- Unit tests, lint, TypeScript compilation, and production build pass.
- Keyboard users can reach major controls and select a map place through the place selector.
- Empty/unknown data does not crash the interface.
- README accurately states fixture-data limitations and local run instructions.

## Follow-on data tasks

These can proceed in parallel once the UI contract is stable:

1. Replace household and housing-stock fixtures with ACS/CHAS tract data, retaining margins of error.
2. Replace Fit fixtures with county parcel/assessment aggregates and hazard joins.
3. Build and human-verify the City of Pittsburgh zoning allowance matrix with exact code citations.
4. Add authoritative municipality boundaries, flood, transit, zoning, and Homewood parcel overlays.
