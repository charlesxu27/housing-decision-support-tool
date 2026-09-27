# Allegheny Housing Match Map

A municipal decision-support prototype that separates three questions for every housing type and place:

1. **Need:** Which households does the current housing stock fail?
2. **Fit:** Can this type physically and sensibly go here?
3. **Allowed:** Does current zoning permit it?

The interface then makes policy and community tradeoffs visible without allowing subjective weights to change factual inputs.

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

The app reads a versioned static snapshot produced by `pipeline/` (ACS, county parcels/assessments, hazards, transit, Pittsburgh zoning). The browser does not call public APIs at runtime. Zoning matrix rows without human verification are labeled draft in the UI.

The interface includes a **Grounded Preview** of the planned RAG planning copilot. Today it uses deterministic lexical retrieval, templates, and citations over a small local corpus—no LLM, embeddings, or vector database. Selecting a parcel also shows a **plain-language brief** (demand, transit, equity, climate, cost, size) written from the snapshot Need / Fit / Allowed facts. If `OPENAI_API_KEY` is set in the repo-root `.env` or `web/.env`, Vite’s `/api/lot-brief` endpoint asks the model to rephrase that same card; it does not rescore the lot.

See:

- [`pipeline/README.md`](pipeline/README.md) for fetch/build, sources, and export contracts.
- [`docs/implementation_plan_map_feature.md`](docs/implementation_plan_map_feature.md) for the product and technical plan.
- [`docs/mvp_tasks.md`](docs/mvp_tasks.md) for the implementation backlog and acceptance criteria.
- [`docs/rag_chatbot_implementation_plan.md`](docs/rag_chatbot_implementation_plan.md) for the grounded chatbot architecture.

## Responsible-use notice

This is a decision-support prototype, not legal, zoning, financial, engineering, or permitting advice. Fit thresholds, typology mappings, and value presets are assumptions until reviewed. Always verify zoning with the municipality, site conditions with qualified professionals, ownership and availability, infrastructure capacity, and community priorities before acting.

## AI and open-source disclosure

Cursor was used to help plan and implement the prototype. The web application uses React, TypeScript, Vite, MapLibre GL, deck.gl, Zustand, and Vitest. Source datasets, vintages, and licenses are pinned in [`pipeline/sources.yaml`](pipeline/sources.yaml) and recorded in the published `manifest.json`.
