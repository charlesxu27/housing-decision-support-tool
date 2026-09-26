from __future__ import annotations

from typing import Any

from .zoning_table import HOUSING_TYPES

_ELIG_POINTS = {"likely": 72, "conditional": 48, "unlikely": 18}


def _clip(n: int) -> int:
    return max(0, min(100, n))


def score_types(card: dict[str, Any]) -> list[dict[str, Any]]:
    elig = card.get("eligibility") or {}
    lot = (card.get("parcel") or {}).get("lot_sqft") or 0
    transit = card.get("transit") or {}
    stops_400 = transit.get("stops_400m")
    stops_800 = transit.get("stops_800m")
    hazards = card.get("hazards") or {}
    flood = hazards.get("flood") or {}
    sfha = bool(flood.get("sfha"))
    steep = bool(hazards.get("steep_slope_25pct"))
    mines = bool(hazards.get("undermined"))
    flags = card.get("flags") or {}
    vacant = bool(flags.get("likely_vacant_or_no_structure"))
    city_owned = bool(flags.get("city_owned"))
    acs = card.get("acs") or {}
    vacancy_rate = acs.get("vacancy_rate") or 0
    renter_share = acs.get("renter_share") or 0
    burden = acs.get("severe_rent_burden_share") or 0
    median_value = acs.get("median_value") or 0
    use = str((card.get("assessment") or {}).get("use") or "").upper()
    class_code = str((card.get("assessment") or {}).get("class") or "").upper()
    commercialish = class_code in {"C", "I", "G"} or any(
        k in use for k in ("COMMERCIAL", "INDUSTRIAL", "OFFICE", "WAREHOUSE", "RETAIL")
    )

    ranked = []
    for spec in HOUSING_TYPES:
        tid = spec["id"]
        eligibility = elig.get(tid, "conditional")
        score = _ELIG_POINTS[eligibility]
        why_bits: list[str] = []
        flags_out: list[str] = []

        if eligibility == "likely":
            why_bits.append("Zoning typically contemplates this pattern")
        elif eligibility == "unlikely":
            why_bits.append("Base zoning is a poor match without a map amendment or variance")
            flags_out.append("zoning_conflict")

        if tid == "adu":
            if lot and lot >= 3500 and not vacant:
                score += 12
                why_bits.append("Lot is large enough that a secondary unit is physically plausible")
            if vacant:
                score -= 15
                why_bits.append("ADUs piggyback on an existing (or planned) primary house")
        if tid in {"duplex_triplex", "townhouse"} and lot and 2500 <= lot <= 12000:
            score += 8
        if tid == "small_multifamily":
            if lot and lot >= 5000:
                score += 10
            if stops_400 and stops_400 >= 3:
                score += 10
                why_bits.append("Frequent nearby transit supports more units")
        if tid == "midrise":
            if lot and lot < 8000:
                score -= 12
                why_bits.append("Lot is small for a mid-rise without assembly")
            if stops_400 and stops_400 >= 4:
                score += 12
        if tid == "mixed_use":
            if stops_400 and stops_400 >= 2:
                score += 10
            if commercialish:
                score += 8
                why_bits.append("Current use is already non-residential")
        if tid == "adaptive_reuse":
            if commercialish:
                score += 18
                why_bits.append("Existing commercial/industrial stock is a conversion candidate")
            elif vacant:
                score -= 8
        if tid == "single_family":
            if vacant and lot and lot < 4000:
                score -= 6
            if median_value and median_value > 250000 and eligibility != "likely":
                score -= 4

        if stops_800 is not None:
            if stops_800 == 0 and tid in {"midrise", "mixed_use", "small_multifamily"}:
                score -= 10
                why_bits.append("Weak transit access for higher intensity")
            if stops_400 == 0 and tid == "single_family" and eligibility == "likely":
                score += 4

        if sfha:
            score -= 18 if tid in {"midrise", "small_multifamily", "mixed_use"} else 10
            flags_out.append("flood_hazard")
            why_bits.append("Site is in a FEMA special flood hazard area")
        if steep:
            score -= 14 if tid in {"midrise", "small_multifamily"} else 6
            flags_out.append("steep_slope")
            why_bits.append("Steep-slope overlay/area raises grading and foundation cost")
        if mines:
            score -= 6
            flags_out.append("mine_subsidence")
            why_bits.append("Historic undermining is a geotechnical screening flag")

        if vacant or city_owned:
            if tid in {"small_multifamily", "duplex_triplex", "townhouse", "mixed_use"}:
                score += 8
            if city_owned:
                flags_out.append("city_owned")
                why_bits.append("Public ownership can change the pipeline (disposition, RFPs)")

        if burden and burden > 0.2 and tid in {"small_multifamily", "duplex_triplex", "adu", "mixed_use"}:
            score += 8
            why_bits.append("Census tract shows elevated severe rent burden — more homes help")
        if vacancy_rate and vacancy_rate > 0.18 and tid == "midrise":
            score -= 8
            why_bits.append("High vacancy argues against adding a large new building first")
        if renter_share and renter_share > 0.55 and tid == "single_family":
            score -= 4

        if flags.get("outside_pittsburgh"):
            score -= 20
            flags_out.append("outside_city")

        ranked.append(
            {
                "id": tid,
                "label": spec["label"],
                "blurb": spec["blurb"],
                "score": _clip(int(round(score))),
                "eligibility": eligibility,
                "why": "; ".join(why_bits) or "Neutral site conditions relative to this type.",
                "flags": sorted(set(flags_out)),
            }
        )

    ranked.sort(key=lambda r: (-r["score"], r["label"]))
    return ranked
