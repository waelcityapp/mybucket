import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import type { Language } from '../types';
import { offerAdsRequest } from '../services/offerAdsClient';

const deviceStorage = 'mybucket.vipPush.device';
type Device = { secret: string; id?: string };
type Availability = 'checking' | 'ready' | 'unsupported' | 'unavailable';
const hex = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function readDevice(): Device | null {
  const saved = localStorage.getItem(deviceStorage);
  if (!saved) return null;
  try {
    const { id, secret } = JSON.parse(saved);
    return hex(secret) ? { secret, ...(hex(id) && { id }) } : null;
  } catch {
    return null;
  }
}

export function VipPushSettings({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const [availability, setAvailability] = useState<Availability>('checking');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (!window.isSecureContext || !('Notification' in window) || !('PushManager' in window) ||
        !('serviceWorker' in navigator) || typeof window.crypto?.getRandomValues !== 'function' || !window.crypto.subtle) {
      setAvailability('unsupported');
      return;
    }
    let mounted = true;
    const sync = async () => {
      if (lock.current) return;
      try {
        const device = readDevice();
        setPermission(Notification.permission);
        if (device?.id && Notification.permission !== 'granted') {
          await offerAdsRequest('vipPush.unsubscribe', device);
          localStorage.removeItem(deviceStorage);
          if (mounted) setActive(false);
        } else if (device?.id) {
          const { active } = await offerAdsRequest<{ active: boolean }>('vipPush.status', device);
          if (mounted) setActive(active);
        }
      } catch {
        if (mounted) setError(true);
      }
    };
    (async () => {
      try {
        const [{ isSupported }, config] = await Promise.all([
          import('firebase/messaging'),
          offerAdsRequest<{ vapidKey: string | null }>('vipPush.config'),
        ]);
        if (!await isSupported()) {
          if (mounted) setAvailability('unsupported');
          return;
        }
        if (!mounted) return;
        setVapidKey(config.vapidKey);
        setAvailability(config.vapidKey ? 'ready' : 'unavailable');
        await sync();
      } catch {
        if (mounted) setAvailability('unavailable');
      }
    })();
    window.addEventListener('focus', sync);
    return () => {
      mounted = false;
      window.removeEventListener('focus', sync);
    };
  }, []);

  async function toggle() {
    if (lock.current || (!active && !vapidKey)) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      const existing = readDevice();
      if (active && existing?.id) {
        await offerAdsRequest('vipPush.unsubscribe', existing);
        localStorage.removeItem(deviceStorage);
        setActive(false);
        // Server opt-out succeeded even if the browser cannot remove its local token.
        const { getMessaging, deleteToken } = await import('firebase/messaging');
        await deleteToken(getMessaging()).catch(() => {});
        return;
      }

      // In particular, Safari requires the permission request to run within this click.
      const result = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      setPermission(result);
      if (result !== 'granted' || !vapidKey) return;

      const { getMessaging, getToken } = await import('firebase/messaging');
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const serviceWorkerRegistration = registration.active
        ? registration
        : await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<never>((_, reject) => {
              const timeout = window.setTimeout(() => reject(new Error('push_worker_timeout')), 10000);
              void navigator.serviceWorker.ready.then(() => window.clearTimeout(timeout));
            }),
          ]);
      const secret = existing?.secret ?? Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
      const token = await getToken(getMessaging(), { vapidKey, serviceWorkerRegistration });
      if (!token) throw new Error('missing_push_token');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
      const id = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (existing?.id && existing.id !== id) await offerAdsRequest('vipPush.unsubscribe', existing);
      // Store the device key before the request so a lost response can be recovered in status.
      localStorage.setItem(deviceStorage, JSON.stringify({ id, secret }));
      await offerAdsRequest('vipPush.subscribe', { token, secret, lang });
      setActive(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  const denied = permission === 'denied';
  const available = availability === 'ready' && !denied;
  const showAction = active || available;
  return <section className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
    {active && <p role="status" className="font-bold text-emerald-900 dark:text-emerald-200">
      {ar ? 'إشعارات VIP مفعّلة' : 'VIP notifications enabled'}
    </p>}
    {showAction && <button type="button" onClick={() => void toggle()} disabled={busy}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200 px-3 font-bold text-emerald-900 disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-200">
      {active ? <BellOff className="size-4" aria-hidden="true" /> : <Bell className="size-4" aria-hidden="true" />}
      {busy ? (ar ? 'جارٍ تحديث الإشعارات…' : 'Updating notifications…')
        : active ? (ar ? 'إيقاف إشعارات VIP' : 'Turn off VIP notifications')
        : (ar ? 'فعّل إشعارات عروض VIP' : 'Enable VIP offer notifications')}
    </button>}
    {!active && !available && <p role="status" className="text-slate-700 dark:text-slate-300">
      {denied ? (ar ? 'الإذن مرفوض. اسمح بالإشعارات من إعدادات هذا الموقع في المتصفح، ثم ارجع هنا للتفعيل.' : 'Permission was blocked. Allow notifications in this site’s browser settings, then return here to enable them.')
        : availability === 'unsupported' ? (ar ? 'الجهاز أو المتصفح لا يدعم الإشعارات هنا. على iPhone أو iPad جرّب إضافة التطبيق للشاشة الرئيسية وفتحه منها.' : 'Notifications are unavailable on this device or browser. On iPhone or iPad, try adding the app to your Home Screen and opening it there.')
        : availability === 'checking' ? (ar ? 'جارٍ التحقق من دعم الإشعارات…' : 'Checking notification support…')
        : (ar ? 'إشعارات VIP غير متاحة حاليًا.' : 'VIP notifications are currently unavailable.')}
    </p>}
    {error && <p role="alert" className="text-rose-700 dark:text-rose-300">{ar ? 'تعذّر تحديث إشعارات VIP. حاول مرة أخرى.' : 'Could not update VIP notifications. Try again.'}</p>}
  </section>;
}
