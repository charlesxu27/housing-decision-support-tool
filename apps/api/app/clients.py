from __future__ import annotations

import json
import math
from typing import Any

import httpx

PASDA_PARCELS = (
    "https://mapservices.pasda.psu.edu/server/rest/services/pasda/"
    "AlleghenyCounty/MapServer/25/query"
)
ZONING = (
    "https://services1.arcgis.com/YZCmUqbcsUpOKfj7/arcgis/rest/services/"
    "PGHWebZoning/FeatureServer/0/query"
)
SLOPE = (
    "https://services1.arcgis.com/YZCmUqbcsUpOKfj7/arcgis/rest/services/"
    "PGHWebSlope25/FeatureServer/0/query"
)
UNDERMINED = (
    "https://services1.arcgis.com/YZCmUqbcsUpOKfj7/arcgis/rest/services/"
    "PGHWebUndermined/FeatureServer/0/query"
)
FEMA_NFHL = (
    "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query"
)
WPRDC_SEARCH = "https://data.wprdc.org/api/3/action/datastore_search"
ASSESSMENTS_RESOURCE = "65855e14-549e-4992-b5be-d629afc676fa"
CITY_OWNED_RESOURCE = "e1dcee82-9179-4306-8167-5891915b62a7"
CENSUS_GEOCODER = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates"
CENSUS_REPORTER = "https://api.censusreporter.org/1.0/data/show/latest"
OVERPASS = "https://overpass-api.de/api/interpreter"

# ~20m envelope in degrees at Pittsburgh latitude
_DEG = 0.00018


def _envelope(lon: float, lat: float, pad: float = _DEG) -> str:
    import json

    return json.dumps(
        {
            "xmin": lon - pad,
            "ymin": lat - pad,
            "xmax": lon + pad,
            "ymax": lat + pad,
            "spatialReference": {"wkid": 4326},
        }
    )


def esri_polygon_to_geojson(geometry: dict[str, Any] | None) -> dict[str, Any] | None:
    if not geometry:
        return None
    rings = geometry.get("rings")
    if not rings:
        return None
    return {"type": "Polygon", "coordinates": rings}


def _area_approx(geom: dict[str, Any] | None) -> float:
    if not geom:
        return 0.0
    rings = geom.get("rings") or []
    if not rings:
        return 0.0
    ring = rings[0]
    area = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


