/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import EventWizard from '@/components/EventWizard';
import { futureDate } from '../fixtures/ai-plan';

function selectWedding() {
  fireEvent.click(screen.getByRole('button', { name: /Wedding/i }));
}

function fillDetails() {
  fireEvent.change(screen.getByLabelText(/Event Date/i), {
    target: { value: futureDate(120) },
  });
  fireEvent.change(screen.getByLabelText(/Location/i), {
    target: { value: 'Mumbai' },
  });
  fireEvent.change(screen.getByLabelText(/Total Budget/i), {
    target: { value: '5000' },
  });
  fireEvent.change(screen.getByLabelText(/Guest Count/i), {
    target: { value: '50' },
  });
}

describe('EventWizard', () => {
  it('blocks progression until an event type is chosen', () => {
    const onSubmit = jest.fn();
    render(<EventWizard onSubmit={onSubmit} isLoading={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/select an event type/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('validates required details and rejects a past date', () => {
    render(<EventWizard onSubmit={jest.fn()} isLoading={false} />);

    selectWedding();
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(screen.getByText('Event date is required')).toBeInTheDocument();
    expect(screen.getByText('Location is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid budget amount')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid guest count')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Event Date/i), {
      target: { value: '2020-01-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(screen.getByText(/Past events cannot be planned/i)).toBeInTheDocument();
  });

  it('submits a schema-valid payload with defaults applied', () => {
    const onSubmit = jest.fn();
    render(<EventWizard onSubmit={onSubmit} isLoading={false} />);

    selectWedding();
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    fillDetails();
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Generate My Plan/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.category).toBe('wedding');
    expect(payload.location).toBe('Mumbai');
    expect(payload.totalBudget).toBe(5000);
    expect(payload.guestCount).toBe(50);
    expect(Array.isArray(payload.dietaryRequirements)).toBe(true);
    expect(payload.currency).toBeTruthy();
  });

  it('loads existing values in edit mode', () => {
    render(
      <EventWizard
        onSubmit={jest.fn()}
        isLoading={false}
        editing
        initialData={{
          category: 'wedding',
          eventDate: futureDate(90),
          location: 'Pune',
          currency: 'INR',
          totalBudget: 250_000,
          guestCount: 80,
        }}
      />
    );

    expect(screen.getByRole('button', { name: /Wedding/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});

