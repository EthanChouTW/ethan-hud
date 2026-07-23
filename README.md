# ethan-hud

Personal HUD dashboard for the Even G2 smart glasses.
A multi-card glance app showing operational metrics, calendar, tasks, monitoring, and finance data at a glance.

## Architecture / 架構

```
Even G2 glasses (576x288, green mono, 16 grayscale)
      |
    BLE
      |
Even App (phone) -- WebView runs this app
      |
   WebSocket
      |
Mac mini aggregator (separate service, feeds data)
```

The app runs as an Even Hub WebView plugin on the phone.
The glasses only render what the phone sends over BLE.
A Mac mini aggregator (not included in this repo) pushes real-time data via WebSocket.

## Cards / 卡片

| Card | Description | Status |
|------|-------------|--------|
| OPS LENS | AlleyPin operational overview (active patients, pending tasks, alerts) | Planned |
| CALENDAR | Upcoming events from Google Calendar | Planned |
| TASKS | Today's task list with completion progress | Planned |
| MONITOR | Infrastructure/service health metrics | Planned |
| FINANCE | Cash position, burn rate, runway | Planned |

## Tech Stack

- React + TypeScript + Vite
- Even Hub SDK (`@evenrealities/even_hub_sdk`)
- WebSocket for aggregator connection
- CSS tuned for 576x288 monochrome green display

## Dev Setup / 開發設定

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production (output in dist/)
npm run build
```

Arrow keys navigate between cards in the browser.
On the G2 glasses, the touch bar scroll navigates between cards.

## Packaging for Even Hub

```bash
# Pack the built app into .ehpk
npx @evenrealities/evenhub-cli pack app.json dist
```

## Project Structure

```
src/
  cards/          -- Card components (one per dashboard screen)
    Card.tsx      -- Base card wrapper
    OpsLensCard.tsx
    CalendarCard.tsx
    TasksCard.tsx
    MonitorCard.tsx
    FinanceCard.tsx
  hooks/
    useBridge.ts  -- Even Hub SDK bridge lifecycle
    useWebSocket.ts -- Mac mini aggregator WebSocket connection
  types/
    dashboard.ts  -- Data types for aggregator messages
  App.tsx         -- Main layout with horizontal card scroll
  App.css         -- G2-optimized monochrome green styles
app.json          -- Even Hub app manifest
```
