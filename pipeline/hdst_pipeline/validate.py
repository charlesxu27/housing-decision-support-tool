"""Validate an exported snapshot against the frozen contract (web/src/data/types.ts).

Every check returns a human-readable problem string; an empty list means the
snapshot is acceptable. Pure functions take parsed JSON so tests can exercise
them on tiny synthetic inputs without touching the filesystem.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from .acs import HOUSEHOLD_KEYS, STOCK_KEYS
from .paths import BANDS, DEFAULT_PATHS, TYPE_IDS, ZONING_STATUSES, Paths

REQUIRED_AREA_KEYS = [
    "id",
    "kind",
    "name",
    "muni",
    "munis",
    "inCity",
    "neighborhood",
    "neighborhoods",
    "centroid",
    "households",
    "stock",
    "moeFlags",
    "need",
    "needScores",
    "fit",
    "allowed",
    "allowedShares",
    "zoningDistricts",
    "risk",
    "carbon",
    "transitTrips800m",
    "parcels",
    "confidence",
]
REQUIRED_SOURCE_KEYS = [
    "id",
    "title",
    "publisher",
    "catalogUrl",
    "resourceUrl",
    "geography",
    "vintage",
    "retrievedAt",
    "sha256",
    "license",
    "fieldsRetained",
    "notes",
    "available",
]
SHARE_TOL = 1e-3


def _is_num(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and not (isinstance(x, float) and (math.isnan(x) or math.isinf(x)))


def _share_ok(x) -> bool:
    return x is None or (_is_num(x) and -SHARE_TOL <= x <= 1 + SHARE_TOL)


def validate_area(a: dict, city_label: str | None = None) -> list[str]:
    p: list[str] = []
    aid = a.get("id", "<no id>")
    for k in REQUIRED_AREA_KEYS:
        if k not in a:
            p.append(f"{aid}: missing key {k}")
    if p:
        return p
    if not (isinstance(aid, str) and len(aid) == 11 and aid.isdigit()):
        p.append(f"{aid}: id is not an 11-digit GEOID")
    if a["kind"] != "tract":
        p.append(f"{aid}: kind != tract")
    if not str(a["name"]).startswith("Tract "):
        p.append(f"{aid}: name must start with 'Tract '")
    if a["muni"] not in a["munis"]:
        p.append(f"{aid}: muni {a['muni']!r} not in munis")
    if city_label is not None and a["inCity"] != (a["muni"] == city_label):
        p.append(f"{aid}: inCity inconsistent with muni")
    if not a["inCity"] and a["neighborhood"] is not None:
        p.append(f"{aid}: neighborhood must be null outside the City")
    c = a["centroid"]
    if not (isinstance(c, list) and len(c) == 2 and -81 < c[0] < -79 and 40 < c[1] < 41):
        p.append(f"{aid}: centroid {c} outside Allegheny County bounds")
    for group, keys in (("households", HOUSEHOLD_KEYS), ("stock", STOCK_KEYS)):
        for k in keys:
            if k not in a[group]:
                p.append(f"{aid}: {group}.{k} missing")
                continue
            v = a[group][k]
            if k in ("total", "total_units"):
                if v is not None and not _is_num(v):
                    p.append(f"{aid}: {group}.{k} not numeric")
            elif not _share_ok(v):
                p.append(f"{aid}: {group}.{k}={v} not a share in 0..1 or null")
    for t in TYPE_IDS:
        if a["need"].get(t) not in BANDS:
            p.append(f"{aid}: need.{t}={a['need'].get(t)!r} invalid band")
        if not _share_ok(a["needScores"].get(t)):
            p.append(f"{aid}: needScores.{t} out of range")
        if (a["need"].get(t) == "uncertain") != (a["needScores"].get(t) is None):
            p.append(f"{aid}: need.{t} uncertain iff needScores.{t} null")
        f = a["fit"].get(t)
        if not isinstance(f, dict) or f.get("band") not in BANDS or not isinstance(f.get("parcels"), int) or f["parcels"] < 0:
            p.append(f"{aid}: fit.{t} malformed")
        elif not (isinstance(f.get("homes"), list) and len(f["homes"]) == 2 and f["homes"][0] <= f["homes"][1]):
            p.append(f"{aid}: fit.{t}.homes malformed")
        elif f["parcels"] == 0 and f["homes"] != [0, 0]:
            p.append(f"{aid}: fit.{t} zero parcels but non-zero homes")
        st = a["allowed"].get(t)
        if st not in ZONING_STATUSES:
            p.append(f"{aid}: allowed.{t}={st!r} invalid status")
        shares = a["allowedShares"].get(t)
        if not isinstance(shares, dict) or not shares:
            p.append(f"{aid}: allowedShares.{t} missing")
        else:
            bad = [k for k in shares if k not in ZONING_STATUSES]
            if bad:
                p.append(f"{aid}: allowedShares.{t} has unknown statuses {bad}")
            if any(not _share_ok(v) for v in shares.values()):
                p.append(f"{aid}: allowedShares.{t} has out-of-range share")
            elif abs(sum(shares.values()) - 1.0) > SHARE_TOL:
                p.append(f"{aid}: allowedShares.{t} sums to {sum(shares.values()):.4f}, not 1")
            elif st in shares and shares[st] < max(shares.values()) - SHARE_TOL:
                p.append(f"{aid}: allowed.{t}={st} is not the dominant share")
        if not a["inCity"] and st != "unknown":
            p.append(f"{aid}: allowed.{t} must be unknown outside the City")
    r = a["risk"]
    for k in ("floodShare", "floodwayShare"):
        if not _is_num(r.get(k)) or not _share_ok(r[k]):
            p.append(f"{aid}: risk.{k} must be a share")
    for k in ("displacement", "slopeShare", "undermined"):
        if not _share_ok(r.get(k)):
            p.append(f"{aid}: risk.{k} must be a share or null")
    if not isinstance(r.get("floodway"), bool):
        p.append(f"{aid}: risk.floodway must be boolean")
    if not a["inCity"] and a["zoningDistricts"]:
        p.append(f"{aid}: zoningDistricts must be empty outside the City")
    if not (_is_num(a["confidence"]) and 0 <= a["confidence"] <= 1):
        p.append(f"{aid}: confidence out of range")
    pc = a["parcels"]
    for k in ("total", "residential", "vacant", "rehabCandidates"):
        if not isinstance(pc.get(k), int) or pc[k] < 0:
            p.append(f"{aid}: parcels.{k} must be a non-negative int")
    if isinstance(pc.get("total"), int):
        for k in ("residential", "vacant", "rehabCandidates"):
            if isinstance(pc.get(k), int) and pc[k] > pc["total"]:
                p.append(f"{aid}: parcels.{k} exceeds parcels.total")
    if not isinstance(a["transitTrips800m"], int) or a["transitTrips800m"] < 0:
        p.append(f"{aid}: transitTrips800m must be a non-negative int")
    return p


def validate_area_metrics(data: dict, city_label: str | None = None) -> list[str]:
    p: list[str] = []
    if data.get("schemaVersion") != 1:
        p.append("area_metrics: schemaVersion != 1")
    areas = data.get("areas") or []
    summaries = data.get("summaries") or []
    if not areas:
        p.append("area_metrics: no areas")
    ids = [a.get("id") for a in areas]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        p.append(f"area_metrics: duplicate area ids {sorted(dup)[:5]}")
    if ids != sorted(ids):
        p.append("area_metrics: areas not sorted by id")
    for a in areas:
        p.extend(validate_area(a, city_label))
    by_id = {a["id"]: a for a in areas if "id" in a}
    sids = [s.get("id") for s in summaries]
    dup = {i for i in sids if sids.count(i) > 1}
    if dup:
        p.append(f"area_metrics: duplicate summary ids {sorted(dup)[:5]}")
    muni_labels = {s["label"] for s in summaries if s.get("kind") == "municipality"}
    hood_labels = {s["label"] for s in summaries if s.get("kind") == "neighborhood"}
    if city_label and city_label not in muni_labels:
        p.append(f"area_metrics: municipality summary {city_label!r} missing")
    muni_weights: dict[str, int] = {}
    hood_weights: dict[str, int] = {}
    for s in summaries:
        sid = s.get("id", "<no id>")
        if s.get("kind") not in ("municipality", "neighborhood"):
            p.append(f"{sid}: bad summary kind")
            continue
        prefix = "muni:" if s["kind"] == "municipality" else "hood:"
        if not str(sid).startswith(prefix):
            p.append(f"{sid}: id must start with {prefix}")
        if not isinstance(s.get("members"), list):
            p.append(f"{sid}: members missing")
            continue
        total = 0
        for m in s["members"]:
            if m.get("id") not in by_id:
                p.append(f"{sid}: member {m.get('id')} is not an area")
            if not isinstance(m.get("weight"), int) or m["weight"] <= 0:
                p.append(f"{sid}: member weight must be a positive int")
            else:
                total += m["weight"]
                bucket = muni_weights if s["kind"] == "municipality" else hood_weights
                bucket[m["id"]] = bucket.get(m["id"], 0) + m["weight"]
        if s.get("parcels") != total:
            p.append(f"{sid}: parcels {s.get('parcels')} != sum of member weights {total}")
        bbox = s.get("bbox")
        if not (isinstance(bbox, list) and len(bbox) == 4 and bbox[0] <= bbox[2] and bbox[1] <= bbox[3]):
            p.append(f"{sid}: bbox malformed")
    for a in areas:
        tot = a.get("parcels", {}).get("total")
        if isinstance(tot, int):
            if muni_weights.get(a["id"], 0) != tot:
                p.append(f"{a['id']}: municipality member weights {muni_weights.get(a['id'], 0)} != parcels.total {tot}")
            if hood_weights.get(a["id"], 0) > tot:
                p.append(f"{a['id']}: neighborhood member weights exceed parcels.total")
        if muni_labels and a.get("muni") not in muni_labels:
            p.append(f"{a['id']}: muni {a.get('muni')!r} has no municipality summary")
        if a.get("neighborhood") is not None and hood_labels and a["neighborhood"] not in hood_labels:
            p.append(f"{a['id']}: neighborhood {a['neighborhood']!r} has no neighborhood summary")
    return p


def validate_zoning_matrix(m: dict) -> list[str]:
    p: list[str] = []
    if m.get("schemaVersion") != 1:
        p.append("zoning_matrix: schemaVersion != 1")
    if m.get("verificationStatus") not in ("draft", "verified"):
        p.append("zoning_matrix: bad verificationStatus")
    rules = m.get("rules") or []
    seen = set()
    all_verified = bool(rules)
    for r in rules:
        key = (r.get("district"), r.get("type"))
        if key in seen:
            p.append(f"zoning_matrix: duplicate rule {key}")
        seen.add(key)
        if r.get("type") not in TYPE_IDS or r.get("status") not in ZONING_STATUSES:
            p.append(f"zoning_matrix: bad rule {key}")
        if not r.get("section"):
            p.append(f"zoning_matrix: rule {key} lacks a section citation")
        if not r.get("verifiedBy"):
            all_verified = False
    if m.get("verificationStatus") == "verified" and not all_verified:
        p.append("zoning_matrix: marked verified but some rules lack verifiedBy")
    for d in m.get("districts") or []:
        if not any(r.get("district") == d or r.get("district") == d.split("-", 1)[0] for r in rules):
            p.append(f"zoning_matrix: district {d} present in GIS has no matrix row (nor family row)")
    return p


def validate_manifest(man: dict, out_dir: Path | None = None) -> list[str]:
    p: list[str] = []
    for k in ("schemaVersion", "builtAt", "modelVersion", "configHash", "coverage", "files", "sources", "nullCoverage", "counts", "parcelTiles"):
        if k not in man:
            p.append(f"manifest: missing {k}")
    if p:
        return p
    if man["schemaVersion"] != 1:
        p.append("manifest: schemaVersion != 1")
    if not man["sources"]:
        p.append("manifest: no sources (provenance missing)")
    for s in man["sources"]:
        for k in REQUIRED_SOURCE_KEYS:
            if k not in s:
                p.append(f"manifest: source {s.get('id')} missing {k}")
        if s.get("available") and not s.get("sha256"):
            p.append(f"manifest: source {s.get('id')} available but has no sha256")
        if s.get("available") and not s.get("retrievedAt"):
            p.append(f"manifest: source {s.get('id')} available but has no retrievedAt")
    for k, v in man["nullCoverage"].items():
        if not _share_ok(v) or v is None:
            p.append(f"manifest: nullCoverage.{k} not a share")
    pt = man["parcelTiles"]
    if pt is not None:
        if pt.get("urlTemplate") != "/data/tiles/parcels/{z}/{x}/{y}.pbf" or pt.get("layer") != "parcels":
            p.append("manifest: parcelTiles descriptor does not match the contract")
        if not (isinstance(pt.get("minZoom"), int) and isinstance(pt.get("maxZoom"), int) and pt["minZoom"] <= pt["maxZoom"]):
            p.append("manifest: parcelTiles zoom range malformed")
    if out_dir is not None:
        from .export import sha256_file

        for rel, f in man["files"].items():
            path = out_dir / rel
            if not path.exists():
                p.append(f"manifest: file {rel} missing on disk")
                continue
            if path.stat().st_size != f.get("bytes"):
                p.append(f"manifest: file {rel} size mismatch")
            if sha256_file(path) != f.get("sha256"):
                p.append(f"manifest: file {rel} sha256 mismatch")
        for required in ("area_metrics.json", "analysis_areas.geojson", "municipalities.geojson", "pittsburgh_neighborhoods.geojson", "zoning_matrix.json"):
            if required not in man["files"]:
                p.append(f"manifest: required file {required} not listed")
        if pt is not None:
            meta = out_dir / "tiles" / "parcels" / "metadata.json"
            if not meta.exists():
                p.append("manifest: parcelTiles set but tiles/parcels/metadata.json missing")
            elif not any((out_dir / "tiles" / "parcels").rglob("*.pbf")):
                p.append("manifest: parcelTiles set but no .pbf tiles found")
    return p


def validate_geojson_file(path: Path, required_props: list[str]) -> list[str]:
    p: list[str] = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return [f"{path.name}: unreadable ({exc})"]
    if data.get("type") != "FeatureCollection":
        p.append(f"{path.name}: not a FeatureCollection")
        return p
    for i, feat in enumerate(data.get("features", [])):
        props = feat.get("properties") or {}
        for k in required_props:
            if k not in props:
                p.append(f"{path.name}: feature {i} missing property {k}")
                break
        if not feat.get("geometry"):
            p.append(f"{path.name}: feature {i} has no geometry")
    return p


def validate_snapshot(paths: Paths = DEFAULT_PATHS, out_dir: Path | None = None, out_override: str | None = None) -> list[str]:
    out_dir = out_dir or (Path(out_override) if out_override else paths.out)
    problems: list[str] = []
    man_path = out_dir / "manifest.json"
    if not man_path.exists():
        return [f"{man_path} missing"]
    man = json.loads(man_path.read_text(encoding="utf-8"))
    problems += validate_manifest(man, out_dir)
    am_path = out_dir / "area_metrics.json"
    if am_path.exists():
        am = json.loads(am_path.read_text(encoding="utf-8"))
        city = None
        try:
            from .paths import load_model_config

            city = load_model_config(paths)["county"]["cityLabel"]
        except Exception:  # noqa: BLE001
            pass
        problems += validate_area_metrics(am, city)
        if man.get("counts", {}).get("tracts") != len(am.get("areas", [])):
            problems.append("manifest.counts.tracts != number of areas")
        if am.get("builtAt") != man.get("builtAt"):
            problems.append("area_metrics.builtAt != manifest.builtAt")
        area_ids = {a["id"] for a in am.get("areas", [])}
        aa = out_dir / "analysis_areas.geojson"
        if aa.exists():
            problems += validate_geojson_file(aa, ["id", "name", "muni", "inCity"])
            feats = json.loads(aa.read_text(encoding="utf-8"))["features"]
            geo_ids = {f["properties"]["id"] for f in feats}
            if geo_ids != area_ids:
                problems.append(f"analysis_areas.geojson ids differ from area_metrics ({len(geo_ids ^ area_ids)} differences)")
        summary_ids = {s["id"] for s in am.get("summaries", [])}
        for name in ("municipalities.geojson", "pittsburgh_neighborhoods.geojson"):
            fp = out_dir / name
            if fp.exists():
                problems += validate_geojson_file(fp, ["id", "kind", "label", "municipality"])
                feats = json.loads(fp.read_text(encoding="utf-8"))["features"]
                missing = {f["properties"]["id"] for f in feats} - summary_ids
                if missing:
                    problems.append(f"{name}: {len(missing)} features without a summary record")
    else:
        problems.append("area_metrics.json missing")
    zm = out_dir / "zoning_matrix.json"
    if zm.exists():
        problems += validate_zoning_matrix(json.loads(zm.read_text(encoding="utf-8")))
    else:
        problems.append("zoning_matrix.json missing")
    for name, props in (
        ("zoning_pittsburgh.geojson", ["district", "label"]),
        ("overlays/flood_zones.geojson", ["zone", "sfha", "floodway"]),
        ("overlays/transit_stops.geojson", ["stopId", "name", "weekdayTrips", "routes"]),
        ("overlays/steep_slopes.geojson", []),
        ("overlays/undermined.geojson", []),
    ):
        fp = out_dir / name
        if fp.exists():
            problems += validate_geojson_file(fp, props)
    return problems
