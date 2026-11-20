import { useMemo } from "react";
import { Expand, Layers, MapPin, Route } from "lucide-react";
import type { Airport, Flight } from "../data/network";

type FlightNetworkProps = {
  airports: Airport[];
  flights: Flight[];
  selectedAirport: string;
};

const MAP_WIDTH = 660;
const MAP_HEIGHT = 350;

function project(airport: Airport) {
  const minLng = 70;
  const maxLng = 93;
  const minLat = 6;
  const maxLat = 33;
  return {
    x: 50 + ((airport.lng - minLng) / (maxLng - minLng)) * (MAP_WIDTH - 100),
    y: 25 + ((maxLat - airport.lat) / (maxLat - minLat)) * (MAP_HEIGHT - 50),
  };
}

export function FlightNetwork({ airports, flights, selectedAirport }: FlightNetworkProps) {
  const airportById = useMemo(() => new Map(airports.map((airport) => [airport.id, airport])), [airports]);
  const airportPoints = useMemo(() => new Map(airports.map((airport) => [airport.id, project(airport)])), [airports]);

  return (
    <section className="panel network-panel" id="network">
      <div className="panel-heading network-heading">
        <div className="panel-title-group"><div className="panel-icon map-icon"><MapPin size={17} /></div><div><h2>Flight network</h2><p>Live route overview across India</p></div></div>
        <div className="map-actions"><span className="map-leg-legend"><i /> Active routes</span><button className="small-icon-button" aria-label="Map layers"><Layers size={15} /></button><button className="small-icon-button" aria-label="Expand network"><Expand size={15} /></button></div>
      </div>
      <div className="map-wrap">
        <div className="map-grid" />
        <svg className="network-svg" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label="Flight routes between airports in India">
          <defs>
            <pattern id="mapDots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="#dbe2ea" /></pattern>
          </defs>
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#mapDots)" />
          {flights.map((flight) => {
            const origin = airportPoints.get(flight.origin);
            const destination = airportPoints.get(flight.destination);
            if (!origin || !destination) return null;
            const related = flight.origin === selectedAirport || flight.destination === selectedAirport;
            const midpointX = (origin.x + destination.x) / 2;
            const midpointY = Math.min(origin.y, destination.y) - Math.abs(origin.x - destination.x) * 0.1 - 4;
            return <path key={flight.flight_id} className={`route-line ${related ? "route-highlight" : ""}`} d={`M ${origin.x} ${origin.y} Q ${midpointX} ${midpointY} ${destination.x} ${destination.y}`} />;
          })}
          {airports.map((airport) => {
            const point = airportPoints.get(airport.id);
            if (!point) return null;
            const isSelected = airport.id === selectedAirport;
            return (
              <g key={airport.id} className={isSelected ? "airport-selected" : ""}>
                {isSelected && <circle className="airport-ring" cx={point.x} cy={point.y} r="12" />}
                <circle className={`airport-marker ${isSelected ? "selected" : ""}`} cx={point.x} cy={point.y} r={isSelected ? 4.5 : 3.2} />
                <text className={`airport-label ${isSelected ? "selected" : ""}`} x={point.x + 7} y={point.y - 7}>{airport.id}</text>
              </g>
            );
          })}
        </svg>
        <div className="map-compass"><span>N</span><i>↑</i></div>
        <div className="map-selected"><span className="selected-pulse" /> {airportById.get(selectedAirport)?.city ?? selectedAirport} <strong>{selectedAirport}</strong></div>
      </div>
      <div className="map-footer">
        <div className="map-stat"><span className="map-stat-icon"><Route size={14} /></span><span><strong>{flights.length} scheduled legs</strong><small>From supplied network dataset</small></span></div>
        <div className="map-stat"><span className="map-stat-icon muted"><MapPin size={14} /></span><span><strong>{airports.length} airports</strong><small>Domestic network</small></span></div>
        <div className="map-status"><span className="status-dot" /> Dataset loaded</div>
      </div>
    </section>
  );
}
