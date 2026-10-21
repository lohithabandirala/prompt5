'use client';

import { useCallback, useMemo, useState } from 'react';
import type { TimelineTask } from '@/lib/schemas/event-plan';
import {
  groupTasksByPhase,
  calculateProgress,
  isTaskOverdue,
  validateDependencies,
  daysBetween,
  sortTasks,
  todayCalendarDate,
} from '@/lib/timeline/schedule';

interface TimelinePlannerProps {
  tasks: TimelineTask[];
  eventDate: string;
  onUpdate: (tasks: TimelineTask[]) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

interface TaskDraft {
  title: string;
  phase: string;
  dueDate: string;
  priority: TimelineTask['priority'];
  assignee: string;
  notes: string;
}

const PRIORITY_LABEL: Record<TimelineTask['priority'], string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const STATUS_LABEL: Record<TimelineTask['status'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
};

export default function TimelinePlanner({
  tasks,
  eventDate,
  onUpdate,
  onRegenerate,
  isRegenerating,
}: TimelinePlannerProps) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    phase: '',
    dueDate: todayCalendarDate(),
    priority: 'medium' as TimelineTask['priority'],
  });

  const progress = useMemo(() => calculateProgress(tasks), [tasks]);
  const phaseGroups = useMemo(() => groupTasksByPhase(tasks), [tasks]);
  const dependencyWarnings = useMemo(() => validateDependencies(tasks), [tasks]);

  const handleStatusChange = useCallback(
    (taskId: string, status: TimelineTask['status']) => {
      onUpdate(tasks.map((task) => (task.id === taskId ? { ...task, status } : task)));
    },
    [tasks, onUpdate]
  );

  const handleDelete = useCallback(
    (taskId: string) => {
      onUpdate(tasks.filter((task) => task.id !== taskId));
    },
    [tasks, onUpdate]
  );

  const startEdit = (task: TimelineTask) => {
    if (editingTaskId === task.id) {
      setEditingTaskId(null);
      setDraft(null);
      return;
    }
    setEditingTaskId(task.id);
    setDraft({
      title: task.title,
      phase: task.phase,
      dueDate: task.dueDate ?? '',
      priority: task.priority,
      assignee: task.assignee ?? '',
      notes: task.notes ?? '',
    });
  };

  const saveEdit = () => {
    if (!draft || !editingTaskId) return;
    const days = draft.dueDate ? daysBetween(draft.dueDate, eventDate) : null;

    const updated = tasks.map((task) => {
      if (task.id !== editingTaskId) return task;
      return {
        ...task,
        title: draft.title.trim() || task.title,
        phase: draft.phase.trim() || task.phase,
        priority: draft.priority,
        dueDate: draft.dueDate || task.dueDate,
        daysBeforeEvent:
          days !== null && days >= 0 ? days : task.daysBeforeEvent,
        assignee: draft.assignee.trim() || undefined,
        notes: draft.notes.trim() || undefined,
      };
    });

    onUpdate(sortTasks(updated));
    setEditingTaskId(null);
    setDraft(null);
  };

  const handleAddTask = () => {
    if (!newTask.title.trim()) return;

    const days = daysBetween(newTask.dueDate || todayCalendarDate(), eventDate);
    const created: TimelineTask = {
      id: `task-custom-${Date.now()}`,
      title: newTask.title.trim(),
      phase: newTask.phase.trim() || 'Custom tasks',
      daysBeforeEvent: days !== null && days >= 0 ? days : 0,
      priority: newTask.priority,
      status: 'not_started',
      dueDate: newTask.dueDate || undefined,
    };

    onUpdate(sortTasks([...tasks, created]));
    setNewTask({ title: '', phase: '', dueDate: todayCalendarDate(), priority: 'medium' });
    setShowAddTask(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card card-body">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="section-title">📋 Preparation Timeline</h3>
            <p className="text-sm text-slate-500">
              Deadlines are calculated from the event date. Dates are calendar dates, not times.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAddTask((open) => !open)}
              className="btn btn-secondary btn-sm"
              aria-expanded={showAddTask}
            >
              + Add task
            </button>
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="btn btn-ghost btn-sm"
                aria-label="Regenerate timeline"
              >
                {isRegenerating ? <span className="spinner" aria-hidden="true" /> : '🔄'} Regenerate
              </button>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-medium text-slate-600">
              {progress.completed} of {progress.total} tasks completed
            </span>
            <span className="font-bold text-indigo-700">{progress.percentage}%</span>
          </div>
          <div
            className="progress-bar"
            role="progressbar"
            aria-valuenow={progress.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Preparation progress: ${progress.percentage}% complete`}
          >
            <div className="progress-bar-fill" style={{ width: `${progress.percentage}%` }} />
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
            <span>✅ {progress.completed} completed</span>
            <span>🔵 {progress.inProgress} in progress</span>
            <span>⬜ {progress.notStarted} not started</span>
            {progress.overdue > 0 && (
              <span className="font-semibold text-red-700" role="status">
                ⏰ {progress.overdue} overdue
              </span>
            )}
          </div>
        </div>

        {dependencyWarnings.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3" role="alert">
            <p className="text-sm font-semibold text-amber-900">Scheduling warnings</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-amber-800">
              {dependencyWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {showAddTask && (
          <div className="p-4 bg-indigo-50 rounded-lg mb-4 animate-fade-in">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label htmlFor="newTaskTitle" className="label">Task name</label>
                <input
                  type="text"
                  id="newTaskTitle"
                  className="input-field"
                  value={newTask.title}
                  onChange={(event) => setNewTask({ ...newTask, title: event.target.value })}
                  placeholder="Enter task name"
                  maxLength={200}
                />
              </div>
              <div>
                <label htmlFor="newTaskPhase" className="label">Phase</label>
                <input
                  type="text"
                  id="newTaskPhase"
                  className="input-field"
                  value={newTask.phase}
                  onChange={(event) => setNewTask({ ...newTask, phase: event.target.value })}
                  placeholder="e.g. Final week"
                  maxLength={100}
                />
              </div>
              <div>
                <label htmlFor="newTaskDue" className="label">Due date</label>
                <input
                  type="date"
                  id="newTaskDue"
                  className="input-field"
                  value={newTask.dueDate}
                  onChange={(event) => setNewTask({ ...newTask, dueDate: event.target.value })}
                  max={eventDate}
                />
              </div>
              <div>
                <label htmlFor="newTaskPriority" className="label">Priority</label>
                <select
                  id="newTaskPriority"
                  className="input-field"
                  value={newTask.priority}
                  onChange={(event) =>
                    setNewTask({ ...newTask, priority: event.target.value as TimelineTask['priority'] })
                  }
                >
                  {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={handleAddTask}
                className="btn btn-primary btn-sm"
                disabled={!newTask.title.trim()}
              >
                Add task
              </button>
              <button type="button" onClick={() => setShowAddTask(false)} className="btn btn-ghost btn-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {Array.from(phaseGroups.entries()).map(([phase, phaseTasks]) => {
        const phaseProgress = calculateProgress(phaseTasks);
        const isExpanded = expandedPhase === null || expandedPhase === phase;
        const panelId = `phase-${phase.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;

        return (
          <div key={phase} className="card">
            <button
              type="button"
              onClick={() => setExpandedPhase(isExpanded && expandedPhase !== null ? null : phase)}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors rounded-t-xl"
              aria-expanded={isExpanded}
              aria-controls={panelId}
            >
              <div className="flex flex-wrap items-center gap-3">
                <h4 className="font-semibold text-slate-800">{phase}</h4>
                <span className="badge badge-primary">{phaseTasks.length} tasks</span>
                {phaseProgress.percentage === 100 && <span className="badge badge-success">✓ Complete</span>}
              </div>
              <span className="text-slate-500 text-sm">{phaseProgress.percentage}%</span>
            </button>

            {isExpanded && (
              <div id={panelId} className="px-6 pb-4 space-y-2">
                {phaseTasks.map((task) => {
                  const overdue = isTaskOverdue(task);
                  return (
                    <div
                      key={task.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        task.status === 'completed'
                          ? 'bg-green-50 border-green-200'
                          : overdue
                            ? 'bg-red-50 border-red-200'
                            : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5">
                          <label htmlFor={`status-${task.id}`} className="sr-only">
                            Status for {task.title}
                          </label>
                          <select
                            id={`status-${task.id}`}
                            value={task.status}
                            onChange={(event) =>
                              handleStatusChange(task.id, event.target.value as TimelineTask['status'])
                            }
                            className="text-xs border rounded px-1 py-1"
                          >
                            {Object.entries(STATUS_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                              {task.title}
                            </span>
                            <span className={`badge ${
                              task.priority === 'critical' ? 'badge-danger' :
                              task.priority === 'high' ? 'badge-warning' :
                              task.priority === 'medium' ? 'badge-info' : 'badge-primary'
                            }`}>
                              {PRIORITY_LABEL[task.priority]}
                            </span>
                            {overdue && (
                              <span className="badge badge-danger" role="status">⏰ Overdue</span>
                            )}
                            {task.status === 'in_progress' && (
                              <span className="badge badge-info">In progress</span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-slate-600 mt-0.5">{task.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                            {task.dueDate ? (
                              <span>📅 Due <time dateTime={task.dueDate}>{task.dueDate}</time></span>
                            ) : (
                              <span>📅 No due date</span>
                            )}
                            {task.assignee && <span>👤 {task.assignee}</span>}
                          </div>
                          {task.notes && (
                            <p className="mt-1 text-xs text-slate-500 italic">{task.notes}</p>
                          )}
                        </div>

                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(task)}
                            className="text-slate-500 hover:text-indigo-700 p-1"
                            aria-label={`Edit ${task.title}`}
                            aria-expanded={editingTaskId === task.id}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(task.id)}
                            className="text-slate-500 hover:text-red-700 p-1"
                            aria-label={`Delete ${task.title}`}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {editingTaskId === task.id && draft && (
                        <div className="mt-3 pt-3 border-t border-slate-200 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label htmlFor={`title-${task.id}`} className="label">Title</label>
                            <input
                              id={`title-${task.id}`}
                              type="text"
                              className="input-field"
                              value={draft.title}
                              maxLength={200}
                              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                            />
                          </div>
                          <div>
                            <label htmlFor={`phase-${task.id}`} className="label">Phase</label>
                            <input
                              id={`phase-${task.id}`}
                              type="text"
                              className="input-field"
                              value={draft.phase}
                              maxLength={100}
                              onChange={(event) => setDraft({ ...draft, phase: event.target.value })}
                            />
                          </div>
                          <div>
                            <label htmlFor={`due-${task.id}`} className="label">Due date</label>
                            <input
                              id={`due-${task.id}`}
                              type="date"
                              className="input-field"
                              value={draft.dueDate}
                              max={eventDate}
                              onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
                            />
                          </div>
                          <div>
                            <label htmlFor={`priority-${task.id}`} className="label">Priority</label>
                            <select
                              id={`priority-${task.id}`}
                              className="input-field"
                              value={draft.priority}
                              onChange={(event) =>
                                setDraft({ ...draft, priority: event.target.value as TimelineTask['priority'] })
                              }
                            >
                              {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`assignee-${task.id}`} className="label">Owner (optional)</label>
                            <input
                              id={`assignee-${task.id}`}
                              type="text"
                              className="input-field"
                              value={draft.assignee}
                              maxLength={100}
                              onChange={(event) => setDraft({ ...draft, assignee: event.target.value })}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label htmlFor={`task-notes-${task.id}`} className="label">Notes</label>
                            <textarea
                              id={`task-notes-${task.id}`}
                              className="input-field text-sm"
                              rows={2}
                              value={draft.notes}
                              maxLength={500}
                              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                            />
                          </div>
                          <div className="sm:col-span-2 flex gap-2">
                            <button type="button" onClick={saveEdit} className="btn btn-primary btn-sm">
                              Save changes
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingTaskId(null); setDraft(null); }}
                              className="btn btn-ghost btn-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
