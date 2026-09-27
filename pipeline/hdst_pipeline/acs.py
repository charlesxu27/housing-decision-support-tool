"""ACS 5-year table-based summary file parsing and derived tract measures.

Input: ``acsdt5y2024-<table>.dat`` files (pipe-delimited, ``GEO_ID`` plus
``<TABLE>_E###`` estimate and ``<TABLE>_M###`` margin-of-error columns).

Output: one row per tract with each contract measure as an estimate plus a
90% MOE, and a reliability flag per measure. ``None`` means the source did
not publish a usable estimate. Nothing here substitutes defaults.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import pandas as pd

TABLES = ["B11016", "B11007", "B25003", "B25002", "B25004", "B25014", "B25024", "B25041", "B25070", "B19013", "B25064"]

# Estimates at or below this are Census "jam values" (not available / suppressed).
JAM_THRESHOLD = -222222222
# MOE jam value meaning "estimate is controlled; MOE not applicable" (treat as 0).
MOE_CONTROLLED = -555555555

HOUSEHOLD_KEYS = ["total", "hh_1_2", "hh_5_plus", "senior_alone", "cost_burdened_renters", "overcrowded", "renter_share"]
STOCK_KEYS = [
    "total_units",
    "br_0_1",
    "br_2",
    "br_3_plus",
    "units_1_detached",
    "units_1_attached",
    "units_2_to_4",
    "units_5_to_19",
    "units_20_plus",
    "vacant_share",
    "other_vacant_share",
]


@dataclass
class Est:
    """Estimate with a 90% margin of error. ``value`` None => unusable."""

    value: float | None
    moe: float | None

    @property
    def ok(self) -> bool:
        return self.value is not None and not (isinstance(self.value, float) and math.isnan(self.value))


def _clean_est(v) -> float | None:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if x <= JAM_THRESHOLD:
        return None
    return x


def _clean_moe(v) -> float | None:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if x == MOE_CONTROLLED:
        return 0.0
    if x <= JAM_THRESHOLD:
        return None
    return abs(x)


def read_table(path: Path, geo_prefixes: Iterable[str]) -> pd.DataFrame:
    """Read one ACS .dat file keeping only rows whose GEO_ID starts with any prefix."""
    prefixes = tuple(geo_prefixes)
    chunks = []
    for chunk in pd.read_csv(path, sep="|", dtype=str, chunksize=200_000, na_values=[""], keep_default_na=False):
        mask = chunk["GEO_ID"].str.startswith(prefixes)
        if mask.any():
            chunks.append(chunk[mask])
    if not chunks:
        return pd.DataFrame(columns=["GEO_ID"])
    df = pd.concat(chunks, ignore_index=True)
    for c in df.columns:
        if c != "GEO_ID":
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df.set_index("GEO_ID")


def check_table_schema(df: pd.DataFrame, table: str, expected_lines: int) -> None:
    """Raise when the table layout does not match what the model expects (schema drift)."""
    need = [f"{table}_E{i:03d}" for i in range(1, expected_lines + 1)] + [
        f"{table}_M{i:03d}" for i in range(1, expected_lines + 1)
    ]
    missing = [c for c in need if c not in df.columns]
    if missing:
        raise ValueError(f"ACS table {table} is missing expected columns {missing[:4]}... (schema drift?)")


EXPECTED_LINES = {
    "B11016": 16,
    "B11007": 11,
    "B25003": 3,
    "B25002": 3,
    "B25004": 8,
    "B25014": 13,
    "B25024": 11,
    "B25041": 7,
    "B25070": 11,
    "B19013": 1,
    "B25064": 1,
}


def load_tables(raw_dir: Path, county_fips: str) -> dict[str, pd.DataFrame]:
    prefixes = [f"1400000US{county_fips}", f"0500000US{county_fips}"]
    out = {}
    for t in TABLES:
        p = raw_dir / f"acsdt5y2024-{t.lower()}.dat"
        if not p.exists():
            raise FileNotFoundError(p)
        df = read_table(p, prefixes)
        check_table_schema(df, t, EXPECTED_LINES[t])
        out[t] = df
    return out


class Row:
    """Accessor for one geography across all tables."""

    def __init__(self, tables: dict[str, pd.DataFrame], geo_id: str):
        self.tables = tables
        self.geo_id = geo_id

    def cell(self, var: str) -> Est:
        table = var.split("_")[0]
        df = self.tables[table]
        if self.geo_id not in df.index:
            return Est(None, None)
        row = df.loc[self.geo_id]
        e = _clean_est(row.get(var))
        m = _clean_moe(row.get(var.replace("_E", "_M")))
        return Est(e, m)

    def sum(self, vars_: list[str]) -> Est:
        ests = [self.cell(v) for v in vars_]
        if any(not e.ok for e in ests):
            return Est(None, None)
        value = sum(e.value for e in ests)  # type: ignore[misc]
        if any(e.moe is None for e in ests):
            return Est(value, None)
        moe = math.sqrt(sum(e.moe**2 for e in ests))  # type: ignore[operator]
        return Est(value, moe)


def ratio(num: Est, den: Est) -> Est:
    """Proportion with Census-recommended MOE approximation."""
    if not num.ok or not den.ok or den.value in (None, 0):
        return Est(None, None)
    p = num.value / den.value  # type: ignore[operator]
    if num.moe is None or den.moe is None:
        return Est(p, None)
    inner = num.moe**2 - (p**2) * den.moe**2
    if inner < 0:  # ratio formula when the proportion formula is undefined
        inner = num.moe**2 + (p**2) * den.moe**2
    return Est(p, math.sqrt(inner) / den.value)  # type: ignore[operator]


def cv(est: Est, z: float) -> float | None:
    if not est.ok or est.moe is None:
        return None
    if est.value == 0:
        return math.inf if est.moe > 0 else 0.0
    return (est.moe / z) / abs(est.value)  # type: ignore[operator]


def tract_measures(row: Row) -> dict[str, Est]:
    """All contract measures for one tract as estimates with MOE."""
    m: dict[str, Est] = {}
    hh = row.cell("B11016_E001")
    m["total"] = hh
    m["hh_1_2"] = ratio(row.sum(["B11016_E003", "B11016_E010", "B11016_E011"]), hh)
    m["hh_5_plus"] = ratio(
        row.sum(["B11016_E006", "B11016_E007", "B11016_E008", "B11016_E014", "B11016_E015", "B11016_E016"]), hh
    )
    m["senior_alone"] = ratio(row.cell("B11007_E003"), row.cell("B11007_E001"))
    # Renter households paying >= 30% of income among those with computed burden.
    burden_num = row.sum(["B25070_E007", "B25070_E008", "B25070_E009", "B25070_E010"])
    total_r = row.cell("B25070_E001")
    notc = row.cell("B25070_E011")
    if total_r.ok and notc.ok:
        den = Est(total_r.value - notc.value, None)  # type: ignore[operator]
        if total_r.moe is not None and notc.moe is not None:
            den.moe = math.sqrt(total_r.moe**2 + notc.moe**2)
    else:
        den = Est(None, None)
    m["cost_burdened_renters"] = ratio(burden_num, den)
    m["overcrowded"] = ratio(
        row.sum(["B25014_E005", "B25014_E006", "B25014_E007", "B25014_E011", "B25014_E012", "B25014_E013"]),
        row.cell("B25014_E001"),
    )
    m["renter_share"] = ratio(row.cell("B25003_E003"), row.cell("B25003_E001"))

    units = row.cell("B25002_E001")
    m["total_units"] = units
    br_total = row.cell("B25041_E001")
    m["br_0_1"] = ratio(row.sum(["B25041_E002", "B25041_E003"]), br_total)
    m["br_2"] = ratio(row.cell("B25041_E004"), br_total)
    m["br_3_plus"] = ratio(row.sum(["B25041_E005", "B25041_E006", "B25041_E007"]), br_total)
    st = row.cell("B25024_E001")
    m["units_1_detached"] = ratio(row.cell("B25024_E002"), st)
    m["units_1_attached"] = ratio(row.cell("B25024_E003"), st)
    m["units_2_to_4"] = ratio(row.sum(["B25024_E004", "B25024_E005"]), st)
    m["units_5_to_19"] = ratio(row.sum(["B25024_E006", "B25024_E007"]), st)
    m["units_20_plus"] = ratio(row.sum(["B25024_E008", "B25024_E009"]), st)
    m["vacant_share"] = ratio(row.cell("B25002_E003"), units)
    m["other_vacant_share"] = ratio(row.cell("B25004_E008"), units)
    m["median_income"] = row.cell("B19013_E001")
    m["median_rent"] = row.cell("B25064_E001")
    return m


def flags_for(
    measures: dict[str, Est],
    cv_threshold: float,
    min_households: float,
    z: float,
    min_abs_moe: float = 0.0,
) -> list[str]:
    """Keys whose estimate is unreliable.

    A share is flagged when its coefficient of variation exceeds ``cv_threshold``
    *and* its absolute 90% MOE exceeds ``min_abs_moe`` share points (a 1% +/- 1.2%
    share has a huge CV but is immaterial to gaps measured in share points), or
    when the tract has fewer than ``min_households`` households, or when the MOE
    is not published (reliability cannot be assessed).
    """
    flags = []
    hh = measures.get("total")
    few = hh is not None and hh.ok and hh.value is not None and hh.value < min_households
    for key, est in measures.items():
        if key in ("total", "total_units", "median_income", "median_rent"):
            continue
        if not est.ok:
            continue  # missing is reported as null, not as a flag
        c = cv(est, z)
        if few or c is None:
            flags.append(key)
        elif c > cv_threshold and (est.moe or 0.0) > min_abs_moe:
            flags.append(key)
    return flags


def build_acs_frame(tables: dict[str, pd.DataFrame], county_fips: str, cfg: dict) -> tuple[pd.DataFrame, dict]:
    """Return (tract frame, county row dict).

    Tract frame columns: ``<key>`` (value or None), ``<key>_moe``, plus ``moe_flags`` (list).
    """
    z = float(cfg["zScore"])
    geo_ids = sorted(set().union(*[set(df.index) for df in tables.values()]))
    tract_ids = [g for g in geo_ids if g.startswith("1400000US")]
    records = []
    for g in tract_ids:
        row = Row(tables, g)
        ms = tract_measures(row)
        rec: dict = {"geoid": g.replace("1400000US", "")}
        for k, e in ms.items():
            rec[k] = e.value if e.ok else None
            rec[f"{k}_moe"] = e.moe if e.ok else None
        rec["moe_flags"] = flags_for(
            ms, float(cfg["cvThreshold"]), float(cfg["minHouseholds"]), z, float(cfg.get("minAbsoluteMoe", 0.0))
        )
        records.append(rec)
    frame = pd.DataFrame.from_records(records).set_index("geoid")
    county_row = Row(tables, f"0500000US{county_fips}")
    county = {k: (e.value if e.ok else None) for k, e in tract_measures(county_row).items()}
    return frame, county
