"""Tract income and school-level assessment context.

Median household income comes from ACS B19013 (already fetched for the
displacement index). School context assigns each tract to the unified school
district covering the most of its land (TIGER), then names the elementary,
middle, and high school for that tract.

Inside Pittsburgh School District the school is the feeder-pattern attendance
zone covering the most of the tract (Pittsburgh Public Schools boundaries).
Renamed zones are joined to the current school: University Prep to Milliones,
Westinghouse to Academy at Westinghouse, and the North Side high-school zone
to Perry. Elsewhere the county has no attendance-zone layer, so the tract
gets the nearest regular school of that level in the same district.

Future Ready publishes proficiency at the school. Suppressed cells stay null.
The figure is that school's result, not a district average and not a magnet
or charter assignment.
"""

from __future__ import annotations

import math
import re
from pathlib import Path

import geopandas as gpd
import pandas as pd

from .acs import JAM_THRESHOLD, read_table
from .paths import METRIC_CRS, Paths, WGS84

ASSESSMENT_COLUMNS = [
    "AUN",
    "Schl",
    "PercentProficientorAdvancedonMathematicsAlgebra1_AllStudent",
    "PercentProficientorAdvancedonELALiterature_AllStudent",
]
FACTS_COLUMNS = [
    "AUN",
    "Schl",
    "Name",
    "DistrictName",
    "GradesOffered",
    "Latitude",
    "Longitude",
    "OrganizationTypeCode",
    "Enrollment",
]
SCHOOL_COLUMNS = [
    "name",
    "district_name",
    "district_key",
    "core",
    "levels",
    "latitude",
    "longitude",
    "enrollment",
    "mathProficient",
    "elaProficient",
]
LEVELS = ("elementary", "middle", "high")
SUPPRESSED = {"IS", "NA", "N/A", "*", "", "ND"}
PPS_KEY = "pittsburgh school district"
# Ignore a sliver of a neighboring zone. The zone covering the most land still wins.
MIN_ZONE_SHARE = 0.05
METERS_PER_MILE = 1609.344
# 2012 feeder names that no longer match the Future Ready school name.
BOUNDARY_CORE = {
    "north side": "perry",
    "u prep": "milliones",
    "westinghouse": "academy at westinghouse",
}
_GRADE_SPAN = re.compile(
    r"\b(?:pk|pre[-\s]?k|k)\s*-?\s*\d+\b|\b\d+\s*-\s*\d+\b|\bhs\b",
    re.IGNORECASE,
)
# Grades 3–5 are the elementary grades on the state assessment. K–2 centers
# publish no proficiency percent, so they are not an elementary assignment.
_ELEMENTARY_GRADES = {"3", "4", "5"}
_MIDDLE_GRADES = {"6", "7", "8"}
_HIGH_GRADES = {"9", "10", "11", "12"}


