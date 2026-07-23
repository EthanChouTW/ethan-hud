import { Card } from './Card';
import type { TasksData } from '../types/dashboard';

interface Props {
  data: TasksData | null;
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
          {task.priority === 'high' && <span className="task-priority">!</span>}
        </div>
      ))}
    </Card>
  );
}
