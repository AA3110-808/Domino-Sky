import networkData from "../../flight_network.json";
import type { AirportRecord, ConnectionRecord, CrewRecord, FlightRecord, NetworkDataset, SpareAircraftRecord } from "../simulation/contract";

export type Airport = AirportRecord;
export type Flight = FlightRecord;
export type Connection = ConnectionRecord;
export type Crew = CrewRecord;
export type SpareAircraft = SpareAircraftRecord;

export const actualNetwork: NetworkDataset = networkData;