def normalize_district_name(name: str) -> str:
    """Fold punctuation and Mt/St so PDE names match TIGER names."""
    text = str(name).lower().replace("&", " and ")
    text = re.sub(r"\bmt\.?\b", "mount", text)
    text = re.sub(r"\bst\.?\b", "saint", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def school_core(name: str) -> str:
    """School name with the district prefix and grade span removed."""
    text = str(name).lower().replace("&", " and ")
    text = re.sub(r"\bpittsburgh\b", " ", text)
    text = _GRADE_SPAN.sub(" ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def boundary_core(name: str) -> str:
    """Attendance-zone name, after joins for schools PPS has renamed."""
    core = school_core(name)
    return BOUNDARY_CORE.get(core, core)


def school_levels(grades: str) -> list[str]:
    """Grade bands a school serves. K–2 and early-childhood sites are omitted."""
    tokens = {part.strip() for part in str(grades).split(",") if part.strip()}
    found = set()
    if tokens & _ELEMENTARY_GRADES:
        found.add("elementary")
    if tokens & _MIDDLE_GRADES:
        found.add("middle")
    if tokens & _HIGH_GRADES:
        found.add("high")
    return [level for level in LEVELS if level in found]


def _dollars(value) -> int | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number) or number <= JAM_THRESHOLD:
        return None
    return int(round(number))


def _percent(value) -> float | None:
    """Future Ready stores 28.7 for 28.7%. Suppressed cells are null."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if isinstance(value, str):
        token = value.strip().upper()
        if token in SUPPRESSED or token.startswith("SUPPRESS"):
            return None
        try:
            value = float(token)
        except ValueError:
            return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    if math.isnan(number) or not 0 <= number <= 100:
        return None
    return number


def _enrollment(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or number <= 0:
        return None
    return number


def _combined_share(math, ela) -> float | None:
    scores = [score for score in (_share(math), _share(ela)) if score is not None]
    if not scores:
        return None
    return sum(scores) / len(scores)


def district_proficient(records: list[dict]) -> dict[str, float]:
    """Enrollment-weighted mean of each school's math and reading shares, by district."""
    weighted: dict[str, float] = {}
    enrollment: dict[str, float] = {}
    for school in records:
        share = _combined_share(school.get("mathProficient"), school.get("elaProficient"))
        weight = _enrollment(school.get("enrollment"))
        key = school.get("district_key")
        if share is None or weight is None or not key:
            continue
        weighted[key] = weighted.get(key, 0.0) + share * weight
        enrollment[key] = enrollment.get(key, 0.0) + weight
    return {key: round(weighted[key] / total, 4) for key, total in enrollment.items() if total > 0}


def _share(value) -> float | None:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _require_columns(frame: pd.DataFrame, columns: list[str], label: str) -> None:
    missing = [column for column in columns if column not in frame.columns]
    if missing:
        raise ValueError(f"{label} is missing columns {missing} (schema drift?)")


def _in_pennsylvania(latitude: float, longitude: float) -> bool:
    return 39.0 <= latitude <= 42.5 and -80.6 <= longitude <= -74.5


def load_median_income(acs_dir: Path, county_fips: str) -> tuple[dict[str, int | None], int | None]:
    """Return (tract GEOID -> median household income, county median)."""
    frame = read_table(
        acs_dir / "acsdt5y2024-b19013.dat",
        [f"1400000US{county_fips}", f"0500000US{county_fips}"],
    )
    if "B19013_E001" not in frame.columns:
        raise ValueError("ACS B19013 is missing B19013_E001 (schema drift?)")
    incomes: dict[str, int | None] = {}
    for geo_id, value in frame["B19013_E001"].items():
        geo_id = str(geo_id)
        if not geo_id.startswith("1400000US"):
            continue
        incomes[geo_id.replace("1400000US", "")] = _dollars(value)
    county = frame["B19013_E001"].get(f"0500000US{county_fips}") if len(frame) else None
    return incomes, _dollars(county)


def prepare_schools(assessments: pd.DataFrame, facts: pd.DataFrame) -> pd.DataFrame:
    """One row per regular public school, with proficiency shares in 0..1."""
    _require_columns(assessments, ASSESSMENT_COLUMNS, "Future Ready assessments")
    _require_columns(facts, FACTS_COLUMNS, "Future Ready school facts")
    math_col = ASSESSMENT_COLUMNS[2]
    ela_col = ASSESSMENT_COLUMNS[3]
    usable = facts[FACTS_COLUMNS].copy()
    usable = usable[usable["OrganizationTypeCode"].astype(str).str.lower().eq("regular")]
    usable = usable[~usable["Name"].astype(str).str.contains(r"online|cyber", case=False, na=False)]
    usable = usable.drop_duplicates(["AUN", "Schl"])
    merged = assessments[ASSESSMENT_COLUMNS].drop_duplicates(["AUN", "Schl"]).merge(
        usable, on=["AUN", "Schl"], how="inner"
    )
    rows = []
    for _, row in merged.iterrows():
        try:
            latitude = float(row["Latitude"])
            longitude = float(row["Longitude"])
        except (TypeError, ValueError):
            continue
        if math.isnan(latitude) or math.isnan(longitude) or not _in_pennsylvania(latitude, longitude):
            continue
        levels = school_levels(row["GradesOffered"])
        if not levels:
            continue
        name = str(row["Name"]).strip()
        district_name = str(row["DistrictName"]).strip()
        if not name or not district_name:
            continue
        rows.append(
            {
                "name": name,
                "district_name": district_name,
                "district_key": normalize_district_name(district_name),
                "core": school_core(name),
                "levels": levels,
                "latitude": latitude,
                "longitude": longitude,
                "enrollment": _enrollment(row["Enrollment"]),
                "mathProficient": None if _percent(row[math_col]) is None else round(_percent(row[math_col]) / 100.0, 4),
                "elaProficient": None if _percent(row[ela_col]) is None else round(_percent(row[ela_col]) / 100.0, 4),
            }
        )
    table = pd.DataFrame(rows, columns=SCHOOL_COLUMNS)
    return table


def assign_districts(tracts: gpd.GeoDataFrame, districts: gpd.GeoDataFrame) -> dict[str, dict]:
    """Largest-overlap unified district for each tract.

    ``tracts`` needs ``id`` and ``geometry``. ``districts`` needs ``NAME`` and
    ``geometry``. Ties go to the alphabetically first district name.
    """
    if tracts.empty or districts.empty:
        return {}
    _require_columns(districts, ["NAME"], "school district layer")
    tracts_m = tracts[["id", "geometry"]].copy()
    tracts_m["geometry"] = tracts_m.geometry.make_valid()
    tracts_m = tracts_m.to_crs(METRIC_CRS)
    districts_m = districts[["NAME", "geometry"]].copy()
    districts_m["geometry"] = districts_m.geometry.make_valid()
    districts_m = districts_m.to_crs(METRIC_CRS)
    pieces = gpd.overlay(tracts_m, districts_m, how="intersection", keep_geom_type=True)
    if pieces.empty:
        return {}
    pieces = pieces[pieces.geometry.geom_type.isin(["Polygon", "MultiPolygon"])].copy()
    if pieces.empty:
        return {}
    pieces["iarea"] = pieces.geometry.area
    winners = (
        pieces.sort_values(["id", "iarea", "NAME"], ascending=[True, False, True])
        .groupby("id", as_index=False)
        .head(1)
    )
    tract_area = tracts_m.set_index("id").geometry.area
    assigned = {}
    for _, row in winners.iterrows():
        area = float(tract_area.get(row["id"], 0.0))
        share = None if area <= 0 else round(min(1.0, float(row["iarea"]) / area), 4)
        assigned[str(row["id"])] = {
            "schoolDistrict": str(row["NAME"]),
            "schoolDistrictShare": share,
            "schools": [],
        }
    return assigned


def _school_records(schools: pd.DataFrame) -> list[dict]:
    if schools is None or schools.empty:
        return []
    _require_columns(schools, SCHOOL_COLUMNS, "school table")
    points = gpd.GeoDataFrame(
        schools,
        geometry=gpd.points_from_xy(schools["longitude"], schools["latitude"]),
        crs=WGS84,
    ).to_crs(METRIC_CRS)
    records = []
    for (_, row), point in zip(schools.iterrows(), points.geometry, strict=True):
        levels = list(row["levels"])
        records.append(
            {
                "name": str(row["name"]),
                "district_key": str(row["district_key"]),
                "core": str(row["core"]),
                "levels": levels,
                "x": float(point.x),
                "y": float(point.y),
                "enrollment": _enrollment(row["enrollment"]),
                "mathProficient": _share(row["mathProficient"]),
                "elaProficient": _share(row["elaProficient"]),
            }
        )
    return records


def _match_school(records: list[dict], district_key: str, core: str, level: str) -> dict | None:
    hits = [
        school
        for school in records
        if school["district_key"] == district_key and school["core"] == core and level in school["levels"]
    ]
    if len(hits) == 1:
        return hits[0]
    only_this_level = [school for school in hits if school["levels"] == [level]]
    if len(only_this_level) == 1:
        return only_this_level[0]
    return None


def _nearest_school(
    records: list[dict],
    district_key: str,
    level: str,
    x: float,
    y: float,
    cores: set[str] | None,
) -> tuple[dict, float] | None:
    best: tuple[dict, float] | None = None
    for school in records:
        if school["district_key"] != district_key or level not in school["levels"]:
            continue
        if cores is not None and school["core"] not in cores:
            continue
        meters = math.hypot(school["x"] - x, school["y"] - y)
        if best is None or meters < best[1] - 0.5 or (abs(meters - best[1]) <= 0.5 and school["name"] < best[0]["name"]):
            best = (school, meters)
    return best


def _zone_winners(tracts_m: gpd.GeoDataFrame, zones: gpd.GeoDataFrame) -> dict[str, dict]:
    """Largest attendance zone per tract, ignoring overlaps under MIN_ZONE_SHARE."""
    layer = zones[["SchoolName", "geometry"]].copy()
    layer["geometry"] = layer.geometry.make_valid()
    layer["core"] = layer["SchoolName"].map(boundary_core)
    layer = layer.to_crs(METRIC_CRS)
    pieces = gpd.overlay(tracts_m[["id", "geometry"]], layer, how="intersection", keep_geom_type=True)
    if pieces.empty:
        return {}
    pieces = pieces[pieces.geometry.geom_type.isin(["Polygon", "MultiPolygon"])].copy()
    if pieces.empty:
        return {}
    pieces["iarea"] = pieces.geometry.area
    winners = (
        pieces.sort_values(["id", "iarea", "SchoolName"], ascending=[True, False, True])
        .groupby("id", as_index=False)
        .head(1)
    )
    tract_area = tracts_m.set_index("id").geometry.area
    chosen = {}
    for _, row in winners.iterrows():
        area = float(tract_area.get(row["id"], 0.0))
        if area <= 0:
            continue
        share = round(min(1.0, float(row["iarea"]) / area), 4)
        if share < MIN_ZONE_SHARE:
            continue
        chosen[str(row["id"])] = {
            "name": str(row["SchoolName"]),
            "core": str(row["core"]),
            "coverage": share,
        }
    return chosen


def _entry(level: str, name: str, math, ela, basis: str, coverage, distance) -> dict:
    return {
        "level": level,
        "name": name,
        "mathProficient": _share(math),
        "elaProficient": _share(ela),
        "basis": basis,
        "coverage": coverage,
        "distanceMiles": distance,
    }


def assign_schools(
    tracts: gpd.GeoDataFrame,
    districts: gpd.GeoDataFrame,
    schools: pd.DataFrame,
    zones: dict[str, gpd.GeoDataFrame] | None = None,
) -> dict[str, dict]:
    """District plus one elementary, middle, and high school for each tract."""
    assigned = assign_districts(tracts, districts)
    if not assigned:
        return {}
    zones = zones or {}
    records = _school_records(schools)
    district_scores = district_proficient(records)
    tracts_m = tracts[["id", "geometry"]].copy()
    tracts_m["geometry"] = tracts_m.geometry.make_valid()
    tracts_m = tracts_m.to_crs(METRIC_CRS)
    centroids = tracts_m.geometry.centroid
    location = {str(tid): (float(x), float(y)) for tid, x, y in zip(tracts_m["id"], centroids.x, centroids.y, strict=True)}
    winners = {}
    feeder_cores: dict[str, set[str]] = {}
    for level in LEVELS:
        layer = zones.get(level)
        if layer is None or layer.empty or "SchoolName" not in layer.columns:
            continue
        winners[level] = _zone_winners(tracts_m, layer)
        feeder_cores[level] = {str(core) for core in layer["SchoolName"].map(boundary_core)}
    for tract_id, row in assigned.items():
        district_key = normalize_district_name(row["schoolDistrict"])
        point = location.get(tract_id)
        chosen = []
        for level in LEVELS:
            zone = winners.get(level, {}).get(tract_id) if district_key == PPS_KEY else None
            if zone is not None:
                school = _match_school(records, district_key, zone["core"], level)
                if school is None:
                    chosen.append(_entry(level, zone["name"], None, None, "attendance_zone", zone["coverage"], None))
                else:
                    chosen.append(
                        _entry(
                            level,
                            school["name"],
                            school["mathProficient"],
                            school["elaProficient"],
                            "attendance_zone",
                            zone["coverage"],
                            None,
                        )
                    )
                continue
            if point is None:
                continue
            cores = feeder_cores.get(level) if district_key == PPS_KEY and level in feeder_cores else None
            nearest = _nearest_school(records, district_key, level, point[0], point[1], cores)
            if nearest is None:
                continue
            school, meters = nearest
            chosen.append(
                _entry(
                    level,
                    school["name"],
                    school["mathProficient"],
                    school["elaProficient"],
                    "nearest_in_district",
                    None,
                    round(meters / METERS_PER_MILE, 2),
                )
            )
        row["schools"] = chosen
        row["districtProficient"] = district_scores.get(district_key)
    return assigned


def _source_files(paths: Paths, fetch_log: dict, source_id: str) -> list[Path]:
    record = fetch_log.get(source_id) or {}
    if not record.get("available"):
        return []
    files = [paths.repo_root / relative for relative in record.get("files") or []]
    if not files or any(not path.exists() for path in files):
        return []
    return files


def _read_zones(path: Path) -> gpd.GeoDataFrame:
    zones = gpd.read_file(path)
    if "SchoolName" not in zones.columns:
        raise ValueError(f"{path.name} is missing SchoolName (schema drift?)")
    zones = zones[["SchoolName", "geometry"]].copy()
    zones["geometry"] = zones.geometry.make_valid()
    return zones[zones.geometry.notna() & ~zones.geometry.is_empty]


def load_school_assignments(
    tracts: gpd.GeoDataFrame,
    paths: Paths,
    fetch_log: dict,
) -> tuple[dict[str, dict], dict[str, bool]]:
    """Assign districts and schools when the sources were fetched. Missing files yield nulls."""
    district_files = _source_files(paths, fetch_log, "school_districts")
    ready_files = _source_files(paths, fetch_log, "future_ready")
    attendance_files = _source_files(paths, fetch_log, "pps_attendance")
    status = {
        "school_districts": bool(district_files),
        "future_ready": bool(ready_files),
        "pps_attendance": bool(attendance_files),
    }
    if not district_files:
        return {}, status
    districts = gpd.read_file(district_files[0])
    assessments = next((path for path in ready_files if path.name.startswith("future_ready")), None)
    facts = next((path for path in ready_files if "fast_facts" in path.name), None)
    if assessments is None or facts is None:
        status["future_ready"] = False
        schools = pd.DataFrame(columns=SCHOOL_COLUMNS)
    else:
        schools = prepare_schools(
            pd.read_excel(assessments, sheet_name="State Assessment Measures"),
            pd.read_excel(facts),
        )
    zone_paths = {
        "elementary": next((path for path in attendance_files if path.name.startswith("elementary")), None),
        "middle": next((path for path in attendance_files if path.name.startswith("middle")), None),
        "high": next((path for path in attendance_files if path.name.startswith("high")), None),
    }
    if any(path is None for path in zone_paths.values()):
        status["pps_attendance"] = False
        zones = {}
    else:
        zones = {level: _read_zones(path) for level, path in zone_paths.items()}
    return assign_schools(tracts, districts, schools, zones), status


def opportunity_record(income, county_income, school: dict | None = None) -> dict:
    """AreaRecord.opportunity. School fields stay empty when the tract was not assigned.

    ``mathProficient`` and ``elaProficient`` mirror the elementary school so
    coverage stats have one number. The sidebar reads ``schools``.
    """
    school = school or {}
    schools = list(school.get("schools") or [])
    elementary = next((item for item in schools if item.get("level") == "elementary"), None)
    return {
        "medianHouseholdIncome": _dollars(income),
        "countyMedianHouseholdIncome": _dollars(county_income),
        "schoolDistrict": school.get("schoolDistrict"),
        "schoolDistrictShare": school.get("schoolDistrictShare"),
        "districtProficient": _share(school.get("districtProficient")),
        "mathProficient": None if elementary is None else elementary.get("mathProficient"),
        "elaProficient": None if elementary is None else elementary.get("elaProficient"),
        "schools": schools,
    }
