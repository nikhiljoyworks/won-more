import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Standalone global handler so toast can also be called outside React tree if needed
let globalToastHandler: ((type: ToastType, message: string, title?: string, duration?: number) => void) | null = null;

export const toast = {
  success: (message: string, title?: string, duration?: number) => {
    if (globalToastHandler) globalToastHandler('success', message, title, duration);
  },
  error: (message: string, title?: string, duration?: number) => {
    if (globalToastHandler) globalToastHandler('error', message, title, duration);
  },
  warning: (message: string, title?: string, duration?: number) => {
    if (globalToastHandler) globalToastHandler('warning', message, title, duration);
  },
  info: (message: string, title?: string, duration?: number) => {
    if (globalToastHandler) globalToastHandler('info', message, title, duration);
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastItem = { id, type, message, title, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  useEffect(() => {
    globalToastHandler = showToast;
    return () => {
      globalToastHandler = null;
    };
  }, [showToast]);

  const success = useCallback((message: string, title?: string, duration?: number) => {
    showToast('success', message, title || 'Success', duration);
  }, [showToast]);

  const error = useCallback((message: string, title?: string, duration?: number) => {
    showToast('error', message, title || 'Error', duration);
  }, [showToast]);

  const warning = useCallback((message: string, title?: string, duration?: number) => {
    showToast('warning', message, title || 'Warning', duration);
  }, [showToast]);

  const info = useCallback((message: string, title?: string, duration?: number) => {
    showToast('info', message, title || 'Notice', duration);
  }, [showToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        removeToast,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}

      {/* Classic Floating Toast Container */}
      <div
        className="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const typeStyles = {
            success: {
              border: 'border-emerald-500/30',
              bg: 'bg-white',
              accent: 'bg-emerald-500',
              text: 'text-slate-900',
              icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />,
            },
            error: {
              border: 'border-rose-500/30',
              bg: 'bg-white',
              accent: 'bg-rose-500',
              text: 'text-slate-900',
              icon: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />,
            },
            warning: {
              border: 'border-amber-500/30',
              bg: 'bg-white',
              accent: 'bg-amber-500',
              text: 'text-slate-900',
              icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />,
            },
            info: {
              border: 'border-sky-500/30',
              bg: 'bg-white',
              accent: 'bg-sky-500',
              text: 'text-slate-900',
              icon: <Info className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />,
            },
          }[t.type];

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border ${typeStyles.border} ${typeStyles.bg} shadow-xl shadow-slate-900/10 relative overflow-hidden transition-all duration-300 animate-slideInRight`}
            >
              {/* Colored left edge bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${typeStyles.accent}`} />

              {/* Icon */}
              {typeStyles.icon}

              {/* Message Body */}
              <div className="flex-1 min-w-0 pr-1">
                {t.title && (
                  <h4 className="text-xs font-bold text-slate-900 mb-0.5">
                    {t.title}
                  </h4>
                )}
                <p className="text-xs text-slate-600 font-medium leading-relaxed break-words">
                  {t.message}
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-600 p-1 -mr-1 -mt-1 rounded-lg transition"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
