/**
 * Glasses page rendering.
 *
 * The G2 does not render this React tree -- that only ever runs in the phone
 * WebView. The glasses draw native containers (text / list / image) that we
 * build here and push over the bridge.
 *
 * Layout is a 576x288 space, origin top-left:
 *
 *   +---------------------------------------------+  y=0
 *   | TASKS 2/5                          [header] |  h=30
 *   +---------------------------------------------+  y=34
 *   |  今天  長崎皮卡丘工藝館                       |
 *   |  前天  領取 My Number Card                   |  list
 *   |  ...                                        |  h=250
 *   +---------------------------------------------+  y=284
 */

import {
  ListContainerProperty,
  ListItemContainerProperty,
  TextContainerProperty,
} from '@evenrealities/even_hub_sdk';
import type {
  CalendarData,
  CalendarEvent,
  FinanceData,
  TaskDetail,
  TasksData,
} from '../types/dashboard';

/** Glasses display bounds. */
const SCREEN_W = 576;
const HEADER_H = 30;
const LIST_Y = HEADER_H + 4;
const LIST_H = 288 - LIST_Y - 4;

/**
 * Border brightness.
 *
 * The SDK never documents this range, but image raw data is described as
 * normalised to 0-255, so the panel's 16 grey levels are addressed on that
 * scale. Leaving it unset means 0 -- black on a black display, which is why
 * the first attempt at drawing container edges showed nothing at all.
 */
const BORDER_COLOR = 255;

/** Container IDs are stable so textContainerUpgrade can target them. */
export const HEADER_CONTAINER_ID = 1;
export const LIST_CONTAINER_ID = 2;

export const HEADER_CONTAINER_NAME = 'hud-header';
const HEADER_NAME = HEADER_CONTAINER_NAME;
const LIST_NAME = 'hud-list';

/**
 * Rows visible at once. The G2 list scrolls natively, but keeping the payload
 * small matters -- every rebuild goes out over BLE.
 */
const MAX_ROWS = 8;

export interface GlassesPage {
  title: string;
  rows: string[];
  /**
   * Row cap for this page. The detail view wraps rather than truncates, so it
   * needs more room than a list; the host still rejects an oversized page, but
   * that now surfaces as a visible !render rather than a silent stale screen.
   */
  maxRows?: number;
}

/**
 * Stamp connection state and the gesture hint onto the header.
 *
 * The glasses have no affordances -- no visible buttons, no cursor -- so the
 * only way the wearer can tell a dead WebSocket from an empty list, or learn
 * that double-tap changes cards, is if the header says so.
 */
export function decorate(
  page: GlassesPage,
  wsStatus: 'connecting' | 'connected' | 'disconnected',
  mock: boolean,
  hint: string = '2tap=next',
): GlassesPage {
  const flag = mock
    ? 'MOCK'
    : wsStatus === 'connected'
      ? 'ws'
      : wsStatus === 'connecting'
        ? 'ws..'
        : 'ws:OFF';

  return {
    ...page,
    title: fit(`${page.title} ${flag} ${hint}`, MAX_COLS + 8),
  };
}

/**
 * Build the container payload for a page.
 *
 * Exactly one container sets `isEventCapture` (the list), per the SDK rule.
 * `zOrderIndex` is set on every container -- the SDK rejects the page if some
 * containers set it and others do not.
 */
export function buildContainerPayload(page: GlassesPage) {
  const rows = page.rows.slice(0, page.maxRows ?? MAX_ROWS);

  // The SDK requires real class instances -- it calls toJson() on each
  // container, so plain object literals are rejected at the type level.
  //
  // The 1px borders are deliberate: the SDK documents an image container as
  // 288x144 max while its own example places a text container at y=220, so
  // whether the usable space is 576x288 or half that is genuinely unclear.
  // Drawing the container edges settles it by eye on the device.
  return {
    containerTotalNum: 2,
    textObject: [
      new TextContainerProperty({
        xPosition: 0,
        yPosition: 0,
        width: SCREEN_W,
        height: HEADER_H,
        containerID: HEADER_CONTAINER_ID,
        containerName: HEADER_NAME,
        zOrderIndex: 1,
        content: page.title,
        isEventCapture: 0,
        borderWidth: 2,
        borderColor: BORDER_COLOR,
      }),
    ],
    listObject: [
      new ListContainerProperty({
        xPosition: 0,
        yPosition: LIST_Y,
        width: SCREEN_W,
        height: LIST_H,
        containerID: LIST_CONTAINER_ID,
        containerName: LIST_NAME,
        zOrderIndex: 2,
        isEventCapture: 1,
        borderWidth: 2,
        borderColor: BORDER_COLOR,
        itemContainer: new ListItemContainerProperty({
          itemCount: rows.length,
          itemName: rows,
          isItemSelectBorderEn: 1,
        }),
      }),
    ],
  };
}

