import { create } from 'zustand';
import { sanitizeUserMessage } from './errors/userError';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

interface NotificationStore {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

/**
 * Error/warning toasts are a single choke-point for text that originates from
 * services and servers. Anything technical (Firebase codes, HTTP errors, stack
 * text, ids) is replaced with safe copy here, so no call site can leak it.
 * Human-written business messages pass through unchanged.
 */
function toSafeToast(toast: Omit<ToastMessage, 'id'>): Omit<ToastMessage, 'id'> {
  if (toast.type !== 'error' && toast.type !== 'warning') return toast;
  return {
    ...toast,
    title: sanitizeUserMessage(toast.title, { source: 'toast.title' }),
    message: sanitizeUserMessage(toast.message, { source: 'toast.message' }),
  };
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    const safe = toSafeToast(toast);
    set((state) => ({ toasts: [...state.toasts, { ...safe, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, safe.type === 'error' ? 6000 : 4000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function showToast(toast: Omit<ToastMessage, 'id'>) {
  useNotificationStore.getState().addToast(toast);
}
