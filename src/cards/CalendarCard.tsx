import { Card } from './Card';
import type { CalendarData } from '../types/dashboard';

interface Props {
  data: CalendarData | null;
}

/**
 * Calendar card -- shows upcoming events.
 * The next event is highlighted.
 */
export function CalendarCard({ data }: Props) {
  if (!data) {
    return (
      <Card title="CALENDAR" status="offline">
        <p className="card-placeholder">Waiting for data...</p>
      </Card>
    );
  }

  return (
    <Card title="CALENDAR">
      <div className="card-time">{data.currentTime}</div>
      {data.events.slice(0, 3).map((event, i) => (
        <div key={i} className={`event-row ${event.isNext ? 'event-row--next' : ''}`}>
          <span className="event-time">{event.time}</span>
          <span className="event-title">{event.title}</span>
        </div>
      ))}
      {data.events.length === 0 && (
        <p className="card-placeholder">No upcoming events</p>
      )}
    </Card>
  );
}
