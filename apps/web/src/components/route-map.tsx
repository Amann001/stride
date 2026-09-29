"use client";

import "leaflet/dist/leaflet.css";

import { CircleMarker, MapContainer, Polyline, TileLayer } from "react-leaflet";

// Draws a route on an OpenStreetMap map (free, no API key needed).
// Leaflet only works in the browser, so pages load this with next/dynamic and ssr: false.
export default function RouteMap({ coords }: { coords: { lat: number; lng: number }[] }) {
  if (coords.length === 0) return null;
  const line = coords.map((c) => [c.lat, c.lng] as [number, number]);

  return (
    <MapContainer bounds={line} boundsOptions={{ padding: [24, 24] }} scrollWheelZoom={false} className="h-80 w-full rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* A dark outline under the lime line keeps the route visible on the light map. */}
      <Polyline positions={line} pathOptions={{ color: "#121212", weight: 7 }} />
      <Polyline positions={line} pathOptions={{ color: "#C8F31D", weight: 4 }} />
      <CircleMarker center={line[0]} radius={6} pathOptions={{ color: "#fff", fillColor: "#16A34A", fillOpacity: 1 }} />
      <CircleMarker center={line[line.length - 1]} radius={6} pathOptions={{ color: "#fff", fillColor: "#DC2626", fillOpacity: 1 }} />
    </MapContainer>
  );
}
