# DOMINO SKY

DOMINO SKY is an airline disruption simulation dashboard with a React and Vite frontend, a Node.js/Express API, and a deterministic TypeScript simulation engine.

## Run locally

Install dependencies once:

```sh
npm install
```

In separate terminals from the project root, start the API and frontend:

```sh
npm run dev:server
```

```sh
npm run dev
```

The Vite development server proxies `/api` requests to `http://127.0.0.1:3001`. The frontend can render the supplied schedule without the API, but simulations, recovery actions, comparisons, and reports require the backend.

Run all unit and API tests:

```sh
npm test
```

Build and type-check the frontend and backend:

```sh
npm run build
```

For production, run `npm run build`, then start the compiled API with `npm run start:server`. Serve the generated `dist/` frontend through a static host configured to proxy `/api` to the API service.

## Architecture

- `flight_network.json` — authoritative supplied operational dataset. It is not modified by the app.
- `src/data/network.ts` — frontend dataset import and shared record types.
- `src/simulation/contract.ts` — dataset, scenario, recovery action, and result contracts shared by the UI and engine.
- `src/simulation/engine.ts` — pure deterministic schedule, closure, rotation, connection, crew, and recovery calculations.
- `server/schemas.ts` — Zod validation for API requests.
- `server/app.ts` and `server/index.ts` — Express API routes and process setup.
- `server/ai/dispatcher.ts` — optional OpenAI-compatible provider adapter and validation of returned advice.
- `src/components/` — dashboard panels and interactive controls.
- `src/services/api.ts` — typed frontend API request helper.

## API

- `GET /api/health` — API, engine, and AI configuration status.
- `GET /api/dataset` — validated supplied dataset.
- `POST /api/simulations` — run an airport closure scenario.
- `POST /api/simulations/reset` — calculate the selected scenario without recovery actions.
- `POST /api/recovery` — validate and simulate queued recovery actions.
- `POST /api/simulations/compare` — compare 2–10 scenarios.
- `POST /api/dispatcher/analyze` — request optional advisory analysis from current engine output.
- `POST /api/reports` — export summary, flight, rotation, connection, or crew CSV.

The scenario request shape is `{ "airportId": "BOM", "startTime": "10:30", "durationMinutes": 90, "actions": [] }`. Recovery actions are `cancel-flight`, `reschedule-departure`, `hold-connection`, `substitute-spare`, and `reassign-aircraft`.

## Simulation rules and data limitations

- Times are local IST in 24-hour `HH:MM`; calculations unwrap flights across midnight.
- The engine uses the dataset's 30-minute minimum aircraft turnaround, aircraft `tail_id` and `leg_order`, flight block minutes, listed flight loads, listed connections, crew assignment lists, and crew duty limits.
- A closure prevents departures from and arrivals to the selected airport during the configured interval. Arrivals are timed to land after the closure; delays propagate through the assigned aircraft sequence.
- The first scheduled flight of each active aircraft is assumed available at its listed origin at its scheduled departure. A spare is available only at its supplied base and `available_from` time. A spare substitution moves the selected aircraft's remaining rotation; no repositioning flight is invented.
- Impossible aircraft location, capacity, or connection-hold actions are rejected. Aircraft assignment, closure delay, cancellations, passenger connections, and duty time are recalculated after each action set.
- Crew duty is calculated from `duty_start` to the last operated arrival among the roster's listed flights. Crew swaps, reserve crew, duty extensions, and positioning are not in the dataset.
- `pax` and connection passenger counts are reported from their respective dataset fields. The dataset has no passenger identities or booking-level records, so passengers on cancelled flights and passengers on missed connections may overlap and are not combined into a unique passenger total.
- `capacity_per_hour` is supplied for airports but the dataset does not define a runway/slot allocation model, so airport throughput congestion is not simulated.
- All disruption metrics shown after a run come from the deterministic engine. There is no `preview.ts` or static sample disruption data.

## Recovery, comparison, and reports

Recovery actions can be queued together, validated, removed individually, or cleared. A failed feasibility check is returned explicitly instead of applying an impossible aircraft or connection action. The before/after panel compares engine output.

Saved closure scenarios are stored in the current browser's local storage and can be compared through the API. CSV exports are generated from a fresh engine run. PDF exports and cross-user/server-side scenario persistence are not implemented.

## Optional Gemini dispatcher

Gemini analysis is disabled unless `GEMINI_API_KEY` and `GEMINI_MODEL` are configured on the backend. If `.env` does not exist, create it from `.env.example`; if it already exists, add or update only those two entries and preserve its other values. The server uses Google's OpenAI-compatible chat-completions endpoint. Never place the API key in frontend code or commit `.env`.

The AI receives scenario and simulation output, not user-entered personal data. Returned numeric claims are checked against the engine result, flight references must exist, and proposed actions are rerun through the deterministic engine before being labeled feasible. The AI does not calculate operational values. Without Gemini configuration or when the provider is unavailable, the deterministic simulator remains usable.

To test locally, set `GEMINI_API_KEY` and `GEMINI_MODEL` in your untracked `.env`, start the backend with `npm run dev:server` and the frontend with `npm run dev`, run a closure simulation, then select **Analyze current simulation** in the AI Dispatcher panel. `GET /api/health` reports Gemini configuration status without returning credentials.

## Remaining limitations

- Crew replacement/assignment actions, diversions, airport slot allocation, and passenger-level reaccommodation are not modeled because the dataset lacks the required data and constraints.
- Scenario comparison currently presents a comparison table, not charts.
- CSV reporting is implemented; PDF reporting is not.
- The Gemini integration is optional and requires backend-only configuration.
