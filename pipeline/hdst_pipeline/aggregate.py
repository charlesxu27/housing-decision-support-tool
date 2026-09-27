"""Assemble AreaRecord and SummaryArea dictionaries (contract: web/src/data/types.ts)."""

from __future__ import annotations

import math

import geopandas as gpd
import numpy as np
import pandas as pd

from .acs import HOUSEHOLD_KEYS, STOCK_KEYS
from .geography import centroid_lonlat
from .opportunity import opportunity_record
from .paths import TYPE_IDS


def _num(x, digits: int = 6) -> float | None:
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return round(f, digits)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def mode_or_none(values: pd.Series) -> str | None:
    v = values.dropna()
    if v.empty:
        return None
    counts = v.value_counts()
    top = counts[counts == counts.max()].index
    return str(sorted(top)[0])


def displacement_index(renter, burden, income, county_income, w: dict) -> float | None:
    if None in (renter, burden, income, county_income) or not county_income:
        return None
    return _clamp01(w["renter"] * renter + w["burden"] * burden + w["income"] * (1 - _clamp01(income / county_income)))


def build_area_records(
    tracts: gpd.GeoDataFrame,
    parcels: pd.DataFrame,
    fit_flags: pd.DataFrame,
    acs: pd.DataFrame,
    need: pd.DataFrame,
    fit: dict,
    allowed: dict,
    allowed_shares: dict,
    zoning_districts: dict,
    tract_trips: dict[str, int],
    county: dict,
    cfg: dict,
    munis_gdf: gpd.GeoDataFrame,
    school_by_tract: dict | None = None,
) -> list[dict]:
    city = cfg["county"]["cityLabel"]
    w_disp = cfg["risk"]["displacement"]
    gate = float(cfg["risk"]["floodwayShareGate"])
    required = cfg["confidence"]["requiredMeasures"]
    outside_factor = float(cfg["confidence"]["outsideCityFactor"])
    res_uses = set(cfg["allowed"]["residentialCapableUses"])

    centroids = centroid_lonlat(tracts)
    # municipality fallback for tracts without parcels: muni containing the tract centroid
    from .geography import assign_points

    cen_pts = gpd.GeoSeries(gpd.points_from_xy([c[0] for c in centroids], [c[1] for c in centroids]), crs=tracts.crs)
    fallback_muni = assign_points(cen_pts, munis_gdf, "label")

    grouped = parcels.groupby("tract", sort=True)
    groups = {k: v for k, v in grouped}
    records = []
    for i, tract in tracts.iterrows():
        tid = tract["id"]
        p = groups.get(tid)
        acs_row = acs.loc[tid] if tid in acs.index else None
        need_row = need.loc[tid] if tid in need.index else None

        if p is not None and len(p):
            muni = mode_or_none(p["muni"]) or fallback_muni.iloc[i] or "Unknown"
            munis = sorted(set(p["muni"].dropna()))
            hoods = sorted(set(p["hood"].dropna()))
            hood = mode_or_none(p["hood"])
            n = int(len(p))
            flood_share = float(p["flood"].eq(1).mean())
            fw_share = float(p["floodway"].eq(1).mean())
            slope_cov = p["slope"].ne(-1)
            slope_share = float(p.loc[slope_cov, "slope"].eq(1).mean()) if slope_cov.any() else None
            mine_cov = p["mine"].ne(-1)
            mine_share = float(p.loc[mine_cov, "mine"].eq(1).mean()) if mine_cov.any() else None
            counts = {
                "total": n,
                "residential": int((p["residential"] | p["use"].isin(res_uses - {"vacant"})).sum()),
                "vacant": int(p["use"].eq("vacant").sum()),
                "rehabCandidates": int(p["rehab"].eq(1).sum()),
            }
        else:
            muni = fallback_muni.iloc[i] or "Unknown"
            munis, hoods, hood = [muni], [], None
            flood_share, fw_share, slope_share, mine_share = 0.0, 0.0, None, None
            counts = {"total": 0, "residential": 0, "vacant": 0, "rehabCandidates": 0}

        in_city = muni == city
        if not in_city:
            hood = None

        def measure(key):
            if acs_row is None:
                return None
            return _num(acs_row.get(key))

        households = {k: measure(k) for k in HOUSEHOLD_KEYS}
        if households["total"] is not None:
            households["total"] = int(households["total"])
        stock = {k: measure(k) for k in STOCK_KEYS}
        if stock["total_units"] is not None:
            stock["total_units"] = int(stock["total_units"])
        flags = sorted(acs_row["moe_flags"]) if acs_row is not None and isinstance(acs_row["moe_flags"], list) else []

        need_bands = {t: (str(need_row[f"need_{t}"]) if need_row is not None else "uncertain") for t in TYPE_IDS}
        need_scores = {t: (_num(need_row[f"score_{t}"]) if need_row is not None else None) for t in TYPE_IDS}

        income = measure("median_income")
        county_income = county.get("median_income")
        disp = displacement_index(households["renter_share"], households["cost_burdened_renters"], income, county_income, w_disp)

        present = sum(1 for k in required if (households.get(k) if k in households else stock.get(k)) is not None and k not in flags)
        confidence = (present / len(required)) * (1.0 if in_city else outside_factor)

        records.append(
            {
                "id": tid,
                "kind": "tract",
                "name": tract["name"],
                "muni": muni,
                "munis": munis,
                "inCity": bool(in_city),
                "neighborhood": hood,
                "neighborhoods": hoods if in_city else [],
                "centroid": [round(centroids[i][0], 6), round(centroids[i][1], 6)],
                "households": households,
                "stock": stock,
                "moeFlags": flags,
                "need": need_bands,
                "needScores": need_scores,
                "fit": fit[tid],
                "allowed": allowed[tid],
                "allowedShares": allowed_shares[tid],
                # A boundary tract can contain a few City parcels. Zoning applies
                # only when the tract's dominant municipality is the City.
                "zoningDistricts": zoning_districts.get(tid, []) if in_city else [],
                "risk": {
                    "displacement": _num(disp),
                    "floodShare": _num(flood_share),
                    "floodwayShare": _num(fw_share),
                    "floodway": bool(fw_share >= gate),
                    "slopeShare": _num(slope_share),
                    "undermined": _num(mine_share),
                },
                "carbon": {"vmtPerHh": None},
                "transitTrips800m": int(tract_trips.get(tid, 0)),
                "parcels": counts,
                "confidence": _num(confidence, 4),
                "opportunity": opportunity_record(income, county_income, (school_by_tract or {}).get(tid)),
            }
        )
    return records


