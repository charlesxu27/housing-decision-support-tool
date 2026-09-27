# PGH Housing Advisor

Click a Pittsburgh parcel and get a ranked list of housing types (single-family, ADU, duplex/triplex, townhouse, small multifamily, mid-rise, mixed-use, adaptive reuse) plus a plain-language writeup of demand, transit, equity, climate/hazards, cost, and lot size.

The map talks to live public APIs (PASDA parcels, WPRDC assessments, City zoning/slope/mines, FEMA flood, Census Reporter/ACS, OpenStreetMap stops) with an Esri streets basemap. Scores are computed in code. If `OPENAI_API_KEY` is set, the explanation is written by the model using only those facts; otherwise a template narrative is used so you can demo without a key.

## Run locally (Windows)

You need two terminals.

**1. API**

```powershell
cd C:\Users\donal\pgh-housing-advisor\apps\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**2. Web**

```powershell
cd C:\Users\donal\pgh-housing-advisor\apps\web
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

Optional: copy `.env.example` to `.env` at the repo root and add your OpenAI key. Restart the API. You do not need the key to click parcels and see scores.

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Optional ACS cache (not required):

```powershell
cd C:\Users\donal\pgh-housing-advisor
python etl\download.py
```

## How a click is scored

1. PASDA parcel identify (PIN, geometry, acreage). City lots are municipality codes 101–132.
2. WPRDC property assessments (`PARID`).
3. City zoning, 25% slope, undermined areas; FEMA NFHL flood zone.
4. Census tract ACS (income, rent, value, vacancy, rent burden).
5. OSM transit stops within 400m / 800m, including the nearest stop name.
6. Zoning-prefix eligibility table (conservative; not Title 9 legal advice) plus lot, transit, hazard, vacancy, and burden adjustments.
7. Narrative (OpenAI or template) written for city housing staff.

## Disclaimers

Not a permit, appraisal, survey, or flood determination. Assessed value is not market value. Overlay districts, planned developments, and ZBA cases can override the simplified zoning table.
