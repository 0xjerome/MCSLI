import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Optional Cloudflare Turnstile bot protection for sign-up, login and password recovery.
 *
 * Inactive unless VITE_TURNSTILE_SITE_KEY is set (the site key is public). Enable it in this order:
 *   1. deploy the frontend with VITE_TURNSTILE_SITE_KEY;
 *   2. then Supabase → Authentication → Attack Protection → CAPTCHA: Turnstile + the SECRET key.
 * Turnstile is usually invisible ("managed" mode), works on mobile and needs no puzzles.
 */
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || '';
export const captchaEnabled = Boolean(TURNSTILE_SITE_KEY);

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('captcha script failed to load'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Returns the current token (undefined when captcha is off), a reset function and the widget element. */
export function useCaptcha() {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!captchaEnabled) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          appearance: 'interaction-only',
          callback: (t: string) => setToken(t),
          'expired-callback': () => setToken(undefined),
          'error-callback': () => setFailed(true),
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
    };
  }, []);

  const reset = useCallback(() => {
    setToken(undefined);
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, []);

  const widget = captchaEnabled ? (
    <div>
      <div ref={container} />
      {failed && <p className="mt-1 text-sm text-danger-700">The security check could not load. Check your connection and reload the page.</p>}
    </div>
  ) : null;

  return { token, reset, widget, ready: !captchaEnabled || Boolean(token) };
}
