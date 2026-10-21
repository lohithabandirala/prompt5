/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import ConfirmDialog from '@/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('exposes modal semantics and focuses the safe action', () => {
    render(
      <ConfirmDialog
        open
        title="Delete this plan?"
        description="This cannot be undone."
        confirmLabel="Delete plan"
        destructive
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Delete this plan?');
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = jest.fn();
    render(
      <ConfirmDialog
        open
        title="Delete this plan?"
        description="This cannot be undone."
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('confirms only when the destructive button is clicked', () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmDialog
        open
        title="Delete this plan?"
        description="This cannot be undone."
        confirmLabel="Delete plan"
        destructive
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete plan' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the previously focused element on close', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open';
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <ConfirmDialog
        open
        title="Delete this plan?"
        description="This cannot be undone."
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    rerender(
      <ConfirmDialog
        open={false}
        title="Delete this plan?"
        description="This cannot be undone."
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Hidden"
        description="Hidden"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
