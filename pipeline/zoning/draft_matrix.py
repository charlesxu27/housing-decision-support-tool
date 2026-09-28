"""Regenerate the DRAFT Pittsburgh zoning matrix from the district codes in the zoning layer.

    cd pipeline && ../.venv/bin/python zoning/draft_matrix.py

Every row it writes is an unverified assumption drawn from a reading of the
Pittsburgh Zoning Code Title 9, Chapter 911, section 911.02 Use Table. Rows
already carrying ``verified_by`` in the existing CSV are preserved verbatim so
re-running never discards review work.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE.parent))

from hdst_pipeline.allowed import MATRIX_COLUMNS  # noqa: E402
from hdst_pipeline.paths import TYPE_IDS  # noqa: E402

SECTION = "911.02 Use Table"
QUOTE_NOTE = "reviewer: paste use-table cell text"

# Family -> type -> status. Families are the code before the first '-'.
BY_RIGHT, SE, NP, UNK = "by_right", "special_exception", "not_permitted", "unknown"

RES_LOW = ["R1D", "R1A", "R2", "R3", "RM", "H", "LNC", "UNC", "NDO", "NDI"]
NONRES = ["HC", "GT", "GI", "UI", "P"]
# Districts that already allow a residential primary use in this draft.
# Pending CB 2025-1545 would allow an ADU as accessory to that use.
ADU_BY_RIGHT = ["R1D", "R1A", "R2", "R3", "RM", "H", "LNC", "UNC", "NDO", "NDI", "HC", "GT"]
ADU_NOT_PERMITTED = ["GI", "UI", "P"]

DRAFT: dict[str, dict[str, str]] = {}


def _set(family: str, type_id: str, status: str) -> None:
    DRAFT.setdefault(family, {})[type_id] = status


for fam in RES_LOW:
    _set(fam, "detached_sf", BY_RIGHT)
for fam in NONRES:
    _set(fam, "detached_sf", NP)

_set("R1D", "townhome", NP)
for fam in ["R1A", "R2", "R3", "RM", "LNC", "UNC", "NDO", "NDI"]:
    _set(fam, "townhome", BY_RIGHT)
for fam in NONRES:
    _set(fam, "townhome", NP)

for fam in ["R1D", "R1A"]:
    _set(fam, "duplex_triplex", NP)
for fam in ["R2", "R3", "RM", "LNC", "UNC", "NDO", "NDI"]:
    _set(fam, "duplex_triplex", BY_RIGHT)
for fam in NONRES:
    _set(fam, "duplex_triplex", NP)

for t in ["small_apartment", "large_apartment", "senior_accessible"]:
    for fam in ["R1D", "R1A", "R2", "R3"]:
        _set(fam, t, NP)
    for fam in ["RM", "LNC", "UNC", "HC", "GT"]:
        _set(fam, t, BY_RIGHT)
    for fam in ["NDO", "NDI"]:
        _set(fam, t, SE)
    for fam in ["GI", "UI", "P"]:
        _set(fam, t, NP)

# Hillside: detached by right, everything else unknown (handled by default).

NOTES = {
    "adu": "Draft from Council Bill 2025-1545 proposed §912.08 (Planning Commission recommended June 2, 2026; held in Council after the Sept 23, 2026 hearing; not enacted). ADUs by right on lots whose primary use is Residential, Community Center, or Religious Assembly.",
    "rehab_reuse": "Draft assumption: by_right wherever detached_sf or duplex_triplex is by_right in this draft; rehab of an existing lawful use is treated as continuing that use.",
    "senior_accessible": "Draft assumption using Multi-Unit Residential as the proxy use.",
    "small_apartment": "Draft assumption using Multi-Unit Residential as the proxy use.",
    "large_apartment": "Draft assumption using Multi-Unit Residential as the proxy use.",
    "detached_sf": "Draft assumption from the Single-Unit Detached Residential row.",
    "townhome": "Draft assumption from the Single-Unit Attached Residential row.",
    "duplex_triplex": "Draft assumption from the Two-Unit Residential row; three-unit needs a separate check.",
}
FAMILY_NOTES = {
    "H": "Hillside district: only detached single-unit assumed by right; verify all others.",
    "RP": "Residential Planned Unit Development: allowances set by approved plan; unknown.",
    "SP": "Specially Planned district: allowances set by the SP plan; unknown.",
    "RIV": "Riverfront district (Ch. 905.04): uses differ by sub-district; unknown until reviewed.",
    "EMI": "Educational/Medical Institution: institutional master plan controls; unknown.",
    "P": "Parks and Open Space.",
    "GT": "Golden Triangle: treated as a downtown mixed-use family; residential by right assumed for multi-unit only.",
}


def family(code: str) -> str:
    return code.split("-", 1)[0]


def draft_status(code: str, type_id: str) -> str:
    fam = family(code)
    statuses = DRAFT.get(fam, {})
    if type_id == "adu":
        if fam in ADU_NOT_PERMITTED:
            return NP
        if fam in ADU_BY_RIGHT:
            return BY_RIGHT
        return UNK
    if type_id == "rehab_reuse":
        if statuses.get("detached_sf") == BY_RIGHT or statuses.get("duplex_triplex") == BY_RIGHT:
            return BY_RIGHT
        return UNK
    return statuses.get(type_id, UNK)


def district_codes() -> list[str]:
    import geopandas as gpd

    path = REPO / "data" / "raw" / "zoning" / "zoning.geojson"
    if not path.exists():
        raise SystemExit(f"run `python -m hdst_pipeline fetch --only zoning` first ({path} missing)")
    z = gpd.read_file(path, columns=["zon_new"])
    codes = sorted({str(c).strip().upper() for c in z["zon_new"].dropna() if str(c).strip()})
    # Family fallback rows only for families the draft (or its notes) actually describe.
    fams = {family(c) for c in codes if "-" in c and family(c) in (set(DRAFT) | set(FAMILY_NOTES))}
    return sorted(set(codes) | fams)


def main() -> None:
    out = HERE / "pittsburgh_matrix.csv"
    existing: dict[tuple[str, str], dict] = {}
    if out.exists():
        with out.open(newline="", encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                if (r.get("verified_by") or "").strip():
                    existing[(r["district"], r["type"])] = r
    rows = []
    for code in district_codes():
        for t in TYPE_IDS:
            key = (code, t)
            if key in existing:
                rows.append(existing[key])
                continue
            status = draft_status(code, t)
            note = NOTES.get(t, "Draft assumption.")
            fam_note = FAMILY_NOTES.get(family(code))
            if fam_note:
                note = f"{fam_note} {note}"
            if "-" in code:
                note += f" Specific sub-district; inherits the {family(code)} family draft."
            rows.append(
                {
                    "district": code,
                    "type": t,
                    "status": status,
                    "min_lot_sqft": "",
                    "section": SECTION,
                    "quote": "",
                    "verified_by": "",
                    "verified_at": "",
                    "notes": f"{QUOTE_NOTE}. {note}",
                }
            )
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=MATRIX_COLUMNS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rows for {len(rows) // len(TYPE_IDS)} district codes -> {out}")


if __name__ == "__main__":
    main()
