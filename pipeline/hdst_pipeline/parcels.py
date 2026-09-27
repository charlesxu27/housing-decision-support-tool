"""Parcel polygons joined to assessment attributes and rehab-candidate lists.

PII policy: the assessment CSV is read with ``usecols`` so owner names,
mailing/change-notice addresses, and sale records never enter memory.
"""

from __future__ import annotations

import re
import zipfile
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd

from .paths import WGS84

ASSESSMENT_COLS = [
    "PARID",
    "MUNICODE",
    "CLASS",
    "USECODE",
    "USEDESC",
    "LOTAREA",
    "COUNTYBUILDING",
    "FINISHEDLIVINGAREA",
    "YEARBLT",
    "BEDROOMS",
]

# Columns that must never be read; used by the schema test to make sure the
# usecols list stays clean.
FORBIDDEN_COLS = {
    "OWNERDESC",
    "CHANGENOTICEADDRESS1",
    "CHANGENOTICEADDRESS2",
    "CHANGENOTICEADDRESS3",
    "CHANGENOTICEADDRESS4",
    "PROPERTYADDRESS",
    "PROPERTYHOUSENUM",
    "SALEPRICE",
    "SALEDATE",
    "DEEDBOOK",
    "DEEDPAGE",
}

PIN_RE = re.compile(r"^[0-9A-Z]{16}$")


def normalize_pin(value) -> str | None:
    """Canonical 16-character parcel id (strip, upper, drop separators); None when invalid.

    Accepts the 16-char block-lot form used by the parcel shapefile (``PIN``),
    assessments (``PARID``), delinquency/condemned (``parcel_id``) and
    city-owned (``pin``) files, plus the hyphenated ``0011-E-00204-0000-00`` form.
    """
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    s = re.sub(r"[\s\-]", "", str(value)).upper()
    if not s:
        return None
    if len(s) < 16 and s.isalnum():
        s = s.ljust(16, "0")
    return s if PIN_RE.match(s) else None


def load_parcel_polygons(zip_path: Path) -> gpd.GeoDataFrame:
    """Parcel polygons with only ``pin`` + geometry (EPSG:4326). Invalid PINs are dropped."""
    with zipfile.ZipFile(zip_path) as zf:
        shp = [n for n in zf.namelist() if n.lower().endswith(".shp")]
    if not shp:
        raise ValueError(f"no .shp inside {zip_path}")
    uri = f"zip://{zip_path}!{shp[0]}"
    import pyogrio

    info = pyogrio.read_info(uri)
    fields = list(info["fields"])
    pin_field = next((f for f in fields if f.upper() == "PIN"), None)
    if pin_field is None:
        raise ValueError(f"parcel shapefile has no PIN field; fields: {fields}")
    gdf = gpd.read_file(uri, columns=[pin_field])
    gdf = gdf.rename(columns={pin_field: "pin_raw"})
    gdf["pin"] = gdf["pin_raw"].map(normalize_pin)
    bad = gdf["pin"].isna().sum()
    if bad:
        print(f"[parcels] dropping {bad} polygons with invalid PIN")
    gdf = gdf[gdf["pin"].notna()].drop(columns=["pin_raw"])
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    gdf["geometry"] = gdf.geometry.make_valid()
    gdf = gdf.to_crs(WGS84)
    # Several polygons can share a PIN (multi-part lots); dissolve to one row per PIN.
    if gdf["pin"].duplicated().any():
        n = gdf["pin"].duplicated().sum()
        print(f"[parcels] dissolving {n} duplicate-PIN polygons")
        gdf = gdf.dissolve(by="pin", as_index=False)
    return gdf.sort_values("pin").reset_index(drop=True)


def load_assessments(csv_path: Path) -> pd.DataFrame:
    """Assessment attributes needed by the fit rules, keyed by normalized pin."""
    header = pd.read_csv(csv_path, nrows=0).columns.tolist()
    missing = [c for c in ASSESSMENT_COLS if c not in header]
    if missing:
        raise ValueError(f"assessments.csv missing expected columns {missing} (schema drift?)")
    df = pd.read_csv(
        csv_path,
        usecols=ASSESSMENT_COLS,
        dtype={"PARID": str, "MUNICODE": str, "CLASS": str, "USECODE": str, "USEDESC": str},
        low_memory=False,
    )
    df["pin"] = df["PARID"].map(normalize_pin)
    df = df[df["pin"].notna()].drop(columns=["PARID"])
    for c in ("LOTAREA", "COUNTYBUILDING", "FINISHEDLIVINGAREA", "YEARBLT", "BEDROOMS"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.drop_duplicates("pin", keep="first").set_index("pin")
    df.columns = [c.lower() for c in df.columns]
    return df


def classify_use(usedesc: pd.Series, rules: list[dict]) -> pd.Series:
    """Map assessment USEDESC to the contract use class via ordered regex rules."""
    out = pd.Series("other", index=usedesc.index, dtype=object)
    desc = usedesc.fillna("").astype(str).str.upper()
    assigned = pd.Series(False, index=usedesc.index)
    for rule in rules:
        m = desc.str.contains(rule["pattern"], regex=True, case=False, na=False) & ~assigned
        out[m] = rule["use"]
        assigned |= m
    return out


def _pin_set_from_csv(path: Path, candidates: list[str]) -> set[str]:
    header = pd.read_csv(path, nrows=0).columns.tolist()
    col = next((c for c in candidates if c in header), None)
    if col is None:
        raise ValueError(f"{path.name}: none of {candidates} present; have {header}")
    s = pd.read_csv(path, usecols=[col], dtype=str)[col].map(normalize_pin)
    return set(s.dropna())


def load_rehab_flags(delinquency: Path | None, condemned: Path | None, city_owned: Path | None) -> dict[str, set[str]]:
    """PIN sets for each rehab indicator; a missing file yields an empty set."""
    out: dict[str, set[str]] = {}
    out["delinquent"] = _pin_set_from_csv(delinquency, ["parcel_id", "PARCEL_ID", "pin", "PIN"]) if delinquency else set()
    out["condemned"] = _pin_set_from_csv(condemned, ["parcel_id", "PARCEL_ID", "pin", "PIN"]) if condemned else set()
    out["city_owned"] = _pin_set_from_csv(city_owned, ["pin", "PIN", "parcel_id"]) if city_owned else set()
    return out


def join_assessments(parcels: gpd.GeoDataFrame, assessments: pd.DataFrame, cfg_fit: dict) -> gpd.GeoDataFrame:
    """Attach lot area, use class, building flag and commercial flag to parcel polygons.

    Parcels without an assessment row keep NaN lot area and use ``other``;
    the fit rules then evaluate False for them.
    """
    df = parcels.merge(assessments, how="left", left_on="pin", right_index=True)
    df["use"] = classify_use(df["usedesc"], cfg_fit["useClasses"])
    df.loc[df["usedesc"].isna(), "use"] = "other"
    df["lot"] = df["lotarea"]
    df["bldg"] = (df["countybuilding"].fillna(0) > 0).astype(int)
    df["commercial"] = df["class"].isin(cfg_fit["commercialClasses"])
    df["residential"] = df["class"].isin(cfg_fit["residentialClasses"])
    df["finished"] = df["finishedlivingarea"]
    df["has_assessment"] = df["usedesc"].notna()
    return gpd.GeoDataFrame(df, geometry="geometry", crs=parcels.crs)
