import type { ReactNode } from 'react';

interface CardProps {
  title: string;
  children: ReactNode;
  status?: 'ok' | 'warn' | 'error' | 'offline';
}

/**
 * Base card wrapper for the HUD dashboard.
 *
 * Even G2 display: 576x288 px, green mono, 16 grayscale levels.
 * Each card occupies the full viewport and is horizontally scrolled.
 */
export function Card({ title, children, status = 'ok' }: CardProps) {
  const statusIndicator: Record<string, string> = {
    ok: '[OK]',
    warn: '[!]',
    error: '[ERR]',
    offline: '[--]',
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
        <span className={`card-status card-status--${status}`}>
          {statusIndicator[status]}
        </span>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}
