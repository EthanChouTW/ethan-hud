import { Card } from './Card';
import type { TaskDetail } from '../types/dashboard';

interface Props {
  detail: TaskDetail | null;
  updating?: boolean;
}

/**
 * Phone-side mirror of the glasses detail page.
 *
 * Kept deliberately close to `taskDetailPage` in src/glasses/page.ts so the
 * browser preview shows what the wearer sees -- the glasses are the real
 * target, and this is where the layout gets debugged.
 */
export function TaskDetailCard({ detail, updating }: Props) {
  if (!detail) {
    return (
      <Card title="TASK" status="offline">
        <p className="card-placeholder">Loading...</p>
      </Card>
    );
  }

  return (
    <Card title="TASK" status={updating ? 'warn' : 'ok'}>
      <div className="detail-title">{detail.title}</div>

      <div className="detail-meta">
        {detail.status && <span className="detail-status">{detail.status}</span>}
        {detail.deadline && <span className="detail-date">{detail.deadline}</span>}
      </div>

      {detail.content.length > 0 ? (
        <div className="detail-content">
          {detail.content.map((line, i) => (
            <div key={i} className="detail-line">{line}</div>
          ))}
        </div>
      ) : (
        <div className="detail-empty">(no page content)</div>
      )}

      <div className="task-hint">TAP=advance status | 2xTAP=back</div>
    </Card>
  );
}
