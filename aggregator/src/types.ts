/**
 * Shared types for the aggregator.
 *
 * These mirror the frontend types in src/types/dashboard.ts.
 * TODO: Extract to a shared package when the monorepo grows.
 */

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

export interface AggregatorMessage {
  type: 'ops' | 'calendar' | 'tasks' | 'monitor' | 'finance';
  data: unknown;
  timestamp: number;
}
