"""Build orchestration: data/raw -> web/public/data."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd

from . import MODEL_VERSION, SCHEMA_VERSION
from .acs import build_acs_frame, load_tables
from .aggregate import build_area_records, build_summaries, null_coverage
from .allowed import load_matrix, matrix_index, matrix_to_export, parcel_statuses, tract_allowed
from .export import (
    build_parcel_tiles,
    manifest_file_entry,
    simplify_metres,
    write_geojson,
    write_geojson_within_budget,
    write_json,
)
from .fit import parcel_fit_flags, tract_fit
from .geography import assign_points, intersects_any, load_municipalities, load_neighborhoods, load_tracts
from .hazards import dissolve_flood_for_overlay, load_flood, load_polygon_layer, overlay_polygons
from .need import compute_need
from .parcels import join_assessments, load_assessments, load_parcel_polygons, load_rehab_flags
from .paths import DEFAULT_PATHS, TYPE_IDS, WGS84, Paths, config_hash, load_model_config, load_sources, read_fetch_log
from .sources import utcnow
from .transit import stop_weekday_trips, trips_within

GEOJSON_BUDGET = 8 * 1024 * 1024


def log(msg: str) -> None:
    print(f"[build] {msg}", file=sys.stderr, flush=True)


class Timer:
    def __init__(self):
        self.t = time.time()

    def lap(self, label: str) -> None:
        now = time.time()
        log(f"{label} ({now - self.t:.1f}s)")
        self.t = now


def source_records(
    sources: list[dict], fetch_log: dict, availability: dict[str, bool], transit_meta: dict | None = None
) -> list[dict]:
    out = []
    for s in sources:
        rec = fetch_log.get(s["id"], {})
        shas = rec.get("sha256") or []
        if len(shas) == 1:
            sha = shas[0]
        elif shas:
            import hashlib

            sha = hashlib.sha256("".join(shas).encode()).hexdigest()
        else:
            sha = None
        available = bool(rec.get("available")) and availability.get(s["id"], True)
        notes = s.get("notes", "") or ""
        if rec.get("error") and not available:
            notes = (notes + " " if notes else "") + f"Unavailable: {rec['error']}"
        if rec.get("fallbackUsed"):
            notes = (notes + " " if notes else "") + "Fallback URL used."
        vintage = s["vintage"]
        if s["id"] == "gtfs" and rec.get("resourceName"):
            vintage = f"{rec['resourceName']} (resource {rec.get('resourceId')})"
            if transit_meta:
                notes = (notes + " " if notes else "") + (
                    f"Weekday trips counted for the busiest regular weekday ({transit_meta['weekday']}): "
                    f"{transit_meta['trips']:,} trips at {transit_meta['stopsWithService']:,} stops."
                )
        out.append(
            {
                "id": s["id"],
                "title": s["title"],
                "publisher": s["publisher"],
                "catalogUrl": s["catalogUrl"],
                "resourceUrl": (rec.get("urls") or [s["resourceUrl"]])[0],
                "geography": s["geography"],
                "vintage": vintage,
                "retrievedAt": rec.get("retrievedAt", ""),
                "sha256": sha,
                "license": s["license"],
                "fieldsRetained": [str(f) for f in s.get("fieldsRetained", [])],
                "notes": notes,
                "available": available,
            }
        )
    return out


def raw_file(paths: Paths, fetch_log: dict, source_id: str) -> Path | None:
    rec = fetch_log.get(source_id)
    if not rec or not rec.get("available") or not rec.get("files"):
        return None
    p = paths.repo_root / rec["files"][0]
    return p if p.exists() else None


def run_build(paths: Paths = DEFAULT_PATHS, skip_tiles: bool = False, out_override: str | None = None) -> dict:
    cfg = load_model_config(paths)
    sources = load_sources(paths)
    fetch_log = read_fetch_log(paths)
    out_dir = Path(out_override) if out_override else paths.out
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "overlays").mkdir(exist_ok=True)
    paths.processed.mkdir(parents=True, exist_ok=True)
    county_fips = cfg["county"]["fips"]
    city = cfg["county"]["cityLabel"]
    simp = cfg["geography"]["simplifyMetres"]
    dec = int(cfg["geography"]["coordinateDecimals"])
    availability: dict[str, bool] = {}
    timer = Timer()

    # --- boundaries -----------------------------------------------------------
    tracts_zip = raw_file(paths, fetch_log, "tiger_tracts")
    if tracts_zip is None:
        raise SystemExit("tiger_tracts is required; run fetch first")
    tracts = load_tracts(tracts_zip, county_fips)
    tract_ids = tracts["id"].tolist()
    tract_vintage = "TIGER/Line 2024" if "2024" in tracts_zip.name else f"TIGER/Line ({tracts_zip.name})"
    munis = load_municipalities(raw_file(paths, fetch_log, "municipalities"), city)
    hoods = load_neighborhoods(raw_file(paths, fetch_log, "neighborhoods"))
    timer.lap(f"boundaries: {len(tracts)} tracts, {len(munis)} municipalities, {len(hoods)} neighborhoods")

    # --- parcels ----------------------------------------------------------------
    parcels = load_parcel_polygons(raw_file(paths, fetch_log, "parcels"))
    timer.lap(f"parcel polygons: {len(parcels):,}")
    assessments = load_assessments(raw_file(paths, fetch_log, "assessments"))
    timer.lap(f"assessments: {len(assessments):,} rows")
    parcels = join_assessments(parcels, assessments, cfg["fit"])
    log(f"parcels with assessment match: {int(parcels['has_assessment'].sum()):,}")
    del assessments

    rep = parcels.geometry.representative_point()
    parcels["tract"] = assign_points(rep, tracts, "id")
    parcels["muni"] = assign_points(rep, munis, "label")
    parcels["hood"] = assign_points(rep, hoods, "label")
    no_tract = parcels["tract"].isna()
    log(f"parcels outside any tract (dropped): {int(no_tract.sum()):,}")
    parcels = parcels[~no_tract].reset_index(drop=True)
    rep = rep[~no_tract.values].reset_index(drop=True)
    no_muni = parcels["muni"].isna()
    if no_muni.any():
        # parcels straddling a municipal edge: nearest municipality by representative point
        log(f"parcels outside any municipality: {int(no_muni.sum()):,}; assigning nearest")
        near = gpd.sjoin_nearest(
            gpd.GeoDataFrame(geometry=rep[no_muni.values], crs=WGS84).to_crs("EPSG:32617"),
            munis.to_crs("EPSG:32617")[["label", "geometry"]],
            how="left",
        )
        near = near[~near.index.duplicated()]
        parcels.loc[no_muni, "muni"] = near["label"].values
    in_city = parcels["muni"].eq(city)
    parcels.loc[~in_city, "hood"] = None
    timer.lap(f"spatial assignment: {int(in_city.sum()):,} City parcels, {int((~in_city).sum()):,} outside")

    # --- hazards ----------------------------------------------------------------
    flood_path = raw_file(paths, fetch_log, "flood")
    if flood_path is not None:
        flood = load_flood(flood_path)
        parcels["flood"] = intersects_any(parcels.geometry, flood.loc[flood["sfha"], "geometry"]).astype(int)
        parcels["floodway"] = intersects_any(parcels.geometry, flood.loc[flood["floodway"], "geometry"]).astype(int)
        availability["flood"] = True
    else:
        flood = None
        parcels["flood"] = 0
        parcels["floodway"] = 0
        availability["flood"] = False
        log("flood layer unavailable: flood/floodway set to 0 and source marked unavailable")
    timer.lap(f"flood: {int(parcels['flood'].sum()):,} SFHA parcels, {int(parcels['floodway'].sum()):,} floodway parcels")

    slopes_path = raw_file(paths, fetch_log, "slopes")
    parcels["slope"] = -1
    if slopes_path is not None:
        slopes = load_polygon_layer(slopes_path)
        hit = intersects_any(parcels.geometry, slopes.geometry)
        parcels.loc[in_city, "slope"] = hit[in_city.values].astype(int)
        availability["slopes"] = True
    else:
        slopes = None
        availability["slopes"] = False
    timer.lap(f"slopes: {int(parcels['slope'].eq(1).sum()):,} steep City parcels")

    mine_path = raw_file(paths, fetch_log, "undermined")
    parcels["mine"] = -1
    if mine_path is not None:
        undermined = load_polygon_layer(mine_path)
        hit = intersects_any(parcels.geometry, undermined.geometry)
        parcels.loc[in_city, "mine"] = hit[in_city.values].astype(int)
        availability["undermined"] = True
    else:
        undermined = None
        availability["undermined"] = False
    timer.lap(f"undermined: {int(parcels['mine'].eq(1).sum()):,} City parcels")

    # --- transit ----------------------------------------------------------------
    gtfs_path = raw_file(paths, fetch_log, "gtfs")
    if gtfs_path is not None:
        stops, transit_meta = stop_weekday_trips(gtfs_path)
        parcels["trips800"] = trips_within(rep, stops, float(cfg["fit"]["transit"]["radiusMetres"]))
        tract_centroids = gpd.GeoSeries(tracts.geometry.to_crs("EPSG:32617").centroid, crs="EPSG:32617").to_crs(WGS84)
        tract_trips = dict(zip(tract_ids, trips_within(tract_centroids, stops, float(cfg["fit"]["transit"]["radiusMetres"])).tolist()))
        availability["gtfs"] = True
    else:
        stops, transit_meta = None, None
        parcels["trips800"] = 0
        tract_trips = {t: 0 for t in tract_ids}
        availability["gtfs"] = False
    timer.lap(f"transit: {0 if stops is None else len(stops):,} stops with weekday service ({transit_meta['weekday'] if transit_meta else 'n/a'})")

    # --- rehab candidates ---------------------------------------------------
    rehab = load_rehab_flags(
        raw_file(paths, fetch_log, "delinquency"),
        raw_file(paths, fetch_log, "condemned"),
        raw_file(paths, fetch_log, "city_owned"),
    )
    for k in ("delinquency", "condemned", "city_owned"):
        availability[k] = raw_file(paths, fetch_log, k) is not None
    rehab_pins = rehab["delinquent"] | rehab["condemned"] | rehab["city_owned"]
    parcels["rehab"] = parcels["pin"].isin(rehab_pins).astype(int)
    timer.lap(
        f"rehab: {len(rehab['delinquent']):,} delinquent, {len(rehab['condemned']):,} condemned, "
        f"{len(rehab['city_owned']):,} city-owned pins -> {int(parcels['rehab'].sum()):,} matched parcels"
    )

    # --- FIT ------------------------------------------------------------------
    flags = parcel_fit_flags(parcels, cfg["fit"])
    for t in TYPE_IDS:
        parcels[f"f_{t}"] = flags[t].astype(int)
    fit = tract_fit(parcels, flags, cfg["fit"], tract_ids)
    timer.lap("fit: " + ", ".join(f"{t}={int(flags[t].sum()):,}" for t in TYPE_IDS))

    # --- ALLOWED --------------------------------------------------------------
    zoning_path = raw_file(paths, fetch_log, "zoning")
    parcels["zone"] = None
    if zoning_path is not None:
        zoning = gpd.read_file(zoning_path)
        if "zon_new" not in zoning.columns:
            raise ValueError(f"zoning layer missing zon_new; have {list(zoning.columns)}")
        zoning = zoning.rename(columns={"zon_new": "district", "full_zoning_type": "label"})
        zoning["district"] = zoning["district"].astype(str).str.strip().str.upper()
        zoning["label"] = zoning["label"].fillna(zoning["district"]).astype(str).str.strip().str.title()
        zoning = zoning[zoning["district"].ne("") & zoning.geometry.notna()].to_crs(WGS84)
        zoning["geometry"] = zoning.geometry.make_valid()
        zone = assign_points(rep, zoning, "district")
        parcels.loc[in_city, "zone"] = zone[in_city.values].values
        availability["zoning"] = True
    else:
        zoning = None
        availability["zoning"] = False
    matrix_rows = load_matrix(paths.zoning_matrix_csv)
    matrix = matrix_index(matrix_rows)
    statuses = parcel_statuses(parcels, matrix, city)
    allowed, allowed_shares, zoning_districts = tract_allowed(
        parcels, statuses, tract_ids, cfg["allowed"]["residentialCapableUses"], cfg["allowed"]["statusPriority"]
    )
    timer.lap(f"allowed: {int(parcels['zone'].notna().sum()):,} City parcels with a zoning district")

    # --- NEED -----------------------------------------------------------------
    acs_dir = paths.raw_dir("acs5")
    tables = load_tables(acs_dir, county_fips)
    acs, county = build_acs_frame(tables, county_fips, cfg["acs"])
    acs = acs.reindex(tract_ids)
    acs["moe_flags"] = acs["moe_flags"].apply(lambda v: v if isinstance(v, list) else [])
    need = compute_need(acs, cfg["need"]["weights"])
    availability["acs5"] = True
    availability["chas"] = bool(fetch_log.get("chas", {}).get("available"))
    timer.lap(f"need: {len(acs)} tracts with ACS rows; county median income {county.get('median_income')}")

    # --- records ------------------------------------------------------------------
    areas = build_area_records(
        tracts, parcels, flags, acs, need, fit, allowed, allowed_shares, zoning_districts, tract_trips, county, cfg, munis
    )
    tract_muni = {a["id"]: a["muni"] for a in areas}
    summaries = build_summaries(munis, "municipality", parcels, "muni", city, tract_muni) + build_summaries(
        hoods, "neighborhood", parcels, "hood", city, tract_muni
    )
    summaries.sort(key=lambda s: s["id"])
    built_at = utcnow()
    timer.lap(f"records: {len(areas)} areas, {len(summaries)} summaries")

    # --- export ---------------------------------------------------------------------
    files: dict[str, dict] = {}

    write_json(out_dir / "area_metrics.json", {"schemaVersion": SCHEMA_VERSION, "builtAt": built_at, "areas": areas, "summaries": summaries})
    files["area_metrics.json"] = manifest_file_entry(out_dir, "area_metrics.json", len(areas))

    tracts_out = tracts.merge(pd.DataFrame([{"id": a["id"], "muni": a["muni"], "inCity": a["inCity"]} for a in areas]), on="id")
    n = write_geojson(simplify_metres(tracts_out, simp["tracts"]), out_dir / "analysis_areas.geojson", ["id", "name", "muni", "inCity"], dec)
    files["analysis_areas.geojson"] = manifest_file_entry(out_dir, "analysis_areas.geojson", n)

    munis_out = munis.copy()
    munis_out["kind"] = "municipality"
    munis_out["municipality"] = munis_out["label"]
    n = write_geojson(simplify_metres(munis_out, simp["municipalities"]), out_dir / "municipalities.geojson", ["id", "kind", "label", "municipality"], dec)
    files["municipalities.geojson"] = manifest_file_entry(out_dir, "municipalities.geojson", n)

    hoods_out = hoods.copy()
    hoods_out["kind"] = "neighborhood"
    hoods_out["municipality"] = city
    n = write_geojson(simplify_metres(hoods_out, simp["neighborhoods"]), out_dir / "pittsburgh_neighborhoods.geojson", ["id", "kind", "label", "municipality"], dec)
    files["pittsburgh_neighborhoods.geojson"] = manifest_file_entry(out_dir, "pittsburgh_neighborhoods.geojson", n)

    if zoning is not None:
        n, tol = write_geojson_within_budget(zoning[["district", "label", "geometry"]], out_dir / "zoning_pittsburgh.geojson", ["district", "label"], simp["zoning"], GEOJSON_BUDGET, dec)
        files["zoning_pittsburgh.geojson"] = manifest_file_entry(out_dir, "zoning_pittsburgh.geojson", n)
        districts_present = sorted(set(zoning["district"]))
    else:
        districts_present = []
    matrix_export = matrix_to_export(matrix_rows, districts_present, city, "Pittsburgh Zoning Code Title 9, Ch. 911 (draft extraction; see pipeline/zoning/review.md)")
    write_json(out_dir / "zoning_matrix.json", matrix_export)
    files["zoning_matrix.json"] = manifest_file_entry(out_dir, "zoning_matrix.json", len(matrix_export["rules"]))

    if flood is not None:
        overlay = dissolve_flood_for_overlay(flood, simp["flood"], include_non_sfha=True)
        n, tol = write_geojson_within_budget(overlay, out_dir / "overlays" / "flood_zones.geojson", ["zone", "sfha", "floodway"], 0, GEOJSON_BUDGET, dec)
        files["overlays/flood_zones.geojson"] = manifest_file_entry(out_dir, "overlays/flood_zones.geojson", n)
    if stops is not None:
        n = write_geojson(stops, out_dir / "overlays" / "transit_stops.geojson", ["stopId", "name", "weekdayTrips", "routes"], dec)
        files["overlays/transit_stops.geojson"] = manifest_file_entry(out_dir, "overlays/transit_stops.geojson", n)
    min_part = cfg["geography"].get("overlayMinPartAreaM2", {})
    if slopes is not None:
        slopes_overlay = overlay_polygons(slopes, float(min_part.get("slopes", 0)), simp["slopes"])
        n, tol = write_geojson_within_budget(slopes_overlay, out_dir / "overlays" / "steep_slopes.geojson", [], 0, GEOJSON_BUDGET, dec)
        files["overlays/steep_slopes.geojson"] = manifest_file_entry(out_dir, "overlays/steep_slopes.geojson", n)
        log(f"steep slopes overlay: {n:,} parts (>= {min_part.get('slopes', 0)} m2), extra simplification {tol} m")
    if undermined is not None:
        undermined_overlay = overlay_polygons(undermined, float(min_part.get("undermined", 0)), simp["undermined"])
        n, tol = write_geojson_within_budget(undermined_overlay, out_dir / "overlays" / "undermined.geojson", [], 0, GEOJSON_BUDGET, dec)
        files["overlays/undermined.geojson"] = manifest_file_entry(out_dir, "overlays/undermined.geojson", n)
    timer.lap("geojson exports written")

    parcel_tiles = None
    if not skip_tiles:
        info = build_parcel_tiles(parcels, paths.processed, out_dir, cfg["tiles"])
        meta_path = out_dir / "tiles" / "parcels" / "metadata.json"
        if meta_path.exists():
            files["tiles/parcels/metadata.json"] = manifest_file_entry(out_dir, "tiles/parcels/metadata.json", info["tiles"])
        parcel_tiles = {
            "urlTemplate": "/data/tiles/parcels/{z}/{x}/{y}.pbf",
            "layer": "parcels",
            "minZoom": info["minZoom"],
            "maxZoom": info["maxZoom"],
        }
        timer.lap(f"tiles: {info['tiles']:,} tiles, {info['bytes']/1e6:.1f} MB, z{info['minZoom']}-{info['maxZoom']}")

    # processed parcel table for debugging / tests (no PII)
    keep = ["pin", "tract", "muni", "hood", "lot", "use", "zone", "bldg", "flood", "floodway", "slope", "mine", "rehab", "trips800", "commercial", "residential"] + [f"f_{t}" for t in TYPE_IDS]
    parcels[keep].to_parquet(paths.processed / "parcels.parquet", index=False)

    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "builtAt": built_at,
        "modelVersion": MODEL_VERSION,
        "configHash": config_hash(paths),
        "coverage": {
            "county": cfg["county"]["name"],
            "tractVintage": tract_vintage,
            "acsVintage": f"ACS 5-year {cfg['acs']['vintage']}",
            "zoningMunicipalities": [city] if zoning is not None else [],
        },
        "files": dict(sorted(files.items())),
        "sources": source_records(sources, fetch_log, availability, transit_meta),
        "nullCoverage": null_coverage(areas),
        "counts": {
            "tracts": len(areas),
            "municipalities": sum(1 for s in summaries if s["kind"] == "municipality"),
            "neighborhoods": sum(1 for s in summaries if s["kind"] == "neighborhood"),
            "parcels": int(len(parcels)),
        },
        "parcelTiles": parcel_tiles,
    }
    write_json(out_dir / "manifest.json", manifest)
    timer.lap("manifest written")

    from .validate import validate_snapshot

    problems = validate_snapshot(out_dir=out_dir)
    if problems:
        for p in problems:
            log(f"VALIDATION: {p}")
        raise SystemExit(f"build produced an invalid snapshot ({len(problems)} problems)")
    log("validation passed")
    return manifest
