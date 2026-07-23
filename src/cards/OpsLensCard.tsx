import { Card } from './Card';
import type { OpsLensData } from '../types/dashboard';

interface Props {
  data: OpsLensData | null;
}

/**
 * Ops Lens card -- quick glance at AlleyPin operational status.
 * Shows active patients, pending tasks, and the latest alert.
 */
export function OpsLensCard({ data }: Props) {
  if (!data) {
    return (
      <Card title="OPS LENS" status="offline">
        <p className="card-placeholder">Waiting for data...</p>
      </Card>
    );
  }

  return (
    <Card title="OPS LENS" status={data.alerts.length > 0 ? 'warn' : 'ok'}>
      <div className="metric-row">
        <span className="metric-label">Active</span>
        <span className="metric-value">{data.activePatients}</span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Pending</span>
        <span className="metric-value">{data.pendingTasks}</span>
      </div>
      {data.alerts.length > 0 && (
        <div className="card-alert">{data.alerts[0]}</div>
      )}
    </Card>
  );
}
