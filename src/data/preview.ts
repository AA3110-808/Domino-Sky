export type PreviewDisruption = {
  flightId: string;
  predictedDeparture: string;
  delayMinutes: number;
  reason: string;
  severity: "moderate" | "high";
};

// UI-only examples. These values are not derived from the supplied network.
export const previewDisruptions: PreviewDisruption[] = [
  {
    flightId: "DS0203",
    predictedDeparture: "12:45",
    delayMinutes: 90,
    reason: "Airport closure · preview",
    severity: "high",
  },
  {
    flightId: "DS0204",
    predictedDeparture: "13:10",
    delayMinutes: 40,
    reason: "Aircraft rotation · preview",
    severity: "moderate",
  },
  {
    flightId: "DS0302",
    predictedDeparture: "14:25",
    delayMinutes: 0,
    reason: "No preview change",
    severity: "moderate",
  },
  {
    flightId: "DS0403",
    predictedDeparture: "11:35",
    delayMinutes: 0,
    reason: "No preview change",
    severity: "moderate",
  },
  {
    flightId: "DS0404",
    predictedDeparture: "12:50",
    delayMinutes: 0,
    reason: "No preview change",
    severity: "moderate",
  },
];
