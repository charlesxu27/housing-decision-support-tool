# Reviewing the Pittsburgh zoning matrix

`pittsburgh_matrix.csv` maps every base zoning district code that appears in
the City's zoning GIS layer (`zon_new`) to a status for each of the eight
housing types. **Every row was drafted by machine from a reading of the
Pittsburgh Zoning Code Title 9, Chapter 911, §911.02 Use Table and is an
unverified assumption** until a person fills in `verified_by`. The exported
`zoning_matrix.json` carries `verificationStatus: "draft"` until every row has a
reviewer, and the app labels draft rows as "draft, not human-verified".

## Columns

| Column | Meaning |
| --- | --- |
| `district` | Zoning code exactly as in the GIS layer (`R1D-L`, `LNC`, ...) or a family code (`R1D`, `RM`, `GT`, `SP`, `RIV`). Specific codes win; a family row is only used when the specific code has no row. |
| `type` | One of `adu`, `duplex_triplex`, `townhome`, `small_apartment`, `large_apartment`, `senior_accessible`, `rehab_reuse`, `detached_sf`. |
| `status` | `by_right`, `special_exception`, `conditional_use`, `not_permitted`, or `unknown`. Use `unknown` whenever the code is silent, the district is plan-controlled (RP, SP, EMI, PUD), or you are not sure. |
| `min_lot_sqft` | Minimum lot area in square feet from the dimensional table for that district and use, or blank when none applies / not checked. |
| `section` | Exact code citation, e.g. `911.02 Use Table` or `903.03.D.2` for dimensional standards. |
| `quote` | The literal cell or sentence you relied on, pasted verbatim. Empty in drafts. |
| `verified_by` | Your name or initials. Leave blank unless you personally checked the row. |
| `verified_at` | ISO date (`2026-09-27`). |
| `notes` | Anything a second reviewer should know (overlays ignored, recent amendment, ambiguity). |

## How the draft maps types to use-table rows

| Type | Use-table row used as proxy |
| --- | --- |
| `detached_sf` | Single-Unit Detached Residential |
| `townhome` | Single-Unit Attached Residential |
| `duplex_triplex` | Two-Unit Residential (three-unit needs its own check) |
| `small_apartment`, `large_apartment`, `senior_accessible` | Multi-Unit Residential |
| `rehab_reuse` | `by_right` wherever detached or two-unit is `by_right` in the draft (continuing a lawful use); otherwise `unknown` |
| `adu` | `unknown` everywhere; the 2025 accessory dwelling unit legislation must be confirmed |

Hillside (`H`) is drafted as detached-only. `RP`, `SP-*`, `RIV-*`, `EMI`,
`AP`/`CP`, `GPR*`, `UC-*`, `UPR-*`, `R-MU`, and `MTOBOR` are `unknown`.

## Review procedure

1. Open the current Zoning Code Title 9 on Municode/eCode (the GIS layer's
   `municode` attribute links to the chapter). Use the §911.02 Use Table and the
   district's dimensional standards in Chapter 903/904/905.
2. For each row, find the cell for the proxy use and the district column.
   Record the letter (P = by right, S = special exception, C = conditional use,
   blank/N = not permitted) as the `status`, paste the cell or the footnote text
   into `quote`, and put the exact section in `section`.
3. Fill `min_lot_sqft` from the dimensional table if one applies to that use.
4. Write your name and the date in `verified_by` / `verified_at`.
5. If the district is controlled by an approved plan or has use-specific
   footnotes you cannot resolve, set `status` to `unknown` and explain in `notes`.
6. Do not model overlays, variances, or pending amendments; note them instead.
7. Re-run `cd pipeline && ../.venv/bin/python -m hdst_pipeline build` and then
   `validate`. The build fails if a row has an unknown type/status or duplicate key.

`draft_matrix.py` regenerates draft rows but never overwrites rows that
already carry a `verified_by`.
