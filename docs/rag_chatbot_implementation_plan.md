# Future Grounded RAG Chatbot Implementation Plan

**Allegheny Housing Match Map · municipal decision-support prototype**  
*Future architecture; not part of the current fixture-data MVP.*

## 1. Purpose and boundaries

The future chatbot should help a municipal planner, nonprofit, or community partner understand what the map shows, why it shows it, which sources support it, and what must still be verified. It is an evidence-navigation layer over the deterministic housing model, not a second scoring engine and not a substitute for a zoning officer, attorney, engineer, or community process.

The map remains the system of record for:

- selected place and housing type;
- Need, Fit, Allowed, and match status;
- observed and derived place facts;
- scenario inputs, scores, rankings, and value weights; and
- known uncertainty and missing-data flags.

The chatbot may retrieve, quote, compare, and explain those facts. It must not silently recalculate them, invent missing values, infer legal permission from general text, or turn screening results into a recommendation to approve, deny, buy, sell, or build.

### 1.1 Two deliberately different capabilities

| Capability | Hackathon-feasible local preview | True hosted RAG |
| :--- | :--- | :--- |
| Name shown in UI | **Grounded preview** | **Grounded AI answer** |
| Generation | Deterministic templates and extractive snippets | LLM constrained by retrieved evidence |
| Retrieval | Exact IDs, metadata filters, curated keywords/BM25-like text matching | Metadata filters plus hybrid lexical and embedding/vector search, optionally reranked |
| Data | Bundled, curated documents and the current place/scenario snapshot | Versioned corpus in object storage/search index plus the current snapshot |
| Citations | Attached directly from matched records | Claim-linked citations validated against retrieved records |
| What it demonstrates | Grounding contract, citations, refusals, and UI workflow | Semantic retrieval and natural-language synthesis |
| What it is **not** | It is not embedding search, vector retrieval, or LLM RAG | It is not an autonomous planner or source of binding legal advice |

The deterministic preview must never be presented as “AI RAG.” Its value is that it exercises the same request, response, citation, refusal, and UI contracts without API keys, model latency, or hallucination risk. A later hosted implementation can replace the retrieval and generation internals without changing the browser contract.

## 2. Questions the chatbot should support

The first release should answer a narrow, testable set of questions.

### 2.1 In scope

1. **Explain the map**
   - “Why is duplex/triplex marked Blocked by zoning here?”
   - “What makes senior housing a stronger fit in this hex?”
   - “Which values changed the scenario order?”
2. **Define data and methods**
   - “What does cost burden mean in CHAS?”
   - “Why do you use ACS 5-year estimates?”
   - “How is the small-household housing gap calculated?”
3. **Report selected-place facts**
   - “What do we know about housing need in Homewood North?”
   - “Which facts have high uncertainty or missing data?”
4. **Compare scenarios already computed by the app**
   - “How do Gentle density and Transit apartments differ?”
   - “Which scenario has more homes needing approval?”
5. **Retrieve zoning evidence**
   - “What source supports the ADU allowance shown for this district?”
   - “Quote the section used for the duplex result.”
6. **Explain sources and limitations**
   - “What vintage is this household estimate?”
   - “Does vacant mean the parcel is available?”
   - “What would staff need to verify next?”
7. **Help operate the interface**
   - “How do I compare housing types?”
   - “How do I reset the value sliders?”

### 2.2 Out of scope

The chatbot must refuse or redirect:

- binding interpretations of zoning, building, tax, environmental, or permitting law;
- parcel-specific entitlement predictions when overlays, exceptions, variances, amendments, or dimensional facts are incomplete;
- legal, financial, engineering, appraisal, or investment advice;
- claims about individual residents, owners, protected classes, or likely displacement of named people;
- fabrication of a missing source, figure, quotation, code section, approval timeline, or community preference;
- changing the deterministic model through free text without showing and confirming structured inputs; and
- recommendations that treat the model as the final municipal decision.

