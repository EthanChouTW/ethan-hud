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

- **Glasses**: 576x288 single-color green, 16 grayscale levels.
- **Phone**: Even App WebView runs this React app. Receives data via WebSocket.
- **Mac mini**: Aggregator service polls APIs, aggregates, pushes via WebSocket.

### The glasses do not render this React tree

This is the part that is easy to get wrong. The React/CSS UI only ever runs in
the **phone** WebView. The G2 draws **native containers** (text / list / image)
that the app builds and pushes over the bridge:

- `createStartUpPageContainer` is **mandatory on launch**. Skip it and the
  glasses sit on the "launch app" screen forever, no matter what else you call.
- `rebuildPageContainer` applies every later change.
- Layout lives in `src/glasses/page.ts`; the push loop in
  `src/hooks/useGlassesPage.ts`.

The list container is created with `isEventCapture: 1`, so the temple scroll
drives **native row selection** and arrives as a `listEvent` -- the app does not
implement scrolling itself.

### How the G2 actually reports a tap

Undocumented, and it cost several builds to pin down: **a tap arrives as a list
event carrying no `eventType` at all** -- just a selection payload. Any handler
that keys off `eventType` throws every tap away while scroll and double-tap keep
working, which makes it look like taps are being ignored by the device.

What separates the two is whether the selection index moved:

| Event | Meaning |
|---|---|
| index changed | temple scrolled -- move selection |
| index same, or absent | row activated -- treat as tap |

`useBridge` takes an `onRawEvent` callback for exactly this kind of question.
Wire it to the header (see git history for `lastEvent`) to read raw event codes
off the display instead of guessing. Unwire it afterwards -- while it is live,
every event changes the header and costs a BLE write.

### Other things the SDK does not spell out

- **Rows are limited by display width, not character count.** CJK glyphs are
  double-width; a title that fits by `length` can still be twice the container
  width. The host rejects an oversized page, and a rejected `rebuildPageContainer`
  leaves the *previous* page on screen -- which reads as "the card didn't
  switch", not as an error. `src/glasses/page.ts` measures real columns.
- **`borderWidth` without `borderColor` draws nothing** -- the colour defaults
  to 0, i.e. black on a black display. The scale appears to be 0-255.
- **The usable area really is 576x288**, confirmed by drawing container
  borders, despite `ImageContainerProperty` documenting a 288x144 maximum.

### Controls

| Gesture (glasses) | Key (browser) | Action |
|---|---|---|
| Scroll temple | Up / Down | Move row selection |
| Tap | Enter | Open the selected task or event |
| Tap *(in task detail)* | Enter | Advance that task's status |
| Double-tap | Left / Right | Next card, or back out of a detail |

Tap means "go deeper", never "mutate" -- advancing a task's status lives one
level in, so it is not one stray tap away on a list you are only scanning.

## Cards

| Card | Data Source | Status |
|------|------------|--------|
| **TASKS** | Notion API (personal 項目 DB) | Done -- tap opens detail, tap again advances status |
| **FINANCE** | exchangerate-api.com (JPY/TWD) | Done |
| **CALENDAR** | Google Calendar API (via ADC) | Done -- today + tomorrow, tap opens detail |

Both detail views wrap text rather than truncating it -- that is the whole
point of drilling in. The task detail fetches the Notion page body, so it shows
a brief loading state; the event detail is instant because location, meeting
link and description already arrived with the list.

`OpsLensCard` and `MonitorCard` still exist in `src/cards/` but have no
collector behind them, so they are left out of the rotation -- on the glasses
the only way forward is double-tap, and dead cards there are pure friction.
Add them back to `CARDS` in `App.tsx` once their collectors land.

## Quick Start

```bash
# 1. Install
npm install
cd aggregator && npm install && cd ..

# 2. Configure aggregator
cp aggregator/.env.example aggregator/.env
# Edit .env: fill NOTION_TOKEN, optionally CALENDAR_ENABLED

# 3. Google Calendar setup (one-time)
#    Google now blocks the gcloud default client for Calendar scopes, so this
#    needs your own OAuth client: GCP Console -> Credentials -> OAuth client ID
#    -> Desktop app -> download the JSON. cloud-platform must be included.
gcloud auth application-default login \
  --client-id-file=/path/to/client_secret.json \
  --scopes=https://www.googleapis.com/auth/calendar.readonly,https://www.googleapis.com/auth/cloud-platform

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
  glasses/
    page.ts            Native container layout + width-aware text fitting
  cards/              Phone-side mirrors of what the glasses show
    Card.tsx           Base card wrapper
    TasksCard.tsx      Notion tasks with day label + selection
    TaskDetailCard.tsx Full title + Notion page body
    CalendarCard.tsx   Today + tomorrow, next-event countdown
    EventDetailCard.tsx Time, location, meeting link, description
    FinanceCard.tsx    JPY/TWD exchange rate + delta
    OpsLensCard.tsx    PR / CI / release train (planned, not in rotation)
    MonitorCard.tsx    Infrastructure health (planned, not in rotation)
  hooks/
    useBridge.ts       Even Hub SDK bridge + touch bar events
    useGlassesPage.ts  Serialised page push loop over BLE
    useWebSocket.ts    WebSocket to aggregator (auto-reconnect)
  mock/
    data.ts            Realistic sample data for all cards
  types/
    dashboard.ts       Shared data types
  App.tsx              Card rotation, drill-down state, gesture routing
  App.css              G2-optimized monochrome green styles

aggregator/
  src/
    server.ts          WebSocket server (:9500)
    config.ts          Environment config (.env)
    types.ts           Shared types (mirrors frontend)
    collectors/
      types.ts         Collector interface (poll + optional handleAction)
      notion.ts        Tasks poll (60s), page body fetch, status writes
      calendar.ts      Google Calendar via ADC (5min), today + tomorrow
      exchange-rate.ts Free JPY/TWD rate API (30min)

app.json               Even Hub manifest
.env.production        VITE_WS_URL for packed builds (see DEPLOY.md)
DEPLOY.md              Deployment guide (Traditional Chinese)
```

Collectors are not push-only: a client can send
`{collector, action, payload}` upstream and the server routes it to that
collector's `handleAction`. That is how a tap advances a Notion status and how
the task detail fetches a page body.

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
4. Add a page builder in `src/glasses/page.ts` -- this is what the glasses
   actually render; use `fit()` for list rows and `wrap()` for detail text
5. Create the phone-side card in `src/cards/`
6. Wire up in `App.tsx`: add to `CARDS`, add state, add a `glassesPage` case
7. Add mock data in `src/mock/data.ts`

Step 4 is the one that is easy to skip. A card that only exists in `src/cards/`
renders on the phone and shows nothing on the glasses.
