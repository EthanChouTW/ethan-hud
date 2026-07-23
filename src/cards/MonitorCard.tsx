import { Card } from './Card';
import type { MonitorData } from '../types/dashboard';

interface Props {
  data: MonitorData | null;
}

/**
 * Monitor card -- infrastructure/service health at a glance.
 * Shows key metrics with OK/warn/critical indicators.
 */
export function MonitorCard({ data }: Props) {
  if (!data) {
    return (
      <Card title="MONITOR" status="offline">
        <p className="card-placeholder">Waiting for data...</p>
      </Card>
    );
  }

  const worstStatus = data.metrics.reduce<'ok' | 'warn' | 'critical'>(
    (worst, m) => {
      if (m.status === 'critical') return 'critical';
      if (m.status === 'warn' && worst !== 'critical') return 'warn';
      return worst;
    },
    'ok',
  );

  const cardStatus = worstStatus === 'critical' ? 'error' : worstStatus === 'warn' ? 'warn' : 'ok';

  return (
    <Card title="MONITOR" status={cardStatus}>
      <div className="metric-row">
        <span className="metric-label">Uptime</span>
        <span className="metric-value">{data.uptimeHours}h</span>
      </div>
      {data.metrics.slice(0, 3).map((metric, i) => (
        <div key={i} className="metric-row">
          <span className="metric-label">{metric.label}</span>
          <span className={`metric-value metric-value--${metric.status}`}>
            {metric.value}
          </span>
        </div>
      ))}
    </Card>
  );
}
