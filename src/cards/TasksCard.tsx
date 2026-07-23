import { Card } from './Card';
import type { TasksData } from '../types/dashboard';

interface Props {
  data: TasksData | null;
}

/**
 * Format a date string (YYYY-MM-DD) as MM/DD for compact display.
 */
function formatDeadline(deadline: string): string {
  const parts = deadline.split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return deadline;
}

/**
 * Tasks card -- today's task list with completion progress.
 * Shows up to 4 tasks to fit the G2 viewport.
 */
export function TasksCard({ data }: Props) {
  if (!data) {
    return (
      <Card title="TASKS" status="offline">
        <p className="card-placeholder">Waiting for data...</p>
      </Card>
    );
  }

  const progress = data.totalToday > 0
    ? `${data.completedToday}/${data.totalToday}`
    : '0/0';

  return (
    <Card title={`TASKS ${progress}`}>
      {data.items.slice(0, 4).map((task) => (
        <div key={task.id} className={`task-row ${task.done ? 'task-row--done' : ''}`}>
          <span className="task-check">{task.done ? '[x]' : '[ ]'}</span>
          <span className="task-title">{task.title}</span>
          {task.deadline && (
            <span className="task-deadline">{formatDeadline(task.deadline)}</span>
          )}
          {task.status && (
            <span className="task-status">{task.status}</span>
          )}
          {task.priority === 'high' && <span className="task-priority">!</span>}
        </div>
      ))}
    </Card>
  );
}
