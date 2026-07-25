import { Card } from './Card';
import type { TasksData } from '../types/dashboard';

interface Props {
  data: TasksData | null;
  editMode?: boolean;
  selectedIndex?: number;
  updating?: boolean;
}

export function TasksCard({ data, editMode, selectedIndex, updating }: Props) {
  if (!data) {
    return (
      <Card title="TASKS" status="offline">
        <p className="card-placeholder">Waiting for data...</p>
      </Card>
    );
  }

  const title = editMode ? 'TASKS [EDIT]' : 'TASKS';

  return (
    <Card title={title}>
      {data.items.slice(0, 5).map((task, i) => {
        const isSelected = editMode && i === selectedIndex;
        const classes = [
          'task-row',
          task.done ? 'task-row--done' : '',
          isSelected ? 'task-row--selected' : '',
          task.priority === 'high' ? 'task-row--overdue' : '',
        ].filter(Boolean).join(' ');

        const label = task.dayLabel ?? (task.deadline ? task.deadline.slice(5).replace('-', '/') : '');

        return (
          <div key={task.id} className={classes}>
            <span className="task-check">
              {updating && isSelected ? '[~]' : task.done ? '[x]' : '[ ]'}
            </span>
            <span className="task-day-label">{label}</span>
            <span className="task-title">{task.title}</span>
            <span className="task-status">{task.status ?? ''}</span>
          </div>
        );
      })}
      {editMode && (
        <div className="task-hint">TAP=advance | 2xTAP=exit</div>
      )}
    </Card>
  );
}
