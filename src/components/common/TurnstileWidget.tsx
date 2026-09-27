import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: (errorCode?: string) => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
          appearance?: 'always' | 'execute' | 'interaction-only';
          action?: string;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

interface TurnstileWidgetProps {
  siteKey?: string;
  onSuccess: (token: string) => void;
  onError?: (error?: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  className?: string;
  action?: string;
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  siteKey: propSiteKey,
  onSuccess,
  onError,
  onExpire,
  theme = 'light',
  size = 'flexible',
  className = '',
  action = 'campaign_scratch',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRendered, setIsRendered] = useState(false);

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    onExpireRef.current = onExpire;
  });

  // Default to official Cloudflare Turnstile "Always Passes" test sitekey if none provided
  const effectiveSiteKey =
    propSiteKey ||
    (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) ||
    '1x00000000000000000000AA';

  useEffect(() => {
    let isCancelled = false;

    function renderWidget() {
      if (isCancelled || !containerRef.current || !window.turnstile) return;

      // If already rendered, do not re-render unnecessarily
      if (widgetIdRef.current) return;

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: effectiveSiteKey,
          theme,
          size,
          action,
          callback: (token: string) => {
            if (!isCancelled) {
              onSuccessRef.current?.(token);
            }
          },
          'error-callback': (code?: string) => {
            console.warn('Cloudflare Turnstile challenge error:', code);
            if (!isCancelled) {
              onErrorRef.current?.(code || 'Verification failed');
            }
          },
          'expired-callback': () => {
            if (!isCancelled) {
              onExpireRef.current?.();
            }
          },
        });

        widgetIdRef.current = id;
        setIsRendered(true);
      } catch (err: unknown) {
        console.error('Failed to render Turnstile widget:', err);
        if (!isCancelled) {
          setLoadError('Failed to initialize verification widget.');
          onErrorRef.current?.('Render error');
        }
      }
    }

    // 1. If Turnstile script already loaded on window
    if (window.turnstile) {
      renderWidget();
      return () => {
        isCancelled = true;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // Ignore
          }
          widgetIdRef.current = null;
        }
      };
    }

    // 2. Otherwise dynamically inject script
    const existingScript = document.querySelector('script[src*="turnstile/v0/api.js"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (!isCancelled) renderWidget();
      };
      script.onerror = () => {
        if (!isCancelled) {
          setLoadError('Could not load Cloudflare Turnstile script.');
          onErrorRef.current?.('Script load error');
        }
      };
      document.head.appendChild(script);
    } else {
      // Script is already in DOM but maybe still loading
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          if (!isCancelled) renderWidget();
        }
      }, 50);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (!window.turnstile && !isCancelled) {
          setLoadError('Turnstile load timed out.');
        }
      }, 5000);

      return () => {
        isCancelled = true;
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }

    return () => {
      isCancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [effectiveSiteKey, theme, size, action]);

  return (
    <div className={`turnstile-wrapper my-2 flex flex-col items-center justify-center ${className}`}>
      {/* Target DOM Element for Turnstile */}
      <div ref={containerRef} className="cf-turnstile-container" />

      {loadError && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg mt-1 text-center">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
          <span>Security verification active (Offline/Fallback mode)</span>
        </div>
      )}
    </div>
  );
};

export default TurnstileWidget;