“Where could we put senior housing?” should remain a structured **Ask the map** operation: language is translated into visible filter chips, schema-validated, and executed by deterministic map code. The chatbot can explain the resulting set after the map computes it.

## 3. Source corpus and authority

Every retrievable record must have a stable ID, source metadata, text or structured facts, and an authority tier. The chatbot should prefer the narrowest applicable, highest-authority, current record; it should surface material conflicts rather than blend them.

### 3.1 Corpus families

#### A. Source catalog metadata

One source card per dataset or publication:

- title, publisher, canonical URL, license, access date, and coverage;
- release/vintage and effective dates;
- geographic level and known update cadence;
- fields used by this app;
- limitations supplied by the publisher and limitations added by the project; and
- lineage from raw source to exported app field.

These records answer provenance questions. They do not supply place-specific values unless the request also includes a selected-place fact record.

#### B. ACS and CHAS definitions

Curated records for each measure used in the app:

- official variable/table ID and label;
- universe, unit, geography, estimate year, and margin-of-error interpretation;
- CHAS income-band and cost-burden definitions;
- project-specific transformations, such as a derived share or band; and
- warnings against comparing incompatible universes or vintages.

Official definitions and project methodology must remain separate citations. For example, Census may define a variable while this project defines how that variable contributes to a Need band.

#### C. Zoning code sections and quoted text

Records should preserve exact, reviewable legal evidence:

- municipality, code title, chapter/article, section/subsection, table and row labels;
- exact quoted text, with enough surrounding text to interpret the provision;
- official URL or official document identifier and page when available;
- effective date, retrieved date, amendment/supersession status, and code version;
- district, housing type, use/standard category, and approval path;
- extraction method and source-document checksum;
- `verification_status`, reviewer, review date, and review notes; and
- known exclusions such as overlays, definitions, dimensional standards, parking, nonconformities, or discretionary approvals.

Only `human_verified` zoning records may support a definitive description of what the app currently classifies. Draft or stale records may be shown only as unverified leads with an explicit escalation.

#### D. Methodology and assumptions

Short records explaining:

- Need segment-to-typology mappings;
- Fit thresholds and hard gates;
- Allowed and match-status logic;
- confidence and uncertainty treatment;
- scenario scoring and value weights;
- carbon and displacement proxies; and
- known limitations and responsible-use framing.

Each record identifies whether it is an observed-source interpretation, derived method, assumption, or user value. The chatbot must not describe assumptions as empirical findings.

#### E. Selected-place facts

The browser supplies a compact, generated snapshot for the selected H3 cell, neighborhood, municipality, or parcel. It includes only facts already visible or available to the current app:

- stable place ID and display name;
- geography type and parent municipality;
- selected housing type and deterministic match status;
- Need, Fit, Allowed, parcel count, homes-possible range, and confidence;
- relevant household, housing-stock, hazard, transit, and uncertainty values;
- provenance/source IDs and vintages for each fact; and
- explicit unknowns.

These records are request context, not embedding-index documents. Exact structured context takes precedence over similar facts retrieved from prose.

#### F. Scenario facts

The browser also supplies the selected scenarios and current deterministic outputs:

- scenario ID, label, typology mix, and target homes;
- factual scorecard values and zoning path;
- current user-selected weights;
- deterministic ranking and score deltas;
- assumptions and source IDs used by each metric; and
- known omissions.

The model may compare these supplied values but may not recompute or alter the ranking.

### 3.2 Common metadata contract

Each indexed record should contain at least:

