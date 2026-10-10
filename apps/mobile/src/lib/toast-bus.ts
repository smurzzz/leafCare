/**
 * Toast bus (screen 27).
 *
 * Mutations live in React Query callbacks, so they need a way to raise the
 * dark-green toast without holding a component reference. The provider
 * subscribes; everything else publishes.
 */

export type ToastVariant = 'success' | 'error' | 'info';

export type ToastEvent = {
  message: string;
  variant: ToastVariant;
};

type Listener = (event: ToastEvent) => void;

const listeners = new Set<Listener>();

export const toastBus = {
  show(message: string, variant: ToastVariant = 'success'): void {
    for (const listener of listeners) listener({ message, variant });
  },
  error(message: string): void {
    toastBus.show(message, 'error');
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
