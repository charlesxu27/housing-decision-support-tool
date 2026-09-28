# Implementation Plan: Allegheny Housing Match Map

**AI for Housing Hackathon · AI Horizons 2026 · Track 03: Housing Typology, Equity & Climate Matchmaker**
*Living doc. Owner: frontend/map. Last updated Sat Sept 26, ~7 p.m. ET.*

---

## 0. The idea in one breath

> A simple label such as "missing middle" does not tell a planner, nonprofit, or developer whether a particular neighborhood **needs** duplexes, apartments, townhomes, accessory units, senior housing, or another option, or whether current zoning **allows** it. — Track 3 brief

Most teams will build a **site-suitability score**: one number per place that says "good for housing." That answers *where*, but not *what* or *what's stopping it*.

We answer three separate questions for every place in Allegheny County, for every housing type, and never blend them into one number:

| | Question | Answered by | Kind of answer |
| :---- | :---- | :---- | :---- |
| **NEED** | Who lives here, and which households does the current housing stock fail? | Census household mix vs the housing stock that exists | **Data** |
| **FIT** | Can this type physically and sensibly go here? | Lots, vacant land and buildings, transit, hazards | **Data + stated assumptions** |
| **ALLOWED** | Does current zoning permit it, and with what approval? | Zoning map + zoning code, with section citations | **Law (as we read it; verify)** |

Then a fourth layer, **TRADEOFFS**, is where the user's values enter: displacement, carbon, climate risk, affordability depth, and speed. **Values change priorities; they never change the facts.** Moving a slider cannot make a flood zone safer or a zoning district more permissive. This design directly answers the brief's test: *"understand which conclusions are data-driven versus value judgments."*

Combining NEED × FIT × ALLOWED gives each place-and-type a **match status**, which is the map's hero view:

| Match status | Meaning | What a municipality does with it |
| :---- | :---- | :---- |
| 🟢 **Ready match** | Needed, fits, allowed by right | Fast-track, market to builders, pre-approve plans |
| 🟡 **Needs approval** | Needed, fits, allowed only with special exception / conditional use | Streamline the approval process |
| 🟣 **Blocked by zoning** | Needed, fits, **not permitted** | **Zoning reform candidate.** This is the policy lever. |
| 🔵 **Needed but hard** | Needed, but land/hazards/infrastructure make it hard | Needs investment (land assembly, remediation, subsidy) |
| ⚪ **Low priority** | Allowed or buildable, but local need is low | Don't prioritize here |
| ▨ **Zoning unknown** | Outside the zoning data we have | Check with the municipality's zoning officer |

The **"Blocked by zoning"** map is the result judges won't see from other teams: *"Here is where your own code prevents the housing your residents need."*

---

## 1. Decisions assumed (override here if you disagree; locked at 9 p.m. ET Sat)

| Decision | Default | Why |
| :---- | :---- | :---- |
| Map unit | **Multi-scale geography:** municipalities/neighborhoods when zoomed out, Census block groups/planning areas at medium zoom, and parcels when zoomed in | Each question appears on the geography that actually supports it: household need on Census areas, zoning on districts/parcels, and physical fit on parcels. Regions with mixed parcel results show a breakdown instead of a misleading dominant status. |
| Rendering | **deck.gl** on **MapLibre GL** with an OpenStreetMap-based basemap | Real pan/zoom/tilt, WebGL 3D extrusion, no API key. Three.js has no map projection or tiles. |
| App | **Vite + React + TypeScript** on **Vercel**; serverless functions only for LLM calls | Static, fast, key stays server-side. |
| Pipeline | **Python** (GeoPandas + h3-py), offline, outputs static JSON | Demo never depends on live APIs. |
| Zoning coverage | **City of Pittsburgh** in MVP; one more municipality via AI-assisted extraction is MVP+ | Only the City publishes zoning as open GIS data in the catalog. |

This plan supersedes the Streamlit UI in §5 step 4 of the Team Plan. Its scoring and data-prep ideas carry over.

**Map presentation decision (updated during implementation):** H3 remains useful as an optional internal aggregation/indexing tool, but it is not the primary visible geography. The interface uses recognizable administrative and parcel boundaries over an OpenStreetMap street basemap. At county/city zoom it summarizes the share of underlying sites in each status; at parcel zoom it colors the actual site. Real countywide parcels will be packaged as vector tiles/PMTiles so the browser loads only the current viewport.

---

## 2. Housing types we match

The brief names duplexes, apartments, townhomes, accessory units, senior housing, "or another option." We cover all of these, plus one option most tools miss.