```ts
interface CorpusRecord {
  recordId: string
  corpus:
    | 'source'
    | 'definition'
    | 'zoning'
    | 'methodology'
    | 'place_fact'
    | 'scenario_fact'
  title: string
  text: string
  sourceId: string
  sourceTitle: string
  sourceUrl: string | null
  publisher: string
  authority: 'official_primary' | 'official_secondary' | 'project_method' | 'project_assumption'
  municipality: string | null
  geographyType: 'county' | 'municipality' | 'neighborhood' | 'tract' | 'h3' | 'parcel' | null
  geographyId: string | null
  vintage: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
  retrievedAt: string
  section: string | null
  page: number | null
  quote: string | null
  verificationStatus: 'not_required' | 'draft' | 'human_verified' | 'stale'
  verifiedBy: string | null
  verifiedAt: string | null
  supersedesRecordId: string | null
  contentHash: string
}
```

Records may add corpus-specific fields, but the API should not rely on fields being inferred from body text.

### 3.3 Filtering rules

Retrieval applies hard filters before semantic ranking:

1. **Municipality:** Zoning evidence must match the selected or named municipality. Never substitute Pittsburgh rules for another Allegheny County municipality.
2. **Geography:** Place facts must match the selected geography ID. County or tract context can supplement a smaller geography only when clearly labeled.
3. **Vintage/effective date:** Prefer the vintage used by the map. Do not combine vintages in one statistic without explaining the mismatch.
4. **Source authority:** Prefer current official primary sources, then official secondary sources, then project methodology. Assumptions cannot override official text.
5. **Verification:** Exclude draft zoning from definitive answers. If no verified legal record remains, return `verification_required`.
6. **Record status:** Exclude superseded records by default. Retain them only for explicit historical questions.
7. **Question intent:** Retrieve legal text for legal questions, definitions for term questions, and current request facts for map/scenario questions. Broad similarity alone is insufficient.

## 4. Ingestion and chunking

### 4.1 Ingestion pipeline

1. Register each source in a source manifest.
2. Download or snapshot the official source and store its checksum.
3. Extract text and tables while preserving headings, row/column headers, pages, and section hierarchy.
4. Normalize whitespace and repeated headers without rewriting source language.
5. Create corpus-specific records and metadata.
6. Run schema, link, quote, duplicate, and effective-date checks.
7. Route zoning records through human verification.
8. Publish an immutable corpus version and build the local lexical index or hosted vector index.
9. Record which corpus version served each answer.

OCR-extracted legal text is never eligible for `human_verified` status until compared with the official image or publication.

### 4.2 Chunking rules

Chunk by meaning and legal structure, not by arbitrary character windows:

- **Source cards and definitions:** one concept or variable family per chunk, usually 150–400 tokens.
- **Methodology:** one rule, formula, or limitation per chunk, usually 200–500 tokens. Keep formula inputs and caveats together.
- **Narrative reports:** heading-aware chunks of roughly 300–600 tokens with 50–80 tokens of overlap.
- **Zoning prose:** one section or subsection per chunk. Include ancestor headings and defined-term references as metadata.
- **Zoning tables:** one semantically complete row or small row group per chunk, repeating the table title and column headers. Never separate a permission value from its district/use headers.
- **Quoted legal text:** preserve exact characters from the normalized source; do not manufacture overlap inside a quote.
- **Place and scenario facts:** do not chunk for vector search. Serialize the exact selected snapshot into bounded prompt context.

Every chunk gets a stable ID derived from source version, structural path, and content hash. Re-ingestion creates a new record when the source text changes, allowing citations and evaluations to detect staleness.

## 5. Retrieval and answering flow

### 5.1 Request pipeline

1. Validate request size, IDs, enum values, and schema version.
2. Classify the request into one or more supported intents: `map_explanation`, `definition`, `source`, `zoning_evidence`, `scenario_comparison`, `limitations`, `ui_help`, or `out_of_scope`.
3. Resolve named places against known geography IDs; ask a clarification question when two places or districts are plausible.
4. Add exact selected-place and scenario snapshots supplied by the app.
5. Apply municipality, geography, vintage, authority, verification, and corpus filters.
6. Retrieve a small evidence set.
7. Reject irrelevant, conflicting, stale, or duplicate records; preserve useful disagreement.
8. Generate an answer under the prompt contract, or use a deterministic template in preview mode.
9. Validate the answer schema, citation IDs, quoted text, numeric claims, and zoning verification status.
10. Return either a grounded answer, a clarification, or a refusal/escalation. Never “best guess” through a failed validation.

