import { useEffect, useRef, useState } from 'react';
import { adVideoPlays, DAILY_AD_VIDEO_PLAYS, nextCairoVideoDay, takeAdVideoPlay } from '../utils/adVideoQuota';

type Props = { src: string; poster?: string; label: string; className?: string; adId?: string; lang?: 'ar' | 'en' };

/** User-initiated playback; pause when off-screen or when the page is hidden. */
export function AdVideoPlayer({ src, poster, label, className, adId, lang = 'ar' }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!adId) { setRemaining(null); setMessage(''); return; }
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      try {
        const left = DAILY_AD_VIDEO_PLAYS - adVideoPlays(localStorage, adId);
        setRemaining(left);
        if (left > 0) setMessage('');
        timer = window.setTimeout(refresh, Math.max(1, nextCairoVideoDay() - Date.now() + 50));
      } catch { setRemaining(0); }
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith(`mybucket_ad_video_${encodeURIComponent(adId)}_`)) refresh();
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.clearTimeout(timer); window.removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', onVisibility); };
  }, [adId]);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const pauseWhenHidden = () => { if (document.visibilityState !== 'visible') video.pause(); };
    const pauseWhenOffscreen = () => {
      const rect = video.getBoundingClientRect();
      const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      if (rect.height <= 0 || rect.width <= 0 || (height * width) / (rect.height * rect.width) < 0.5) video.pause();
    };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    window.addEventListener('scroll', pauseWhenOffscreen, { passive: true });
    window.addEventListener('resize', pauseWhenOffscreen);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      const current = entries.find(entry => entry.target === video);
      if (current && (!current.isIntersecting || current.intersectionRatio < 0.5)) video.pause();
    }, { threshold: [0, 0.5] });
    observer?.observe(video);
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', pauseWhenHidden); window.removeEventListener('scroll', pauseWhenOffscreen); window.removeEventListener('resize', pauseWhenOffscreen); video.pause(); };
  }, [src]);
  const onPlay = () => {
    const video = ref.current;
    if (!video) return;
    if (document.visibilityState !== 'visible') { video.pause(); return; }
    if (!adId) return;
    try {
      const count = adVideoPlays(localStorage, adId);
      if (count >= DAILY_AD_VIDEO_PLAYS) {
        video.pause(); setRemaining(0);
        setMessage(lang === 'ar' ? 'وصلت للحد اليومي لتشغيل الفيديو. تقدر تشوفه تاني بكرة.' : 'Daily video play limit reached. You can watch again tomorrow.');
        return;
      }
      setRemaining(takeAdVideoPlay(localStorage, adId)); setMessage('');
    } catch {
      video.pause(); setRemaining(0);
      setMessage(lang === 'ar' ? 'تعذر التحقق من عدد مرات التشغيل على الجهاز.' : 'Could not check the daily play limit on this browser.');
    }
  };
  return <div>
    <video ref={ref} src={src} poster={poster} aria-label={label} controls playsInline preload="none" className={className} onPlay={onPlay} />
    {adId && remaining !== null && <p className="mt-1 text-xs text-slate-600">{lang === 'ar' ? `مرات التشغيل المتبقية اليوم: ${remaining}` : `Plays remaining today: ${remaining}`}</p>}
    {message && <p role="status" className="mt-1 text-xs font-bold text-amber-800">{message}</p>}
  </div>;
}
