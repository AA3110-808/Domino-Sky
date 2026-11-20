# DOMINO SKY

Airline operations disruption dashboard UI built with React, TypeScript, and Vite.

## Run locally

```sh
npm install
npm run dev
```

Run `npm run build` to type-check and create a production build in `dist/`.

## Data boundaries

- `flight_network.json` is the supplied network dataset and is the source for airport, flight, connection, and crew schedule views.
- `src/data/preview.ts` contains illustrative disruption rows for initial UI development. They are not computed from the network and must not be treated as operational results.
- `src/simulation/contract.ts` defines the typed input boundary for a deterministic simulation engine. No engine or recovery calculations are implemented yet.

The AI Dispatcher is advisory-only and does not create, change, or calculate operational numbers.
