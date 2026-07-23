/**
 * Dashboard card data types.
 *
 * Each card receives its data from the Mac mini aggregator via WebSocket.
 * These types define the shape of that data.
 */

export interface OpsLensData {
  activePatients: number;
  pendingTasks: number;
  alerts: string[];
  lastSync: string;
}

export interface CalendarEvent {
  title: string;
  startTime: string;      // HH:MM format
  endTime: string;        // HH:MM format
  location?: string;
  isNext: boolean;        // true for the next upcoming event
  minutesUntil?: number;  // minutes until start (only for isNext)
  conferenceUrl?: string;
}

export interface CalendarData {
  events: CalendarEvent[];
  currentTime: string;    // HH:MM
  nextEventTitle?: string;
  nextEventIn?: number;   // minutes
}

export interface TaskItem {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  done: boolean;
  deadline?: string;
  status?: string;
  tags?: string[];
}

export interface TasksData {
  items: TaskItem[];
  completedToday: number;
  totalToday: number;
}

export interface MonitorMetric {
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'critical';
}

export interface MonitorData {
  metrics: MonitorMetric[];
  uptimeHours: number;
}

export interface FinanceData {
  jpyToTwd: number;        // e.g. 0.2234
  jpyToTwdPrev?: number;   // previous rate for delta display
  rateUpdatedAt: string;   // ISO timestamp
  cashPosition?: string;   // future: from Sheets
  burnRate?: string;       // future: from Sheets
  runway?: string;         // future: from Sheets
  lastUpdated: string;
}

export interface AggregatorMessage {
  type: 'ops' | 'calendar' | 'tasks' | 'monitor' | 'finance';
  data: OpsLensData | CalendarData | TasksData | MonitorData | FinanceData;
  timestamp: number;
}
