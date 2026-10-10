/**
 * Toast bus (src/lib/toast-bus.ts, screen 27).
 *
 * Mutations live in React Query callbacks, so they raise the toast through this
 * bus instead of holding a component reference. The properties that matter are
 * that every subscriber hears an event and that unsubscribing really stops
 * delivery — a leaked listener would raise a toast on an unmounted screen.
 */

import { toastBus, type ToastEvent } from '../toast-bus';

describe('toastBus', () => {
  it('delivers an event to every subscriber', () => {
    const first: ToastEvent[] = [];
    const second: ToastEvent[] = [];
    const offFirst = toastBus.subscribe((event) => first.push(event));
    const offSecond = toastBus.subscribe((event) => second.push(event));

    toastBus.show('Ficus watered');
    offFirst();
    offSecond();

    expect(first).toEqual([{ message: 'Ficus watered', variant: 'success' }]);
    expect(second).toEqual([{ message: 'Ficus watered', variant: 'success' }]);
  });

  it('stops delivery after unsubscribe, and only for that subscriber', () => {
    const kept: ToastEvent[] = [];
    const dropped: ToastEvent[] = [];
    const offDropped = toastBus.subscribe((event) => dropped.push(event));
    const offKept = toastBus.subscribe((event) => kept.push(event));

    offDropped();
    toastBus.show('Ficus watered');
    offKept();

    expect(dropped).toEqual([]);
    expect(kept).toHaveLength(1);
  });

  it('marks failures as errors so the toast does not look like a success', () => {
    const events: ToastEvent[] = [];
    const off = toastBus.subscribe((event) => events.push(event));

    toastBus.error('Could not reach LeafCare');
    toastBus.show('Saved', 'info');
    off();

    expect(events).toEqual([
      { message: 'Could not reach LeafCare', variant: 'error' },
      { message: 'Saved', variant: 'info' },
    ]);
  });

  it('publishes with no subscribers without throwing', () => {
    expect(() => toastBus.show('Ficus watered')).not.toThrow();
  });
});
