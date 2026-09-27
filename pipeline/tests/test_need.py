"""ACS MOE handling and propagation of missing/flagged inputs to `uncertain`."""

import math

import pandas as pd

from hdst_pipeline.acs import Est, cv, flags_for, ratio
from hdst_pipeline.need import compute_need, tertile_bands


def test_ratio_moe_uses_proportion_formula():
    r = ratio(Est(50, 10), Est(200, 20))
    assert math.isclose(r.value, 0.25)
    expected = math.sqrt(10**2 - 0.25**2 * 20**2) / 200
    assert math.isclose(r.moe, expected)


def test_ratio_missing_inputs_propagate_none():
    assert ratio(Est(None, None), Est(200, 20)).value is None
    assert ratio(Est(50, 10), Est(0, 5)).value is None


def test_cv_and_flags():
    est = Est(0.30, 0.20)  # CV = (0.2/1.645)/0.3 = 0.405
    assert cv(est, 1.645) > 0.40
    measures = {"total": Est(400, 30), "renter_share": est, "hh_1_2": Est(0.5, 0.02)}
    assert flags_for(measures, 0.40, 50, 1.645, 0.05) == ["renter_share"]
    # small share with huge CV but tiny absolute MOE is not flagged
    measures = {"total": Est(400, 30), "overcrowded": Est(0.01, 0.012)}
    assert flags_for(measures, 0.40, 50, 1.645, 0.05) == []
    # too few households flags everything that is present
    measures = {"total": Est(20, 5), "renter_share": Est(0.5, 0.01)}
    assert flags_for(measures, 0.40, 50, 1.645, 0.05) == ["renter_share"]
    # unknown MOE cannot be assessed -> flagged
    assert flags_for({"total": Est(400, 1), "hh_1_2": Est(0.5, None)}, 0.40, 50, 1.645) == ["hh_1_2"]


def _frame():
    cols = ["hh_1_2", "hh_5_plus", "senior_alone", "cost_burdened_renters", "overcrowded", "renter_share", "br_0_1", "br_2", "br_3_plus", "other_vacant_share", "vacant_share"]
    rows = {
        "t1": [0.8, 0.02, 0.2, 0.5, 0.01, 0.6, 0.2, 0.3, 0.5, 0.10, 0.15],
        "t2": [0.6, 0.08, 0.1, 0.3, 0.02, 0.3, 0.1, 0.3, 0.6, 0.02, 0.05],
        "t3": [0.7, 0.05, 0.15, 0.4, 0.01, 0.4, 0.15, 0.3, 0.55, 0.05, 0.08],
        "t4": [None, 0.05, 0.15, 0.4, 0.01, 0.4, 0.15, 0.3, 0.55, 0.05, 0.08],  # missing hh_1_2
    }
    df = pd.DataFrame.from_dict(rows, orient="index", columns=cols)
    df["moe_flags"] = [[], [], ["senior_alone"], []]
    return df


def test_missing_measure_makes_dependent_types_uncertain():
    weights = {"adu": {"small": 1.0}, "townhome": {"large": 1.0}}
    out = compute_need(_frame(), weights)
    assert out.loc["t4", "need_adu"] == "uncertain"
    assert pd.isna(out.loc["t4", "score_adu"])
    assert out.loc["t4", "need_townhome"] != "uncertain"  # does not depend on hh_1_2


def test_flagged_measure_makes_dependent_types_uncertain():
    weights = {"senior_accessible": {"senior": 1.0}, "adu": {"small": 1.0}}
    out = compute_need(_frame(), weights)
    assert out.loc["t3", "need_senior_accessible"] == "uncertain"
    assert out.loc["t3", "need_adu"] != "uncertain"


def test_tertile_bands_cover_high_medium_low():
    s = pd.Series([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, None])
    bands = tertile_bands(s)
    assert bands.tolist() == ["low", "low", "medium", "medium", "high", "high", "uncertain"]


def test_type_without_weights_is_uncertain():
    out = compute_need(_frame(), {"adu": {"small": 1.0}})
    assert set(out["need_rehab_reuse"]) == {"uncertain"}
