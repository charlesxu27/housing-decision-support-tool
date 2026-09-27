"""Aggregation totals and export validation on tiny synthetic snapshots."""

import copy
import json

import geopandas as gpd
import pandas as pd
import pytest
from shapely.geometry import box

from hdst_pipeline.aggregate import build_area_records, build_summaries, displacement_index, mode_or_none
from hdst_pipeline.paths import TYPE_IDS
from hdst_pipeline.validate import validate_area_metrics, validate_manifest, validate_zoning_matrix


def _area(aid="42003010301", muni="Pittsburgh", in_city=True, total=3):
    return {
        "id": aid,
        "kind": "tract",
        "name": "Tract 103.01",
        "muni": muni,
        "munis": [muni],
        "inCity": in_city,
        "neighborhood": "Shadyside" if in_city else None,
        "neighborhoods": ["Shadyside"] if in_city else [],
        "centroid": [-79.93, 40.45],
        "households": {"total": 100, "hh_1_2": 0.7, "hh_5_plus": 0.05, "senior_alone": 0.1, "cost_burdened_renters": 0.4, "overcrowded": 0.01, "renter_share": 0.5},
        "stock": {"total_units": 110, "br_0_1": 0.2, "br_2": 0.3, "br_3_plus": 0.5, "units_1_detached": 0.5, "units_1_attached": 0.1, "units_2_to_4": 0.1, "units_5_to_19": 0.1, "units_20_plus": 0.2, "vacant_share": 0.1, "other_vacant_share": 0.03},
        "moeFlags": [],
        "need": {t: "medium" for t in TYPE_IDS},
        "needScores": {t: 0.5 for t in TYPE_IDS},
        "fit": {t: {"band": "low", "parcels": 0, "homes": [0, 0]} for t in TYPE_IDS},
        "allowed": {t: ("by_right" if in_city else "unknown") for t in TYPE_IDS},
        "allowedShares": {t: ({"by_right": 1.0} if in_city else {"unknown": 1.0}) for t in TYPE_IDS},
        "zoningDistricts": ["R2-L"] if in_city else [],
        "risk": {"displacement": 0.3, "floodShare": 0.0, "floodwayShare": 0.0, "floodway": False, "slopeShare": 0.1 if in_city else None, "undermined": None},
        "carbon": {"vmtPerHh": None},
        "transitTrips800m": 12,
        "parcels": {"total": total, "residential": 2, "vacant": 1, "rehabCandidates": 0},
        "confidence": 0.9,
    }


def _summary(sid, kind, label, members):
    return {
        "id": sid,
        "kind": kind,
        "label": label,
        "municipality": label if kind == "municipality" else "Pittsburgh",
        "members": members,
        "parcels": sum(m["weight"] for m in members),
        "centroid": [-79.9, 40.4],
        "bbox": [-80.0, 40.3, -79.8, 40.5],
    }


def _snapshot():
    a1 = _area("42003010301", total=3)
    a2 = _area("42003020100", muni="Penn Hills Municipality", in_city=False, total=2)
    return {
        "schemaVersion": 1,
        "builtAt": "2026-09-27T00:00:00Z",
        "areas": [a1, a2],
        "summaries": [
            _summary("hood:shadyside", "neighborhood", "Shadyside", [{"id": a1["id"], "weight": 3}]),
            _summary("muni:penn-hills-municipality", "municipality", "Penn Hills Municipality", [{"id": a2["id"], "weight": 2}]),
            _summary("muni:pittsburgh", "municipality", "Pittsburgh", [{"id": a1["id"], "weight": 3}]),
        ],
    }