### 5.2 Local deterministic retrieval

The local preview uses:

- exact record and geography lookup;
- intent-specific keyword aliases;
- metadata filtering;
- optional deterministic lexical scoring; and
- fixed response templates with extractive quotations.

Given the same corpus version, request, and context, it returns the same response. This mode requires no model, embeddings, vector database, or external network call.

### 5.3 Hosted hybrid retrieval

The hosted version may use:

- lexical/BM25 retrieval for code sections, table IDs, quoted phrases, and official terminology;
- embedding/vector retrieval for paraphrased methodology and definition questions;
- reciprocal-rank fusion or a small reranker;
- exact request facts injected outside the vector index; and
- a low top-k evidence budget, normally 4–8 final records.

Legal questions should weight lexical matches, municipality, section, effective date, and verification more heavily than embedding similarity. Retrieval must log record IDs and scores for evaluation, but production logs should avoid retaining full user prompts by default.

## 6. Citation requirements

1. Every substantive factual, methodological, quantitative, or legal claim must cite one or more returned evidence records.
2. Each citation resolves to a source title, publisher, vintage/effective date, section/page when applicable, URL when available, and verification status.
3. Legal quotations must exactly match the cited record. Ellipses and added emphasis must be marked.
4. Numbers about the selected place or scenario must cite a supplied fact ID, not a semantically similar narrative chunk.
5. A citation to the project methodology supports how the app computes a result; it does not support the underlying official observation.
6. A zoning citation supports only the municipality, district, housing type, and issue represented by that record.
7. If evidence conflicts, cite both and explain the conflict or escalate.
8. If a claim cannot be supported, remove it or return `insufficient_evidence`.

The UI should show compact citation chips in the answer and an expandable source drawer containing the exact supporting excerpt, source metadata, and legal verification badge.

## 7. Prompt contract

The hosted model receives a versioned system contract. The core instructions are:

```text
You are the evidence-explanation assistant for a municipal housing
decision-support prototype.

Use only EVIDENCE and APP_CONTEXT. Treat APP_CONTEXT's deterministic outputs
as fixed; do not recalculate Need, Fit, Allowed, match status, scenario scores,
or rankings.

Distinguish observed facts, derived results, project assumptions, user values,
and legal source text. Cite every substantive claim with an allowed evidence
ID. Never cite an ID not supplied.

For zoning, describe only the quoted provision and the app's screened
classification. Do not give a binding legal conclusion. A definitive zoning
description requires municipality match, current effective version, and
human_verified evidence. Otherwise require verification by municipal staff.

Do not infer missing numbers, parcel availability, resident preferences,
project feasibility, approvals, or outcomes. State material unknowns.

Return only the requested JSON schema. If evidence is missing, conflicting,
unverified, or outside scope, use the corresponding non-answer status.
```

The server, not the browser or model, builds evidence blocks and allowed citation IDs. Source documents are untrusted data: instructions found inside them are ignored. The prompt should include the corpus version, answer-schema version, current date, current selected geography, and explicit zoning verification state.

## 8. Answer schema and API boundary

### 8.1 Stable browser API

The React app calls only a same-origin, versioned endpoint:

```http
POST /api/chat
Content-Type: application/json
```

