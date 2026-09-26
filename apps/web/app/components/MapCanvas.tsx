"use client";

import { useCallback, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Props = {
  onPick: (lat: number, lon: number) => void;
  geometry: GeoJSON.Polygon | null;
  flyTo: { lat: number; lon: number } | null;
};

export default function MapCanvas({ onPick, geometry, flyTo }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Tiles &copy; Esri",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [-79.9959, 40.4406],
      zoom: 13,
      attributionControl: true,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("click", (e) => {
      onPickRef.current(e.lngLat.lat, e.lngLat.lng);
    });
    map.on("load", () => {
      map.resize();
      map.addSource("parcel", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "parcel-fill",
        type: "fill",
        source: "parcel",
        paint: { "fill-color": "#c5a35a", "fill-opacity": 0.28 },
      });
      map.addLayer({
        id: "parcel-line",
        type: "line",
        source: "parcel",
        paint: { "line-color": "#8a6a2f", "line-width": 2 },
      });
    });
    mapRef.current = map;
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("parcel") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData(
        geometry
          ? { type: "Feature", properties: {}, geometry }
          : { type: "FeatureCollection", features: [] }
      );
      if (geometry?.coordinates?.[0]) {
        const ring = geometry.coordinates[0];
        const bounds = ring.reduce(
          (b, c) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(ring[0] as [number, number], ring[0] as [number, number])
        );
        map.fitBounds(bounds, { padding: 60, maxZoom: 18 });
      }
    };
    if (map.getSource("parcel")) apply();
    else map.once("load", apply);
  }, [geometry]);

  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: 16, duration: 900 });
  }, [flyTo]);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    ref.current = node;
  }, []);

  return (
    <div className="map-wrap">
      <div className="map" ref={setRef} />
      <div className="map-legend">Click a lot inside Pittsburgh</div>
    </div>
  );
}