def test_boundary_tract_outside_city_drops_spillover_zoning(model_cfg):
    tracts = gpd.GeoDataFrame(
        {"id": ["T"], "name": ["Tract T"], "geometry": [box(-80.1, 40.3, -80.0, 40.4)]},
        crs="EPSG:4326",
    )
    munis = gpd.GeoDataFrame(
        {"label": ["Green Tree Borough"], "geometry": [box(-80.2, 40.2, -79.9, 40.5)]},
        crs="EPSG:4326",
    )
    parcels = pd.DataFrame(
        {
            "tract": ["T", "T", "T"],
            "muni": ["Green Tree Borough", "Green Tree Borough", "Pittsburgh"],
            "hood": [None, None, "Banksville"],
            "flood": [0, 0, 0],
            "floodway": [0, 0, 0],
            "slope": [-1, -1, 0],
            "mine": [-1, -1, 0],
            "residential": [True, True, True],
            "use": ["sf_detached", "sf_detached", "sf_detached"],
            "rehab": [0, 0, 0],
        }
    )
    per_type = {t: {"band": "low", "parcels": 0, "homes": [0, 0]} for t in TYPE_IDS}
    records = build_area_records(
        tracts,
        parcels,
        pd.DataFrame(),
        pd.DataFrame(),
        pd.DataFrame(),
        {"T": per_type},
        {"T": {t: "unknown" for t in TYPE_IDS}},
        {"T": {t: {"unknown": 1.0} for t in TYPE_IDS}},
        {"T": ["R1D-L"]},
        {},
        {"median_income": 78548},
        model_cfg,
        munis,
    )
    assert records[0]["inCity"] is False
    assert records[0]["muni"] == "Green Tree Borough"
    assert records[0]["zoningDistricts"] == []
    assert records[0]["neighborhood"] is None


def test_valid_snapshot_passes():
    assert validate_area_metrics(_snapshot(), "Pittsburgh") == []


def test_duplicate_ids_rejected():
    s = _snapshot()
    s["areas"].append(copy.deepcopy(s["areas"][0]))
    assert any("duplicate area ids" in p for p in validate_area_metrics(s, "Pittsburgh"))


def test_out_of_range_share_rejected():
    s = _snapshot()
    s["areas"][0]["households"]["renter_share"] = 1.7
    assert any("renter_share" in p for p in validate_area_metrics(s, "Pittsburgh"))
    s = _snapshot()
    s["areas"][0]["allowedShares"]["adu"] = {"by_right": 0.7, "unknown": 0.7}
    assert any("sums to" in p for p in validate_area_metrics(s, "Pittsburgh"))


def test_outside_city_allowed_must_be_unknown():
    s = _snapshot()
    s["areas"][1]["allowed"]["adu"] = "by_right"
    s["areas"][1]["allowedShares"]["adu"] = {"by_right": 1.0}
    assert any("must be unknown outside the City" in p for p in validate_area_metrics(s, "Pittsburgh"))


def test_member_weights_must_match_tract_parcel_counts():
    s = _snapshot()
    s["summaries"][2]["members"][0]["weight"] = 2
    s["summaries"][2]["parcels"] = 2
    assert any("member weights" in p for p in validate_area_metrics(s, "Pittsburgh"))


def test_uncertain_iff_null_score():
    s = _snapshot()
    s["areas"][0]["need"]["adu"] = "uncertain"
    assert any("uncertain iff" in p for p in validate_area_metrics(s, "Pittsburgh"))


def test_default_substitution_is_rejected():
    # a tract whose neighborhood is set outside the City is a copied default
    s = _snapshot()
    s["areas"][1]["neighborhood"] = "Shadyside"
    assert any("neighborhood must be null" in p for p in validate_area_metrics(s, "Pittsburgh"))


def _manifest():
    return {
        "schemaVersion": 1,
        "builtAt": "2026-09-27T00:00:00Z",
        "modelVersion": "0.1.0",
        "configHash": "abc",
        "coverage": {"county": "Allegheny", "tractVintage": "2024", "acsVintage": "2020-2024", "zoningMunicipalities": ["Pittsburgh"]},
        "files": {},
        "sources": [
            {
                "id": "acs5",
                "title": "t",
                "publisher": "p",
                "catalogUrl": "u",
                "resourceUrl": "u",
                "geography": "g",
                "vintage": "v",
                "retrievedAt": "2026-09-27T00:00:00Z",
                "sha256": "x",
                "license": "l",
                "fieldsRetained": [],
                "notes": "",
                "available": True,
            }
        ],
        "nullCoverage": {"households.hh_1_2": 0.02},
        "counts": {"tracts": 2, "municipalities": 2, "neighborhoods": 1, "parcels": 5},
        "parcelTiles": {"urlTemplate": "/data/tiles/parcels/{z}/{x}/{y}.pbf", "layer": "parcels", "minZoom": 13, "maxZoom": 16},
    }


