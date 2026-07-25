import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useBridge } from './hooks/useBridge';
import { useGlassesPage } from './hooks/useGlassesPage';
import { CalendarCard } from './cards/CalendarCard';
import { TasksCard } from './cards/TasksCard';
import { TaskDetailCard } from './cards/TaskDetailCard';
import { EventDetailCard } from './cards/EventDetailCard';
import { FinanceCard } from './cards/FinanceCard';
import {
  tasksPage,
  financePage,
  calendarPage,
  taskDetailPage,
  calendarDetailPage,
  decorate,
} from './glasses/page';
import {
  mockCalendarData,
  mockTasksData,
  mockFinanceData,
} from './mock/data';
import type {
  AggregatorMessage,
  CalendarData,
  TasksData,
  TaskDetail,
  FinanceData,
} from './types/dashboard';
import './App.css';

/**
 * Cards with a live collector behind them, in display order.
 *
 * OPS and MONITOR exist as components but have no data source yet, so they are
 * left out of the rotation -- on the glasses the only way forward is
 * double-tap, and dead cards in that cycle are pure friction.
 */
const CARDS = ['TSK', 'FIN', 'CAL'] as const;
const TASKS_CARD_INDEX = 0;
const CALENDAR_CARD_INDEX = 2;
const MOCK_ACTIVATE_DELAY_MS = 3000;

function isMockForced(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('mock') === 'true';
  } catch {
    return false;
  }
}

