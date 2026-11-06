'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Toasts de sucesso fecham sozinhos após este tempo se o operador não fechar (padrão Taskflow / dashboard). */
const SUCCESS_AUTO_DISMISS_MS = 3000;

export type FloatingFeedbackPayload =
  | { kind: 'success'; message: string }
  | { kind: 'error'; title?: string; message: string };

export type FloatingFeedbackContextValue = {
  show: (payload: FloatingFeedbackPayload) => void;
  showSuccess: (message: string) => void;
  showError: (message: string, title?: string) => void;
  dismiss: () => void;
};

const FloatingFeedbackContext = createContext<FloatingFeedbackContextValue | null>(null);

export function useFloatingFeedback(): FloatingFeedbackContextValue {
  const ctx = useContext(FloatingFeedbackContext);
  if (!ctx) {
    throw new Error('useFloatingFeedback deve ser usado dentro de FloatingFeedbackProvider (layout do dashboard).');
  }
  return ctx;
}

export function FloatingFeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<FloatingFeedbackPayload | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFeedback(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [feedback]);

  useEffect(() => {
    if (!feedback || feedback.kind !== 'success') return;
    const t = window.setTimeout(() => setFeedback(null), SUCCESS_AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const dismiss = useCallback(() => setFeedback(null), []);

  const value = useMemo<FloatingFeedbackContextValue>(
    () => ({
      show: setFeedback,
      showSuccess: (message) => setFeedback({ kind: 'success', message }),
      showError: (message, title) =>
        setFeedback({ kind: 'error', message, ...(title ? { title } : {}) }),
      dismiss,
    }),
    [dismiss],
  );

  const portal =
    mounted && feedback
      ? createPortal(
          <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            role="presentation"
            onClick={() => setFeedback(null)}
          >
            <div
              role="status"
              aria-live="polite"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'flex max-h-[min(85dvh,28rem)] w-full max-w-lg animate-in gap-3 overflow-y-auto rounded-2xl border p-4 shadow-2xl duration-200 fade-in zoom-in-95',
                feedback.kind === 'success' &&
                  'border-emerald-200/90 bg-emerald-50/98 text-emerald-950 backdrop-blur-md dark:border-emerald-700/50 dark:bg-emerald-950/92 dark:text-emerald-50',
                feedback.kind === 'error' &&
                  (feedback.title
                    ? 'border-amber-200/95 bg-amber-50/98 text-amber-950 backdrop-blur-md dark:border-amber-700/50 dark:bg-amber-950/92 dark:text-amber-50'
                    : 'border-rose-200/95 bg-rose-50/98 text-rose-950 backdrop-blur-md dark:border-rose-800/50 dark:bg-rose-950/92 dark:text-rose-50'),
              )}
            >
              {feedback.kind === 'success' ? (
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
              ) : (
                <AlertCircle
                  className={cn(
                    'mt-0.5 h-5 w-5 shrink-0',
                    feedback.title
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400',
                  )}
                  aria-hidden
                />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                {feedback.kind === 'error' && feedback.title ? (
                  <p className="text-sm font-semibold leading-snug tracking-tight">{feedback.title}</p>
                ) : null}
                <p className="text-xs leading-relaxed sm:text-sm">{feedback.message}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full opacity-80 hover:opacity-100"
                onClick={() => setFeedback(null)}
                aria-label="Fechar aviso"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <FloatingFeedbackContext.Provider value={value}>
      {children}
      {portal}
    </FloatingFeedbackContext.Provider>
  );
}
