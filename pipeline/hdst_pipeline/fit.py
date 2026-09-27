"""FIT model: per-parcel suitability flags per housing type, then tract aggregation.

Expected parcel columns: ``use``, ``lot`` (sq ft), ``bldg`` (0/1), ``finished``
(sq ft), ``commercial`` (bool), ``trips800`` (int), ``flood``, ``floodway``,
``slope`` (-1/0/1), ``rehab`` (0/1).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .paths import TYPE_IDS


def parcel_fit_flags(p: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    lot = p["lot"].astype(float)
    finished = p["finished"].astype(float) if "finished" in p else pd.Series(np.nan, index=p.index)
    L, T = cfg["lotSqft"], cfg["transit"]
    vacant = p["use"].eq("vacant")
    sf = p["use"].eq("sf_detached")
    bldg = p["bldg"].astype(int).eq(1)
    commercial = p["commercial"].astype(bool)
    trips = p["trips800"].astype(float)
    dev_land = vacant | commercial
    not_steep = ~p["slope"].astype(int).eq(1)

    f = pd.DataFrame(index=p.index)
    f["adu"] = sf & bldg & (lot >= L["adu"])
    f["duplex_triplex"] = (vacant & (lot >= L["duplexVacant"])) | (
        sf & bldg & (finished >= L["duplexConversionFinishedSqft"]) & (lot >= L["duplexConversion"])
    )
    f["townhome"] = vacant & (lot >= L["townhome"])
    f["small_apartment"] = dev_land & (lot >= L["smallApartmentMin"]) & (lot <= L["smallApartmentMax"]) & (trips >= T["smallApartmentTrips"])
    f["large_apartment"] = dev_land & (lot >= L["largeApartment"]) & (trips >= T["largeApartmentTrips"])
    f["senior_accessible"] = (lot >= L["senior"]) & not_steep & (trips >= T["seniorTrips"])
    f["rehab_reuse"] = bldg & p["rehab"].astype(int).eq(1)
    f["detached_sf"] = vacant & (lot >= L["detached"])

    floodway = p["floodway"].astype(int).eq(1)
    steep = p["slope"].astype(int).eq(1)
    for t in TYPE_IDS:
        f[t] = f[t].fillna(False) & ~floodway
        if t in cfg["slopeExcludedTypes"]:
            f[t] = f[t] & ~steep
    return f.astype(int)


def tertile_count_bands(counts: pd.Series) -> pd.Series:
    """County tertiles of suitable-parcel counts; zero => 'low'."""
    c = counts.astype(float)
    out = pd.Series("low", index=c.index, dtype=object)
    pos = c[c > 0]
    if len(pos) == 0:
        return out
    q1, q2 = pos.quantile(1 / 3), pos.quantile(2 / 3)
    out[pos.index] = np.where(pos > q2, "high", np.where(pos > q1, "medium", "low"))
    return out


def tract_fit(parcels: pd.DataFrame, flags: pd.DataFrame, cfg: dict, tract_ids: list[str]) -> dict[str, dict[str, dict]]:
    """Per tract per type: {band, parcels, homes}. Tracts without parcels get zero counts."""
    by_tract = flags.groupby(parcels["tract"]).sum()
    by_tract = by_tract.reindex(tract_ids).fillna(0).astype(int)
    result: dict[str, dict[str, dict]] = {tid: {} for tid in tract_ids}
    for t in TYPE_IDS:
        bands = tertile_count_bands(by_tract[t])
        lo, hi = cfg["homesPerParcel"][t]
        for tid in tract_ids:
            n = int(by_tract.at[tid, t])
            result[tid][t] = {"band": str(bands[tid]), "parcels": n, "homes": [n * int(lo), n * int(hi)]}
    return result
