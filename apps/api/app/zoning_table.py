"""Conservative Pittsburgh zoning → housing-type eligibility.

Not legal advice. Maps district prefixes from the City GIS `zon_new` field
to typical Title 9 patterns. Always cite the district and flag review.
"""

from __future__ import annotations

from typing import Literal

Eligibility = Literal["likely", "conditional", "unlikely"]

HOUSING_TYPES = [
    {
        "id": "single_family",
        "label": "Single-family",
        "blurb": "One primary dwelling on the lot.",
    },
    {
        "id": "adu",
        "label": "Accessory dwelling unit (ADU)",
        "blurb": "A secondary unit on a lot that already has (or will have) a house.",
    },
    {
        "id": "duplex_triplex",
        "label": "Duplex / triplex / fourplex",
        "blurb": "Two to four units in a house-scale building.",
    },
    {
        "id": "townhouse",
        "label": "Townhouse / row",
        "blurb": "Attached single-family units sharing walls.",
    },
    {
        "id": "small_multifamily",
        "blurb": "About 5–19 apartments, often 2–4 stories.",
        "label": "Small multifamily",
    },
    {
        "id": "midrise",
        "label": "Mid-rise multifamily",
        "blurb": "Elevator building, typically 5+ stories.",
    },
    {
        "id": "mixed_use",
        "label": "Mixed-use",
        "blurb": "Housing over ground-floor commercial or civic space.",
    },
    {
        "id": "adaptive_reuse",
        "label": "Adaptive reuse / conversion",
        "blurb": "Convert an existing non-residential building to housing.",
    },
]

# Prefix rules evaluated longest-first.
_PREFIX_ELIGIBILITY: list[tuple[str, dict[str, Eligibility]]] = [
    (
        "R1D",
        {
            "single_family": "likely",
            "adu": "conditional",
            "duplex_triplex": "unlikely",
            "townhouse": "unlikely",
            "small_multifamily": "unlikely",
            "midrise": "unlikely",
            "mixed_use": "unlikely",
            "adaptive_reuse": "conditional",
        },
    ),
    (
        "R1A",
        {
            "single_family": "likely",
            "adu": "conditional",
            "duplex_triplex": "conditional",
            "townhouse": "likely",
            "small_multifamily": "unlikely",
            "midrise": "unlikely",
            "mixed_use": "unlikely",
            "adaptive_reuse": "conditional",
        },
    ),
    (
        "R2",
        {
            "single_family": "likely",
            "adu": "conditional",
            "duplex_triplex": "likely",
            "townhouse": "conditional",
            "small_multifamily": "unlikely",
            "midrise": "unlikely",
            "mixed_use": "unlikely",
            "adaptive_reuse": "conditional",
        },
    ),
    (
        "RM",
        {
            "single_family": "conditional",
            "adu": "conditional",
            "duplex_triplex": "likely",
            "townhouse": "likely",
            "small_multifamily": "likely",
            "midrise": "conditional",
            "mixed_use": "conditional",
            "adaptive_reuse": "likely",
        },
    ),
    (
        "LNC",
        {
            "single_family": "conditional",
            "adu": "conditional",
            "duplex_triplex": "likely",
            "townhouse": "likely",
            "small_multifamily": "likely",
            "midrise": "conditional",
            "mixed_use": "likely",
            "adaptive_reuse": "likely",
        },
    ),
    (
        "UNC",
        {
            "single_family": "conditional",
            "adu": "conditional",
            "duplex_triplex": "likely",
            "townhouse": "likely",
            "small_multifamily": "likely",
            "midrise": "likely",
            "mixed_use": "likely",
            "adaptive_reuse": "likely",
        },
    ),
    (
        "NDI",
        {
            "single_family": "unlikely",
            "adu": "unlikely",
            "duplex_triplex": "conditional",
            "townhouse": "conditional",
            "small_multifamily": "likely",
            "midrise": "conditional",
            "mixed_use": "likely",
            "adaptive_reuse": "likely",
        },
    ),
    (
        "UC",
        {
            "single_family": "unlikely",
            "adu": "unlikely",
            "duplex_triplex": "conditional",
            "townhouse": "conditional",
            "small_multifamily": "likely",
            "midrise": "likely",
            "mixed_use": "likely",
            "adaptive_reuse": "likely",
        },
    ),
    (
        "GT",
        {
            "single_family": "unlikely",
            "adu": "unlikely",
            "duplex_triplex": "unlikely",
            "townhouse": "unlikely",
            "small_multifamily": "conditional",
            "midrise": "likely",
            "mixed_use": "likely",
            "adaptive_reuse": "likely",
        },
    ),
    (
        "EMI",
        {
            "single_family": "unlikely",
            "adu": "unlikely",
            "duplex_triplex": "conditional",
            "townhouse": "conditional",
            "small_multifamily": "likely",
            "midrise": "likely",
            "mixed_use": "conditional",
            "adaptive_reuse": "likely",
        },
    ),
    (
        "NDO",
        {
            "single_family": "conditional",
            "adu": "conditional",
            "duplex_triplex": "likely",
            "townhouse": "conditional",
            "small_multifamily": "likely",
            "midrise": "conditional",
            "mixed_use": "likely",
            "adaptive_reuse": "likely",
        },
    ),
    (
        "H",
        {
            "single_family": "likely",
            "adu": "conditional",
            "duplex_triplex": "conditional",
            "townhouse": "conditional",
            "small_multifamily": "unlikely",
            "midrise": "unlikely",
            "mixed_use": "unlikely",
            "adaptive_reuse": "conditional",
        },
    ),
    (
        "RIV",
        {
            "single_family": "unlikely",
            "adu": "unlikely",
            "duplex_triplex": "conditional",
            "townhouse": "conditional",
            "small_multifamily": "likely",
            "midrise": "conditional",
            "mixed_use": "likely",
            "adaptive_reuse": "likely",
        },
    ),
    (
        "GI",
        {
            "single_family": "unlikely",
            "adu": "unlikely",
            "duplex_triplex": "unlikely",
            "townhouse": "unlikely",
            "small_multifamily": "unlikely",
            "midrise": "unlikely",
            "mixed_use": "conditional",
            "adaptive_reuse": "conditional",
        },
    ),
    (
        "UI",
        {
            "single_family": "unlikely",
            "adu": "unlikely",
            "duplex_triplex": "unlikely",
            "townhouse": "unlikely",
            "small_multifamily": "unlikely",
            "midrise": "unlikely",
            "mixed_use": "conditional",
            "adaptive_reuse": "conditional",
        },
    ),
    (
        "P",
        {
            "single_family": "unlikely",
            "adu": "unlikely",
            "duplex_triplex": "unlikely",
            "townhouse": "unlikely",
            "small_multifamily": "unlikely",
            "midrise": "unlikely",
            "mixed_use": "unlikely",
            "adaptive_reuse": "unlikely",
        },
    ),
]


def eligibility_for_district(zon_new: str | None) -> dict[str, Eligibility]:
    code = (zon_new or "").upper().strip()
    default: dict[str, Eligibility] = {t["id"]: "conditional" for t in HOUSING_TYPES}
    if not code:
        return default
    ranked = sorted(_PREFIX_ELIGIBILITY, key=lambda x: len(x[0]), reverse=True)
    for prefix, table in ranked:
        if code.startswith(prefix):
            merged = default.copy()
            merged.update(table)
            if prefix == "RM" and ("H" in code.split("-")[-1] or code.endswith("H")):
                merged["midrise"] = "likely"
            return merged
    return default
