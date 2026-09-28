"""Hazard layers: FEMA flood zones (SFHA / floodway), Pittsburgh steep slopes, undermined areas."""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import pandas as pd

from .paths import METRIC_CRS, WGS84


def load_flood(path: Path) -> gpd.GeoDataFrame:
    """FEMA S_FLD_HAZ_AR features with ``zone``, ``sfha``, ``floodway`` (EPSG:4326)."""
    gdf = gpd.read_file(path)
    cols = {c.upper(): c for c in gdf.columns}
    for need in ("FLD_ZONE", "SFHA_TF"):
        if need not in cols:
            raise ValueError(f"flood layer missing {need}; have {list(gdf.columns)}")
    gdf["zone"] = gdf[cols["FLD_ZONE"]].astype(str).str.strip()
    gdf["sfha"] = gdf[cols["SFHA_TF"]].astype(str).str.upper().eq("T")
    subty = gdf[cols["ZONE_SUBTY"]] if "ZONE_SUBTY" in cols else pd.Series("", index=gdf.index)
    gdf["floodway"] = subty.fillna("").astype(str).str.upper().str.contains("FLOODWAY")
    gdf["subtype"] = subty.fillna("").astype(str)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
    gdf["geometry"] = gdf.geometry.make_valid()
    return gdf[["zone", "subtype", "sfha", "floodway", "geometry"]].to_crs(WGS84)


def dissolve_flood_for_overlay(flood: gpd.GeoDataFrame, simplify_m: float, include_non_sfha: bool = False) -> gpd.GeoDataFrame:
    """Dissolve by zone/sfha/floodway and simplify (metres); SFHA only unless requested."""
    sel = flood if include_non_sfha else flood[flood["sfha"]]
    sel = sel[["zone", "sfha", "floodway", "geometry"]]
    metric = sel.to_crs(METRIC_CRS)
    dis = metric.dissolve(by=["zone", "sfha", "floodway"], as_index=False)
    dis["geometry"] = dis.geometry.simplify(simplify_m, preserve_topology=True)
    dis = dis[~dis.geometry.is_empty]
    return dis.to_crs(WGS84).sort_values(["zone", "floodway", "sfha"]).reset_index(drop=True)


def overlay_polygons(gdf: gpd.GeoDataFrame, min_part_area_m2: float, simplify_m: float) -> gpd.GeoDataFrame:
    """Browser overlay version of a hazard layer: explode, drop slivers, simplify.

    Raster-derived layers (steep slopes) contain tens of thousands of parts a few
    square metres in size; they dominate file size without adding information at
    map scale. Parcel-level intersection always uses the full-resolution layer.
    """
    m = gdf[["geometry"]].to_crs(METRIC_CRS).explode(index_parts=False)
    m = m[m.geometry.area >= min_part_area_m2]
    m["geometry"] = m.geometry.simplify(simplify_m, preserve_topology=True)
    m = m[~m.geometry.is_empty & m.geometry.notna()]
    return m.to_crs(WGS84).reset_index(drop=True)


def load_polygon_layer(path: Path, simplify_m: float | None = None) -> gpd.GeoDataFrame:
    """Generic polygon overlay (slopes, undermined) as a single-column GeoDataFrame."""
    gdf = gpd.read_file(path)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
    gdf["geometry"] = gdf.geometry.make_valid()
    gdf = gdf[["geometry"]].to_crs(WGS84)
    if simplify_m:
        m = gdf.to_crs(METRIC_CRS)
        m["geometry"] = m.geometry.simplify(simplify_m, preserve_topology=True)
        gdf = m[~m.geometry.is_empty].to_crs(WGS84)
    return gdf.reset_index(drop=True)
