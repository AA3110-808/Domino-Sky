import networkData from "../../flight_network.json";

export type Airport = (typeof networkData.airports)[number];
export type Flight = (typeof networkData.flights)[number];
export type Connection = (typeof networkData.connections)[number];
export type Crew = (typeof networkData.crews)[number];
export type NetworkDataset = typeof networkData;

export const actualNetwork = networkData;