def test_manifest_provenance_required():
    assert validate_manifest(_manifest()) == []
    m = _manifest()
    m["sources"] = []
    assert any("provenance" in p for p in validate_manifest(m))
    m = _manifest()
    del m["sources"][0]["license"]
    assert any("missing license" in p for p in validate_manifest(m))
    m = _manifest()
    m["sources"][0]["sha256"] = None
    assert any("no sha256" in p for p in validate_manifest(m))
    m = _manifest()
    m["parcelTiles"]["urlTemplate"] = "/tiles/{z}/{x}/{y}.pbf"
    assert any("parcelTiles" in p for p in validate_manifest(m))


def test_manifest_checks_files_on_disk(tmp_path):
    m = _manifest()
    (tmp_path / "area_metrics.json").write_text("{}")
    m["files"] = {"area_metrics.json": {"path": "area_metrics.json", "bytes": 2, "sha256": "wrong", "rows": 0}}
    m["parcelTiles"] = None
    probs = validate_manifest(m, tmp_path)
    assert any("sha256 mismatch" in p for p in probs)


def test_zoning_matrix_validation():
    good = {
        "schemaVersion": 1,
        "muni": "Pittsburgh",
        "source": "s",
        "verificationStatus": "draft",
        "districts": ["R1D-L", "LNC"],
        "rules": [
            {"muni": "Pittsburgh", "district": "R1D", "type": "adu", "status": "unknown", "minLotSqft": None, "section": "911.02", "quote": "", "verifiedBy": None, "verifiedAt": None},
            {"muni": "Pittsburgh", "district": "LNC", "type": "adu", "status": "by_right", "minLotSqft": None, "section": "911.02", "quote": "", "verifiedBy": None, "verifiedAt": None},
        ],
    }
    assert validate_zoning_matrix(good) == []
    bad = copy.deepcopy(good)
    bad["verificationStatus"] = "verified"
    assert any("verifiedBy" in p for p in validate_zoning_matrix(bad))
    bad = copy.deepcopy(good)
    bad["districts"].append("GT-A")
    assert any("GT-A" in p for p in validate_zoning_matrix(bad))
    bad = copy.deepcopy(good)
    bad["rules"].append(dict(good["rules"][0]))
    assert any("duplicate" in p for p in validate_zoning_matrix(bad))


def test_build_summaries_member_weights_equal_parcel_counts():
    parcels = pd.DataFrame(
        {
            "pin": list("abcdef"),
            "tract": ["T1", "T1", "T1", "T2", "T2", "T2"],
            "muni": ["Pittsburgh", "Pittsburgh", "Wilkinsburg Borough", "Wilkinsburg Borough", "Wilkinsburg Borough", "Wilkinsburg Borough"],
            "hood": ["Homewood North", "Homewood South", None, None, None, None],
        }
    )
    munis = gpd.GeoDataFrame(
        {"id": ["muni:pittsburgh", "muni:wilkinsburg-borough"], "label": ["Pittsburgh", "Wilkinsburg Borough"]},
        geometry=[box(-80, 40.4, -79.9, 40.5), box(-79.9, 40.4, -79.8, 40.5)],
        crs="EPSG:4326",
    )
    out = build_summaries(munis, "municipality", parcels, "muni", "Pittsburgh", {})
    by_id = {s["id"]: s for s in out}
    assert by_id["muni:pittsburgh"]["members"] == [{"id": "T1", "weight": 2}]
    assert by_id["muni:wilkinsburg-borough"]["members"] == [{"id": "T1", "weight": 1}, {"id": "T2", "weight": 3}]
    # weights per tract across municipalities equal tract parcel counts
    per_tract = {}
    for s in out:
        for m in s["members"]:
            per_tract[m["id"]] = per_tract.get(m["id"], 0) + m["weight"]
    assert per_tract == parcels.groupby("tract").size().to_dict()
    assert by_id["muni:wilkinsburg-borough"]["parcels"] == 4
    assert len(by_id["muni:pittsburgh"]["bbox"]) == 4


def test_mode_and_displacement():
    assert mode_or_none(pd.Series(["a", "b", "b", None])) == "b"
    assert mode_or_none(pd.Series([None, None])) is None
    assert mode_or_none(pd.Series(["b", "a"])) == "a"  # deterministic tie-break
    w = {"renter": 0.4, "burden": 0.3, "income": 0.3}
    assert displacement_index(0.5, 0.5, 40000, 80000, w) == pytest.approx(0.4 * 0.5 + 0.3 * 0.5 + 0.3 * 0.5)
    assert displacement_index(None, 0.5, 40000, 80000, w) is None
    assert displacement_index(1.0, 1.0, 0, 80000, w) == 1.0
