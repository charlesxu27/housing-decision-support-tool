# Housing Choices

Compare plausible housing options, transit access, community needs, and climate constraints in Pittsburgh.

**AI for Housing Hackathon 2026 · Track 3: Housing Typology, Equity & Climate Matchmaker**

**Status: repository scaffold. The application, data pipeline, and scenario engine are not implemented yet.**

## For judges

Housing Choices is being designed for a community development organization or municipal planner comparing housing options in a small Pittsburgh pilot area. The intended output is a comparison of alternatives, with cited evidence, explicit assumptions, tradeoffs, and next steps for human review.

| Deliverable | Current status |
| --- | --- |
| Working application | Not implemented |
| Public demo URL | Not deployed |
| 3–5 minute demo video | Not recorded |
| Data | Source registry prepared; no datasets bundled |
| Evaluation | Protocol prepared; no results claimed |
| Team | Four workstreams; member names pending |

See [scope and architecture](docs/PROJECT.md), [data sources](data/sources.json), [limitations](docs/LIMITATIONS.md), [evaluation](docs/EVALUATION.md), and [AI disclosure](docs/AI_DISCLOSURE.md).

## Planned first workflow

1. Select a pilot area and compare a small set of candidate locations.
2. Compare two or three expert-reviewed housing scenarios.
3. Inspect household and housing context, scheduled transit service, and verified hazard constraints.
4. Change explicit priorities and see the tradeoffs.
5. Export a source-linked comparison brief with assumptions and unresolved questions.

Scenario unit counts, affordability commitments, and housing templates are assumptions until validated. The prototype is decision support, not binding zoning, legal, financial, engineering, or environmental advice.

## Work locally

The scaffold requires Git and Python 3.11 or newer. No app installation or API key is needed to check the repository:

```sh
python3 scripts/check_repo.py
```

Application commands will be added when the team chooses and implements the stack. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and [the team workflow](docs/TEAM.md).

## Repository layout

```text
src/                 Application code (not implemented)
data/sources.json    Source metadata and access/quality caveats
data/README.md       Data handling and refresh conventions
docs/                Scope, expert questions, evidence, and submission guide
scripts/             Repository checks
.github/             Pull request/issue templates and CI
```

## Integrity and reproducibility

Use structured calculations for numerical results and retrieval for supporting text. Every displayed observation must retain its source, geography, vintage, and uncertainty. Distinguish observed values, modeled results, and user-specified scenarios. Never treat missing data as zero or as proof of safety.

Preserve the original commit history. Record human contributions and AI assistance. Freeze a submission tag at the deadline; clearly separate subsequent work. See [the submission checklist](docs/SUBMISSION.md).

## License and data rights

The team has not yet selected a software license. Public visibility alone does not grant an open-source license. Source datasets retain their own licenses and attribution requirements; do not redistribute them without checking those terms.
