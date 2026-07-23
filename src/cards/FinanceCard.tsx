import { Card } from './Card';
import type { FinanceData } from '../types/dashboard';

interface Props {
  data: FinanceData | null;
}

/**
 * Finance card -- cash position, burn rate, and runway.
 */
export function FinanceCard({ data }: Props) {
  if (!data) {
    return (
      <Card title="FINANCE" status="offline">
        <p className="card-placeholder">Waiting for data...</p>
      </Card>
    );
  }

  return (
    <Card title="FINANCE">
      <div className="metric-row">
        <span className="metric-label">Cash</span>
        <span className="metric-value">{data.cashPosition}</span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Burn</span>
        <span className="metric-value">{data.burnRate}</span>
      </div>
      <div className="metric-row">
        <span className="metric-label">Runway</span>
        <span className="metric-value">{data.runway}</span>
      </div>
      <div className="card-footnote">Updated: {data.lastUpdated}</div>
    </Card>
  );
}
