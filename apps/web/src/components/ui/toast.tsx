'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  tone: Tone;
  message: string;
  action?: { label: string; href: string };
}

interface ToastContextValue {
  notify: (message: string, options?: { tone?: Tone; action?: Toast['action'] }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const TOAST_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const notify = useCallback<ToastContextValue['notify']>((message, options) => {
    counter.current += 1;
    const id = counter.current;
    setToasts((list) => [
      ...list,
      { id, tone: options?.tone ?? 'success', message, action: options?.action },
    ]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), TOAST_MS);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg',
              toast.tone === 'success' && 'bg-green-700',
              toast.tone === 'error' && 'bg-accent-600',
              toast.tone === 'info' && 'bg-ink',
            )}
          >
            <span>{toast.message}</span>
            {toast.action ? (
              <a href={toast.action.href} className="font-bold underline">
                {toast.action.label}
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
