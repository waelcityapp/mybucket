import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, Info, X } from 'lucide-react';
import type { Language } from '../types';

type NoticeTone = 'info' | 'warning';
type Notice = { message: string; lang: Language; tone: NoticeTone };
type ShowNotice = (message: string | null, lang: Language, tone?: NoticeTone) => void;

const AppNoticeContext = createContext<ShowNotice>(() => {});

export function AppNoticeDialog({ message, lang, tone = 'info', onClose, children }: Omit<Notice, 'tone'> & {
  tone?: NoticeTone;
  onClose: () => void;
  children?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const messageId = useId();
  const ar = lang === 'ar';
  const Icon = tone === 'warning' ? CircleAlert : Info;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-label={ar ? 'إشعار' : 'Notification'}
      aria-describedby={messageId}
      dir={ar ? 'rtl' : 'ltr'}
      onCancel={event => event.preventDefault()}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl backdrop:bg-slate-950/40"
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className={`mt-3 size-5 shrink-0 ${tone === 'warning' ? 'text-rose-700' : 'text-slate-600'}`} />
        <p id={messageId} className="min-w-0 flex-1 break-words py-2.5 text-sm font-bold leading-6">{message}</p>
        <button type="button" autoFocus onClick={onClose} aria-label={ar ? 'إغلاق الإشعار' : 'Close notification'}
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-700">
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function AppNoticeProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const showNotice = useCallback<ShowNotice>((message, lang, tone = 'info') => {
    setNotices(current => {
      if (message === null) return [];
      if (current.some(notice => notice.message === message && notice.lang === lang)) return current;
      return [...current, { message, lang, tone }];
    });
  }, []);
  const notice = notices[0];
  return (
    <AppNoticeContext.Provider value={showNotice}>
      {children}
      {notice && <AppNoticeDialog key={notice.message} {...notice} onClose={() => setNotices(current => current.slice(1))} />}
    </AppNoticeContext.Provider>
  );
}

export function useAppNotice() {
  return useContext(AppNoticeContext);
}
