const preferenceKey = 'mybucket_startup_sound';

export function isStartupSoundEnabled(): boolean {
  try {
    return localStorage.getItem(preferenceKey) === 'on';
  } catch {
    return false;
  }
}

export function saveStartupSoundPreference(enabled: boolean): boolean {
  try {
    localStorage.setItem(preferenceKey, enabled ? 'on' : 'off');
    return true;
  } catch {
    return false;
  }
}

export function startStartupSound(): void {
  if (!isStartupSoundEnabled()) return;

  const playOnFirstClick = (event: MouseEvent) => {
    if (!event.isTrusted || !document.getElementById('root')?.contains(event.target as Node)) return;
    window.removeEventListener('click', playOnFirstClick);
    if (!isStartupSoundEnabled()) return;
    const chime = new Audio('/audio/mybucket-startup.mp3');
    void chime.play().catch(() => {
      // Autoplay restrictions or unavailable audio never block the app.
    });
  };

  window.addEventListener('click', playOnFirstClick);
}
