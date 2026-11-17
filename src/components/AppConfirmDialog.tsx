import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import type { Language } from '../types';

export type ConfirmationOptions = {
  lang: Language;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning';
};

type ConfirmFunction = (options: ConfirmationOptions) => Promise<boolean>;
const ConfirmationContext = createContext<ConfirmFunction | null>(null);

/** App-branded, accessible confirmation instead of blocking browser confirm(). */
export function AppConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmationOptions | null>(null);
  const resolver = useRef<((result: boolean) => void) | null>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFunction>((options) => {
    // Never bypass an existing confirmation by replacing its pending action.
    if (resolver.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setRequest(options);
    });
  }, []);

  const finish = useCallback((answer: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setRequest(null);
    resolve?.(answer);
  }, []);

  useEffect(() => {
    if (!request) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Put initial focus on the safe choice (cancel), not the destructive action.
    cancelButton.current?.focus();
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('keydown', onEscape);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [request, finish]);

  useEffect(() => () => {
    resolver.current?.(false);
    resolver.current = null;
  }, []);

  const keepFocusInside = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const first = cancelButton.current;
    const last = confirmButton.current;
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const ar = request?.lang === 'ar';
  const danger = request?.tone === 'danger';

  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      {request && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-[2px]"
          dir={ar ? 'rtl' : 'ltr'}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="app-confirm-title"
            aria-describedby="app-confirm-description" onKeyDown={keepFocusInside}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start gap-3">
              <div className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ' +
                (danger ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700')}>
                {danger ? <ShieldAlert className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="app-confirm-title" className="text-base font-black text-slate-900 sm:text-lg">{request.title}</h2>
                <p id="app-confirm-description" className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{request.description}</p>
              </div>
              <button type="button" onClick={() => finish(false)}
                aria-label={ar ? 'إلغاء' : 'Cancel'}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button ref={cancelButton} type="button" onClick={() => finish(false)}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-500">
                {request.cancelLabel ?? (ar ? 'إلغاء' : 'Cancel')}
              </button>
              <button ref={confirmButton} type="button" onClick={() => finish(true)}
                className={'min-h-11 rounded-xl px-5 py-2.5 text-sm font-extrabold text-white focus-visible:outline-2 focus-visible:outline-offset-2 ' +
                  (danger ? 'bg-rose-600 hover:bg-rose-700 focus-visible:outline-rose-600' : 'bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600')}>
                {request.confirmLabel ?? (ar ? 'تأكيد' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmationContext.Provider>
  );
}

export function useAppConfirm(): ConfirmFunction {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) throw new Error('AppConfirmProvider is missing');
  return confirm;
}
