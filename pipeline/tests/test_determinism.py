"""Same inputs => same configHash and identical area_metrics (ignoring builtAt)."""

import json

import pandas as pd

from hdst_pipeline.allowed import matrix_index, parcel_statuses, tract_allowed
from hdst_pipeline.fit import parcel_fit_flags, tract_fit
from hdst_pipeline.need import compute_need
from hdst_pipeline.paths import DEFAULT_PATHS, TYPE_IDS, config_hash


def test_config_hash_is_stable_and_sensitive(tmp_path, monkeypatch):
    h1 = config_hash(DEFAULT_PATHS)
    h2 = config_hash(DEFAULT_PATHS)
    assert h1 == h2 and len(h1) == 64
    assert config_hash(DEFAULT_PATHS, extra={"x": 1}) != h1


def _inputs():
    parcels = pd.DataFrame(
        {
            "pin": ["p1", "p2", "p3"],
            "tract": ["A", "A", "B"],
            "muni": ["Pittsburgh", "Pittsburgh", "Penn Hills"],
            "use": ["vacant", "sf_detached", "vacant"],
            "lot": [7000.0, 6000.0, 9000.0],
            "bldg": [0, 1, 0],
            "finished": [None, 2600.0, None],
            "commercial": [False, False, False],
            "trips800": [100, 0, 200],
            "flood": [0, 0, 0],
            "floodway": [0, 0, 0],
            "slope": [0, 0, -1],
            "rehab": [0, 1, 0],
            "zone": ["R2-L", "R1D-L", None],
        }
    )
    acs = pd.DataFrame(
        {
            "hh_1_2": [0.8, 0.6],
            "hh_5_plus": [0.02, 0.08],
            "senior_alone": [0.2, 0.1],
            "cost_burdened_renters": [0.5, 0.3],
            "overcrowded": [0.01, 0.02],
            "renter_share": [0.6, 0.3],
            "br_0_1": [0.2, 0.1],
            "br_2": [0.3, 0.3],
            "br_3_plus": [0.5, 0.6],
            "other_vacant_share": [0.1, 0.02],
            "vacant_share": [0.15, 0.05],
            "moe_flags": [[], []],
        },
        index=["A", "B"],
    )
    return parcels, acs


def _run(model_cfg):
    parcels, acs = _inputs()
    flags = parcel_fit_flags(parcels, model_cfg["fit"])
    fit = tract_fit(parcels, flags, model_cfg["fit"], ["A", "B"])
    m = matrix_index([{"district": "R2", "type": t, "status": "by_right"} for t in TYPE_IDS])
    st = parcel_statuses(parcels, m, "Pittsburgh")
    allowed, shares, _ = tract_allowed(parcels, st, ["A", "B"], model_cfg["allowed"]["residentialCapableUses"], model_cfg["allowed"]["statusPriority"])
    need = compute_need(acs, model_cfg["need"]["weights"])
    return json.dumps({"fit": fit, "allowed": allowed, "shares": shares, "need": need.fillna("null").to_dict()}, sort_keys=True)


def test_model_outputs_are_deterministic(model_cfg):
    assert _run(model_cfg) == _run(model_cfg)


def test_area_metrics_equal_ignoring_built_at():
    a = {"schemaVersion": 1, "builtAt": "2026-01-01T00:00:00Z", "areas": [{"id": "x"}], "summaries": []}
    b = {"schemaVersion": 1, "builtAt": "2026-01-02T00:00:00Z", "areas": [{"id": "x"}], "summaries": []}
    strip = lambda d: {k: v for k, v in d.items() if k != "builtAt"}  # noqa: E731
    assert json.dumps(strip(a), sort_keys=True) == json.dumps(strip(b), sort_keys=True)