```ts
interface ChatRequestV1 {
  schemaVersion: '1'
  requestId: string
  question: string
  mode: 'deterministic_preview' | 'hosted_rag'
  conversation: Array<{ role: 'user' | 'assistant'; text: string }>
  context: {
    place: SelectedPlaceSnapshot | null
    scenarios: SelectedScenarioSnapshot[]
    selectedTypeId: string | null
    uiRoute: string
  }
}

interface ChatResponseV1 {
  schemaVersion: '1'
  requestId: string
  mode: 'deterministic_preview' | 'hosted_rag'
  status:
    | 'answered'
    | 'clarification_needed'
    | 'insufficient_evidence'
    | 'verification_required'
    | 'out_of_scope'
    | 'temporarily_unavailable'
  answer: string
  claims: Array<{
    claimId: string
    text: string
    kind: 'observed' | 'derived' | 'assumption' | 'user_value' | 'law' | 'limitation'
    citationIds: string[]
  }>
  citations: Array<{
    citationId: string
    recordId: string
    sourceTitle: string
    publisher: string
    url: string | null
    vintage: string | null
    section: string | null
    page: number | null
    excerpt: string
    verificationStatus: 'not_required' | 'draft' | 'human_verified' | 'stale'
  }>
  caveats: string[]
  followUps: Array<{
    label: string
    question: string
  }>
  escalation: {
    required: boolean
    reason: string | null
    nextStep: string | null
  }
  diagnostics?: {
    corpusVersion: string
    promptVersion: string | null
  }
}
```

The production response should omit retrieval scores, raw prompts, and chain-of-thought. Development diagnostics may expose record IDs and versions, not hidden reasoning.

### 8.2 Local and deployment topology

**Local Vite development**

```text
Browser at localhost:5173
  → POST /api/chat
  → Vite dev proxy
  → local chat service at localhost:8787
      → bundled corpus + deterministic retriever/template renderer
```

The browser imports no server SDK and contains no secret. A small mock adapter may run in-browser for static demos, but the proxy-backed endpoint is preferred because it proves the deployable boundary.

**Hosted deployment**

```text
Browser
  → same-origin POST /api/chat
  → serverless function or small API service
      → corpus/search index
      → model provider
      → validators and audit metadata
```

The endpoint and schemas stay the same. Environment configuration selects the implementation. API keys, full legal corpus credentials, and provider calls remain server-side. Add timeouts, rate limits, request-size limits, abort support, and deterministic fallback. A model or search outage should return `temporarily_unavailable` or the labeled preview, never an uncited free-form answer.

## 9. Refusal, clarification, and escalation

The assistant should make non-answers useful and specific.

| Condition | Response status | Required behavior |
| :--- | :--- | :--- |
| Place, district, or “this scenario” is ambiguous | `clarification_needed` | Ask one focused question; do not retrieve across municipalities |
| No relevant evidence survives filters | `insufficient_evidence` | State what is missing and where staff might obtain it |
| Zoning evidence is draft, stale, conflicting, or incomplete | `verification_required` | Show only clearly labeled leads; direct the user to the municipality/zoning officer |
| Request seeks legal, financial, engineering, or individual-level advice | `out_of_scope` | Briefly explain the boundary and offer an in-scope evidence question |
| Service/model/index fails validation or times out | `temporarily_unavailable` | Preserve the app workflow and offer deterministic source links or preview |

For consequential zoning content, escalation text should identify the exact issue to verify, the cited section or missing section, the municipality, and the source effective date. “Consult a professional” alone is not a sufficient workflow.

## 10. Human verification for zoning content

1. **Acquire:** Save the official code page/PDF, canonical URL, effective date, and checksum.
2. **Extract:** AI or parsing code drafts section text, table rows, classification, and relevant definitions.
3. **Validate mechanically:** Confirm section identifiers, quote match, required metadata, table headers, internal links, and schema.
4. **Review by a person:** A reviewer compares the quote and classification with the official source, checks definitions and nearby exceptions, and records review notes.
5. **Second check for demo-critical rules:** A second reviewer or municipal subject-matter expert checks high-impact examples when feasible.
6. **Publish:** Only reviewed records receive `human_verified`; the app and chatbot can then use them for screened descriptions.
7. **Monitor:** Store a review-by date or source-change signal. Changed or expired sources become `stale`, not silently current.
8. **Escalate:** The UI supplies a verification checklist for overlays, dimensional standards, parking, nonconformities, variances, amendments, and parcel facts not modeled.