async def _arcgis_query(
    client: httpx.AsyncClient,
    url: str,
    lon: float,
    lat: float,
    *,
    out_fields: str = "*",
    return_geometry: bool = False,
    pad: float = _DEG,
    extra: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    data: dict[str, Any] = {
        "geometry": _envelope(lon, lat, pad),
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": out_fields,
        "returnGeometry": "true" if return_geometry else "false",
        "outSR": "4326",
        "resultRecordCount": 25,
        "f": "json",
    }
    if extra:
        data.update(extra)
    r = await client.get(url, params=data)
    r.raise_for_status()
    payload = r.json()
    if payload.get("error"):
        return []
    return payload.get("features") or []


async def fetch_parcel(
    client: httpx.AsyncClient, lon: float, lat: float
) -> dict[str, Any] | None:
    feats = await _arcgis_query(
        client,
        PASDA_PARCELS,
        lon,
        lat,
        out_fields="PIN,MAPBLOCKLO,MUNICODE,CALCACREAG,NOTES",
        return_geometry=True,
        pad=0.00012,
    )
    if not feats:
        return None
    feats.sort(key=lambda f: _area_approx(f.get("geometry")))
    feat = feats[0]
    attrs = feat.get("attributes") or {}
    return {
        "pin": (attrs.get("PIN") or "").strip(),
        "mapblocklo": (attrs.get("MAPBLOCKLO") or "").strip(),
        "municode": attrs.get("MUNICODE"),
        "calc_acreage": attrs.get("CALCACREAG"),
        "geometry": esri_polygon_to_geojson(feat.get("geometry")),
    }


async def fetch_assessment(
    client: httpx.AsyncClient, pin: str
) -> dict[str, Any] | None:
    if not pin:
        return None
    params_list = [
        {"resource_id": ASSESSMENTS_RESOURCE, "filters": json.dumps({"PARID": pin}), "limit": 5},
        {"resource_id": ASSESSMENTS_RESOURCE, "q": pin, "limit": 5},
    ]
    records: list[dict[str, Any]] = []
    for params in params_list:
        try:
            r = await client.get(WPRDC_SEARCH, params=params)
            r.raise_for_status()
            records = (r.json().get("result") or {}).get("records") or []
            if records:
                break
        except httpx.HTTPError:
            continue
    exact = [rec for rec in records if str(rec.get("PARID") or "").strip() == pin]
    rec = (exact or records)[0] if (exact or records) else None
    return rec


async def fetch_city_owned(client: httpx.AsyncClient, pin: str) -> bool:
    if not pin:
        return False
    try:
        r = await client.get(
            WPRDC_SEARCH,
            params={"resource_id": CITY_OWNED_RESOURCE, "q": pin, "limit": 5},
        )
        r.raise_for_status()
        records = (r.json().get("result") or {}).get("records") or []
        return any(pin in str(rec.values()) for rec in records)
    except httpx.HTTPError:
        return False


async def fetch_zoning(
    client: httpx.AsyncClient, lon: float, lat: float
) -> dict[str, Any] | None:
    feats = await _arcgis_query(client, ZONING, lon, lat, pad=0.00005)
    if not feats:
        return None
    return feats[0].get("attributes") or {}


async def fetch_hazard_flag(
    client: httpx.AsyncClient, url: str, lon: float, lat: float
) -> bool:
    try:
        feats = await _arcgis_query(
            client, url, lon, lat, out_fields="OBJECTID", pad=0.00008
        )
        return bool(feats)
    except httpx.HTTPError:
        return False


async def fetch_flood(
    client: httpx.AsyncClient, lon: float, lat: float
) -> dict[str, Any] | None:
    try:
        feats = await _arcgis_query(
            client,
            FEMA_NFHL,
            lon,
            lat,
            out_fields="FLD_ZONE,ZONE_SUBTY,SFHA_TF",
            pad=0.0002,
        )
    except httpx.HTTPError:
        return None
    if not feats:
        return None
    attrs = feats[0].get("attributes") or {}
    zone = str(attrs.get("FLD_ZONE") or "X").upper()
    sfha = str(attrs.get("SFHA_TF") or "").upper() == "T" or zone[:1] in {"A", "V"}
    return {"zone": zone, "sfha": sfha, "subtype": attrs.get("ZONE_SUBTY")}


async def fetch_census_acs(
    client: httpx.AsyncClient, lon: float, lat: float
) -> dict[str, Any] | None:
    r = await client.get(
        CENSUS_GEOCODER,
        params={
            "x": lon,
            "y": lat,
            "benchmark": "Public_AR_Current",
            "vintage": "Current_Current",
            "format": "json",
        },
    )
    r.raise_for_status()
    geos = ((r.json().get("result") or {}).get("geographies")) or {}
    tract = None
    for key in ("Census Tracts", "2020 Census Tracts"):
        rows = geos.get(key) or []
        if rows:
            tract = rows[0]
            break
    if not tract:
        return None
    tract_id = str(tract.get("TRACT") or "").zfill(6)
    geoid = str(tract.get("GEOID") or f"42003{tract_id}")
    acs = await client.get(
        CENSUS_REPORTER,
        params={
            "table_ids": "B19013,B25064,B25077,B25002,B25003,B25070",
            "geo_ids": f"14000US{geoid}",
        },
    )
    acs.raise_for_status()
    payload = acs.json()
    data = ((payload.get("data") or {}).get(f"14000US{geoid}")) or {}
    tables = {k: (v.get("estimate") or {}) for k, v in data.items()}

    def est(table: str, col: str) -> float | None:
        try:
            v = float(tables[table][col])
            return None if v < 0 else v
        except (KeyError, TypeError, ValueError):
            return None

    occupied = est("B25002", "B25002001")
    vacant = est("B25002", "B25002003")
    owners = est("B25003", "B25003002")
    renters = est("B25003", "B25003003")
    hh = (owners or 0) + (renters or 0)
    # B25070 col 10 is 50% or more (severe burden); col 1 is total
    burden_n = est("B25070", "B25070010")
    burden_d = est("B25070", "B25070001")
    name = (((payload.get("geography") or {}).get(f"14000US{geoid}")) or {}).get("name")
    return {
        "geoid": geoid,
        "tract_name": name or tract.get("NAME"),
        "median_income": est("B19013", "B19013001"),
        "median_rent": est("B25064", "B25064001"),
        "median_value": est("B25077", "B25077001"),
        "vacancy_rate": (vacant / occupied) if occupied else None,
        "renter_share": (renters / hh) if hh else None,
        "severe_rent_burden_share": (burden_n / burden_d) if burden_d else None,
    }


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


async def fetch_transit(
    client: httpx.AsyncClient, lon: float, lat: float
) -> dict[str, Any]:
    query = f"""
    [out:json][timeout:20];
    (
      node["highway"="bus_stop"](around:800,{lat},{lon});
      node["public_transport"="stop_position"](around:800,{lat},{lon});
      node["railway"="station"](around:800,{lat},{lon});
      node["station"="subway"](around:800,{lat},{lon});
    );
    out body;
    """
    try:
        r = await client.post(OVERPASS, content=query.encode("utf-8"))
        r.raise_for_status()
        elements = r.json().get("elements") or []
    except httpx.HTTPError:
        return {"stops_400m": None, "stops_800m": None, "nearest_m": None}
    dists = []
    for el in elements:
        if "lon" in el and "lat" in el:
            dists.append(haversine_m(lon, lat, el["lon"], el["lat"]))
    if not dists:
        return {"stops_400m": 0, "stops_800m": 0, "nearest_m": None}
    return {
        "stops_400m": sum(1 for d in dists if d <= 400),
        "stops_800m": sum(1 for d in dists if d <= 800),
        "nearest_m": round(min(dists)),
    }
