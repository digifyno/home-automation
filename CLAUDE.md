# Home Automation - AI Worker Instructions

## Project Overview

This is a home automation platform that provides a beautiful, modern web interface for managing and monitoring smart home devices. The goal is to create a unified dashboard that brings together multiple home automation systems.

## Tech Stack

- **Runtime**: Node.js 20+ with TypeScript (strict mode)
- **Frontend**: React 18+ with Vite, Tailwind CSS
- **Backend**: Express.js REST API
- **Package Manager**: npm

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (frontend + backend)
npm run build        # Production build
npm run typecheck    # TypeScript type checking
npm test             # Run tests (vitest, single pass)
npm run test:watch   # Run tests in watch mode
```

## Architecture

```
src/
  server/           # Express.js backend API
    integrations/   # Smart home platform connectors
      fibaro/       # Fibaro HC3 integration
    routes/         # API route handlers
    index.ts        # Server entry point
  client/           # React frontend
    components/     # UI components
    pages/          # Page-level views
    hooks/          # Custom React hooks
    services/       # API client services
    App.tsx         # Root component
    main.tsx        # Entry point
  shared/           # Shared types used by both server and client
```

## Integrations

### Fibaro HC3

- **URL**: `http://192.168.1.35` (routed via Tailscale subnet routing through rsiw1)
- **Auth**: Basic auth using environment variables `FIBARO_USERNAME` and `FIBARO_PASSWORD`
- **Rate limit**: All `/api/fibaro` routes are protected by `fibaroLimiter` (120 req/min); exceeding the limit returns HTTP 429 `{ error: 'Too many requests' }`
- **API Docs**: Fibaro HC3 uses a REST API. Key endpoints (all under `/api/fibaro/` prefix on this server):
  - `GET /api/fibaro/devices` - List all devices
  - `GET /api/fibaro/devices/{id}` - Device details
  - `POST /api/fibaro/devices/{id}/action/{actionName}` - Trigger device action (e.g., `turnOn`, `turnOff`, `setValue`, `setBrightness`, `setColor`, `open`, `close`, `toggle`)
  - `GET /api/fibaro/rooms` - List rooms
  - `GET /api/fibaro/scenes` - List scenes
  - `POST /api/fibaro/scenes/{id}/execute` - Execute a scene
  - `GET /api/fibaro/weather` - Weather data
  - `GET /api/fibaro/energy` - Energy device data
  - `GET /api/health` - Health check (unauthenticated); returns 200 when Fibaro is reachable, 503 when degraded
- **Device value types**: Binary switches report `properties.value` as a boolean (`true`/`false`). Dimmers (e.g., `com.fibaro.dimmer2`) report `properties.value` as a **number 0–99** (brightness level), not a boolean. Use `isDeviceOn` from `src/shared/types.ts` to check on/off state — it handles `boolean`, `number > 0`, `"true"`, and `"1"` uniformly.

### Netatmo

- **Status**: To be configured
- **Auth**: OAuth2 via environment variables `NETATMO_CLIENT_ID`, `NETATMO_CLIENT_SECRET`, `NETATMO_REFRESH_TOKEN`
- **API Docs**: https://dev.netatmo.com/apidocumentation

## Environment Variables

Create a `.env` file (never commit this):

```
FIBARO_URL=http://192.168.1.35
FIBARO_USERNAME=admin
FIBARO_PASSWORD=<set-in-env>
NETATMO_CLIENT_ID=<set-in-env>
NETATMO_CLIENT_SECRET=<set-in-env>
NETATMO_REFRESH_TOKEN=<set-in-env>
PORT=4018
API_TOKEN=<generate-with-openssl-rand-hex-32>
VITE_API_TOKEN=<same-value-as-API_TOKEN>
ALLOWED_ORIGIN=
```

`API_TOKEN` is required — the server will refuse to start without it. `VITE_API_TOKEN` must match `API_TOKEN`; it is embedded into the frontend bundle at build time and sent as a `Bearer` token on all `/api/fibaro` requests.

`FIBARO_URL`, `FIBARO_USERNAME`, and `FIBARO_PASSWORD` are also required — the Fibaro client validates all three on startup and exits with a fatal error if any are missing.

`PORT` is optional and defaults to `4018` when unset.

`ALLOWED_ORIGIN` is optional. When unset (or empty), CORS is configured to same-origin only (cross-origin requests are blocked by the browser). Set it to a specific origin (e.g., `http://localhost:5173`) to allow cross-origin requests from that origin during development.

## Design Guidelines

- **Modern and clean**: Use a dark theme with accent colors for status indicators
- **Responsive**: Must work well on desktop, tablet, and mobile. The sidebar is always visible on `md+` breakpoints; on mobile it slides in via a hamburger toggle (`Menu`/`X` icons) with a backdrop overlay that closes it on tap
- **Real-time**: Show live device states, auto-refresh data
- **Intuitive**: Group devices by room, use clear icons, show at-a-glance status
- **Performance**: Minimize API calls with smart caching and WebSocket updates where possible

## Conventions

- Use functional React components with hooks
- Use TypeScript strict mode - no `any` types
- API responses should be typed with shared interfaces
- Error handling: wrap all API calls with proper error boundaries; for `fetch` calls, always check `r.ok` before calling `r.json()` — a non-2xx response (e.g. nginx error page) is not valid JSON and will throw a misleading parse error otherwise. **Exception**: `useHealth.ts` intentionally skips `r.ok` because `/api/health` always returns valid JSON (even on 503), and the body must be read to surface the `degraded` state.
- Use environment variables for all secrets - never hardcode credentials
- Write tests for integration connectors, middleware behaviour (e.g. rate limiting, auth), and critical UI logic
- Tests use **vitest**; all client `.tsx` tests (`src/client/**/*.test.tsx`) and hook `.ts` tests (`src/client/hooks/**/*.test.ts`) run in the `jsdom` environment (configured via `environmentMatchGlobs` in `vitest.config.ts`)
- Route integration tests live in `src/server/routes/*.integration.test.ts` and use `supertest` against a minimal Express app; middleware (CORS, auth, rate limiter) is wired up inline so the tests reflect real request flow
- `src/server/index.production.test.ts` tests production-mode middleware ordering (Helmet, CORS, auth, rate limiter, JSON error handler, `/api/*` 404 catch-all); add tests here when changing `src/server/index.ts` middleware structure
- `src/test-setup.ts` is loaded as a `setupFiles` entry in `vitest.config.ts` before all test modules. It sets `FIBARO_URL`, `FIBARO_USERNAME`, `FIBARO_PASSWORD`, and `API_TOKEN` environment variables so integration and unit tests can import server modules without triggering the startup validation guard that calls `process.exit(1)` when env vars are missing.
- A global Express error handler in `src/server/index.ts` catches `entity.parse.failed` errors (from `express.json()`) and returns `400 { error: 'Invalid JSON body' }`. POST endpoints do not need to handle malformed JSON themselves.

## Allowed Domains

- `127.0.0.1` (Fibaro HC3 proxy)
- `api.netatmo.com`
- `registry.npmjs.org`
- `github.com`