Reviewer identity can be a team role or internal ID; avoid publishing personal contact information. Verification means “checked against the cited source for this prototype,” not municipal endorsement or a legal opinion.

## 11. Privacy, security, and retention

- Do not send parcel-owner names, mailing addresses, contact details, protected-class data, free-text case notes, or other PII to retrieval or model providers.
- Use aggregate ACS/CHAS data and app-generated place/scenario snapshots only.
- Treat prompts as potentially sensitive planning deliberations. Default to no prompt retention; if temporary logging is necessary, document retention, redact obvious PII, restrict access, and expire logs quickly.
- Do not use conversations for model training unless an authorized organization makes a separate, explicit decision.
- Keep shortlist notes and unsent drafts local to the browser unless a future authenticated feature has a defined records policy.
- Escape rendered text, allowlist citation URLs, limit payloads, rate-limit the endpoint, and protect against prompt injection in both user text and retrieved documents.
- Do not expose provider keys, internal prompts, raw embeddings, hidden source credentials, or unrestricted index queries to the browser.
- Provide a visible “clear conversation” action. Avoid cross-user conversation memory in the MVP.

## 12. Evaluation plan

### 12.1 Evaluation set

Create a versioned set of roughly 50–75 questions before enabling hosted generation:

- 10 map-result explanations across different match-status branches;
- 8 ACS/CHAS definition and vintage questions;
- 12 zoning questions spanning verified, unverified, stale, wrong-municipality, exception, and ambiguity cases;
- 8 methodology/assumption questions;
- 8 selected-place and scenario comparisons with exact expected numbers;
- 6 source/limitation questions;
- 6 refusal and escalation cases; and
- 4 adversarial cases, including instructions embedded in source text and requests to ignore citations.

Include paraphrases, misspellings, multi-turn references, no-answer cases, conflicting evidence, and at least two municipalities so filtering failures are visible. Each item should specify allowed records, required facts, forbidden claims, expected status, and whether human verification is mandatory.

### 12.2 Metrics and release gates

Use claim-level evaluation rather than generic answer similarity:

- **Claim support/faithfulness:** supported substantive claims divided by substantive claims. Target ≥ 95%; 100% for legal and numeric claims.
- **Citation correctness:** citations that actually entail the attached claim. Target ≥ 95%; 100% for zoning claims.
- **Citation completeness:** claims requiring citations that have valid citations. Target ≥ 98%.
- **Retrieval context recall:** required gold records present in the final evidence set. Target ≥ 90% overall and ≥ 98% for legal questions.
- **Exact numeric fidelity:** selected-place/scenario numbers match supplied context after display rounding. Target 100%.
- **Filter accuracy:** no wrong-municipality, wrong-geography, superseded, or disallowed-vintage evidence. Target 100%.
- **Legal verification compliance:** definitive zoning claims backed by `human_verified` evidence. Target 100%; unverified definitive-claim rate must be 0.
- **Refusal/escalation accuracy:** correct non-answer status for unsafe or unsupported cases. Target ≥ 95%, with no binding legal answers.
- **Answer relevance and clarity:** human rubric for directly answering the question, separating fact/assumption/value, and naming limitations. Target average ≥ 4/5.
- **Latency:** deterministic preview p95 < 300 ms after corpus load; hosted answer p95 target < 6 s, with a visible progress state.

Run deterministic tests on every change. Run the fixed hosted evaluation when changing corpus version, chunking, embedding model, reranker, prompt, answer model, or validators. Manually review every failed legal case before release.

## 13. UI integration

Add the chatbot as a collapsible **Ask about this place** panel so the map remains primary.

