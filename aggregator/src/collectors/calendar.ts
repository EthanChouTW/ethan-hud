import { GoogleAuth } from 'google-auth-library';
import type { Collector } from './types.js';
import type { AggregatorMessage, CalendarEvent, CalendarData } from '../types.js';

const POLL_INTERVAL_MS = 300_000; // 5 minutes
const TIMEZONE = 'Asia/Tokyo';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

interface GoogleCalendarEvent {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
}

interface GoogleCalendarResponse {
  items?: GoogleCalendarEvent[];
}

/**
 * Calendar collector -- polls Google Calendar via ADC and broadcasts today's events.
 */
export function createCalendarCollector(): Collector {
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastPayloadJson = '';
  let authClient: GoogleAuth | undefined;

  function getTodayBounds(): { timeMin: string; timeMax: string } {
    // Get start and end of today in Asia/Tokyo
    const now = new Date();
    const tokyoDate = new Date(
      now.toLocaleString('en-US', { timeZone: TIMEZONE })
    );
    const year = tokyoDate.getFullYear();
    const month = String(tokyoDate.getMonth() + 1).padStart(2, '0');
    const day = String(tokyoDate.getDate()).padStart(2, '0');

    const timeMin = `${year}-${month}-${day}T00:00:00+09:00`;
    const timeMax = `${year}-${month}-${day}T23:59:59+09:00`;

    return { timeMin, timeMax };
  }

  function formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TIMEZONE,
      hour12: false,
    });
  }

  function getCurrentTime(): string {
    return new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TIMEZONE,
      hour12: false,
    });
  }

  function getConferenceUrl(event: GoogleCalendarEvent): string | undefined {
    const entryPoints = event.conferenceData?.entryPoints;
    if (!entryPoints) return undefined;
    const videoEntry = entryPoints.find((ep) => ep.entryPointType === 'video');
    return videoEntry?.uri;
  }

  async function fetchCalendar(): Promise<CalendarData> {
    if (!authClient) {
      authClient = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      });
    }

    const client = await authClient.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      throw new Error('Failed to obtain access token from ADC');
    }

    const { timeMin, timeMax } = getTodayBounds();
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '10',
      timeZone: TIMEZONE,
    });

    const response = await fetch(`${CALENDAR_API}?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as GoogleCalendarResponse;
    const now = new Date();

    // Find the next upcoming event
    let nextIndex = -1;
    const rawItems = body.items ?? [];

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const startStr = item.start?.dateTime ?? item.start?.date;
      if (startStr) {
        const startDate = new Date(startStr);
        if (startDate > now) {
          nextIndex = i;
          break;
        }
      }
    }

    const events: CalendarEvent[] = rawItems.map((item, i) => {
      const startStr = item.start?.dateTime ?? item.start?.date ?? '';
      const endStr = item.end?.dateTime ?? item.end?.date ?? '';
      const isNext = i === nextIndex;

      let minutesUntil: number | undefined;
      if (isNext && startStr) {
        minutesUntil = Math.round((new Date(startStr).getTime() - now.getTime()) / 60_000);
        if (minutesUntil < 0) minutesUntil = 0;
      }

      return {
        title: item.summary ?? '(no title)',
        startTime: startStr ? formatTime(startStr) : '--:--',
        endTime: endStr ? formatTime(endStr) : '--:--',
        location: item.location,
        isNext,
        minutesUntil,
        conferenceUrl: getConferenceUrl(item),
      };
    });

    const nextEvent = nextIndex >= 0 ? events[nextIndex] : undefined;

    return {
      events,
      currentTime: getCurrentTime(),
      nextEventTitle: nextEvent?.title,
      nextEventIn: nextEvent?.minutesUntil,
    };
  }

  return {
    name: 'calendar',

    start(broadcast: (msg: AggregatorMessage) => void) {
      console.log('[calendar] collector started, polling every 5min');

      const poll = async () => {
        try {
          const data = await fetchCalendar();
          const payloadJson = JSON.stringify(data);

          // Only broadcast if data actually changed
          if (payloadJson !== lastPayloadJson) {
            lastPayloadJson = payloadJson;
            broadcast({
              type: 'calendar',
              data,
              timestamp: Date.now(),
            });
            console.log(
              `[calendar] broadcast ${data.events.length} events` +
                (data.nextEventTitle ? `, next: ${data.nextEventTitle} in ${data.nextEventIn}min` : '')
            );
          } else {
            console.log('[calendar] no changes, skipping broadcast');
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes('Could not load the default credentials') ||
            msg.includes('ENOENT') ||
            msg.includes('application_default_credentials')
          ) {
            console.warn(
              '[calendar] ADC not configured. Run: gcloud auth application-default login --scopes=https://www.googleapis.com/auth/calendar.readonly'
            );
            console.warn('[calendar] Disabling calendar collector.');
            // Stop polling — no point retrying without credentials
            if (timer) {
              clearInterval(timer);
              timer = undefined;
            }
          } else {
            console.error('[calendar] poll error:', msg);
            // Will retry on next interval
          }
        }
      };

      // Initial poll immediately
      void poll();
      timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      console.log('[calendar] collector stopped');
    },
  };
}
