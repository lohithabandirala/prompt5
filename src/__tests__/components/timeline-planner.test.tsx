/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import TimelinePlanner from '@/components/TimelinePlanner';
import type { TimelineTask } from '@/lib/schemas/event-plan';

function task(overrides: Partial<TimelineTask> = {}): TimelineTask {
  return {
    id: 'task-1',
    title: 'Book venue',
    phase: 'Early planning',
    daysBeforeEvent: 90,
    priority: 'high',
    status: 'not_started',
    dueDate: '2026-10-30',
    ...overrides,
  };
}

describe('TimelinePlanner', () => {
  it('shows overdue tasks based on the due date', () => {
    render(
      <TimelinePlanner
        tasks={[task({ dueDate: '2000-01-01' })]}
        eventDate="2030-01-01"
        onUpdate={jest.fn()}
      />
    );

    expect(screen.getByText(/1 overdue/i)).toBeInTheDocument();
  });

  it('does not mark completed tasks as overdue', () => {
    render(
      <TimelinePlanner
        tasks={[task({ dueDate: '2000-01-01', status: 'completed' })]}
        eventDate="2030-01-01"
        onUpdate={jest.fn()}
      />
    );

    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
  });

  it('updates status through an accessible labelled control', () => {
    const onUpdate = jest.fn();
    render(
      <TimelinePlanner
        tasks={[task()]}
        eventDate="2030-01-01"
        onUpdate={onUpdate}
      />
    );

    fireEvent.change(screen.getByLabelText('Status for Book venue'), {
      target: { value: 'completed' },
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect((onUpdate.mock.calls[0][0] as TimelineTask[])[0].status).toBe('completed');
  });

  it('adds a custom task with a computed due date', () => {
    const onUpdate = jest.fn();
    render(
      <TimelinePlanner
        tasks={[task()]}
        eventDate="2030-01-01"
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /\+ Add task/i }));
    fireEvent.change(screen.getByLabelText(/Task name/i), {
      target: { value: 'Order cake' },
    });
    fireEvent.change(screen.getByLabelText(/Due date/i), {
      target: { value: '2029-12-18' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

    const next = onUpdate.mock.calls[0][0] as TimelineTask[];
    const added = next.find((item) => item.title === 'Order cake');
    expect(added).toBeDefined();
    expect(added?.dueDate).toBe('2029-12-18');
  });
});
