"""Boundary layers (tracts, municipalities, neighborhoods) and point-in-polygon assignment."""

from __future__ import annotations

import re
import zipfile
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.strtree import STRtree

from .paths import METRIC_CRS, WGS84


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s or "unnamed"


def load_tracts(zip_path: Path, county_fips: str) -> gpd.GeoDataFrame:
    """TIGER tract polygons for one county: columns id, name, geometry (EPSG:4326)."""
    with zipfile.ZipFile(zip_path) as zf:
        shp = [n for n in zf.namelist() if n.lower().endswith(".shp")]
    if not shp:
        raise ValueError(f"no .shp inside {zip_path}")
    gdf = gpd.read_file(f"zip://{zip_path}!{shp[0]}", columns=["GEOID", "NAME", "COUNTYFP", "STATEFP"])
    required = {"GEOID", "NAME", "COUNTYFP", "STATEFP"}
    if not required.issubset(gdf.columns):
        raise ValueError(f"TIGER tract file missing columns {required - set(gdf.columns)} (schema drift?)")
    gdf = gdf[(gdf["STATEFP"] + gdf["COUNTYFP"]) == county_fips].copy()
    gdf = gdf.rename(columns={"GEOID": "id", "NAME": "tract_name"})[["id", "tract_name", "geometry"]]
    gdf["name"] = "Tract " + gdf["tract_name"].astype(str)
    gdf = gdf.to_crs(WGS84).sort_values("id").reset_index(drop=True)
    if gdf["id"].duplicated().any():
        raise ValueError("duplicate tract GEOIDs in TIGER file")
    return gdf


def load_municipalities(path: Path, city_label: str) -> gpd.GeoDataFrame:
    """County municipal boundaries: id (muni:<slug>), label, name, fips, geometry (EPSG:4326)."""
    gdf = gpd.read_file(path)
    cols = {c.lower(): c for c in gdf.columns}
    for need in ("name", "label"):
        if need not in cols:
            raise ValueError(f"municipal boundaries missing '{need}' field; have {list(gdf.columns)}")
    gdf = gdf.rename(columns={cols["name"]: "name", cols["label"]: "label"})
    if "fips" in cols:
        gdf = gdf.rename(columns={cols["fips"]: "fips"})
    else:
        gdf["fips"] = None
    gdf["label"] = gdf["label"].astype(str).str.strip()
    is_city = gdf["name"].astype(str).str.strip().str.upper().eq("PITTSBURGH")
    gdf.loc[is_city, "label"] = city_label
    if not is_city.any():
        raise ValueError("City of Pittsburgh not found in municipal boundaries")
    gdf = gdf.to_crs(WGS84)
    gdf = gdf.dissolve(by="label", aggfunc={"name": "first", "fips": "first"}, as_index=False)
    gdf["id"] = "muni:" + gdf["label"].map(slugify)
    if gdf["id"].duplicated().any():
        dup = gdf.loc[gdf["id"].duplicated(), "id"].tolist()
        raise ValueError(f"duplicate municipality ids after slugify: {dup}")
    return gdf[["id", "label", "name", "fips", "geometry"]].sort_values("id").reset_index(drop=True)


def load_neighborhoods(path: Path) -> gpd.GeoDataFrame:
    """Pittsburgh neighborhoods: id (hood:<slug>), label, geometry (EPSG:4326)."""
    gdf = gpd.read_file(path)
    cols = {c.lower(): c for c in gdf.columns}
    if "hood" not in cols:
        raise ValueError(f"neighborhoods missing 'hood' field; have {list(gdf.columns)}")
    gdf = gdf.rename(columns={cols["hood"]: "label"})
    gdf["label"] = gdf["label"].astype(str).str.strip()
    gdf = gdf.to_crs(WGS84).dissolve(by="label", as_index=False)
    gdf["id"] = "hood:" + gdf["label"].map(slugify)
    return gdf[["id", "label", "geometry"]].sort_values("id").reset_index(drop=True)


def assign_points(points: gpd.GeoSeries, polygons: gpd.GeoDataFrame, key: str) -> pd.Series:
    """For each point, the ``key`` of the polygon containing it (first match), else None.

    Both inputs must share a CRS. Uses an STRtree for speed.
    """
    if len(polygons) == 0:
        return pd.Series([None] * len(points), index=points.index, dtype=object)
    tree = STRtree(polygons.geometry.values)
    pt_idx, poly_idx = tree.query(points.values, predicate="within")
    out = np.full(len(points), None, dtype=object)
    keys = polygons[key].values
    # keep the first polygon for a point (deterministic: lowest polygon index)
    order = np.lexsort((poly_idx, pt_idx))
    pt_idx, poly_idx = pt_idx[order], poly_idx[order]
    first = np.ones(len(pt_idx), dtype=bool)
    first[1:] = pt_idx[1:] != pt_idx[:-1]
    out[pt_idx[first]] = keys[poly_idx[first]]
    return pd.Series(out, index=points.index, dtype=object)


def intersects_any(geoms: gpd.GeoSeries, hazard: gpd.GeoSeries) -> np.ndarray:
    """Boolean array: does each geometry intersect any hazard geometry?

    The tree is built over ``geoms`` (many small parcels) and queried with the
    hazard polygons, so shapely prepares each (often huge) hazard polygon once
    instead of walking its vertices for every parcel.
    """
    if len(hazard) == 0 or len(geoms) == 0:
        return np.zeros(len(geoms), dtype=bool)
    tree = STRtree(geoms.values)
    _, g_idx = tree.query(hazard.values, predicate="intersects")
    out = np.zeros(len(geoms), dtype=bool)
    out[np.unique(g_idx)] = True
    return out


def to_metric(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    return gdf.to_crs(METRIC_CRS)


def centroid_lonlat(gdf: gpd.GeoDataFrame) -> list[list[float]]:
    """Representative centroid computed in metres, returned as [lon, lat]."""
    c = gdf.geometry.to_crs(METRIC_CRS).centroid.to_crs(WGS84)
    return [[float(p.x), float(p.y)] for p in c]