- Seed prompts from current state: “Why this match?”, “Show zoning evidence,” “Explain uncertainty,” and “Compare selected scenarios.”
- Include selected place, housing type, scenarios, and weights in the request only after showing that context above the composer.
- Label the mode clearly: **Deterministic grounded preview** or **Grounded AI answer**.
- Render answer claims with provenance styling already used by the Place Report: Observed, Derived, Assumption, Your values, Law, and Limitation.
- Make citations keyboard-accessible. Opening one shows exact excerpt, source, vintage/effective date, and zoning verification status.
- Keep legal warnings adjacent to zoning claims, not only in a global footer.
- Provide “View on map” or structured action buttons only for schema-validated filters. The model cannot directly mutate map state.
- Preserve the current deterministic answer when chat is unavailable. Chat failure must not block map, Place Report, or Scenario Builder use.
- Do not imply conversation memory beyond the displayed thread. Provide clear reset and retry controls.
- If the selected place or scenario changes, start a new context or visibly mark older answers as referring to the previous selection.

## 14. Prioritized implementation tasks

### P0 — Grounding foundation

1. Freeze `ChatRequestV1`, `ChatResponseV1`, selected-place, and scenario snapshot schemas.
2. Create the source manifest and 15–25 curated records covering current demo definitions, methodology, limitations, and source cards.
3. Add a small set of exact, human-verified zoning excerpts only if review can be completed; otherwise test the `verification_required` path.
4. Build the versioned evaluation set, including no-answer and wrong-municipality cases.
5. Define corpus versioning, content hashes, and zoning review ownership.

### P1 — Deterministic grounded preview

6. Implement `/api/chat` with schema validation, metadata filters, deterministic lexical matching, templates, and citations.
7. Add the Vite proxy and local service while keeping the browser API same-origin.
8. Add the collapsible chat panel, mode label, source drawer, refusal states, and context-change behavior.
9. Add tests for exact numeric copying, citation resolution, municipality filters, unverified zoning escalation, and prompt-injection strings.
10. Demo questions from each supported intent and clearly disclose that this is not vector/LLM RAG.

### P2 — Hosted RAG pilot

11. Build source ingestion and heading/table-aware chunking.
12. Add a hosted lexical plus embedding/vector index with strict prefilters.
13. Add server-side LLM generation, the versioned prompt, structured output, and post-generation validators.
14. Add timeouts, rate limits, minimal redacted telemetry, deterministic fallback, and cost monitoring.
15. Run the full evaluation; release only after legal, numeric, filter, and refusal gates pass.

### P3 — Municipal pilot hardening

16. Add authenticated corpus administration and zoning review queues.
17. Add source-change detection, stale-record handling, and scheduled re-evaluation.
18. Test with municipal planners, zoning staff, nonprofits, and community partners; revise prompts and UI from observed misunderstandings.
19. Establish records retention, accessibility, incident response, and model/vendor review policies.
20. Expand municipality coverage only as quickly as legal-source verification can be maintained.

For the hackathon, P0 plus a thin P1 is enough to demonstrate the architecture responsibly. P2 should be described as the real RAG path, not simulated in the submission.

## 15. Definition of done

### Deterministic preview

- Same question and context produce the same response and citations.
- Every claim resolves to a bundled record or exact app fact.
- Wrong-municipality zoning evidence cannot be returned.
- Draft or stale zoning triggers verification rather than a definitive answer.
- The UI explicitly says there is no LLM, embedding model, or vector search.
- Chat can fail without degrading deterministic map functions.

### Hosted RAG

- Hybrid retrieval, model generation, and validators run behind the unchanged `/api/chat` boundary.
- No application or provider secret reaches the browser.
- Claim-level faithfulness, citations, numeric fidelity, legal verification, filtering, and refusal gates pass.
- Every zoning answer exposes exact quoted evidence and human-verification status.
- Users are reminded that the output is decision support and given a concrete human verification next step.
