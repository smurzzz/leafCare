/**
 * The pull gesture's spinner.
 *
 * A `RefreshControl` keeps its spinner up until `refreshing` goes back to false,
 * so the spinner has to be owned by the promise and not by whether the screen
 * happened to re-render. The failure it prevents is a spinner that never stops:
 * a refetch that rejects (the phone is offline — exactly when someone pulls down
 * to try again) leaving the list stuck under a frozen spinner.
 *
 * `renderHook`, `rerender` and `act` are all async in this version of the testing
 * library, and every one of them is awaited: a missing `await` on `act` leaves the
 * act scope open, which silently breaks the assertions and then the next test.
 */

import { act, renderHook } from '@testing-library/react-native';

import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';

describe('usePullToRefresh', () => {
  it('spins while the refetch is running and stops when it finishes', async () => {
    let finish!: () => void;
    const refresh = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );

    const { result } = await renderHook(() => usePullToRefresh(refresh));
    expect(result.current.refreshing).toBe(false);

    await act(async () => {
      result.current.onRefresh();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      finish();
    });
    expect(result.current.refreshing).toBe(false);
  });

  it('stops spinning when the refresh fails', async () => {
    const refresh = jest.fn(async () => Promise.reject(new Error('offline')));
    const { result } = await renderHook(() => usePullToRefresh(refresh));

    await act(async () => {
      result.current.onRefresh();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(false);
  });

  // Screens pass an inline arrow function, so `onRefresh` must not stay bound to
  // the first render's closure: it would refetch through a stale screen state — a
  // plant filter that has since changed, a different care-log month.
  it('calls the newest callback after a re-render', async () => {
    const first = jest.fn(async () => undefined);
    const second = jest.fn(async () => undefined);

    const { result, rerender } = await renderHook(
      ({ refresh }: { refresh: () => Promise<unknown> }) => usePullToRefresh(refresh),
      { initialProps: { refresh: first } },
    );

    await rerender({ refresh: second });
    await act(async () => {
      result.current.onRefresh();
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
