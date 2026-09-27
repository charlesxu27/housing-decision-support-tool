"""PIN normalization, use classification, spatial assignment, hazard intersection."""

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import Point, box

from hdst_pipeline.geography import assign_points, intersects_any, slugify
from hdst_pipeline.parcels import classify_use, normalize_pin


def test_normalize_pin_variants():
    assert normalize_pin("0011E00204000000") == "0011E00204000000"
    assert normalize_pin("0011-E-00204-0000-00") == "0011E00204000000"
    assert normalize_pin(" 0011e00204000000 ") == "0011E00204000000"
    assert normalize_pin("0001G00224140400") == "0001G00224140400"


def test_normalize_pin_rejects_garbage():
    assert normalize_pin(None) is None
    assert normalize_pin(float("nan")) is None
    assert normalize_pin("") is None
    assert normalize_pin("not a pin!") is None
    assert normalize_pin("0011E002040000001") is None  # 17 chars


def test_normalize_pin_pads_short_block_lot():
    # trailing zeros are implied in some exports
    assert normalize_pin("0011E00204") == "0011E00204000000"


def test_classify_use(model_cfg):
    desc = pd.Series(["SINGLE FAMILY", "VACANT LAND", "ROWHOUSE", "TWO FAMILY", "THREE FAMILY", "APART:5-19 UNITS", "OFFICE/APARTMENTS OVER", "CHURCH", "RESIDENTIAL VACANT LAND", None])
    out = classify_use(desc, model_cfg["fit"]["useClasses"])
    assert out.tolist() == ["sf_detached", "vacant", "sf_attached", "two_family", "three_family", "multi_unit", "multi_unit", "other", "vacant", "other"]


def test_assign_points_within_and_outside():
    polys = gpd.GeoDataFrame({"id": ["A", "B"]}, geometry=[box(0, 0, 1, 1), box(1, 0, 2, 1)], crs="EPSG:4326")
    pts = gpd.GeoSeries([Point(0.5, 0.5), Point(1.5, 0.5), Point(5, 5)], crs="EPSG:4326")
    got = assign_points(pts, polys, "id")
    assert got.tolist() == ["A", "B", None]


def test_assign_points_is_deterministic_on_overlap():
    polys = gpd.GeoDataFrame({"id": ["Z", "Y"]}, geometry=[box(0, 0, 1, 1), box(0, 0, 1, 1)], crs="EPSG:4326")
    pts = gpd.GeoSeries([Point(0.5, 0.5)], crs="EPSG:4326")
    assert assign_points(pts, polys, "id").tolist() == ["Z"]  # lowest polygon index wins


def test_intersects_any():
    parcels = gpd.GeoSeries([box(0, 0, 1, 1), box(2, 2, 3, 3), box(10, 10, 11, 11)], crs="EPSG:4326")
    hazard = gpd.GeoSeries([box(0.5, 0.5, 2.5, 2.5)], crs="EPSG:4326")
    assert intersects_any(parcels, hazard).tolist() == [True, True, False]
    assert intersects_any(parcels, gpd.GeoSeries([], crs="EPSG:4326")).tolist() == [False, False, False]


def test_slugify():
    assert slugify("Pittsburgh") == "pittsburgh"
    assert slugify("Mt. Oliver Borough") == "mt-oliver-borough"
    assert slugify("O'Hara Township") == "o-hara-township"
