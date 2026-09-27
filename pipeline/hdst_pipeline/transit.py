"""GTFS: weekday scheduled trips per stop and trips within a radius of points."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.strtree import STRtree

from .paths import METRIC_CRS, WGS84

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"]


def _read(zf: zipfile.ZipFile, name: str, **kw) -> pd.DataFrame:
    with zf.open(name) as fh:
        return pd.read_csv(io.TextIOWrapper(fh, encoding="utf-8-sig"), **kw)


def busiest_weekday_services(calendar: pd.DataFrame, trips: pd.DataFrame) -> tuple[str, set[str]]:
    """Pick the regular weekday with the most scheduled trips; return (day, service ids)."""
    for col in WEEKDAYS + ["service_id"]:
        if col not in calendar.columns:
            raise ValueError(f"calendar.txt missing '{col}'")
    trips_per_service = trips.groupby("service_id").size()
    best_day, best_n, best_services = None, -1, set()
    for day in WEEKDAYS:
        services = set(calendar.loc[calendar[day].astype(int) == 1, "service_id"].astype(str))
        n = int(trips_per_service.reindex(list(services)).fillna(0).sum())
        if n > best_n:
            best_day, best_n, best_services = day, n, services
    return best_day or "monday", best_services


def stop_weekday_trips(gtfs_zip: Path) -> tuple[gpd.GeoDataFrame, dict]:
    """Stops (EPSG:4326) with ``weekdayTrips`` and ``routes`` for the busiest regular weekday."""
    with zipfile.ZipFile(gtfs_zip) as zf:
        names = set(zf.namelist())
        for req in ("stops.txt", "stop_times.txt", "trips.txt", "routes.txt", "calendar.txt"):
            if req not in names:
                raise ValueError(f"GTFS zip missing {req}")
        stops = _read(zf, "stops.txt", dtype={"stop_id": str})
        trips = _read(zf, "trips.txt", dtype={"trip_id": str, "service_id": str, "route_id": str}, usecols=["trip_id", "service_id", "route_id"])
        routes = _read(zf, "routes.txt", dtype=str)
        calendar = _read(zf, "calendar.txt", dtype={"service_id": str})
        stop_times = _read(zf, "stop_times.txt", dtype={"trip_id": str, "stop_id": str}, usecols=["trip_id", "stop_id"])
        feed_info = _read(zf, "feed_info.txt", dtype=str) if "feed_info.txt" in names else None

    day, services = busiest_weekday_services(calendar, trips)
    day_trips = trips[trips["service_id"].isin(services)]
    st = stop_times.merge(day_trips[["trip_id", "route_id"]], on="trip_id", how="inner")
    per_stop = st.groupby("stop_id").agg(weekdayTrips=("trip_id", "size"))
    label_col = "route_short_name" if "route_short_name" in routes.columns else "route_id"
    route_labels = routes.set_index("route_id")[label_col].fillna(routes["route_id"]).astype(str)
    st["route_label"] = st["route_id"].map(route_labels).fillna(st["route_id"])
    routes_per_stop = st.groupby("stop_id")["route_label"].agg(lambda s: sorted(set(s)))

    stops = stops[["stop_id", "stop_name", "stop_lat", "stop_lon"]].copy()
    stops["weekdayTrips"] = stops["stop_id"].map(per_stop["weekdayTrips"]).fillna(0).astype(int)
    stops["routes"] = stops["stop_id"].map(routes_per_stop)
    stops["routes"] = stops["routes"].apply(lambda v: v if isinstance(v, list) else [])
    stops = stops[stops["weekdayTrips"] > 0].copy()
    gdf = gpd.GeoDataFrame(
        stops.rename(columns={"stop_id": "stopId", "stop_name": "name"}),
        geometry=gpd.points_from_xy(stops["stop_lon"], stops["stop_lat"]),
        crs=WGS84,
    ).drop(columns=["stop_lat", "stop_lon"])
    meta = {
        "weekday": day,
        "serviceIds": sorted(services),
        "trips": int(len(day_trips)),
        "stopsWithService": int(len(gdf)),
        "feedInfo": feed_info.iloc[0].to_dict() if feed_info is not None and len(feed_info) else None,
    }
    return gdf.sort_values("stopId").reset_index(drop=True), meta


def trips_within(points: gpd.GeoSeries, stops: gpd.GeoDataFrame, radius_m: float) -> np.ndarray:
    """Sum of ``weekdayTrips`` at stops within ``radius_m`` of each point (metres, EPSG:32617)."""
    if len(stops) == 0:
        return np.zeros(len(points), dtype=int)
    pts = points.to_crs(METRIC_CRS).values
    stp = stops.geometry.to_crs(METRIC_CRS).values
    tree = STRtree(stp)
    p_idx, s_idx = tree.query(pts, predicate="dwithin", distance=radius_m)
    trips = stops["weekdayTrips"].to_numpy()
    out = np.bincount(p_idx, weights=trips[s_idx], minlength=len(points))
    return out.astype(int)