| Type | Typical scale | Households it tends to serve |
| :---- | :---- | :---- |
| **Accessory dwelling unit (ADU)** | 1 extra unit on an existing lot | Singles, older adults near family, caregivers; small renters |
| **Duplex / triplex** (new or conversion) | 2–3 units | Small households, owner-occupant + renter, multigenerational |
| **Townhomes / rowhouses** | Attached, 2–3 bedrooms | Families, first-time buyers |
| **Small apartment building** (4–19 units, "missing middle") | Corridor infill | Singles, couples, young workers, downsizers |
| **Mid-size / large apartments** (20+ units) | Near frequent transit | Renters across incomes; the scale where tax-credit (LIHTC) deals usually work |
| **Senior / accessible housing** | Single-level, elevator, near services | Older adults, people with disabilities |
| **Rehab & reuse of vacant homes** | Existing structures | First-time buyers, low-to-moderate income; lowest embodied carbon; no land needed |
| **Detached single-family** | 1 unit per lot | Larger households seeking ownership |

**Why "rehab & reuse" matters here:** Allegheny County has a large stock of vacant, tax-delinquent, and condemned homes. Sometimes the best answer is not new construction. This is a local insight judges from housing practice will recognize.

---

## 3. How this earns each judging criterion

| Criterion | What earns it |
| :---- | :---- |
| **Problem Value** | Directly attacks the brief's stated gap: *which* type a place needs and *whether zoning allows it*. Missing-middle feasibility and zoning navigation are both named bottlenecks. |
| **User Fit & Usability** | Planners' actual questions as map views ("Where are duplexes blocked by zoning?"). Plain-language status labels, not decimal scores. Municipality search, shareable links. |
| **Technical Execution** | Static data + client-side scoring: nothing can time out live. Deployed URL. Unit-tested scoring. |
| **Data & AI Integrity** | Facts vs values separated by design. Every number tagged *Observed / Derived / Assumption / Your values* with source and vintage. Census margins of error shown as Low/Med/High bands, not false precision. Zoning cells carry code section citations and a "human-verified" status. LLM never produces numbers or rules unchecked. No PII. |
| **Actionability** | Outputs are municipal actions: fast-track list, zoning reform candidates with **"parcels unlocked / homes possible"** counts, an exportable screening brief with next steps. |
| **Continuation Potential** | Adding a municipality = extracting its zoning table (AI-drafted, human-verified workflow we demo). Natural owners: Allegheny County Economic Development, CONNECT (council of municipalities), City Planning, URA. |

---

## 4. User experience

