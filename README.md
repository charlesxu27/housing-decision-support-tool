# Allegheny Housing Match Map

A municipal decision-support prototype that separates three questions for every housing type and place:

1. **Need:** Which households does the current housing stock fail?
2. **Fit:** Can this type physically and sensibly go here?
3. **Allowed:** Does current zoning permit it?

The interface then makes policy and community tradeoffs visible without allowing subjective weights to change factual inputs.

## Run locally

Requirements: Node.js 20+ and npm.

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

The first local MVP uses **illustrative fixture data** around Homewood, Wilkinsburg, and nearby Pittsburgh neighborhoods to validate the user experience and deterministic scoring model. It is not yet suitable for real planning decisions. The next data work replaces fixtures with ACS/CHAS household data, county parcel and assessment aggregates, hazard layers, and a human-verified Pittsburgh zoning matrix.

The interface includes a **Grounded Preview** of the planned RAG planning copilot. Today it uses deterministic lexical retrieval, templates, and citations over a small local corpus—no LLM, embeddings, or vector database. The future hosted RAG architecture is documented separately and will preserve the same citation and refusal contract.

See:

- [`docs/implementation_plan_map_feature.md`](docs/implementation_plan_map_feature.md) for the product and technical plan.
- [`docs/mvp_tasks.md`](docs/mvp_tasks.md) for the implementation backlog and acceptance criteria.
- [`docs/rag_chatbot_implementation_plan.md`](docs/rag_chatbot_implementation_plan.md) for the grounded chatbot architecture.

## Responsible-use notice

This is a decision-support prototype, not legal, zoning, financial, engineering, or permitting advice. Fixture values, fit thresholds, typology mappings, and value presets are assumptions until reviewed and sourced. Always verify zoning with the municipality, site conditions with qualified professionals, ownership and availability, infrastructure capacity, and community priorities before acting.

## AI and open-source disclosure

Cursor was used to help plan and implement the prototype. The web application uses React, TypeScript, Vite, MapLibre GL, deck.gl, h3-js, Zustand, and Vitest. Source datasets and their vintages will be listed here as real-data pipeline stages replace fixtures.
