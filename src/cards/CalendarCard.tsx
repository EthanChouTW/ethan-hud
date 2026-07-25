import { Card } from './Card';
import type { CalendarData } from '../types/dashboard';

interface Props {
  data: CalendarData | null;
  selectedIndex?: number;
}

/**
 * Calendar card -- shows next event countdown + today's schedule.
 * Designed for G2 (576x288, green monochrome).
 */
export function CalendarCard({ data, selectedIndex }: Props) {
  if (!data) {
    return (
      <Card title="CALENDAR" status="offline">
        <p className="card-placeholder">Waiting for data...</p>
      </Card>
    );
  }

  const hasNext = data.nextEventTitle && data.nextEventIn !== undefined;

  // The glasses list is indexed over the full event array, so this must be
  // too -- slicing to "upcoming only" would make the selection index point at
  // a different row here than on the device.
  const displayEvents = data.events.slice(0, 5);

  return (
    <Card title="CALENDAR">
      {/* Next event banner */}
      {hasNext ? (
        <div className="cal-next">
          <span className="cal-next-label">NEXT:</span>
          <span className="cal-next-title">{data.nextEventTitle}</span>
          <span className="cal-next-countdown">in {data.nextEventIn} min</span>
        </div>
      ) : (
        <div className="cal-next cal-next--none">
          No upcoming events
        </div>
      )}

      {/* Event list */}
      <div className="cal-list">
        {displayEvents.map((event, i) => (
          <div
            key={i}
            className={[
              'event-row',
              event.isNext ? 'event-row--next' : '',
              i === selectedIndex ? 'task-row--selected' : '',
            ].filter(Boolean).join(' ')}
          >
            <span className="event-time">
              {event.dayLabel === 'tomorrow' ? '+1 ' : ''}{event.startTime}
            </span>
            <span className="event-title">{event.title}</span>
            {event.location && (
              <span className="event-location">{event.location}</span>
            )}
          </div>
        ))}
      </div>

      {/* Current time footer */}
      <div className="card-footnote">{data.currentTime}</div>
    </Card>
  );
}
