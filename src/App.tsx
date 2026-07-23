import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useBridge } from './hooks/useBridge';
import { OpsLensCard } from './cards/OpsLensCard';
import { CalendarCard } from './cards/CalendarCard';
import { TasksCard } from './cards/TasksCard';
import { MonitorCard } from './cards/MonitorCard';
import { FinanceCard } from './cards/FinanceCard';
import type {
  OpsLensData,
  CalendarData,
  TasksData,
  MonitorData,
  FinanceData,
} from './types/dashboard';
import './App.css';

const CARD_COUNT = 5;

function App() {
  const { status: wsStatus, lastMessage } = useWebSocket();
  const { deviceConnected, batteryLevel } = useBridge();

  const [activeCard, setActiveCard] = useState(0);
  const [opsData, setOpsData] = useState<OpsLensData | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [tasksData, setTasksData] = useState<TasksData | null>(null);
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [financeData, setFinanceData] = useState<FinanceData | null>(null);

  // Route incoming WebSocket messages to the correct card state
  useEffect(() => {
    if (!lastMessage) return;
    switch (lastMessage.type) {
      case 'ops':
        setOpsData(lastMessage.data as OpsLensData);
        break;
      case 'calendar':
        setCalendarData(lastMessage.data as CalendarData);
        break;
      case 'tasks':
        setTasksData(lastMessage.data as TasksData);
        break;
      case 'monitor':
        setMonitorData(lastMessage.data as MonitorData);
        break;
      case 'finance':
        setFinanceData(lastMessage.data as FinanceData);
        break;
    }
  }, [lastMessage]);

  // Navigate cards with keyboard (dev) or touch bar events (glasses)
  const navigate = useCallback(
    (direction: 'left' | 'right') => {
      setActiveCard((prev) => {
        if (direction === 'right') return Math.min(prev + 1, CARD_COUNT - 1);
        return Math.max(prev - 1, 0);
      });
    },
    [],
  );

  // Keyboard navigation for browser dev
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate('right');
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigate('left');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  const cardNames = ['OPS', 'CAL', 'TSK', 'MON', 'FIN'];

  return (
    <div className="hud">
      {/* Status bar */}
      <div className="status-bar">
        <span className={`ws-indicator ws-indicator--${wsStatus}`}>
          {wsStatus === 'connected' ? 'WS' : wsStatus === 'connecting' ? '..' : 'XX'}
        </span>
        <span className="device-indicator">
          {deviceConnected ? 'G2' : '--'}
          {batteryLevel !== undefined && ` ${batteryLevel}%`}
        </span>
        <div className="card-dots">
          {cardNames.map((name, i) => (
            <span
              key={name}
              className={`dot ${i === activeCard ? 'dot--active' : ''}`}
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Card viewport -- horizontal scroll */}
      <div
        className="card-viewport"
        style={{ transform: `translateX(-${activeCard * 100}%)` }}
      >
        <OpsLensCard data={opsData} />
        <CalendarCard data={calendarData} />
        <TasksCard data={tasksData} />
        <MonitorCard data={monitorData} />
        <FinanceCard data={financeData} />
      </div>
    </div>
  );
}

export default App;
