# Ethan HUD

Personal dashboard for the Even G2 smart glasses -- a multi-card glance app showing tasks, calendar, exchange rates, and more.

## Architecture

```
GitHub API ──┐
Notion API ──┤
Calendar API ┼──> [Mac mini aggregator :9500] ──WebSocket──> [phone WebView] ──BLE──> [G2 glasses]
Exchange API ┤         aggregator/                              src/            576x288 green mono
Sheets API ──┘
```

- **Glasses**: 576x288 single-color green, 16 grayscale levels. Only renders.
- **Phone**: Even App WebView runs this React app. Receives data via WebSocket.
- **Mac mini**: Aggregator service polls APIs, aggregates, pushes via WebSocket.
- **Navigation**: Touch bar scroll (on glasses) or arrow keys / mouse wheel (in browser).

## Cards

| Card | Data Source | Status |
|------|------------|--------|
| **TASKS** | Notion API (AlleyPin Eng Tasks DB) | Done |
| **CALENDAR** | Google Calendar API (via ADC) | Done (needs `gcloud auth`) |
| **FINANCE** | exchangerate-api.com (JPY/TWD) | Done |
| **OPS LENS** | GitHub API (PR/CI/release train) | Planned -- needs token |
| **MONITOR** | Mac mini scripts (tickets/ANA/IG) | Planned |

## Quick Start

```bash
# 1. Install
npm install
cd aggregator && npm install && cd ..

# 2. Configure aggregator
cp aggregator/.env.example aggregator/.env
# Edit .env: fill NOTION_TOKEN, optionally CALENDAR_ENABLED

# 3. Google Calendar setup (one-time)
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/calendar.readonly

# 4. Run
cd aggregator && npm run dev &    # aggregator on :9500
npm run dev                        # frontend on :5173

# 5. Open in browser
open http://localhost:5173          # real data
open http://localhost:5173?mock=true # mock demo mode
```

## Deploy to G2

See [DEPLOY.md](DEPLOY.md) for full steps. Summary:

```bash
npm run qr      # QR sideload to glasses for testing
npm run pack     # Package for Even Hub upload
# Upload to hub.evenrealities.com -> Beta group -> publish
```

## Mock Mode

When the aggregator is not running, the app auto-fills with realistic sample data after 3 seconds. Force it with `?mock=true`. A `MOCK` label appears in the status bar.

## Project Structure

```
src/
  cards/              Card components (one per dashboard screen)
    Card.tsx           Base card wrapper
    OpsLensCard.tsx    PR / CI / release train (planned)
    CalendarCard.tsx   Today's events + next event countdown
    TasksCard.tsx      Notion tasks with deadline + priority
    MonitorCard.tsx    Infrastructure health (planned)
    FinanceCard.tsx    JPY/TWD exchange rate + delta
  hooks/
    useBridge.ts       Even Hub SDK bridge + touch bar events
    useWebSocket.ts    WebSocket to aggregator (auto-reconnect)
  mock/
    data.ts            Realistic sample data for all cards
  types/
    dashboard.ts       Shared data types
  App.tsx              Main layout, card scroll, mock mode logic
  App.css              G2-optimized monochrome green styles

aggregator/
  src/
    server.ts          WebSocket server (:9500)
    config.ts          Environment config (.env)
    types.ts           Shared types (mirrors frontend)
    collectors/
      types.ts         Collector interface
      notion.ts        Notion Tasks DB polling (60s)
      calendar.ts      Google Calendar via ADC (5min)
      exchange-rate.ts Free JPY/TWD rate API (30min)

app.json               Even Hub manifest
DEPLOY.md              Deployment guide (Traditional Chinese)
```

## Tech Stack

- React 19 + TypeScript + Vite
- Even Hub SDK (`@evenrealities/even_hub_sdk`)
- Node.js aggregator with `ws` library
- `google-auth-library` for Calendar ADC
- CSS tuned for 576x288 monochrome green display

## Adding a New Card

1. Create collector in `aggregator/src/collectors/`
2. Add message type to `aggregator/src/types.ts` + `src/types/dashboard.ts`
3. Register collector in `aggregator/src/server.ts`
4. Create card component in `src/cards/`
5. Wire up in `App.tsx` (state + switch case + render)
6. Add mock data in `src/mock/data.ts`
