"""ALLOWED model: Pittsburgh zoning district x type -> status, aggregated to tracts.

Outside the City every status is ``unknown``. Inside the City a parcel takes
the district of the zoning polygon containing its representative point and the
matrix row for (district, type); when no exact district row exists the
district *family* (text before the first ``-``) is tried; otherwise ``unknown``.
"""

from __future__ import annotations

import csv
from pathlib import Path

import pandas as pd

from .paths import TYPE_IDS, ZONING_STATUSES

MATRIX_COLUMNS = ["district", "type", "status", "min_lot_sqft", "section", "quote", "verified_by", "verified_at", "notes"]


def load_matrix(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        if reader.fieldnames != MATRIX_COLUMNS:
            raise ValueError(f"{path.name}: columns {reader.fieldnames} != {MATRIX_COLUMNS}")
        rows = [dict(r) for r in reader]
    seen = set()
    for r in rows:
        key = (r["district"], r["type"])
        if key in seen:
            raise ValueError(f"duplicate matrix row {key}")
        seen.add(key)
        if r["type"] not in TYPE_IDS:
            raise ValueError(f"unknown type {r['type']!r} in matrix")
        if r["status"] not in ZONING_STATUSES:
            raise ValueError(f"unknown status {r['status']!r} in matrix row {key}")
    return rows


def district_family(code: str) -> str:
    return code.split("-", 1)[0].strip()


def lookup(matrix: dict[tuple[str, str], str], district: str | None, type_id: str) -> str:
    if district is None or district == "":
        return "unknown"
    d = str(district).strip().upper()
    if (d, type_id) in matrix:
        return matrix[(d, type_id)]
    fam = district_family(d)
    if (fam, type_id) in matrix:
        return matrix[(fam, type_id)]
    return "unknown"


def matrix_index(rows: list[dict]) -> dict[tuple[str, str], str]:
    return {(r["district"].strip().upper(), r["type"]): r["status"] for r in rows}


def parcel_statuses(parcels: pd.DataFrame, matrix: dict[tuple[str, str], str], city_label: str) -> pd.DataFrame:
    """Per-parcel status per type. ``zone`` must be None outside the City."""
    out = pd.DataFrame(index=parcels.index)
    in_city = parcels["muni"].eq(city_label)
    zones = parcels["zone"].where(in_city, None)
    uniq = pd.unique(zones.dropna())
    for t in TYPE_IDS:
        mapping = {z: lookup(matrix, z, t) for z in uniq}
        out[t] = zones.map(mapping).fillna("unknown")
        out.loc[~in_city, t] = "unknown"
    return out


def tract_allowed(
    parcels: pd.DataFrame,
    statuses: pd.DataFrame,
    tract_ids: list[str],
    residential_capable_uses: list[str],
    priority: list[str],
) -> tuple[dict[str, dict[str, str]], dict[str, dict[str, dict[str, float]]], dict[str, list[str]]]:
    """Dominant status and share breakdown over residential-capable parcels per tract.

    Tracts with no residential-capable parcels are ``unknown`` with shares {unknown: 1}.
    Returns (allowed, allowedShares, zoningDistricts).
    """
    cap = parcels["use"].isin(residential_capable_uses)
    sub = statuses[cap]
    tracts = parcels.loc[cap, "tract"]
    zones = parcels.loc[parcels["zone"].notna(), ["tract", "zone"]]
    districts = zones.groupby("tract")["zone"].agg(lambda s: sorted(set(s)))
    allowed: dict[str, dict[str, str]] = {}
    shares: dict[str, dict[str, dict[str, float]]] = {}
    zd: dict[str, list[str]] = {}
    rank = {s: i for i, s in enumerate(priority)}
    for tid in tract_ids:
        allowed[tid], shares[tid] = {}, {}
        zd[tid] = list(districts.get(tid, []))
        mask = tracts == tid
        n = int(mask.sum())
        for t in TYPE_IDS:
            if n == 0:
                allowed[tid][t] = "unknown"
                shares[tid][t] = {"unknown": 1.0}
                continue
            counts = sub.loc[mask, t].value_counts()
            share = {str(k): round(float(v) / n, 6) for k, v in counts.items()}
            best = sorted(counts.items(), key=lambda kv: (-kv[1], rank.get(kv[0], 99)))[0][0]
            allowed[tid][t] = str(best)
            shares[tid][t] = dict(sorted(share.items(), key=lambda kv: rank.get(kv[0], 99)))
    return allowed, shares, zd


def matrix_to_export(rows: list[dict], districts_present: list[str], muni: str, source: str) -> dict:
    rules = []
    for r in rows:
        mls = r.get("min_lot_sqft", "").strip()
        rules.append(
            {
                "muni": muni,
                "district": r["district"].strip(),
                "type": r["type"],
                "status": r["status"],
                "minLotSqft": int(float(mls)) if mls else None,
                "section": r.get("section", ""),
                "quote": r.get("quote", ""),
                "verifiedBy": (r.get("verified_by") or "").strip() or None,
                "verifiedAt": (r.get("verified_at") or "").strip() or None,
            }
        )
    verified = all(rule["verifiedBy"] for rule in rules) and bool(rules)
    return {
        "schemaVersion": 1,
        "muni": muni,
        "source": source,
        "verificationStatus": "verified" if verified else "draft",
        "districts": sorted(set(districts_present)),
        "rules": rules,
    }
