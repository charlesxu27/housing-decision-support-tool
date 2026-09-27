# Allegheny Housing Match Map

A municipal decision-support prototype that separates three questions for every housing type and place:

1. **Need:** Which households does the current housing stock fail?
2. **Fit:** Can this type physically and sensibly go here?
3. **Allowed:** Does current zoning permit it?

The interface then makes policy and community tradeoffs visible without allowing subjective weights to change factual inputs.

**Live demo:** [housing-match-pittsburgh.pages.dev](https://housing-match-pittsburgh.pages.dev). The live site uses the same published snapshot, so you don't need to build the data yourself to try it.

Built for the AI Horizons 2026 AI for Housing Hackathon, Track 3: Housing Typology, Equity & Climate Matchmaker.

## Run locally

The web app loads a static snapshot from `web/public/data/` (gitignored). Build that snapshot once with the offline pipeline, then start Vite.

Requirements:

- Node.js 20+ and npm
- Python 3.11+
- [`tippecanoe`](https://github.com/felt/tippecanoe) (Homebrew: `brew install tippecanoe`) for parcel vector tiles

### 1. Build the published data snapshot

From the repo root:

```sh
python3 -m venv .venv
.venv/bin/pip install -r pipeline/requirements.txt
.venv/bin/python -m hdst_pipeline fetch   # downloads into data/raw/ (gitignored)
.venv/bin/python -m hdst_pipeline build   # writes web/public/data/
```

`fetch` only needs to run when sources change or `data/raw/` is empty. Re-run `build` after pipeline or config changes. Optional validation:

```sh
.venv/bin/python -m hdst_pipeline validate
.venv/bin/pytest pipeline/tests
```

Details, optional inputs (e.g. HUD CHAS), and exported file contracts are in [`pipeline/README.md`](pipeline/README.md).

### 2. Start the web app

```sh
cd web
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

Verification:

```sh
cd web
npm test
npm run lint
npm run build
```

## Current MVP status

The app reads a versioned static snapshot produced by `pipeline/` (ACS, county parcels/assessments, hazards, transit, Pittsburgh zoning). The browser does not call Census, WPRDC, or other public data APIs at runtime. Zoning matrix rows without human verification are labeled draft in the UI.

The interface includes a **Grounded Preview** of the planned RAG planning copilot. Today it uses deterministic lexical retrieval, templates, and citations over a small local corpus—no LLM, embeddings, or vector database. Selecting a parcel also shows a **plain-language brief** (demand, transit, equity, climate, cost, size) written from the snapshot Need / Fit / Allowed facts. When `OPENAI_API_KEY` is set, `/api/lot-brief` asks `gpt-5-nano` (override with `OPENAI_MODEL`) to rephrase that same card. The model cannot change a status or a score. The sidebar labels that rewrite **AI-generated summary**.

The production site stays a static Cloudflare Pages bundle. `npm run build` adds `dist/_worker.js`, and Pages runs that file only for `/api/lot-brief`. Set `OPENAI_API_KEY` as an encrypted variable on the Pages project. The key is not in the bundle. Locally, put it in `web/.env` (gitignored); see `web/.env.example`.

See:

- [`pipeline/README.md`](pipeline/README.md) for fetch/build, sources, and export contracts.
- [`docs/implementation_plan_map_feature.md`](docs/implementation_plan_map_feature.md) for the product and technical plan.
- [`docs/mvp_tasks.md`](docs/mvp_tasks.md) for the implementation backlog and acceptance criteria.
- [`docs/rag_chatbot_implementation_plan.md`](docs/rag_chatbot_implementation_plan.md) for the grounded chatbot architecture.

## Limitations: what the tool does not answer

We would rather say what the snapshot can't support than let a color on a map imply it can.

- **Zoning is a draft screen, and it covers Pittsburgh only.** The Allowed layer covers the City of Pittsburgh only; parcels in the other 129 Allegheny County municipalities show `unknown`. In the Pittsburgh matrix (`pipeline/zoning/pittsburgh_matrix.csv`), none of the 520 district-by-type rows has a human reviewer yet, and 269 are still `unknown`. The matrix records use permission and a minimum lot size only. Setbacks, height, floor-area ratio, parking, and overlay districts are not checked.
- **Household need uses ACS, not HUD CHAS.** HUD's CHAS download is behind a bot check, so the published snapshot uses the ACS B25070 renter cost-burden share instead of CHAS income bands. The tool can't say how many burdened households are at or below 30% of area median income. Tract measures with large ACS margins of error are flagged, and the affected need scores are marked `uncertain`.
- **Fit is a parcel screen, not a site assessment.** It uses lot size, assessed land use, building presence, FEMA floodways, 25%+ slopes, and undermined areas. The slope and undermined layers cover the City only, and historic mine maps are incomplete. Ownership, willingness to sell, soils, utilities, and market feasibility are not assessed. A flood-zone flag is not a flood determination.
- **Carbon doesn't vary by place.** Each scenario's embodied carbon is a fixed assumed range per home, so the "Low carbon" score is the same in every tract. Transportation emissions, operating energy, and the cost of extending infrastructure are not modeled.
- **Infrastructure capacity is not modeled.** We found no public water, sewer, stormwater, or school-capacity data suitable for this build, so the tool says nothing about whether a place can absorb more homes.
- **The displacement index is our own composite.** It is `0.4 × renter share + 0.3 × cost-burdened renters + 0.3 × (1 − income relative to the county median)`. It hasn't been validated against observed displacement and doesn't use evictions, sales, or rent change over time.
- **Transit access counts scheduled trips only.** It is the number of weekday scheduled trips within 800 m of the tract center. It doesn't measure reliability, off-peak service, or access to jobs.
- **Scenarios are templates.** The three scenarios (gentle density, transit apartments, senior first) use assumed housing mixes, market-rate shares, carbon ranges, and delivery times, all applied to 40 homes. Only the tract facts come from data.
- **School scores are context only.** They are shown beside the match but don't change Need, Fit, or Allowed.
- **AI output can be wrong.** The lot-brief rewrite uses `gpt-5-nano` to rephrase a card the code has already calculated. It cannot change a status or a score. The sidebar marks that text **AI-generated summary**; if the wording and the checks above it disagree, trust the checks. Without an API key the brief stays the snapshot template and is labeled not AI-generated. The Grounded Preview copilot is keyword retrieval over a small local corpus, so it will miss questions the corpus doesn't cover.

**Who benefits and who could be harmed.** The tool is meant to help planners, community development corporations, and residents see where a housing type is needed and where it is feasible and allowed. It could harm people if it were used to justify market-rate growth in high-displacement tracts without protections, or to treat a draft zoning label as permission. That is why displacement stays visible in every scenario and zoning rows stay labeled draft until a person verifies them.

## Human review and next steps

Consequential calls stay with people. Every zoning row has `quote`, `verified_by`, and `verified_at` columns. A row stays labeled draft in the UI until a reviewer pastes the ordinance text and signs it (see `pipeline/zoning/review.md`). The app tells users to confirm zoning, overlays, and lot conditions with the municipality before acting.

Pilot path after the event:

1. **Verify Pittsburgh zoning with the Department of City Planning.** Walk the 520 matrix rows with a zoning reviewer so the Allowed layer can drop its draft label.
2. **Run a neighborhood pilot with one community development corporation.** Use the scenario comparison and the rehab-candidate lots (city-owned, condemned, and tax-delinquent parcels) in a real site-selection discussion, and record where the tool helped or misled.
3. **Test the rehab list with the URA and the Pittsburgh Land Bank.** Check whether the candidate parcels match what they would actually pursue.
4. **Close the largest data gaps.** Add HUD CHAS income bands, place-based transportation emissions, and zoning for the first suburban municipality that wants it.
5. **Keep maintenance cheap.** The pipeline is deterministic, every source is pinned in `pipeline/sources.yaml`, and the app is a static site. A monthly rebuild and redeploy is enough to keep it current, and a civic data partner could take that over.

## Responsible-use notice

This is a decision-support prototype, not legal, zoning, financial, engineering, or permitting advice. Fit thresholds, typology mappings, and value presets are assumptions until reviewed. Always verify zoning with the municipality, site conditions with qualified professionals, ownership and availability, infrastructure capacity, and community priorities before acting.

## AI and open-source disclosure

Cursor was used to help plan and implement the prototype. At runtime, the lot-brief rewrite calls OpenAI (`gpt-5-nano` by default, the lowest-priced model that returns the required JSON; override with `OPENAI_MODEL`) to rephrase an already-computed card. No other part of the scoring, matching, or copilot uses a language model. The web application uses React, TypeScript, Vite, MapLibre GL, deck.gl, Zustand, and Vitest. Source datasets, vintages, and licenses are pinned in [`pipeline/sources.yaml`](pipeline/sources.yaml) and recorded in the published `manifest.json`.