/**
 * Display columns available per row.
 *
 * Counting characters is not enough: CJK glyphs are double-width, so a row of
 * 40 Chinese characters is roughly 80 columns and blows well past the 576px
 * container. The host rejects an oversized page outright -- and a rejected
 * rebuild leaves the *previous* page on screen, which reads as "the card did
 * not switch" rather than as an error.
 */
const MAX_COLS = 30;

/** True for glyphs that occupy two terminal columns (CJK, kana, fullwidth). */
function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x20000 && code <= 0x3fffd)
  );
}

function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    width += isWide(ch.codePointAt(0) ?? 0) ? 2 : 1;
  }
  return width;
}

/** Truncate to a column budget, measuring CJK as double-width. */
function fit(text: string, maxCols: number = MAX_COLS): string {
  if (displayWidth(text) <= maxCols) return text;

  let width = 0;
  let out = '';
  for (const ch of text) {
    const w = isWide(ch.codePointAt(0) ?? 0) ? 2 : 1;
    if (width + w > maxCols - 1) break;
    out += ch;
    width += w;
  }
  return `${out}…`;
}

export function tasksPage(data: TasksData | null): GlassesPage {
  if (!data || data.items.length === 0) {
    return { title: 'TASKS', rows: ['(no tasks)'] };
  }

  const rows = data.items.map((t) => {
    const day = t.dayLabel ?? (t.deadline ? t.deadline.slice(5).replace('-', '/') : '');
    const mark = t.done ? 'x' : t.status === '進行中' ? '>' : ' ';
    return fit(`[${mark}]${day} ${t.title}`);
  });

  return { title: 'TASKS', rows };
}

/**
 * Wrap text across rows instead of truncating it.
 *
 * The list rows truncate because a task list is a scannable index. The detail
 * view is the opposite: it exists precisely to show what the list had to cut,
 * so long titles and page content wrap rather than losing their tail.
 */
function wrap(text: string, maxCols: number = MAX_COLS): string[] {
  if (displayWidth(text) <= maxCols) return [text];

  const out: string[] = [];
  let line = '';
  let width = 0;

  for (const ch of text) {
    const w = isWide(ch.codePointAt(0) ?? 0) ? 2 : 1;
    if (width + w > maxCols) {
      out.push(line);
      line = '';
      width = 0;
    }
    line += ch;
    width += w;
  }
  if (line) out.push(line);

  return out;
}

export function taskDetailPage(detail: TaskDetail | null): GlassesPage {
  if (!detail) return { title: 'TASK', rows: ['loading…'] };

  const rows: string[] = [];

  // Full title, wrapped -- this is the main thing the list could not show.
  rows.push(...wrap(detail.title));

  const meta = [detail.status, detail.deadline].filter(Boolean).join('  ');
  if (meta) rows.push(fit(meta));

  if (detail.content.length > 0) {
    rows.push('--');
    for (const line of detail.content) {
      rows.push(...wrap(line));
    }
  }

  return { title: 'TASK', rows, maxRows: 12 };
}

export function calendarDetailPage(event: CalendarEvent | null): GlassesPage {
  if (!event) return { title: 'EVENT', rows: ['(none)'] };

  const rows: string[] = [];
  rows.push(...wrap(event.title));

  const when = [
    event.dayLabel,
    `${event.startTime}-${event.endTime}`,
  ].filter(Boolean).join(' ');
  rows.push(fit(when));

  if (event.minutesUntil !== undefined) {
    rows.push(fit(`in ${event.minutesUntil} min`));
  }
  if (event.location) {
    rows.push('--');
    rows.push(...wrap(event.location));
  }
  if (event.conferenceUrl) {
    rows.push(...wrap(event.conferenceUrl));
  }
  if (event.description) {
    rows.push('--');
    rows.push(...wrap(event.description));
  }

  return { title: 'EVENT', rows, maxRows: 12 };
}

export function financePage(data: FinanceData | null): GlassesPage {
  if (!data) return { title: 'FINANCE', rows: ['(no data)'] };

  const rate = data.jpyToTwd.toFixed(4);
  const inverse = (1 / data.jpyToTwd).toFixed(3);
  const rows = [`JPY -> TWD   ${rate}`, `TWD -> JPY   ${inverse}`];

  if (data.jpyToTwdPrev !== undefined) {
    const delta = data.jpyToTwd - data.jpyToTwdPrev;
    const arrow = delta >= 0 ? '↑' : '↓';
    rows.push(`${arrow} ${Math.abs(delta).toFixed(4)}`);
  }

  return { title: 'FINANCE', rows };
}

export function calendarPage(data: CalendarData | null): GlassesPage {
  if (!data || data.events.length === 0) {
    return { title: 'CALENDAR', rows: ['(no events)'] };
  }

  const title = data.nextEventIn !== undefined
    ? `CALENDAR  next in ${data.nextEventIn}m`
    : 'CALENDAR';

  const rows = data.events.map((e) => {
    const day = e.dayLabel === 'tomorrow' ? '+1 ' : '';
    return fit(`${day}${e.startTime} ${e.title}`);
  });

  return { title, rows };
}