def build_summaries(
    summary_gdf: gpd.GeoDataFrame,
    kind: str,
    parcels: pd.DataFrame,
    parcel_key: str,
    city_label: str,
    tract_muni: dict[str, str],
) -> list[dict]:
    """SummaryArea records for municipalities (`parcel_key`='muni') or neighborhoods ('hood')."""
    members = parcels[parcels[parcel_key].notna()].groupby([parcel_key, "tract"]).size()
    centroids = centroid_lonlat(summary_gdf)
    bounds = summary_gdf.bounds
    out = []
    for i, row in summary_gdf.iterrows():
        label = row["label"]
        mem = members.loc[label] if label in members.index.get_level_values(0) else pd.Series(dtype=int)
        mlist = [{"id": str(t), "weight": int(w)} for t, w in sorted(mem.items())]
        out.append(
            {
                "id": row["id"],
                "kind": kind,
                "label": label,
                "municipality": label if kind == "municipality" else city_label,
                "members": mlist,
                "parcels": int(sum(m["weight"] for m in mlist)),
                "centroid": [round(centroids[i][0], 6), round(centroids[i][1], 6)],
                "bbox": [round(float(bounds.loc[i, c]), 6) for c in ("minx", "miny", "maxx", "maxy")],
            }
        )
    return out


def null_coverage(areas: list[dict]) -> dict[str, float]:
    n = len(areas) or 1
    keys = {
        "households.hh_1_2": lambda a: a["households"]["hh_1_2"],
        "households.hh_5_plus": lambda a: a["households"]["hh_5_plus"],
        "households.senior_alone": lambda a: a["households"]["senior_alone"],
        "households.cost_burdened_renters": lambda a: a["households"]["cost_burdened_renters"],
        "households.overcrowded": lambda a: a["households"]["overcrowded"],
        "households.renter_share": lambda a: a["households"]["renter_share"],
        "stock.br_0_1": lambda a: a["stock"]["br_0_1"],
        "stock.br_3_plus": lambda a: a["stock"]["br_3_plus"],
        "stock.other_vacant_share": lambda a: a["stock"]["other_vacant_share"],
        "risk.displacement": lambda a: a["risk"]["displacement"],
        "risk.slopeShare": lambda a: a["risk"]["slopeShare"],
        "risk.undermined": lambda a: a["risk"]["undermined"],
        "carbon.vmtPerHh": lambda a: a["carbon"]["vmtPerHh"],
        "opportunity.medianHouseholdIncome": lambda a: a.get("opportunity", {}).get("medianHouseholdIncome"),
        "opportunity.mathProficient": lambda a: a.get("opportunity", {}).get("mathProficient"),
        "opportunity.elaProficient": lambda a: a.get("opportunity", {}).get("elaProficient"),
    }
    out = {k: round(sum(1 for a in areas if f(a) is None) / n, 4) for k, f in keys.items()}
    for t in TYPE_IDS:
        out[f"need.{t}.uncertain"] = round(sum(1 for a in areas if a["need"][t] == "uncertain") / n, 4)
    out["allowed.unknown"] = round(
        sum(1 for a in areas if all(a["allowed"][t] == "unknown" for t in TYPE_IDS)) / n, 4
    )
    return out
