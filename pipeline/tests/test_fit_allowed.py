"""Floodway exclusion, slope gating, City vs outside-City allowed, aggregation shares."""

import pandas as pd

from pathlib import Path

from hdst_pipeline.allowed import load_matrix, lookup, matrix_index, parcel_statuses, tract_allowed
from hdst_pipeline.fit import parcel_fit_flags, tertile_count_bands, tract_fit
from hdst_pipeline.paths import TYPE_IDS


def _parcels():
    return pd.DataFrame(
        {
            "pin": ["p1", "p2", "p3", "p4", "p5", "p6"],
            "tract": ["A", "A", "A", "B", "B", "B"],
            "muni": ["Pittsburgh", "Pittsburgh", "Pittsburgh", "Penn Hills", "Penn Hills", "Penn Hills"],
            "use": ["vacant", "vacant", "sf_detached", "vacant", "sf_detached", "other"],
            "lot": [9000.0, 9000.0, 6000.0, 9000.0, 3000.0, 50000.0],
            "bldg": [0, 0, 1, 0, 1, 1],
            "finished": [None, None, 2600.0, None, 900.0, 1000.0],
            "commercial": [False, False, False, False, False, True],
            "trips800": [100, 100, 0, 200, 0, 200],
            "flood": [0, 1, 0, 0, 0, 0],
            "floodway": [0, 1, 0, 0, 0, 0],
            "slope": [0, 0, 1, -1, -1, -1],
            "rehab": [0, 0, 1, 0, 1, 0],
            "zone": ["R2-L", "R2-L", "R1D-L", None, None, None],
        }
    )


def test_floodway_parcel_excluded_from_every_type(model_cfg):
    flags = parcel_fit_flags(_parcels(), model_cfg["fit"])
    p1, p2 = flags.iloc[0], flags.iloc[1]
    assert p1["townhome"] == 1 and p1["detached_sf"] == 1 and p1["small_apartment"] == 1
    assert p2.sum() == 0  # identical parcel in the floodway passes nothing


def test_slope_excludes_new_construction_but_not_rehab(model_cfg):
    flags = parcel_fit_flags(_parcels(), model_cfg["fit"])
    p3 = flags.iloc[2]
    assert p3["adu"] == 0 and p3["duplex_triplex"] == 0  # steep
    assert p3["rehab_reuse"] == 1  # rehab still counts


def test_fit_rules_outside_city(model_cfg):
    flags = parcel_fit_flags(_parcels(), model_cfg["fit"])
    p4, p5, p6 = flags.iloc[3], flags.iloc[4], flags.iloc[5]
    assert p4["townhome"] == 1 and p4["small_apartment"] == 1 and p4["senior_accessible"] == 1
    assert p5["rehab_reuse"] == 1 and p5["adu"] == 0  # lot too small for ADU
    assert p6["large_apartment"] == 1  # commercial lot >= 0.5 acre near transit


def test_tract_fit_counts_and_bands(model_cfg):
    p = _parcels()
    flags = parcel_fit_flags(p, model_cfg["fit"])
    fit = tract_fit(p, flags, model_cfg["fit"], ["A", "B", "C"])
    assert fit["A"]["townhome"]["parcels"] == 1
    assert fit["C"]["townhome"] == {"band": "low", "parcels": 0, "homes": [0, 0]}
    lo, hi = model_cfg["fit"]["homesPerParcel"]["townhome"]
    assert fit["A"]["townhome"]["homes"] == [lo, hi]


def test_tertile_count_bands_zero_is_low():
    s = pd.Series({"a": 0, "b": 1, "c": 5, "d": 10, "e": 20, "f": 30, "g": 40})
    b = tertile_count_bands(s)
    assert b["a"] == "low" and b["b"] == "low" and b["g"] == "high"


def test_adu_draft_follows_pending_bill():
    rows = load_matrix(Path(__file__).resolve().parents[1] / "zoning" / "pittsburgh_matrix.csv")
    matrix = matrix_index(rows)
    assert lookup(matrix, "R1D-L", "adu") == "by_right"
    assert lookup(matrix, "LNC", "adu") == "by_right"
    assert lookup(matrix, "GI", "adu") == "not_permitted"
    assert lookup(matrix, "RIV-MU", "adu") == "unknown"


def test_lookup_specific_then_family_then_unknown():
    m = matrix_index([{"district": "R1D", "type": "adu", "status": "not_permitted"}, {"district": "R1D-L", "type": "adu", "status": "by_right"}])
    assert lookup(m, "R1D-L", "adu") == "by_right"
    assert lookup(m, "R1D-H", "adu") == "not_permitted"
    assert lookup(m, "GT-A", "adu") == "unknown"
    assert lookup(m, None, "adu") == "unknown"


def test_outside_city_is_unknown_everywhere(model_cfg):
    p = _parcels()
    m = matrix_index([{"district": "R2", "type": t, "status": "by_right"} for t in TYPE_IDS] + [{"district": "R1D", "type": t, "status": "not_permitted"} for t in TYPE_IDS])
    st = parcel_statuses(p, m, "Pittsburgh")
    assert (st.iloc[3:] == "unknown").all().all()
    assert st.iloc[0]["adu"] == "by_right" and st.iloc[2]["adu"] == "not_permitted"
    allowed, shares, districts = tract_allowed(p, st, ["A", "B"], model_cfg["allowed"]["residentialCapableUses"], model_cfg["allowed"]["statusPriority"])
    assert all(v == "unknown" for v in allowed["B"].values())
    assert shares["B"]["adu"] == {"unknown": 1.0}
    assert allowed["A"]["adu"] == "by_right"
    assert abs(shares["A"]["adu"]["by_right"] - 2 / 3) < 1e-6 and abs(shares["A"]["adu"]["not_permitted"] - 1 / 3) < 1e-6
    assert districts["A"] == ["R1D-L", "R2-L"] and districts["B"] == []


def test_allowed_shares_sum_to_one(model_cfg):
    p = _parcels()
    m = matrix_index([{"district": "R2", "type": "adu", "status": "by_right"}])
    st = parcel_statuses(p, m, "Pittsburgh")
    _, shares, _ = tract_allowed(p, st, ["A", "B"], model_cfg["allowed"]["residentialCapableUses"], model_cfg["allowed"]["statusPriority"])
    for tid in ("A", "B"):
        for t in TYPE_IDS:
            assert abs(sum(shares[tid][t].values()) - 1.0) < 1e-6
