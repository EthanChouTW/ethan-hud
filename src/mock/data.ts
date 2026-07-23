import type {
  OpsLensData,
  CalendarData,
  TasksData,
  MonitorData,
  FinanceData,
} from '../types/dashboard';

/**
 * Mock data for demo mode.
 *
 * Activates automatically when the WebSocket aggregator is unreachable,
 * or when ?mock=true is present in the URL.
 * Data is realistic for Ethan's AlleyPin/JP workflow.
 */

export const mockOpsData: OpsLensData = {
  activePatients: 1247,
  pendingTasks: 3,
  alerts: ['atlas-stg deploy #6195 pending review'],
  lastSync: new Date().toISOString(),
};

export const mockCalendarData: CalendarData = {
  events: [
    {
      title: 'JP BD stand up!',
      startTime: '10:00',
      endTime: '10:30',
      location: 'Google Meet',
      isNext: true,
      minutesUntil: 12,
      conferenceUrl: 'https://meet.google.com/abc-defg-hij',
    },
    {
      title: 'AI Agent GTM sync',
      startTime: '14:00',
      endTime: '14:45',
      location: 'Google Meet',
      isNext: false,
    },
    {
      title: 'Retrospective meeting',
      startTime: '16:00',
      endTime: '17:00',
      location: '#tw-engineering',
      isNext: false,
    },
    {
      title: 'Debra 1:1',
      startTime: '17:30',
      endTime: '18:00',
      isNext: false,
    },
  ],
  currentTime: '09:48',
  nextEventTitle: 'JP BD stand up!',
  nextEventIn: 12,
};

export const mockTasksData: TasksData = {
  items: [
    {
      id: 'TASK-01842',
      title: '[AI Agent] streaming response fix',
      priority: 'high',
      done: false,
      deadline: '2026-07-25',
      status: 'In Progress',
      tags: ['agent', 'bug'],
    },
    {
      id: 'TASK-01839',
      title: '[Runtime] JP prod migration cutover',
      priority: 'high',
      done: false,
      deadline: '2026-07-28',
      status: 'Blocked',
      tags: ['runtime', 'jp'],
    },
    {
      id: 'TASK-01836',
      title: '[Web Chat] language directive injection',
      priority: 'medium',
      done: false,
      status: 'Review',
      tags: ['web-chat'],
    },
    {
      id: 'TASK-01830',
      title: '[Meta] IG DM channel schema PR',
      priority: 'medium',
      done: true,
      status: 'Done',
      tags: ['meta'],
    },
    {
      id: 'TASK-01825',
      title: '[Rich Media] Maps key quota lock',
      priority: 'low',
      done: true,
      status: 'Done',
      tags: ['rich-media'],
    },
  ],
  completedToday: 2,
  totalToday: 5,
};

export const mockMonitorData: MonitorData = {
  metrics: [
    { label: 'atlas-stg', value: 'OK', status: 'ok' },
    { label: 'atlas-prd', value: 'OK', status: 'ok' },
    { label: 'ANA seat check', value: '18:00 last run', status: 'warn' },
  ],
  uptimeHours: 743,
};

export const mockFinanceData: FinanceData = {
  jpyToTwd: 0.2234,
  jpyToTwdPrev: 0.2228,
  rateUpdatedAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
};