### 4.1 Layout

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ [Search municipality / neighborhood]  Housing type: [Duplex/triplex ▾]  [2D|3D]│
│ View: (Match status) (What's missing) (Tradeoffs) (Where values disagree)      │
├────────────────┬───────────────────────────────────────┬──────────────────────┤
│ WHAT YOU VALUE │                                       │ PLACE REPORT         │
│ Lens: [Bal. ▾] │                                       │ Homewood North       │
│ Anti-displ ━●━ │          INTERACTIVE MAP              │ Who lives here vs    │
│ Low carbon ━━● │     (drag, zoom, tilt, rotate)        │ what homes exist     │
│ Climate    ━●━ │                                       │ ▇▇▇ ▇ mirror chart   │
│ Deep afford ●━ │                                       │ Type-by-type table:  │
│ Speed      ━●━ │                                       │ Need·Fit·Allowed     │
│                │                                       │ [Build scenarios]    │
│ [Zoning        │   Legend · confidence hatching        │ [Add to shortlist]   │
│  simulator]    │                                       │ Sources ⓘ            │
└────────────────┴───────────────────────────────────────┴──────────────────────┘
 Decision-support prototype. Not zoning, legal, or financial advice.
```

### 4.2 Map views

| View | Planner's question | Encoding |
| :---- | :---- | :---- |
| **Match status** (hero) | "Where are duplexes needed, feasible, and allowed?" (choose any type) | Six colorblind-safe categorical colors (Okabe-Ito palette) from §0. 3D height = number of suitable parcels. |
| **What's missing** | "What housing does this place lack most?" | Census areas colored by the type with the largest need gap; opacity = gap size. |
| **Tradeoffs** | "Where does opportunity collide with displacement risk?" | 3×3 bivariate palette (match strength × displacement risk). |
| **Where values disagree** | "Does the answer depend on who's asking?" | Highlights areas whose priority rank changes most between two lenses (e.g. planner lens vs community lens). |

**Confidence is everywhere, not a separate view:** areas with high Census margins of error or missing indicators are drawn with hatching; "zoning unknown" has its own pattern. At summary zoom, mixed statuses are shown as mixed with a count/share breakdown—not collapsed to whichever status has a bare majority.

**Overlays:** FEMA flood zones, transit stops sized by weekday trips, municipal boundaries + labels, City zoning districts, undermined areas, vacant/condemned parcels (demo neighborhoods).

**Interactions:** drag, zoom, Ctrl-drag to tilt/rotate; hover tooltip ("Duplex: Blocked by zoning — needed, fits, not permitted in R1D"); click opens the Place Report; municipality search flies there and lists its top areas/parcels per status. The rendered layer transitions from neighborhoods to planning areas/block groups to parcels as the user zooms.

### 4.3 Place Report (click a neighborhood, planning area, or parcel)

1. **"Who lives here vs. what homes exist here"** mirror chart (the NEED story at a glance):
   - Left bars: households by size (1, 2, 3–4, 5+), age 65+ living alone, income band (HUD income bands from CHAS), cost-burdened renters, overcrowded households.
   - Right bars: housing stock by structure type (detached, attached, 2, 3–4, 5–19, 20+ units) and bedrooms (0–1, 2, 3, 4+).
   - Callout, generated from rules: *"58% of households have 1–2 people, but only 14% of homes have 0–1 bedrooms. Small units are underbuilt here."*
2. **Type-by-type table**: one row per housing type with **Need** (High/Med/Low + reason), **Fit** (High/Med/Low + number of suitable parcels + homes-possible range), **Allowed** (✅ by right / ⚠️ needs approval / ⛔ not permitted / ? unknown, with code section), and **Match status**.
3. **Tradeoffs** for the top matches: displacement pressure, carbon per home, climate exposure, depth of affordability, speed to build.
4. **Who benefits / who might be harmed**: rule-generated, specific statements, e.g. *"New market-rate apartments here would serve young renters (high need) but rent growth of 31% over 5 years and a 64% renter share signal displacement pressure on existing tenants."*
5. **Provenance** on every value: `Observed` · `Derived` · `Assumption` · `Your values`, with source, vintage, and caveat on hover.
6. **What we don't know here**: e.g. *"Sewer capacity is not in our data. Zoning for Wilkinsburg has not been human-verified."*
7. Actions: **Build scenarios**, **Add to shortlist**.

**Parcel drill-down (demo neighborhoods):** click a lot to see lot area, current use, vacancy, zoning district, and a per-type check: *"ADU: lot is 4,200 sq ft; district R1A; ⛔ not permitted — would be allowed if §[x] were amended."*

### 4.4 Scenario Builder (the brief's success test)

*"A user can compare at least two housing scenarios for a real place, see why the tool ranked them differently, change normative weights, and understand which conclusions are data-driven versus value judgments."*

The user picks a place and a target (e.g. **"40 new homes in Homewood"**). The tool proposes three starting scenarios, all editable with +/− steppers per type:

- **Gentle density:** 10 ADUs + 8 duplexes (16 homes) + 14 rehabbed vacant homes.
- **Transit apartments:** one 40-unit building near the East Busway.
- **Senior-first:** 24 senior/accessible units + 16 ADUs.

Side-by-side scorecard for 2–3 scenarios:

| Row | How computed | Tag |
| :---- | :---- | :---- |
| **Households served** | Share of the place's unmet need (by household segment) that the mix addresses | Derived |
| **Land needed vs available** | Parcels/acres required vs suitable parcels found | Derived |
| **Zoning path** | Homes by right / need approval / need rezoning | Law (cited) |
| **Displacement pressure** | Market-rate share × local displacement risk → Low/Med/High | Derived + Assumption |
| **Carbon** | Embodied carbon per home (by type) + annual operating + transportation (location vehicle-miles) → range | Assumption + Observed |
| **Climate exposure** | Homes placed on flood / steep slope / undermined parcels | Observed |
| **Infrastructure** | Infill on existing streets vs needs extension | Derived (proxy) |
| **What this can't tell you** | Cost, financing, sewer capacity, community preference | — |

Then:
- **Ranking under your values**: the scenarios are ranked by the TRADEOFFS sliders, with a delta bar showing which rows drove the difference.
- **What would flip it**: *"If you weighted low carbon 25% less, Transit apartments would rank first."* This is computed by sweeping each weight.
- **Data vs values split**: each scorecard row is visibly marked as fact or value, so a judge sees which parts of the ranking are opinion.

### 4.5 Zoning Simulator (the policy lever)

For the City of Pittsburgh (and any municipality we add): *"What if we allowed [duplexes] by right in [R1D and R1A] with a minimum lot of [3,000] sq ft?"*

Instantly shows:
- **Parcels unlocked** and **homes possible** (range), countywide and in the selected place.
- How many **"Blocked by zoning"** hexes become **"Ready match"**; the map animates the change.
- Who those new homes would serve (from the NEED model) and any tradeoff flags (flood-zone parcels unlocked, displacement-risk areas affected).

This runs client-side on precomputed per-hex parcel counts by zoning district × lot-size band × current use (§6.3), so it is instant and doesn't need parcel geometry.

Framing on screen: *"Illustrative screening of a hypothetical rule. Actual code amendments require legal review and public process."*

### 4.6 Community lens and sharing

- All state (place, type, view, weights, scenarios, simulator rule) is encoded in the **URL**. A planner can send a link to a community meeting; residents set their own weights and send a link back.
- **"Where values disagree"** can compare any two saved lenses, e.g. the planning department's vs a community group's. This makes "community partners who want a say" (from the track description) concrete at almost no extra build cost.

### 4.7 Shortlist and screening brief (human in the loop)

- Add places or parcels to a shortlist with notes (`localStorage`; no accounts, no server storage).
- **Export screening brief** (print-to-PDF page + CSV): place, match statuses, chosen scenario, weights used, simulator rule if any, sources with vintages, limitations, and a **verification checklist**:
  - Confirm zoning with the municipal zoning officer (cite section).
  - Confirm ownership and disposition (vacant is not the same as available).
  - Site survey / geotechnical review for slopes and undermining.
  - Community engagement before any proposal.
- This is the escalation path: the tool screens; people decide.

---

## 5. The models (transparent on purpose)

All thresholds, mappings, and profiles live in JSON config and are labeled as assumptions in the UI. Stella reviews them Saturday night; SME office hours validate them Sunday 10 a.m.

### 5.1 NEED: household–housing mismatch

For each Census tract (assigned to hexes), compare **household segments** to the **stock suitable for them**:

| Household segment | Measure (ACS / CHAS) | Stock that serves it | Types that address the gap |
| :---- | :---- | :---- | :---- |
| Small households (1–2 people) | Share of households | Share of 0–1 bedroom and 2-bedroom units | ADU, duplex, small apartments |
| Older adults living alone | Share 65+ living alone | Units in multi-unit / single-level buildings (proxy) | Senior/accessible, ADU, small apartments |
| Large / overcrowded households | Share 5+ people; >1 person per room | Share of 3+ bedroom units | Townhomes, detached, 3-bedroom duplex |
| Cost-burdened low-income renters | CHAS renters <50% of area median income paying >30% | Subsidized units (LIHTC database) | Large apartments (tax-credit scale), rehab with subsidy |
| Moderate-income would-be buyers | Households 80–120% of area median income, renter share | Entry-level ownership stock (proxy: low assessed-value owner units) | Townhomes, rehab, owner-occupied duplex |

Need for type *t* = sum over segments of (gap for that segment × how well *t* serves it), plus market pressure signals (low vacancy, rising rent). Reported as **High / Medium / Low**, and the band widens to "uncertain" when the Census margin of error is large relative to the estimate.

**Sanity check:** roll tract-level needs up to the **Allegheny County Housing Needs Assessment** subregions and compare directions. Report agreement or disagreement in the README.

### 5.2 FIT: can it go here?

Per type, from county assessments (lot area, land use, building presence, vacancy), parcel boundaries, and location layers:

| Type | Fit rule (config, labeled as assumption) |
| :---- | :---- |
| ADU | Detached single-family parcels with lot area ≥ threshold |
| Duplex / triplex | Vacant lots ≥ threshold, or large single-family homes (conversion) |
| Townhomes | Vacant lots/adjacent vacant lots ≥ threshold; slope penalty |
| Small apartments | Lots in threshold range within 800 m of frequent transit or on commercial corridors |
| Large apartments | Parcels ≥ ~0.5 acre (or adjacent vacant lots) near frequent transit |
| Senior / accessible | Low slope, near transit and services (groceries, clinics from OpenStreetMap) |
| Rehab & reuse | Count of vacant, tax-delinquent, or condemned structures |
| Detached single-family | Vacant lots ≥ threshold |

All types: flood zone penalty, **floodway = excluded**, steep slope and undermining penalties. Output per hex: **suitable parcel count**, **homes-possible range** (units per parcel range per type), and **Fit band**.

### 5.3 ALLOWED: zoning allowance matrix

A hand-checked table: `district × type → {status, min lot area, code section, verified_by, verified_at}`.

- **Status values:** `by_right`, `special_exception`, `conditional_use`, `not_permitted`, `unknown`.
- **Source:** Pittsburgh Zoning Code (use table and dimensional standards; cite exact sections found during extraction) + Pittsburgh Zoning Districts GIS layer.
- **Built with AI assistance, verified by a human** (§7.1). Unverified cells are shown as such.
- Overlays, exceptions, and variances are not modeled; the UI says so.

### 5.4 Match status

```
if floodway                                  → not recommended (hard gate)
if need = Low                                → Low priority
if fit = Low                                 → Needed but hard
if allowed = by_right                        → Ready match
if allowed ∈ {special_exception, conditional}→ Needs approval
if allowed = not_permitted                   → Blocked by zoning
if allowed = unknown                         → Zoning unknown
```

### 5.5 TRADEOFFS: where values enter

Five sliders, each tagged `Your values`:
- **Protect existing residents** (displacement)
- **Low carbon**
- **Climate safety**
- **Deep affordability** (serve the lowest incomes)
- **Speed to build** (by-right, no land assembly)

Five lenses (presets), each labeled *"This is a value choice, not a finding"*: Balanced, Transit-oriented growth, Anti-displacement first, Climate-safe, Fastest to build.

Weights affect: priority ranking of places within a match status, scenario ranking, and the disagreement view. **Weights never alter NEED, FIT, ALLOWED, or match status.**

### 5.6 Carbon per scenario

Per home, reported as a range:
- **Embodied:** per-unit construction carbon by type (detached > townhome > duplex > apartments; rehab lowest). Values from published life-cycle studies, cited in `typologies.json`, labeled assumption. *(Owner: find and cite 1–2 sources Saturday night.)*
- **Operating:** relative factor for shared walls / unit size (assumption, cited).
- **Transportation:** location vehicle-miles per household from HUD's Location Affordability Index × EPA per-mile emissions factor (observed + cited constant).

The point is not precision; it's showing that **location and form both matter**, and that rehab near transit usually wins on carbon.

### 5.7 Tests (per CONTRIBUTING)

`vitest` cases with hand-computed expectations: a 3-tract NEED example (including a missing value), FIT on 5 fake parcels (including floodway), each match-status branch, and the simulator's parcels-unlocked count on a tiny fixture.

---

## 6. Data

### 6.1 Sources (all from the organizer catalog)

| Layer | Source | Use | Coverage / caveat shown |
| :---- | :---- | :---- | :---- |
| Households: size, age, tenure, overcrowding, rent, vacancy; housing stock: units in structure, bedrooms | ACS 5-year (tract), via Census API | NEED | County. Margins of error → bands. |
| Cost burden by income band and tenure | HUD CHAS (tract) | NEED | Lags ACS ~2 years. |
| Subsidized units | HUD LIHTC database | NEED (existing supply) | Some geocodes approximate. |
| Lot area, land use, building presence, assessed value | County Property Assessments | FIT, simulator | Owner name / mailing fields **dropped**. Assessments can be stale. |
| Parcel polygons | County Parcel Boundaries | FIT, drill-down | Validate parcel IDs across datasets. |
| Tax delinquency, condemned properties, city-owned | WPRDC | FIT (rehab), drill-down | Vacant or delinquent ≠ available. |
| Zoning districts + zoning code | City of Pittsburgh | ALLOWED, simulator | City only. |
| Transit | PRT GTFS | FIT, tradeoffs | Scheduled ≠ reliable. |
| Flood | FEMA National Flood Hazard Layer | FIT gate/penalty | Not a flood determination. |
| Steep slopes | Pittsburgh ≥25% slope layer | FIT | City only; countywide from USGS elevation is stretch. |
| Undermining | Undermined Areas (WPRDC) | FIT | Historic maps incomplete. |
| Vehicle-miles, housing + transportation costs | HUD Location Affordability Index | Carbon, tradeoffs | Modeled estimates. |
| Services (grocery, clinic, pharmacy) | OpenStreetMap | FIT (senior) | Completeness varies; ODbL attribution. |
| Validation | Allegheny County Housing Needs Assessment | Sanity check | Subregion level only. |
| Boundaries | TIGER/Line, County GIS municipalities | Hex assignment | Match vintages to ACS. |

### 6.2 Pipeline steps

1. `fetch.py` downloads into `data/raw/` (gitignored) and records URL, vintage, download date, and license in `sources.yaml`.
2. `build_hexes.py`: H3 res 8 over the county; tag each hex with municipality, City neighborhood, and tract (by centroid).
3. `need.py`: tract-level segment shares and stock shares → gaps → per-type need bands, with margin-of-error flags.
4. `parcels.py`: join assessments to parcel polygons and to zoning districts, flood, slopes, undermining; drop PII; compute lot-size bands and use classes.
5. `fit.py`: per-hex suitable parcel counts and homes-possible ranges per type.
6. `aggregate_zoning.py`: per-hex counts by `district × lot band × use class` for the simulator.
7. `export.py`: writes `web/public/data/*.json`, including `sources.json` generated from `sources.yaml`.

### 6.3 Size budget

- `hexes.json`: ~2,600 hexes × ~40 numbers ≈ 0.5–1 MB (gzip much smaller). deck.gl's `H3HexagonLayer` draws hexes from IDs, so no geometry is shipped.
- `zoning_counts.json`: only ~200 City hexes × districts present × 4 lot bands × 4 use classes. Small.
- `parcels_demo.geojson`: two neighborhoods, a few thousand parcels, simplified. ~2–5 MB.

---

## 7. Where AI is used (and why it isn't a thin wrapper)

The deterministic model does the analysis. AI is used where it removes a real bottleneck, and every AI output is checkable.

### 7.1 AI-assisted zoning extraction (MVP for City; MVP+ for a second municipality)

- An LLM reads the zoning code's use table and dimensional standards and drafts rows of the allowance matrix as structured JSON (schema-validated), **each with the exact section cited and the quoted source text**.
- A human (Stella) verifies each row in a simple review table; `verified_by` is recorded. Only verified rows show as ✅/⚠️/⛔; unverified rows show as "draft — not verified."
- **Continuation story:** this is how the tool scales to the county's other 129 municipalities. We demo it once live (e.g. Wilkinsburg's ordinance) to show the workflow.

### 7.2 "Ask the map" (MVP+)

- A planner types: *"Where could we put senior housing near frequent transit, outside flood zones, in Penn Hills?"*
- The LLM translates it into a **structured filter** (type, statuses, municipalities, thresholds) validated against a schema. Deterministic code runs the filter. The applied filters appear as editable chips, so the user sees exactly what was interpreted.
- The LLM never produces the answer, only the query.

### 7.3 Plain-language explanations (MVP+)

- Place Report and Scenario scorecards can be summarized in ≤120 words.
- **Guardrail:** every number in the output must appear in the input JSON (regex check with rounding tolerance); otherwise the template text is shown. The UI labels "AI-written summary" vs "Standard summary."
- 4-second timeout; responses cached by `hash(place + scenario + weights)`.

All LLM calls go through Vercel functions; the API key is never sent to the browser.

### 7.4 Future grounded chatbot

The future chatbot architecture is specified in [`rag_chatbot_implementation_plan.md`](rag_chatbot_implementation_plan.md). It keeps the map's Need, Fit, Allowed, match statuses, and scenario rankings deterministic, while retrieving cited source definitions, methodology, selected-place/scenario facts, and exact human-verified zoning excerpts.

The first local version is explicitly a **deterministic grounded preview** using metadata filters, lexical matching, templates, and citations—no embeddings, vector database, or LLM. A later **true RAG** implementation adds hybrid vector/lexical retrieval and server-side LLM synthesis behind the same `/api/chat` contract. Neither mode provides binding zoning or legal advice; unverified, stale, conflicting, or missing legal evidence must escalate to human review.

---

## 8. Architecture

```
Offline (Python)                                   Browser (TypeScript)
───────────────────────────────                    ────────────────────────────────────
fetch → data/raw (gitignored)                      Vite + React
need.py · parcels.py · fit.py                       ├─ MapLibre basemap (OSM-based tiles)
aggregate_zoning.py                                 ├─ deck.gl H3HexagonLayer / GeoJsonLayer
zoning extraction + human review                    ├─ model/ need · fit · allowed · match
export.py ──► web/public/data/*.json ─────────►     │         scenarios · simulator · tradeoffs
                                                    ├─ panels/ PlaceReport · ScenarioBuilder
                                                    │          ZoningSimulator · Values · Shortlist
                                                    └─ URL state (shareable)
                                                           │
                                                    Vercel functions: /api/explain, /api/ask
                                                           → LLM → schema/number checks → fallback
```

### 8.1 Repository layout

```
pipeline/
  requirements.txt  sources.yaml
  fetch.py  build_hexes.py  need.py  parcels.py  fit.py  aggregate_zoning.py  export.py
  zoning/extract.py  zoning/pittsburgh_matrix.csv  zoning/review.md
  tests/
web/
  api/explain.ts  api/ask.ts
  public/data/
    hexes.json  zoning_counts.json  zoning_matrix.json  typologies.json  segments.json
    lenses.json  factors.json  sources.json  municipalities.geojson  parcels_demo.geojson
    overlays/flood.geojson  transit_stops.geojson  zoning_city.geojson
  src/
    data/types.ts  data/load.ts
    model/need.ts  fit.ts  allowed.ts  match.ts  scenarios.ts  simulator.ts  tradeoffs.ts
    model/*.test.ts
    map/MapView.tsx  layers.ts  palettes.ts
    panels/PlaceReport.tsx  MirrorChart.tsx  TypeTable.tsx  ScenarioBuilder.tsx
           ZoningSimulator.tsx  ValuesPanel.tsx  Legend.tsx  Provenance.tsx
           Shortlist.tsx  ScreeningBrief.tsx  AskBar.tsx
    state/store.ts  state/url.ts
```

### 8.2 Libraries

| Purpose | Library |
| :---- | :---- |
| Map + basemap | `maplibre-gl`, `react-map-gl/maplibre`; OpenFreeMap style (no key), CARTO Positron fallback. Never hit `tile.openstreetmap.org` directly (usage policy). |
| Data layers, 3D | `deck.gl` (`@deck.gl/react`, `geo-layers`, `layers`, `mapbox` for interleaving) |
| Hex math | `h3-js` |
| Charts (mirror chart, scorecards) | `visx` or plain SVG |
| Color | `d3-scale`, `d3-scale-chromatic`; Okabe-Ito for categories |
| State | `zustand` + URL sync |
| UI primitives | Radix UI / shadcn/ui (accessible sliders, tooltips, dialogs) |
| Validation | `zod` (LLM outputs, data loading) |
| Tests | `vitest` |
| Pipeline | `geopandas`, `h3`, `pandas`, `requests`, `pyyaml`, `pytest` |

### 8.3 Data contract (freeze Saturday night so pipeline and frontend work in parallel)

```ts
export type TypeId =
  | 'adu' | 'duplex_triplex' | 'townhome' | 'small_apartment'
  | 'large_apartment' | 'senior_accessible' | 'rehab_reuse' | 'detached_sf';

export type Band = 'high' | 'medium' | 'low' | 'uncertain';
export type ZoningStatus = 'by_right' | 'special_exception' | 'conditional_use' | 'not_permitted' | 'unknown';
export type Provenance = 'observed' | 'derived' | 'assumption' | 'law' | 'user';

export interface HexRecord {
  h3: string;
  muni: string;
  inCity: boolean;
  neighborhood?: string;
  tract: string;
  households: Record<string, number>;          // segment shares, e.g. hh_1_2: 0.58
  stock: Record<string, number>;               // stock shares, e.g. br_0_1: 0.14
  moeFlags: string[];                          // segments with unreliable estimates
  need: Record<TypeId, Band>;
  fit: Record<TypeId, { band: Band; parcels: number; homes: [number, number] }>;
  allowed: Record<TypeId, ZoningStatus>;       // dominant status across the hex's parcels
  risk: { displacement: number; floodShare: number; floodway: boolean;
          slopeShare: number | null; undermined: number | null };
  carbon: { vmtPerHh: number | null };
  transitTrips800m: number;
  confidence: number;                          // 0..1
}

export interface ZoningRule {
  muni: string; district: string; type: TypeId; status: ZoningStatus;
  minLotSqft: number | null; section: string; quote: string;
  verifiedBy: string | null; verifiedAt: string | null;
}

export interface ZoningCounts {               // for the simulator
  h3: string;
  rows: { district: string; lotBand: 'lt3k' | '3to5k' | '5to10k' | 'gt10k';
          use: 'vacant' | 'sf_detached' | 'sf_attached' | 'other'; count: number }[];
}
```

A stub `hexes.json` with ~50 fake cells ships in the first hour so the frontend never waits.

---

## 9. Demo places (confirm at SME office hours Sunday 10 a.m. ET)

- **Homewood (City of Pittsburgh):** substantial vacant and publicly held land, East Busway access, real displacement concerns. Full data: NEED, FIT, verified zoning, simulator. Strong candidate for "Blocked by zoning" and "rehab & reuse."
- **Wilkinsburg (borough, next door):** similar transit and vacancy, but separate zoning. Shows "Zoning unknown" first, then the AI-assisted extraction workflow filling it in as "draft — not verified."
- Backup: Hazelwood (riverfront flood zones, slopes, large redevelopment site).

---

## 10. Scope tiers

**MVP (working on the deployed URL by Sun 1 p.m. ET)**
1. Multi-scale map: municipality/neighborhood summaries, planning-area/Census geography, and parcel detail; drag, zoom, tilt, 2D/3D; municipality search.
2. NEED model + mirror chart.
3. FIT model with suitable-parcel counts.
4. ALLOWED for City of Pittsburgh (verified matrix), "unknown" elsewhere.
5. **Match status view** for any chosen type + **What's missing** view.
6. Place Report with type-by-type table, provenance badges, "what we don't know."
7. **Scenario Builder** comparing 2–3 scenarios with the scorecard and values sliders.
8. Flood, transit, municipal boundary overlays; parcel drill-down in Homewood.
9. README: how to run, sources + vintages, libraries, AI tools used, limitations, disclaimer.

**MVP+ (Sunday afternoon, in priority order)**
1. **Zoning Simulator** (parcels unlocked, homes possible, map animation).
2. "What would flip it" sensitivity line in scenarios.
3. AI-assisted zoning extraction demo for Wilkinsburg.
4. Shareable URL state + Where-values-disagree view.
5. Tradeoffs bivariate view.
6. Plain-language LLM summaries with guardrail.
7. Shortlist + screening brief export.
8. Ask the map.

**Stretch**
- Countywide parcels as vector tiles (`tippecanoe` → PMTiles), for parcel checks anywhere.
- Countywide steep slopes from USGS 3DEP elevation.
- Areal-weighted interpolation of Census data to hexes.

---

## 11. Team and timeline (all ET; hard deadline Sun Sept 27 11:59 p.m.)

Workstreams (map names from the Team Plan when roles are filled in):
- **Data A: NEED** (ACS, CHAS, LIHTC, segment/stock gaps).
- **Data B: FIT + ALLOWED** (assessments, parcels, hazards, transit, zoning counts, extraction script).
- **Frontend / map** (map, views, Place Report, Scenario Builder, Simulator).
- **Domain + narrative (Stella)**: segment→type mapping, fit thresholds, zoning matrix verification, benefit/harm rules, limitations, demo script.

| When | Data A: NEED | Data B: FIT + ALLOWED | Frontend | Stella |
| :---- | :---- | :---- | :---- | :---- |
| **Sat 7–9 p.m.** | ACS + CHAS pulls; hex grid | Assessments + parcels join; zoning layer | App skeleton, map with stub hexes, deployed | Segment→type table; fit thresholds draft |
| **Sat 9 p.m.–1 a.m.** | Gaps → need bands, MOE flags | FIT counts; draft zoning matrix via LLM | Match status + What's missing views; Place Report shell; mirror chart | Verify zoning matrix rows |
| **Sleep** | | | | |
| **Sun 9 a.m.–1 p.m.** | Validation vs County HNA; LIHTC | Hazards, transit, demo parcels, `zoning_counts.json` | Scenario Builder, values sliders, overlays, drill-down | **SME office hours 10 a.m.:** validate mapping, thresholds, demo places |
| **Sun 1–5 p.m.** | Carbon inputs (LAI + cited factors) | Wilkinsburg extraction demo | Zoning Simulator, sensitivity line, URL state, disagreement view; LLM endpoints | Benefit/harm rules, limitations, README narrative |
| **Sun 5–6 p.m.** | **Feature freeze** | | | |
| **Sun 6–8 p.m.** | Bug bash on the deployed URL (Chrome + Safari, keyboard-only check, one slow-network test) | | | Rehearse demo |
| **Sun 8–9:30 p.m.** | Record 3–5 min video | | | |
| **Sun by 10 p.m.** | **Submit the form** (editable until 11:59) | | | |

---

## 12. Demo video script (3–5 min)

1. **(0:00–0:20)** "AI for Housing Hackathon, Track 3. We're [team]." The problem in one line: *"Missing middle" is a label, not an answer. A planner needs to know what this place needs, whether it fits, and whether their own code allows it.*
2. **(0:20–1:00)** Countywide map in 3D. Pick **Duplex/triplex**, show the Match status view. Point to the purple: *"Needed, buildable, and blocked by zoning."*
3. **(1:00–1:50)** Click Homewood. Mirror chart: who lives here vs what exists. Type table: Need · Fit · Allowed, each with its source.
4. **(1:50–2:50)** Scenario Builder: Gentle density vs Transit apartments vs Senior-first. Move *Protect existing residents* and *Low carbon*. The ranking changes; the facts don't. *"What would flip it."*
5. **(2:50–3:30)** Zoning Simulator: allow duplexes by right on lots ≥3,000 sq ft in R1A. Parcels unlocked, homes possible, purple turns green.
6. **(3:30–4:00)** Wilkinsburg: "Zoning unknown," then the AI-drafted, human-verified extraction workflow. Export a screening brief with its verification checklist.
7. **(4:00–4:40)** What's real vs mocked, key limitations, and the path to adoption (County / CONNECT pilot, one municipality at a time).

---

## 13. Limitations (README + in-app "About the data")

- **Zoning** is verified only for the City of Pittsburgh (and a draft for one borough). Overlays, variances, and recent amendments are not modeled.
- **Need is inferred from Census household-vs-stock mismatch**, not surveys of what residents want. Small tracts have large margins of error.
- **No cost, financing, or market feasibility**: we don't say whether a project pencils out (that's Track 1's problem).
- **Sewer and water capacity** are not in our data; "infrastructure" is an infill proxy.
- **Vacant is not available**: ownership and willingness to sell are unknown.
- **Carbon figures are ranges from published averages**, not project-level life-cycle analysis.
- **Segment→type mappings, fit thresholds, and lenses are our assumptions**, reviewed with a housing practitioner, not validated by any government.
- **Misuse risk:** the maps could guide speculation into vulnerable neighborhoods. The displacement tradeoff and benefit/harm statements exist to surface this; they don't prevent it.

---

## 14. Risks and mitigations

| Risk | Mitigation |
| :---- | :---- |
| Scope is bigger than the time | Tiers in §10 are strict; the Simulator and AI features are MVP+, and MVP alone already answers the brief. |
| Zoning matrix wrong | Every row cites section + quote; only human-verified rows show as definitive; "verify locally" everywhere. |
| Pipeline late | Stub data in hour one; contract frozen Saturday night; every field optional in the UI. |
| ACS table IDs / fields differ from expectations | Data A confirms table IDs in the first hour; mapping lives in config. |
| LLM outage or hallucination | Schema + number checks, timeouts, template fallback, labeled in UI. |
| Basemap provider down | Fallback style URL in config. |
| Repo compliance | Don't commit the participant packet or data catalog spreadsheet (per CONTRIBUTING); no keys in git; list all libraries and AI tools in README. |

---

## 15. Definition of done (MVP)

- [ ] Deployed URL loads in under 5 s; map drags, zooms, and tilts smoothly.
- [ ] Choosing a type recolors the Match status view; every hex has one of the six statuses.
- [ ] Homewood Place Report shows the mirror chart and Need · Fit · Allowed for all 8 types, each with provenance.
- [ ] Scenario Builder compares ≥2 scenarios; moving a value slider re-ranks them without changing any fact row.
- [ ] Outside the City, zoning shows "unknown — verify locally."
- [ ] `vitest` model tests pass, including missing-data, floodway, and each match-status branch.
- [ ] README complete: run instructions, sources + vintages, open-source libraries, AI tools, limitations, disclaimer.
