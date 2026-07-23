import { Card } from './Card';
import type { FinanceData } from '../types/dashboard';

interface Props {
  data: FinanceData | null;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
}

function getDelta(current: number, prev: number | undefined): { symbol: string; className: string } {
  if (prev === undefined) return { symbol: '', className: '' };
  if (current > prev) return { symbol: '↑', className: 'rate-up' };
  if (current < prev) return { symbol: '↓', className: 'rate-down' };
  return { symbol: '', className: '' };
}

/**
 * Finance card -- JPY/TWD exchange rate + optional cash metrics.
 */
export function FinanceCard({ data }: Props) {
  if (!data) {
    return (
      <Card title="FINANCE" status="offline">
        <p className="card-placeholder">Waiting for data...</p>
      </Card>
    );
  }

  const twdPerJpy = data.jpyToTwd;
  const jpyPerTwd = twdPerJpy > 0 ? 1 / twdPerJpy : 0;
  const delta = getDelta(twdPerJpy, data.jpyToTwdPrev);

  return (
    <Card title="FINANCE">
      <div className="rate-primary">
        <span className="rate-label">1 JPY =</span>
        <span className="rate-value">
          {twdPerJpy.toFixed(4)} TWD
          {delta.symbol && (
            <span className={`rate-delta ${delta.className}`}> {delta.symbol}</span>
          )}
        </span>
      </div>
      <div className="rate-inverse">
        <span className="rate-label">1 TWD =</span>
        <span className="rate-value">{jpyPerTwd.toFixed(2)} JPY</span>
      </div>

      {data.cashPosition && (
        <div className="metric-row">
          <span className="metric-label">Cash</span>
          <span className="metric-value">{data.cashPosition}</span>
        </div>
      )}
      {data.burnRate && (
        <div className="metric-row">
          <span className="metric-label">Burn</span>
          <span className="metric-value">{data.burnRate}</span>
        </div>
      )}
      {data.runway && (
        <div className="metric-row">
          <span className="metric-label">Runway</span>
          <span className="metric-value">{data.runway}</span>
        </div>
      )}

      <div className="card-footnote">Rate @ {formatTime(data.rateUpdatedAt)}</div>
    </Card>
  );
}
