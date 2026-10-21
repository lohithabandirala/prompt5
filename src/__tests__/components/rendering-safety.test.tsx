/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';
import EventOverview from '@/components/EventOverview';
import RunSheet from '@/components/RunSheet';
import { buildPlanFromAI } from '@/lib/plan/build-plan';
import { validAIPlan, validInput } from '../fixtures/ai-plan';

const XSS = '<script>alert("pwned")</script><img src=x onerror=alert(1)>';

describe('safe rendering of AI and user content', () => {
  it('renders markup from a plan as inert text', () => {
    const input = validInput();
    const plan = buildPlanFromAI(validAIPlan(), input);
    plan.eventName = XSS;

    const { container } = render(<EventOverview plan={plan} input={input} />);

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain(XSS);
  });

  it('renders malicious run-sheet descriptions as inert text', () => {
    const input = validInput();
    const { container } = render(
      <RunSheet
        entries={[
          {
            id: 'entry-1',
            time: '15:00',
            activity: XSS,
            notes: XSS,
            location: XSS,
            responsible: XSS,
          },
        ]}
        eventDate={input.eventDate}
        eventName={XSS}
        onUpdate={() => undefined}
      />
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain(XSS);
  });
});
