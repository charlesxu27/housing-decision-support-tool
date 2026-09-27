"""Write the static snapshot: JSON, GeoJSON, parcel vector tiles, manifest."""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely

from .paths import METRIC_CRS, WGS84

TILE_PROPERTY_KEYS = [
    "pin",
    "tract",
    "muni",
    "hood",
    "lot",
    "use",
    "zone",
    "bldg",
    "flood",
    "floodway",
    "slope",
    "mine",
    "rehab",
    "f_adu",
    "f_duplex_triplex",
    "f_townhome",
    "f_small_apartment",
    "f_large_apartment",
    "f_senior_accessible",
    "f_rehab_reuse",
    "f_detached_sf",
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    tmp.replace(path)


def _round_geom(geom, decimals: int):
    return shapely.transform(geom, lambda c: np.round(c, decimals))


def simplify_metres(gdf: gpd.GeoDataFrame, tolerance_m: float) -> gpd.GeoDataFrame:
    if tolerance_m <= 0:
        return gdf
    m = gdf.to_crs(METRIC_CRS)
    m["geometry"] = m.geometry.simplify(tolerance_m, preserve_topology=True)
    m = m[~m.geometry.is_empty & m.geometry.notna()]
    return m.to_crs(WGS84)


def write_geojson(gdf: gpd.GeoDataFrame, path: Path, properties: list[str], decimals: int = 6) -> int:
    """Write a FeatureCollection with only the listed properties; returns feature count."""
    path.parent.mkdir(parents=True, exist_ok=True)
    gdf = gdf.to_crs(WGS84) if gdf.crs is not None and gdf.crs.to_epsg() != 4326 else gdf
    tmp = path.with_suffix(path.suffix + ".tmp")
    n = 0
    with tmp.open("w", encoding="utf-8") as fh:
        fh.write('{"type":"FeatureCollection","features":[')
        first = True
        for row in gdf.itertuples(index=False):
            geom = getattr(row, "geometry")
            if geom is None or geom.is_empty:
                continue
            props = {}
            for k in properties:
                v = getattr(row, k)
                if isinstance(v, (np.integer,)):
                    v = int(v)
                elif isinstance(v, (np.floating,)):
                    v = None if np.isnan(v) else float(v)
                elif isinstance(v, np.bool_):
                    v = bool(v)
                elif isinstance(v, float) and np.isnan(v):
                    v = None
                elif isinstance(v, np.ndarray):
                    v = v.tolist()
                props[k] = v
            gj = shapely.to_geojson(_round_geom(geom, decimals))
            if not first:
                fh.write(",")
            first = False
            fh.write('{"type":"Feature","geometry":')
            fh.write(gj)
            fh.write(',"properties":')
            fh.write(json.dumps(props, ensure_ascii=False, separators=(",", ":"), allow_nan=False))
            fh.write("}")
            n += 1
        fh.write("]}")
    tmp.replace(path)
    return n


def write_geojson_within_budget(
    gdf: gpd.GeoDataFrame, path: Path, properties: list[str], start_tolerance_m: float, budget_bytes: int, decimals: int = 6
) -> tuple[int, float]:
    """Simplify progressively (doubling tolerance) until the file fits the byte budget."""
    tol = start_tolerance_m
    for _ in range(6):
        out = simplify_metres(gdf, tol)
        n = write_geojson(out, path, properties, decimals)
        if path.stat().st_size <= budget_bytes:
            return n, tol
        tol *= 2
    return n, tol


def write_tile_source(parcels: gpd.GeoDataFrame, path: Path) -> int:
    """Newline-delimited GeoJSON (EPSG:4326) with exactly the ParcelTileProperties keys."""
    import pyogrio

    cols = TILE_PROPERTY_KEYS
    missing = [c for c in cols if c not in parcels.columns]
    if missing:
        raise ValueError(f"tile source missing columns {missing}")
    out = parcels[cols + ["geometry"]].to_crs(WGS84)
    int_cols = ["bldg", "flood", "floodway", "slope", "mine", "rehab", *[c for c in cols if c.startswith("f_")]]
    geoms = shapely.to_geojson(shapely.transform(out.geometry.values, lambda c: np.round(c, 7)))
    lots = out["lot"].to_numpy(dtype="float64")
    ints = {c: out[c].to_numpy(dtype="int64") for c in int_cols}
    strs = {c: out[c].astype(object).where(out[c].notna(), None).tolist() for c in ("pin", "tract", "muni", "hood", "use", "zone")}
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    dumps = json.dumps
    with tmp.open("w", encoding="utf-8") as fh:
        for i in range(len(out)):
            props = {
                "pin": strs["pin"][i],
                "tract": strs["tract"][i],
                "muni": strs["muni"][i],
                "hood": strs["hood"][i],
                "lot": None if np.isnan(lots[i]) else int(round(lots[i])),
                "use": strs["use"][i],
                "zone": strs["zone"][i],
            }
            for c in int_cols:
                props[c] = int(ints[c][i])
            fh.write('{"type":"Feature","geometry":')
            fh.write(geoms[i])
            fh.write(',"properties":')
            fh.write(dumps(props, separators=(",", ":"), ensure_ascii=False))
            fh.write("}\n")
    tmp.replace(path)
    return int(len(out))


def dir_size(path: Path) -> int:
    return sum(p.stat().st_size for p in path.rglob("*") if p.is_file())


def run_tippecanoe(source: Path, out_dir: Path, min_zoom: int, max_zoom: int, layer: str = "parcels") -> None:
    exe = shutil.which("tippecanoe")
    if exe is None:
        raise RuntimeError("tippecanoe not found on PATH")
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        exe,
        "-e",
        str(out_dir),
        "--no-tile-compression",
        "-l",
        layer,
        f"-Z{min_zoom}",
        f"-z{max_zoom}",
        "--drop-densest-as-needed",
        "--extend-zooms-if-still-dropping",
        "--force",
        "--quiet",
        str(source),
    ]
    print("[export] " + " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


def build_parcel_tiles(parcels: gpd.GeoDataFrame, processed_dir: Path, out_data_dir: Path, tiles_cfg: dict) -> dict:
    source = processed_dir / "parcels_tiles.geojsonl"
    n = write_tile_source(parcels, source)
    tiles_dir = out_data_dir / "tiles" / "parcels"
    min_zoom, max_zoom = int(tiles_cfg["minZoom"]), int(tiles_cfg["maxZoom"])
    run_tippecanoe(source, tiles_dir, min_zoom, max_zoom)
    size = dir_size(tiles_dir)
    limit = int(tiles_cfg["maxDirectoryMB"]) * 1024 * 1024
    if size > limit:
        print(f"[export] tile directory {size/1e6:.0f} MB exceeds budget; rebuilding from z{tiles_cfg['fallbackMinZoom']}")
        min_zoom = int(tiles_cfg["fallbackMinZoom"])
        run_tippecanoe(source, tiles_dir, min_zoom, max_zoom)
        size = dir_size(tiles_dir)
    tile_count = sum(1 for p in tiles_dir.rglob("*.pbf"))
    return {"minZoom": min_zoom, "maxZoom": max_zoom, "bytes": size, "tiles": tile_count, "features": n}


def manifest_file_entry(out_dir: Path, rel: str, rows: int | None) -> dict:
    p = out_dir / rel
    return {"path": rel, "bytes": p.stat().st_size, "sha256": sha256_file(p), "rows": rows}
