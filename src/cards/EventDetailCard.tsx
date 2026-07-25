import { Card } from './Card';
import type { CalendarEvent } from '../types/dashboard';

interface Props {
  event: CalendarEvent | null;
}

/**
 * Phone-side mirror of the glasses event detail.
 *
 * Unlike the task detail, nothing is fetched here -- the calendar list
 * already carries location, conference link and description, so opening an
 * event is instant.
 */
export function EventDetailCard({ event }: Props) {
  if (!event) {
    return (
      <Card title="EVENT" status="offline">
        <p className="card-placeholder">No event selected</p>
      </Card>
    );
  }

  return (
    <Card title="EVENT">
      <div className="detail-title">{event.title}</div>

      <div className="detail-meta">
        {event.dayLabel && <span>{event.dayLabel}</span>}
        <span>{event.startTime}-{event.endTime}</span>
        {event.minutesUntil !== undefined && (
          <span className="detail-countdown">in {event.minutesUntil} min</span>
        )}
      </div>

      <div className="detail-content">
        {event.location && <div className="detail-line">@ {event.location}</div>}
        {event.conferenceUrl && <div className="detail-line">{event.conferenceUrl}</div>}
        {event.description && <div className="detail-line">{event.description}</div>}
        {!event.location && !event.conferenceUrl && !event.description && (
          <div className="detail-empty">(no location or notes)</div>
        )}
      </div>

      <div className="task-hint">2xTAP=back</div>
    </Card>
  );
}
