import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useBridge } from './hooks/useBridge';
import { OpsLensCard } from './cards/OpsLensCard';
import { CalendarCard } from './cards/CalendarCard';
import { TasksCard } from './cards/TasksCard';
import { MonitorCard } from './cards/MonitorCard';
import { FinanceCard } from './cards/FinanceCard';
import {
  mockOpsData,
  mockCalendarData,
  mockTasksData,
  mockMonitorData,
  mockFinanceData,
} from './mock/data';
import type {
  OpsLensData,
  CalendarData,
  TasksData,
  MonitorData,
  FinanceData,
} from './types/dashboard';
import './App.css';

const CARD_COUNT = 5;
const MOCK_ACTIVATE_DELAY_MS = 3000;

/** Check for ?mock=true in URL */
function isMockForced(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('mock') === 'true';
  } catch {
    return false;
  }
}

function App() {
  const { status: wsStatus, lastMessage } = useWebSocket();

  const [activeCard, setActiveCard] = useState(0);
  const [opsData, setOpsData] = useState<OpsLensData | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [tasksData, setTasksData] = useState<TasksData | null>(null);
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [financeData, setFinanceData] = useState<FinanceData | null>(null);
  const [mockActive, setMockActive] = useState(false);

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

  // Wire G2 touch bar events to card navigation
  const { deviceConnected, batteryLevel } = useBridge(navigate);

  // Route incoming WebSocket messages to the correct card state
  useEffect(() => {
    if (!lastMessage) return;
    // Real data arrived -- disable mock
    if (mockActive) setMockActive(false);

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
  }, [lastMessage, mockActive]);

  // Mock mode: activate after MOCK_ACTIVATE_DELAY_MS of disconnection,
  // or immediately if ?mock=true is in the URL.
  const mockTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(mockTimerRef.current);

    if (isMockForced()) {
      // Forced via URL param -- activate immediately
      setMockActive(true);
      return;
    }

    if (wsStatus === 'disconnected') {
      mockTimerRef.current = setTimeout(() => {
        setMockActive(true);
      }, MOCK_ACTIVATE_DELAY_MS);
    } else if (wsStatus === 'connected') {
      // Real connection established -- turn off mock
      setMockActive(false);
    }

    return () => clearTimeout(mockTimerRef.current);
  }, [wsStatus]);

  // Fill card data with mock values when mock mode is active
  useEffect(() => {
    if (!mockActive) return;
    setOpsData(mockOpsData);
    setCalendarData(mockCalendarData);
    setTasksData(mockTasksData);
    setMonitorData(mockMonitorData);
    setFinanceData(mockFinanceData);
  }, [mockActive]);

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
        {mockActive && <span className="mock-indicator">MOCK</span>}
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