function App() {
  const [activeCard, setActiveCard] = useState(0);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [tasksData, setTasksData] = useState<TasksData | null>(null);
  const [financeData, setFinanceData] = useState<FinanceData | null>(null);
  const [mockActive, setMockActive] = useState(false);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [taskUpdating, setTaskUpdating] = useState(false);

  /**
   * Drill-down state. The tasks card is a two-level view: the list is a
   * scannable index with truncated rows, and the detail shows what the list
   * had to cut. Tap means "go deeper" in the list and "advance status" in the
   * detail, so the destructive action is never one stray tap away.
   */
  const [detailOpen, setDetailOpen] = useState(false);
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);

  /**
   * Route each message as it arrives. Every collector's payload is replayed
   * on connect, so these land together -- they must each be handled, not
   * collapsed into a single "latest message" slot.
   */
  const handleMessage = useCallback((msg: AggregatorMessage) => {
    setMockActive(false);

    switch (msg.type) {
      case 'calendar':
        setCalendarData(msg.data as CalendarData);
        break;
      case 'tasks':
        setTasksData(msg.data as TasksData);
        setTaskUpdating(false);
        break;
      case 'finance':
        setFinanceData(msg.data as FinanceData);
        break;
      case 'taskDetail':
        setTaskDetail(msg.data as TaskDetail);
        break;
    }
  }, []);

  const { status: wsStatus, send } = useWebSocket(handleMessage);

  /**
   * Double-tap. Inside the detail view it means "back"; otherwise it advances
   * to the next card. Card switching wraps -- the glasses have no separate
   * back gesture to reach the previous one.
   */
  const navigate = useCallback((direction: 'left' | 'right') => {
    if (detailOpen) {
      setDetailOpen(false);
      setTaskDetail(null);
      return;
    }
    // Selection is per-list; carrying an index across cards would point at a
    // different row, or past the end of a shorter list.
    setSelectedIdx(0);
    setActiveCard((prev) => {
      const delta = direction === 'right' ? 1 : -1;
      return (prev + delta + CARDS.length) % CARDS.length;
    });
  }, [detailOpen]);

  const handleSelect = useCallback((index: number) => {
    setSelectedIdx(index);
  }, []);

  /** Rows in whichever list is on screen -- selection is per-card. */
  const rowCount = activeCard === TASKS_CARD_INDEX
    ? tasksData?.items.length ?? 0
    : activeCard === CALENDAR_CARD_INDEX
      ? calendarData?.events.length ?? 0
      : 0;

  const handleScroll = useCallback((delta: 1 | -1) => {
    setSelectedIdx((prev) => {
      if (rowCount === 0) return 0;
      return Math.min(Math.max(prev + delta, 0), rowCount - 1);
    });
  }, [rowCount]);

  /** The calendar detail is read straight from the list -- no round trip. */
  const selectedEvent = activeCard === CALENDAR_CARD_INDEX && calendarData
    ? calendarData.events[Math.min(selectedIdx, calendarData.events.length - 1)] ?? null
    : null;

  /**
   * Tap. In a list it opens the selected row; in the task detail it advances
   * that task's status.
   */
  const handleTap = useCallback(() => {
    if (activeCard === CALENDAR_CARD_INDEX) {
      // Everything the event detail shows already arrived with the list, so
      // opening it is instant -- no fetch, unlike the task detail.
      if ((calendarData?.events.length ?? 0) > 0) setDetailOpen(true);
      return;
    }

    if (activeCard !== TASKS_CARD_INDEX) return;

    const items = tasksData?.items ?? [];
    if (items.length === 0) return;

    // The native list reports its own index, which can outrun the data after
    // a refresh shortens the list. Clamping keeps a tap working instead of
    // silently doing nothing.
    const idx = Math.min(Math.max(selectedIdx, 0), items.length - 1);
    const task = items[idx];
    if (!task) return;

    if (!detailOpen) {
      setDetailOpen(true);
      setTaskDetail(null);
      send(JSON.stringify({
        collector: 'notion',
        action: 'getTaskDetail',
        payload: {
          taskId: task.id,
          title: task.title,
          status: task.status,
          deadline: task.deadline,
        },
      }));
      return;
    }

    if (taskUpdating) return;
    setTaskUpdating(true);
    send(JSON.stringify({
      collector: 'notion',
      action: 'advanceTaskStatus',
      payload: { taskId: task.id, currentStatus: task.status ?? '未開始' },
    }));
  }, [activeCard, selectedIdx, tasksData, calendarData, taskUpdating, detailOpen, send]);

  const { bridge, deviceConnected, batteryLevel } = useBridge({
    onNavigate: navigate,
    onTap: handleTap,
    onSelect: handleSelect,
    onScroll: handleScroll,
  });

  // What the glasses should be showing right now.
  const glassesPage = useMemo(() => {
    if (detailOpen) {
      const page = activeCard === CALENDAR_CARD_INDEX
        ? calendarDetailPage(selectedEvent)
        : taskDetailPage(taskDetail);
      const hint = activeCard === CALENDAR_CARD_INDEX
        ? '2tap=back'
        : 'tap=status 2tap=back';
      return decorate(page, wsStatus, mockActive, hint);
    }

    const base = (() => {
      switch (CARDS[activeCard]) {
        case 'TSK': return tasksPage(tasksData);
        case 'FIN': return financePage(financeData);
        case 'CAL': return calendarPage(calendarData);
      }
    })();
    const hint = activeCard === TASKS_CARD_INDEX || activeCard === CALENDAR_CARD_INDEX
      ? 'tap=open 2tap=next'
      : '2tap=next';
    return decorate(base, wsStatus, mockActive, hint);
  }, [
    detailOpen, taskDetail, selectedEvent, activeCard,
    tasksData, financeData, calendarData, wsStatus, mockActive,
  ]);

  useGlassesPage(bridge, glassesPage);

  const mockTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(mockTimerRef.current);

    if (isMockForced()) {
      setMockActive(true);
      return;
    }

    if (wsStatus === 'connected') {
      setMockActive(false);
    } else {
      // Covers 'connecting' too: a socket that is blocked by the manifest
      // whitelist, or pointed at an unreachable host, can sit in 'connecting'
      // indefinitely without ever firing close or error.
      mockTimerRef.current = setTimeout(() => {
        setMockActive(true);
      }, MOCK_ACTIVATE_DELAY_MS);
    }

    return () => clearTimeout(mockTimerRef.current);
  }, [wsStatus]);

  useEffect(() => {
    if (!mockActive) return;
    setCalendarData(mockCalendarData);
    setTasksData(mockTasksData);
    setFinanceData(mockFinanceData);
  }, [mockActive]);

  // Browser dev controls, mirroring the glasses gestures.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') navigate('right');
      if (e.key === 'ArrowLeft') navigate('left');
      if (e.key === 'ArrowDown') {
        setSelectedIdx((i) => Math.min(i + 1, (tasksData?.items.length ?? 1) - 1));
      }
      if (e.key === 'ArrowUp') {
        setSelectedIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleTap();
      }
      if (e.key === 'Escape' && detailOpen) {
        setDetailOpen(false);
        setTaskDetail(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, handleTap, tasksData, detailOpen]);

  return (
    <div className="hud">
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
          {CARDS.map((name, i) => (
            <span
              key={name}
              className={`dot ${i === activeCard ? 'dot--active' : ''}`}
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      {detailOpen ? (
        activeCard === CALENDAR_CARD_INDEX
          ? <EventDetailCard event={selectedEvent} />
          : <TaskDetailCard detail={taskDetail} updating={taskUpdating} />
      ) : (
        <div
          className="card-viewport"
          style={{ transform: `translateX(-${activeCard * (100 / CARDS.length)}%)` }}
        >
          <TasksCard
            data={tasksData}
            editMode
            selectedIndex={selectedIdx}
            updating={taskUpdating}
          />
          <FinanceCard data={financeData} />
          <CalendarCard data={calendarData} selectedIndex={selectedIdx} />
        </div>
      )}
    </div>
  );
}

export default App;
