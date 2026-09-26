from __future__ import annotations

import asyncio
from typing import Any

import httpx

from .clients import (
    SLOPE,
    UNDERMINED,
    fetch_assessment,
    fetch_census_acs,
    fetch_city_owned,
    fetch_flood,
    fetch_hazard_flag,
    fetch_parcel,
    fetch_transit,
    fetch_zoning,
)
from .zoning_table import eligibility_for_district

PITTSBURGH_MUNICODES = set(range(101, 133))


def _in_city(municode: Any) -> bool:
    try:
        return int(municode) in PITTSBURGH_MUNICODES
    except (TypeError, ValueError):
        return False


def _address(assessment: dict[str, Any] | None) -> str | None:
    if not assessment:
        return None
    num = str(assessment.get("PROPERTYHOUSENUM") or "").strip()
    frac = str(assessment.get("PROPERTYFRACTION") or "").strip()
    street = str(assessment.get("PROPERTYADDRESS") or "").strip()
    city = str(assessment.get("PROPERTYCITY") or "").strip().title()
    zipc = str(assessment.get("PROPERTYZIP") or "").strip()
    unit = str(assessment.get("PROPERTYUNIT") or "").strip()
    line = " ".join(p for p in [num, frac, street] if p and p != "0")
    if unit:
        line = f"{line} {unit}"
    if city:
        line = f"{line}, {city}"
    if zipc:
        line = f"{line} {zipc}"
    return line or None


def _lot_sqft(parcel: dict[str, Any], assessment: dict[str, Any] | None) -> float | None:
    acres = parcel.get("calc_acreage")
    try:
        if acres and float(acres) > 0:
            return round(float(acres) * 43560)
    except (TypeError, ValueError):
        pass
    if assessment and assessment.get("LOTAREA"):
        try:
            return float(assessment["LOTAREA"])
        except (TypeError, ValueError):
            return None
    return None


async def assemble_feature_card(lat: float, lon: float) -> dict[str, Any]:
    timeout = httpx.Timeout(18.0, connect=8.0)
    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=True,
        headers={"User-Agent": "pgh-housing-advisor/0.1 (housing hackathon)"},
    ) as client:
        parcel = await fetch_parcel(client, lon, lat)
        if not parcel:
            return {
                "ok": False,
                "error": "No parcel found at that location. Zoom in and click inside a city lot.",
                "lat": lat,
                "lon": lon,
            }

        pin = parcel["pin"]

        async def _safe(coro, fallback):
            try:
                return await coro
            except Exception:
                return fallback

        assessment, zoning, slope, mines, flood, acs, transit, city_owned = await asyncio.gather(
            _safe(fetch_assessment(client, pin), None),
            _safe(fetch_zoning(client, lon, lat), None),
            _safe(fetch_hazard_flag(client, SLOPE, lon, lat), False),
            _safe(fetch_hazard_flag(client, UNDERMINED, lon, lat), False),
            _safe(fetch_flood(client, lon, lat), None),
            _safe(fetch_census_acs(client, lon, lat), None),
            _safe(fetch_transit(client, lon, lat), {"stops_400m": None, "stops_800m": None, "nearest_m": None}),
            _safe(fetch_city_owned(client, pin), False),
        )

    in_city = _in_city(parcel.get("municode"))
    zon_new = (zoning or {}).get("zon_new") if zoning else None
    lot_sqft = _lot_sqft(parcel, assessment)
    use_desc = (assessment or {}).get("USEDESC")
    class_code = (assessment or {}).get("CLASS")
    vacantish = False
    if assessment:
        housenum = str(assessment.get("PROPERTYHOUSENUM") or "").strip()
        vacantish = housenum in {"", "0"} or "VACANT" in str(use_desc or "").upper()

    card = {
        "ok": True,
        "lat": lat,
        "lon": lon,
        "in_city": in_city,
        "parcel": {
            "pin": pin,
            "mapblocklo": parcel.get("mapblocklo"),
            "municode": parcel.get("municode"),
            "acreage": parcel.get("calc_acreage"),
            "lot_sqft": lot_sqft,
            "geometry": parcel.get("geometry"),
        },
        "address": _address(assessment),
        "assessment": None
        if not assessment
        else {
            "use": use_desc,
            "class": class_code,
            "neighborhood": assessment.get("NEIGHDESC"),
            "year_built": assessment.get("YEARBLT"),
            "stories": assessment.get("STORIES"),
            "living_area": assessment.get("FINISHEDLIVINGAREA") or assessment.get("HALFAREA"),
            "fair_market_total": assessment.get("FAIRMARKETTOTAL"),
            "saleprice": assessment.get("SALEPRICE"),
            "saledate": assessment.get("SALEDATE"),
            "tax_desc": assessment.get("TAXDESC"),
            "zip": str(assessment.get("PROPERTYZIP") or "").strip(),
        },
        "zoning": None
        if not zoning
        else {
            "code": zon_new,
            "name": zoning.get("full_zoning_type") or zoning.get("legendtype"),
            "ordinance_url": zoning.get("municode"),
        },
        "eligibility": eligibility_for_district(zon_new),
        "hazards": {
            "steep_slope_25pct": bool(slope),
            "undermined": bool(mines),
            "flood": flood,
        },
        "transit": transit,
        "acs": acs,
        "flags": {
            "city_owned": bool(city_owned),
            "likely_vacant_or_no_structure": vacantish,
            "outside_pittsburgh": not in_city,
        },
        "sources": [
            {
                "name": "Allegheny County parcel boundaries (PASDA)",
                "url": "https://www.pasda.psu.edu/uci/DataSummary.aspx?dataset=1214",
            },
            {
                "name": "Allegheny County property assessments (WPRDC)",
                "url": "https://data.wprdc.org/dataset/property-assessments",
            },
            {
                "name": "Pittsburgh zoning districts (WPRDC / City GIS)",
                "url": "https://data.wprdc.org/dataset/zoning",
            },
            {
                "name": "Pittsburgh Zoning Code",
                "url": "https://pittsburghpa.gov/dcp/zoning-code",
            },
            {
                "name": "25% or greater slope (WPRDC)",
                "url": "https://data.wprdc.org/dataset/25-or-greater-slope",
            },
            {
                "name": "Undermined areas (WPRDC)",
                "url": "https://data.wprdc.org/dataset/undermined-areas",
            },
            {
                "name": "FEMA National Flood Hazard Layer",
                "url": "https://www.fema.gov/flood-maps/national-flood-hazard-layer",
            },
            {
                "name": "ACS via Census Reporter (Census Bureau 5-year)",
                "url": "https://censusreporter.org/",
            },
            {
                "name": "OpenStreetMap transit stops",
                "url": "https://www.openstreetmap.org/",
            },
        ],
    }
    return card
