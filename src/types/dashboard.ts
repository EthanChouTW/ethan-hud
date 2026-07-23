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
  time: string;
  location?: string;
  isNext: boolean;
}

export interface CalendarData {
  events: CalendarEvent[];
  currentTime: string;
}

export interface TaskItem {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  done: boolean;
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
  cashPosition: string;
  burnRate: string;
  runway: string;
  lastUpdated: string;
}

export interface AggregatorMessage {
  type: 'ops' | 'calendar' | 'tasks' | 'monitor' | 'finance';
  data: OpsLensData | CalendarData | TasksData | MonitorData | FinanceData;
  timestamp: number;
}
