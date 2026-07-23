import { Card } from './Card';
import type { CalendarData } from '../types/dashboard';

interface Props {
  data: CalendarData | null;
}

/**
 * Calendar card -- shows next event countdown + today's schedule.
 * Designed for G2 (576x288, green monochrome).
 */
export function CalendarCard({ data }: Props) {
  if (!data) {
    return (
      <Card title="CALENDAR" status="offline">
        <p className="card-placeholder">Waiting for data...</p>
      </Card>
    );
  }

  const hasNext = data.nextEventTitle && data.nextEventIn !== undefined;

  // Show remaining events (from the next event onward), max 4
  const nextIndex = data.events.findIndex((e) => e.isNext);
  const remaining = nextIndex >= 0
    ? data.events.slice(nextIndex)
    : data.events;
  const displayEvents = remaining.slice(0, 4);

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
          No more events today
        </div>
      )}

      {/* Event list */}
      <div className="cal-list">
        {displayEvents.map((event, i) => (
          <div
            key={i}
            className={`event-row ${event.isNext ? 'event-row--next' : ''}`}
          >
            <span className="event-time">
              {event.startTime}
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
