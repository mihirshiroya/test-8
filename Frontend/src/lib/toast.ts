/**
 * Global toast utility — renders every toast through the app's custom
 * `AppToast` component (via Sonner's `toast.custom`) so all toasts share
 * the same look, countdown, and behaviour automatically.
 *
 * Usage:
 *   import { toast } from '../lib/toast';
 *   toast.success('Saved!', { description: 'Your changes are live.' });
 *   toast.success('Changes saved', { action: { label: 'Undo', onClick: undo } });
 *   toast.error('Sign in failed', { description: 'Incorrect email or password.' });
 *   toast.apiError(error, 'Could not save changes');
 *
 * Toasts are de-duplicated: identical type + title + description collapse
 * into a single toast, so a global interceptor and a page-level handler
 * reporting the same failure never stack two copies.
 */

import { createElement, type ReactNode } from 'react';
import { toast as sonnerToast } from 'sonner';
import { AppToast, type AppToastAction, type AppToastType } from '../components/Ui/app-toast';

export interface ToastOptions {
  id?: string | number;
  description?: ReactNode;
  /** Auto-close delay in ms. Use `Infinity` to keep it open. */
  duration?: number;
  action?: AppToastAction;
  /** Show the "This message will close in N seconds" footer. */
  showCountdown?: boolean;
  onDismiss?: () => void;
}

const DEFAULT_DURATION: Record<AppToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 5000,
  error: 6000,
  loading: Infinity,
};

const makeId = (type: string, message: string, options?: ToastOptions) => {
  const description = typeof options?.description === 'string' ? options.description : '';
  return `${type}:${message}:${description}`;
};

let customIdCounter = 0;

const show = (type: AppToastType, message: ReactNode, options: ToastOptions = {}) => {
  const id =
    options.id ??
    (typeof message === 'string' && type !== 'loading' ? makeId(type, message, options) : `toast-${++customIdCounter}`);
  const duration = options.duration ?? DEFAULT_DURATION[type];
  const showCountdown = options.showCountdown ?? (Boolean(options.action) || type === 'success');

  return sonnerToast.custom(
    (toastId) =>
      createElement(AppToast, {
        // Re-mount when an existing toast id is reused (e.g. loading → success) so the timer restarts.
        key: `${type}:${String(message)}`,
        type,
        title: message,
        description: options.description,
        action: options.action,
        duration,
        showCountdown,
        onDismiss: () => {
          sonnerToast.dismiss(toastId);
          options.onDismiss?.();
        },
      }),
    { id, duration: Infinity, unstyled: true },
  );
};

/** Turns any thrown value (axios error, Error, string) into a user-friendly message. */
export const getErrorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  const err = error as any;
  const serverMessage = err?.response?.data?.message;
  if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;

  if (err?.response) {
    switch (err.response.status) {
      case 400:
      case 422:
        return 'Some of the information provided is invalid. Please review it and try again.';
      case 401:
        return 'Your session has expired. Please sign in again.';
      case 403:
        return "You don't have permission to do that.";
      case 404:
        return "We couldn't find what you were looking for.";
      case 409:
        return 'This conflicts with existing data. Please check and try again.';
      case 429:
        return 'Too many attempts. Please wait a moment and try again.';
      default:
        if (err.response.status >= 500) {
          return 'Something went wrong on our side. Please try again shortly.';
        }
    }
  }

  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (err?.request || err?.code === 'ERR_NETWORK') {
    return "Can't reach the server. Check your internet connection and try again.";
  }

  return (typeof err?.message === 'string' && err.message) || fallback;
};

export const toast = {
  success: (message: string, options?: ToastOptions) => show('success', message, options),

  error: (message: string, options?: ToastOptions) => show('error', message, options),

  info: (message: string, options?: ToastOptions) => show('info', message, options),

  warning: (message: string, options?: ToastOptions) => show('warning', message, options),

  loading: (message: string, options?: ToastOptions) => show('loading', message, options),

  /** Shows an error toast: `title` as heading, the extracted error as the explanation. */
  apiError: (error: unknown, title = 'Something went wrong', options?: ToastOptions) =>
    toast.error(title, { description: getErrorMessage(error), ...options }),

  promise: <T>(
    promise: Promise<T>,
    msgs: { loading: string; success: string; error: string },
    options?: ToastOptions,
  ) => {
    const id = toast.loading(msgs.loading, options);
    promise.then(
      () => show('success', msgs.success, { ...options, id }),
      (error) => show('error', msgs.error, { description: getErrorMessage(error), ...options, id }),
    );
    return promise;
  },

  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};
