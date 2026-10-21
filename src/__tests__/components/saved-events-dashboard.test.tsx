/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import SavedEventsDashboard from '@/components/SavedEventsDashboard';
import { buildPlanFromAI } from '@/lib/plan/build-plan';
import type { SavedEvent } from '@/lib/schemas/event-plan';
import { futureDate, validAIPlan, validInput } from '../fixtures/ai-plan';

function savedEvent(overrides: Partial<SavedEvent> = {}): SavedEvent {
  const input = validInput({ eventDate: futureDate(30) });
  const plan = buildPlanFromAI(validAIPlan(), input);
  return {
    id: 'event-1',
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    input,
    plan,
    ...overrides,
  };
}

describe('SavedEventsDashboard', () => {
  it('shows a clear empty state with a create action', () => {
    const onCreateNew = jest.fn();
    render(
      <SavedEventsDashboard
        plans={[]}
        onLoad={jest.fn()}
        onRequestDelete={jest.fn()}
        onCreateNew={onCreateNew}
      />
    );

    expect(screen.getByText(/Plan your next celebration/i)).toBeInTheDocument();
    expect(screen.getByText(/No account needed/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Create your first event/i }));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it('requests deletion rather than deleting immediately', () => {
    const onRequestDelete = jest.fn();
    render(
      <SavedEventsDashboard
        plans={[savedEvent()]}
        onLoad={jest.fn()}
        onRequestDelete={onRequestDelete}
        onCreateNew={jest.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Delete A Garden Romance Wedding/i })
    );

    expect(onRequestDelete).toHaveBeenCalledWith('event-1');
  });

  it('loads a saved plan', () => {
    const onLoad = jest.fn();
    const plan = savedEvent();
    render(
      <SavedEventsDashboard
        plans={[plan]}
        onLoad={onLoad}
        onRequestDelete={jest.fn()}
        onCreateNew={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Open plan/i }));
    expect(onLoad).toHaveBeenCalledWith(plan);
  });

  it('searches by location and reports no matches', () => {
    render(
      <SavedEventsDashboard
        plans={[savedEvent()]}
        onLoad={jest.fn()}
        onRequestDelete={jest.fn()}
        onCreateNew={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/Search saved events/i), {
      target: { value: 'Atlantis' },
    });

    expect(screen.getByText(/No events match your search/i)).toBeInTheDocument();
  });

  it('flags past events without timezone drift', () => {
    const event = savedEvent({
      input: validInput({ eventDate: '2020-01-01' }),
    });

    render(
      <SavedEventsDashboard
        plans={[event]}
        onLoad={jest.fn()}
        onRequestDelete={jest.fn()}
        onCreateNew={jest.fn()}
      />
    );

    expect(screen.getByText('Past')).toBeInTheDocument();
  });
});
