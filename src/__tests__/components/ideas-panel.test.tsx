/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import IdeasPanel from '@/components/IdeasPanel';
import type { CelebrationIdea } from '@/lib/schemas/event-plan';
import { validInput } from '../fixtures/ai-plan';

function idea(overrides: Partial<CelebrationIdea> = {}): CelebrationIdea {
  return {
    id: 'idea-1',
    title: 'Herb favours',
    description: 'Give each household a potted herb.',
    whyItFits: 'Reusable and local.',
    estimatedCost: '8,000 INR',
    saved: false,
    ...overrides,
  };
}

const input = validInput();

describe('IdeasPanel', () => {
  it('saves an idea without mutating the original array', () => {
    const ideas = [idea(), idea({ id: 'idea-2', title: 'Family recipes' })];
    const onUpdate = jest.fn();

    render(
      <IdeasPanel
        ideas={ideas}
        input={input}
        onUpdate={onUpdate}
        onRegenerateIdeas={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save Herb favours' }));

    const next = onUpdate.mock.calls[0][0] as CelebrationIdea[];
    expect(next.find((item) => item.id === 'idea-1')?.saved).toBe(true);
    expect(next.find((item) => item.id === 'idea-2')?.saved).toBe(false);
    expect(ideas[0].saved).toBe(false);
  });

  it('unsaves a saved idea through a pressed toggle', () => {
    const onUpdate = jest.fn();
    render(
      <IdeasPanel
        ideas={[idea({ saved: true })]}
        input={input}
        onUpdate={onUpdate}
      />
    );

    const toggle = screen.getByRole('button', { name: 'Remove Herb favours from saved ideas' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(toggle);
    expect((onUpdate.mock.calls[0][0] as CelebrationIdea[])[0].saved).toBe(false);
  });

  it('discards an idea from the list', () => {
    const onUpdate = jest.fn();
    render(
      <IdeasPanel
        ideas={[idea(), idea({ id: 'idea-2', title: 'Family recipes' })]}
        input={input}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Discard Herb favours' }));

    const next = onUpdate.mock.calls[0][0] as CelebrationIdea[];
    expect(next.map((item) => item.id)).toEqual(['idea-2']);
  });

  it('filters to saved ideas only', () => {
    render(
      <IdeasPanel
        ideas={[idea({ saved: true }), idea({ id: 'idea-2', title: 'Family recipes' })]}
        input={input}
        onUpdate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Saved \(1\)/i }));

    expect(screen.getByText('Herb favours')).toBeInTheDocument();
    expect(screen.queryByText('Family recipes')).not.toBeInTheDocument();
  });

  it('disables regeneration while a request is running', () => {
    render(
      <IdeasPanel
        ideas={[idea()]}
        input={input}
        onUpdate={jest.fn()}
        onRegenerateIdeas={jest.fn()}
        isRegenerating
      />
    );

    expect(screen.getByRole('button', { name: /Regenerate celebration ideas/i })).toBeDisabled();
  });
});
